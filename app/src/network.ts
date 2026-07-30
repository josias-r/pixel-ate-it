import { gameState } from "./state";
import { updateOtherPixelTarget } from "./input";
import { hexHash } from "./cert_hash";

export let transport: WebTransport | null = null; // Use any since TypeScript DOM lib might not have WebTransport by default

export interface Move {
  seq: number;
  dir: string;
  dx: number;
  dy: number;
}

export let moveSeq = 0;
export const unackedMoves: Move[] = [];

export async function initNetwork() {
  try {
    let options = {};

    // In production, because WebTransport (UDP) is hard to reverse proxy through Traefik,
    // we use the serverCertificateHashes feature to securely connect directly to the Rust backend
    // using its self-signed certificate. The hash is dynamically injected at runtime by Docker.
    const hashBytes = new Uint8Array(
      hexHash.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );

    options = {
      serverCertificateHashes: [
        {
          algorithm: "sha-256",
          value: hashBytes,
        },
      ],
    };

    transport = new WebTransport(
      import.meta.env.DEV
        ? "https://localhost:3000/"
        : "__PUBLIC_URL_PLACEHOLDER__",
      options,
    );

    await transport.ready;
    console.log("WebTransport connected!");

    const reader = transport.datagrams.readable.getReader();
    readDatagrams(reader);

    window.addEventListener("beforeunload", () => {
      if (transport) {
        transport.close();
      }
    });
  } catch (e) {
    console.error("WebTransport connection failed:", e);
  }
}

async function readDatagrams(reader: any) {
  const decoder = new TextDecoder("utf-8");
  while (true) {
    try {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const text = decoder.decode(value);
        const msg = JSON.parse(text);
        if (msg.type === "update") {
          handleUpdate(msg.ack, msg.others);
        }
      }
    } catch (e) {
      console.error("Failed to read datagram", e);
      break;
    }
  }
}

function handleUpdate(
  ack: number,
  others: { id: string; x: number; y: number }[],
) {
  const currentIds = new Set(Object.keys(gameState.otherPixels));

  while (unackedMoves.length > 0 && unackedMoves[0].seq <= ack) {
    unackedMoves.shift();
  }

  let ux = 0;
  let uy = 0;
  for (const m of unackedMoves) {
    ux += m.dx;
    uy += m.dy;
  }

  let ax = 0;
  let ay = 0;
  if (gameState.state !== "IDLE") {
    ax = gameState.targetOffsetX;
    ay = gameState.targetOffsetY;
  }

  for (const other of others) {
    currentIds.delete(other.id);

    const localX = other.x - ux + ax;
    const localY = other.y - uy + ay;

    if (!gameState.otherPixels[other.id]) {
      // Create new pixel
      gameState.otherPixels[other.id] = {
        id: other.id,
        offsetX: localX,
        offsetY: localY,
        animOffsetX: localX,
        animOffsetY: localY,
        targetOffsetX: localX,
        targetOffsetY: localY,
        state: "IDLE",
        animationTimer: 0,
      };
    } else {
      // Update existing pixel
      updateOtherPixelTarget(other.id, localX, localY);
    }
  }

  // Remove disconnected pixels
  for (const id of currentIds) {
    delete gameState.otherPixels[id];
  }
}

let datagramWriter: WritableStreamDefaultWriter<Uint8Array> | null = null;

export function sendMove(direction: string, dx: number, dy: number) {
  if (!transport) return;
  moveSeq++;
  unackedMoves.push({ seq: moveSeq, dir: direction, dx, dy });

  const payload = unackedMoves.map((m) => ({ move: m.dir, seq: m.seq }));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({ moves: payload }));

  if (!datagramWriter) {
    try {
      datagramWriter = transport.datagrams.writable.getWriter();
    } catch (e) {
      console.error("Failed to get writer:", e);
      return;
    }
  }

  datagramWriter.write(data).catch((e) => {
    console.error("Failed to write datagram:", e);
    // If writer is broken, we should clear it so we get a new one next time
    datagramWriter = null;
  });
}
