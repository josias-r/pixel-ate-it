import { IDLE, type AnimationState } from "./constants";

export const gameState = {
  state: IDLE as AnimationState,
  animPixelX: 0,
  animPixelY: 0,
  animCameraX: 0,
  animCameraY: 0,
  animationTimer: 0,
  targetOffsetX: 0,
  targetOffsetY: 0,
};
