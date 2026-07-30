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

    gameState.animPixelX =
      gameState.startAnimPixelX +
      (gameState.pixelX - gameState.startAnimPixelX) * ease;
    gameState.animPixelY =
      gameState.startAnimPixelY +
      (gameState.pixelY - gameState.startAnimPixelY) * ease;

    if (progress >= 1) {
      gameState.animPixelX = gameState.pixelX;
      gameState.animPixelY = gameState.pixelY;

      gameState.state = ANIMATING_CAMERA;
      gameState.animationTimer = 0;
      gameState.cameraX = gameState.pixelX;
      gameState.cameraY = gameState.pixelY;
      gameState.startAnimCameraX = gameState.animCameraX;
      gameState.startAnimCameraY = gameState.animCameraY;
    }
  } else if (gameState.state === ANIMATING_CAMERA) {
    gameState.animationTimer += dt;
    const progress = Math.min(1, gameState.animationTimer / ANIMATION_DURATION);
    const ease = easeInOutQuad(progress);

    gameState.animCameraX =
      gameState.startAnimCameraX +
      (gameState.cameraX - gameState.startAnimCameraX) * ease;
    gameState.animCameraY =
      gameState.startAnimCameraY +
      (gameState.cameraY - gameState.startAnimCameraY) * ease;

    if (progress >= 1) {
      gameState.animCameraX = gameState.cameraX;
      gameState.animCameraY = gameState.cameraY;
      gameState.state = IDLE;
    }
  }
}
