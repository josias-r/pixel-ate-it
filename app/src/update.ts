import { gameState } from "./state";
import {
  ANIMATING_CAMERA,
  ANIMATING_PIXEL,
  PLAYER_ANIM_DURATION,
  CAMERA_ANIM_DURATION,
  OTHER_PIXEL_ANIM_DURATION,
  IDLE,
  PIXEL_SIZE,
} from "./constants";

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function update(dt: number) {
  // Update other pixels animations
  Object.values(gameState.otherPixels).forEach((p) => {
    if (p.state === "ANIMATING") {
      p.animationTimer += dt;
      const progress = Math.min(
        1,
        p.animationTimer / OTHER_PIXEL_ANIM_DURATION,
      );
      const ease = easeInOutQuad(progress);

      p.animOffsetX = p.offsetX + (p.targetOffsetX - p.offsetX) * ease;
      p.animOffsetY = p.offsetY + (p.targetOffsetY - p.offsetY) * ease;

      if (progress >= 1) {
        p.animOffsetX = p.targetOffsetX;
        p.animOffsetY = p.targetOffsetY;
        p.offsetX = p.targetOffsetX;
        p.offsetY = p.targetOffsetY;
        p.state = "IDLE";
      }
    }
  });

  // Main player animations
  if (gameState.state === ANIMATING_PIXEL) {
    gameState.animationTimer += dt;
    const progress = Math.min(
      1,
      gameState.animationTimer / PLAYER_ANIM_DURATION,
    );
    const ease = easeInOutQuad(progress);

    gameState.animPixelX = gameState.targetOffsetX * PIXEL_SIZE * ease;
    gameState.animPixelY = gameState.targetOffsetY * PIXEL_SIZE * ease;

    if (progress >= 1) {
      gameState.animPixelX = gameState.targetOffsetX * PIXEL_SIZE;
      gameState.animPixelY = gameState.targetOffsetY * PIXEL_SIZE;

      gameState.state = ANIMATING_CAMERA;
      gameState.animationTimer = 0;
    }
  } else if (gameState.state === ANIMATING_CAMERA) {
    gameState.animationTimer += dt;
    const progress = Math.min(
      1,
      gameState.animationTimer / CAMERA_ANIM_DURATION,
    );
    const ease = easeInOutQuad(progress);

    gameState.animCameraX = gameState.targetOffsetX * PIXEL_SIZE * ease;
    gameState.animCameraY = gameState.targetOffsetY * PIXEL_SIZE * ease;

    if (progress >= 1) {
      const shiftX = gameState.targetOffsetX;
      const shiftY = gameState.targetOffsetY;

      // Re-center by resetting everything back to 0
      gameState.animPixelX = 0;
      gameState.animPixelY = 0;
      gameState.animCameraX = 0;
      gameState.animCameraY = 0;
      gameState.targetOffsetX = 0;
      gameState.targetOffsetY = 0;
      gameState.state = IDLE;

      // Shift all other pixels relative coordinates!
      Object.values(gameState.otherPixels).forEach((p) => {
        p.offsetX -= shiftX;
        p.offsetY -= shiftY;
        p.animOffsetX -= shiftX;
        p.animOffsetY -= shiftY;
        p.targetOffsetX -= shiftX;
        p.targetOffsetY -= shiftY;
      });
    }
  }
}
