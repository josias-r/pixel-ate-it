import { gameState } from "./state";
import { updateOtherPixelTarget } from "./input";
import { hexHash } from "./cert_hash";
import { showToast, updateLeaderboardUI } from "./ui";

export let transport: WebTransport | WebSocket | null = null;
export let isWebSocket = false;

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

    if (window.WebTransport) {
      try {
        const wtBaseUrl = import.meta.env.DEV
          ? import.meta.env.VITE_WT_URL || "https://localhost:3000/"
          : `__PUBLIC_WT_URL_PLACEHOLDER__`;

        const wtUrl = `${wtBaseUrl}?color=${encodeURIComponent(colorHex)}`;
        const wt = new WebTransport(wtUrl, options);

        await wt.ready;
        console.log("WebTransport connected!");
        transport = wt;

        const streamReader = wt.incomingUnidirectionalStreams.getReader();
        readIncomingStreams(streamReader);
      } catch (wtError) {
        console.warn(
          "WebTransport connection failed, falling back to WebSocket",
          wtError,
        );
        showToast("WebTransport unavailable. Falling back to WebSocket.");
        connectWebSocket(colorHex);
      }
    } else {
      console.warn("WebTransport not supported, falling back to WebSocket");
      showToast(
        "Please update your browser to use WebTransport for better performance.",
      );
      connectWebSocket(colorHex);
    }

    window.addEventListener("pagehide", () => {
      if (transport) {
        transport.close();
      }
    });
  } catch (e) {
    console.error("Network initialization failed:", e);
    showToast(
      "Please update your browser to use WebTransport for better performance.",
    );
    connectWebSocket(colorHex);
  }
}

function connectWebSocket(colorHex: string) {
  isWebSocket = true;

  const wsBaseUrl = import.meta.env.DEV
    ? import.meta.env.VITE_WS_URL || "ws://localhost:3001/"
    : `__PUBLIC_WS_URL_PLACEHOLDER__`;

  const wsUrl = `${wsBaseUrl}?color=${encodeURIComponent(colorHex)}`;

  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";
  transport = ws;

  ws.onopen = () => console.log("WebSocket connected!");

  ws.onerror = () => {
    showToast("Your phone is bad bro, get a new one");
  };

  ws.onmessage = (event) => {
    try {
      const decoder = new TextDecoder("utf-8");
      const text = decoder.decode(event.data);
      const msg = JSON.parse(text);
      if (msg.type === "update") {
        handleUpdate(msg.ack, msg.my_score, msg.others);
      } else if (msg.type === "leaderboard") {
        gameState.leaderboard = msg.top_players;
        updateLeaderboardUI(msg.top_players);
      } else if (msg.type === "eaten") {
        gameState.isGameOver = true;
        import("./ui").then(({ showGameOverScreen }) => showGameOverScreen());
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message", e);
    }
  };
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
          handleUpdate(msg.ack, msg.my_score, msg.others);
        } else if (msg.type === "leaderboard") {
          gameState.leaderboard = msg.top_players;
          updateLeaderboardUI(msg.top_players);
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
  myScore: number,
  others: { id: string; x: number; y: number; color: string; score: number }[],
) {
  gameState.myScore = myScore;
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
        score: other.score,
      };
    } else {
      // Update existing pixel
      gameState.otherPixels[other.id].score = other.score;
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

  // Send over active protocol
  if (isWebSocket && transport instanceof WebSocket) {
    if (transport.readyState === WebSocket.OPEN) {
      transport.send(data);
    }
  } else if (!isWebSocket && transport) {
    // Use a reliable Unidirectional Stream to bypass Datagram drops/bugs on mobile WebKit
    (transport as WebTransport)
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
}
