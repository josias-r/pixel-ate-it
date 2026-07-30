import { gameState } from "./state";
import { updateOtherPixelTarget } from "./input";
import { hexHash } from "./cert_hash";

export let transport: WebTransport | null = null; // Use any since TypeScript DOM lib might not have WebTransport by default

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
          handleUpdate(msg.others);
        }
      }
    } catch (e) {
      console.error("Failed to read datagram", e);
      break;
    }
  }
}

function handleUpdate(others: { id: string; x: number; y: number }[]) {
  const currentIds = new Set(Object.keys(gameState.otherPixels));

  for (const other of others) {
    currentIds.delete(other.id);
    if (!gameState.otherPixels[other.id]) {
      // Create new pixel
      gameState.otherPixels[other.id] = {
        id: other.id,
        offsetX: other.x,
        offsetY: other.y,
        animOffsetX: other.x,
        animOffsetY: other.y,
        targetOffsetX: other.x,
        targetOffsetY: other.y,
        state: "IDLE",
        animationTimer: 0,
      };
    } else {
      // Update existing pixel
      updateOtherPixelTarget(other.id, other.x, other.y);
    }
  }

  // Remove disconnected pixels
  for (const id of currentIds) {
    delete gameState.otherPixels[id];
  }
}

export function sendMove(direction: string) {
  if (!transport) return;
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({ move: direction }));
  const writer = transport.datagrams.writable.getWriter();
  writer.write(data);
  writer.releaseLock();
}
