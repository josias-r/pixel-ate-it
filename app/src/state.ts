import { IDLE, type AnimationState } from "./constants";

export const gameState = {
  state: IDLE as AnimationState,
  pixelX: 0,
  pixelY: 0,
  animPixelX: 0,
  animPixelY: 0,
  cameraX: 0,
  cameraY: 0,
  animCameraX: 0,
  animCameraY: 0,
  animationTimer: 0,
  startAnimPixelX: 0,
  startAnimPixelY: 0,
  startAnimCameraX: 0,
  startAnimCameraY: 0,
};
