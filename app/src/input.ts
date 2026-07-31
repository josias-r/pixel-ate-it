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
  function handleMoveAction(moveDx: number, moveDy: number) {
    if (gameState.isGameOver || gameState.state !== "IDLE") return;

    if (moveDx > 0) {
      gameState.targetOffsetX = 1;
      sendMove("right", 1, 0);
    } else if (moveDx < 0) {
      gameState.targetOffsetX = -1;
      sendMove("left", -1, 0);
    } else if (moveDy > 0) {
      gameState.targetOffsetY = 1;
      sendMove("down", 0, 1);
    } else if (moveDy < 0) {
      gameState.targetOffsetY = -1;
      sendMove("up", 0, -1);
    }

    gameState.state = ANIMATING_PIXEL;
    gameState.animationTimer = 0;
  }

  window.addEventListener("keydown", (e) => {
    let dx = 0;
    let dy = 0;

    if (e.key === "ArrowUp") dy = -1;
    else if (e.key === "ArrowDown") dy = 1;
    else if (e.key === "ArrowLeft") dx = -1;
    else if (e.key === "ArrowRight") dx = 1;

    if (dx !== 0 || dy !== 0) {
      handleMoveAction(dx, dy);
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
    { passive: false },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      // Prevent browser from scrolling the page when trying to swipe
      e.preventDefault();
    },
    { passive: false },
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

    if (Math.abs(dx) > Math.abs(dy)) {
      handleMoveAction(dx > 0 ? 1 : -1, 0);
    } else {
      handleMoveAction(0, dy > 0 ? 1 : -1);
    }
  });
}
