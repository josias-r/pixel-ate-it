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

export async function initNetwork(colorHex: string) {
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
        ? `https://localhost:3000/?color=${encodeURIComponent(colorHex)}`
        : `__PUBLIC_URL_PLACEHOLDER__?color=${encodeURIComponent(colorHex)}`,
      options,
    );

    await transport.ready;
    console.log("WebTransport connected!");

    const streamReader = transport.incomingUnidirectionalStreams.getReader();
    readIncomingStreams(streamReader);

    window.addEventListener("pagehide", () => {
      if (transport) {
        transport.close();
      }
    });
  } catch (e) {
    console.error("WebTransport connection failed:", e);
  }
}

async function readIncomingStreams(reader: any) {
  while (true) {
    try {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        handleIncomingStream(value);
      }
    } catch (e) {
      console.error("Failed to read incoming streams", e);
      break;
    }
  }
}

async function handleIncomingStream(stream: any) {
  const decoder = new TextDecoder("utf-8");
  const reader = stream.getReader();
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        text += decoder.decode(value, { stream: !done });
      }
      if (done) {
        const msg = JSON.parse(text);
        if (msg.type === "update") {
          handleUpdate(msg.ack, msg.others);
        } else if (msg.type === "eaten") {
          gameState.isGameOver = true;
          import("./ui").then(({ showGameOverScreen }) => showGameOverScreen());
        }
        break;
      }
    }
  } catch (e) {
    console.error("Error reading individual stream", e);
  }
}

function handleUpdate(
  ack: number,
  others: { id: string; x: number; y: number; color: string }[],
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
        color: other.color,
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

export function sendMove(direction: string, dx: number, dy: number) {
  if (!transport) return;
  moveSeq++;
  unackedMoves.push({ seq: moveSeq, dir: direction, dx, dy });

  const payload = unackedMoves.map((m) => ({ move: m.dir, seq: m.seq }));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({ moves: payload }));

  // Use a reliable Unidirectional Stream to bypass Datagram drops/bugs on mobile WebKit
  transport
    .createUnidirectionalStream()
    .then((stream) => {
      const writer = stream.getWriter();
      writer
        .write(data)
        .then(() => {
          writer.close().catch(console.error);
        })
        .catch((e) => {
          console.error("Failed to write stream:", e);
        });
    })
    .catch((e) => {
      console.error("Failed to create stream:", e);
    });
}
