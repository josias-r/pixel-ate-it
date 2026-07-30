import { gameState } from "./state";
import {
  ANIMATING_PIXEL,
  PLAYER_ANIM_DURATION,
  OTHER_PIXEL_ANIM_DURATION,
  IDLE,
  PIXEL_SIZE,
} from "./constants";

function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
}

function easeOutExpo(x: number): number {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
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
      const ease = easeOutQuint(progress);

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
    const ease = easeOutExpo(progress);

    gameState.animPixelX = gameState.targetOffsetX * PIXEL_SIZE * ease;
    gameState.animPixelY = gameState.targetOffsetY * PIXEL_SIZE * ease;

    if (progress >= 1) {
      const shiftX = gameState.targetOffsetX * PIXEL_SIZE;
      const shiftY = gameState.targetOffsetY * PIXEL_SIZE;

      gameState.animPixelX = 0;
      gameState.animPixelY = 0;
      gameState.animCameraX -= shiftX;
      gameState.animCameraY -= shiftY;
      gameState.targetOffsetX = 0;
      gameState.targetOffsetY = 0;
      gameState.state = IDLE;

      // Shift all other pixels relative coordinates!
      const gridShiftX = shiftX / PIXEL_SIZE;
      const gridShiftY = shiftY / PIXEL_SIZE;
      Object.values(gameState.otherPixels).forEach((p) => {
        p.offsetX -= gridShiftX;
        p.offsetY -= gridShiftY;
        p.animOffsetX -= gridShiftX;
        p.animOffsetY -= gridShiftY;
        p.targetOffsetX -= gridShiftX;
        p.targetOffsetY -= gridShiftY;
      });
    }
  }

  // Continuous camera lerp tracking the player pixel
  // The further away it is, the faster it moves!
  const cameraLerpSpeed = 7;
  const t = 1 - Math.exp(-cameraLerpSpeed * (dt / 1000));
  gameState.animCameraX += (gameState.animPixelX - gameState.animCameraX) * t;
  gameState.animCameraY += (gameState.animPixelY - gameState.animCameraY) * t;
}
