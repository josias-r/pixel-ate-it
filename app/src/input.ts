import { gameState } from "./state";
import { ANIMATING_PIXEL } from "./constants";
import { sendMove } from "./network";

export function updateOtherPixelTarget(
  id: string,
  newOffsetX: number,
  newOffsetY: number,
) {
  const p = gameState.otherPixels[id];
  if (!p) return;
  p.targetOffsetX = newOffsetX;
  p.targetOffsetY = newOffsetY;
  p.state = "ANIMATING";
  p.animationTimer = 0;
}

export function initInput() {
  window.addEventListener("keydown", (e) => {
    // Main player controls
    if (gameState.state !== "IDLE") return;

    let moved = false;
    if (e.key === "ArrowUp") {
      gameState.targetOffsetY = -1;
      moved = true;
      sendMove("up");
    } else if (e.key === "ArrowDown") {
      gameState.targetOffsetY = 1;
      moved = true;
      sendMove("down");
    } else if (e.key === "ArrowLeft") {
      gameState.targetOffsetX = -1;
      moved = true;
      sendMove("left");
    } else if (e.key === "ArrowRight") {
      gameState.targetOffsetX = 1;
      moved = true;
      sendMove("right");
    }

    if (moved) {
      gameState.state = ANIMATING_PIXEL;
      gameState.animationTimer = 0;
    }
  });
}
