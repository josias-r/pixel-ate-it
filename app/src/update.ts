import { gameState } from "./state";
import {
  ANIMATING_CAMERA,
  ANIMATING_PIXEL,
  ANIMATION_DURATION,
  IDLE,
} from "./constants";

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function update(dt: number) {
  if (gameState.state === ANIMATING_PIXEL) {
    gameState.animationTimer += dt;
    const progress = Math.min(1, gameState.animationTimer / ANIMATION_DURATION);
    const ease = easeInOutQuad(progress);

    gameState.animPixelX = gameState.targetOffsetX * ease;
    gameState.animPixelY = gameState.targetOffsetY * ease;

    if (progress >= 1) {
      gameState.animPixelX = gameState.targetOffsetX;
      gameState.animPixelY = gameState.targetOffsetY;

      gameState.state = ANIMATING_CAMERA;
      gameState.animationTimer = 0;
    }
  } else if (gameState.state === ANIMATING_CAMERA) {
    gameState.animationTimer += dt;
    const progress = Math.min(1, gameState.animationTimer / ANIMATION_DURATION);
    const ease = easeInOutQuad(progress);

    gameState.animCameraX = gameState.targetOffsetX * ease;
    gameState.animCameraY = gameState.targetOffsetY * ease;

    if (progress >= 1) {
      // Re-center by resetting everything back to 0
      gameState.animPixelX = 0;
      gameState.animPixelY = 0;
      gameState.animCameraX = 0;
      gameState.animCameraY = 0;
      gameState.targetOffsetX = 0;
      gameState.targetOffsetY = 0;
      gameState.state = IDLE;
    }
  }
}
