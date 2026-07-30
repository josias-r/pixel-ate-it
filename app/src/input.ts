import { gameState } from "./state";
import { ANIMATING_PIXEL } from "./constants";

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
    // Other pixel controls (temporary dev)
    const p2 = gameState.otherPixels["dev-player2"];
    if (p2 && p2.state === "IDLE") {
      if (e.key === "w")
        updateOtherPixelTarget("dev-player2", p2.offsetX, p2.offsetY - 1);
      else if (e.key === "s")
        updateOtherPixelTarget("dev-player2", p2.offsetX, p2.offsetY + 1);
      else if (e.key === "a")
        updateOtherPixelTarget("dev-player2", p2.offsetX - 1, p2.offsetY);
      else if (e.key === "d")
        updateOtherPixelTarget("dev-player2", p2.offsetX + 1, p2.offsetY);
    }

    // Main player controls
    if (gameState.state !== "IDLE") return;

    let moved = false;
    if (e.key === "ArrowUp") {
      gameState.targetOffsetY = -1;
      moved = true;
    } else if (e.key === "ArrowDown") {
      gameState.targetOffsetY = 1;
      moved = true;
    } else if (e.key === "ArrowLeft") {
      gameState.targetOffsetX = -1;
      moved = true;
    } else if (e.key === "ArrowRight") {
      gameState.targetOffsetX = 1;
      moved = true;
    }

    if (moved) {
      gameState.state = ANIMATING_PIXEL;
      gameState.animationTimer = 0;
    }
  });
}
