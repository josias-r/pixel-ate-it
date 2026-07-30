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

  if (p.targetOffsetX === newOffsetX && p.targetOffsetY === newOffsetY) {
    return;
  }

  p.offsetX = p.animOffsetX;
  p.offsetY = p.animOffsetY;
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
    let dx = 0;
    let dy = 0;

    if (e.key === "ArrowUp") dy = -1;
    else if (e.key === "ArrowDown") dy = 1;
    else if (e.key === "ArrowLeft") dx = -1;
    else if (e.key === "ArrowRight") dx = 1;

    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          gameState.targetOffsetX = 1;
          moved = true;
          sendMove("right", 1, 0);
        } else if (dx < 0) {
          gameState.targetOffsetX = -1;
          moved = true;
          sendMove("left", -1, 0);
        }
      } else if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 0) {
          gameState.targetOffsetY = 1;
          moved = true;
          sendMove("down", 0, 1);
        } else if (dy < 0) {
          gameState.targetOffsetY = -1;
          moved = true;
          sendMove("up", 0, -1);
        }
      }
    }

    if (moved) {
      gameState.state = ANIMATING_PIXEL;
      gameState.animationTimer = 0;
    }
  });

  // Swipe controls for mobile
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true },
  );

  window.addEventListener("touchend", (e) => {
    if (gameState.state !== "IDLE") return;

    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    const swipeThreshold = 30;

    if (Math.abs(dx) < swipeThreshold && Math.abs(dy) < swipeThreshold) {
      return;
    }

    let moved = false;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        gameState.targetOffsetX = 1;
        moved = true;
        sendMove("right", 1, 0);
      } else {
        gameState.targetOffsetX = -1;
        moved = true;
        sendMove("left", -1, 0);
      }
    } else {
      if (dy > 0) {
        gameState.targetOffsetY = 1;
        moved = true;
        sendMove("down", 0, 1);
      } else {
        gameState.targetOffsetY = -1;
        moved = true;
        sendMove("up", 0, -1);
      }
    }

    if (moved) {
      gameState.state = ANIMATING_PIXEL;
      gameState.animationTimer = 0;
    }
  });
}
