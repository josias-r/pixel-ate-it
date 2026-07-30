import { gameState } from "./state";
import { ANIMATING_PIXEL, PIXEL_SIZE } from "./constants";

export function initInput() {
  window.addEventListener("keydown", (e) => {
    if (gameState.state !== "IDLE") return;

    let moved = false;
    if (e.key === "ArrowUp") {
      gameState.targetOffsetY = -PIXEL_SIZE;
      moved = true;
    } else if (e.key === "ArrowDown") {
      gameState.targetOffsetY = PIXEL_SIZE;
      moved = true;
    } else if (e.key === "ArrowLeft") {
      gameState.targetOffsetX = -PIXEL_SIZE;
      moved = true;
    } else if (e.key === "ArrowRight") {
      gameState.targetOffsetX = PIXEL_SIZE;
      moved = true;
    }

    if (moved) {
      gameState.state = ANIMATING_PIXEL;
      gameState.animationTimer = 0;
    }
  });
}
