import { gameState } from "./state";
import { ANIMATING_PIXEL, PIXEL_SIZE } from "./constants";

export function initInput() {
  window.addEventListener("keydown", (e) => {
    if (gameState.state !== "IDLE") return;

    let moved = false;
    if (e.key === "ArrowUp") {
      gameState.pixelY -= PIXEL_SIZE;
      moved = true;
    } else if (e.key === "ArrowDown") {
      gameState.pixelY += PIXEL_SIZE;
      moved = true;
    } else if (e.key === "ArrowLeft") {
      gameState.pixelX -= PIXEL_SIZE;
      moved = true;
    } else if (e.key === "ArrowRight") {
      gameState.pixelX += PIXEL_SIZE;
      moved = true;
    }

    if (moved) {
      gameState.state = ANIMATING_PIXEL;
      gameState.animationTimer = 0;
      gameState.startAnimPixelX = gameState.animPixelX;
      gameState.startAnimPixelY = gameState.animPixelY;
    }
  });
}
