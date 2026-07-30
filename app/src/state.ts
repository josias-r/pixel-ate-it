import { IDLE, type AnimationState } from "./constants";

export interface OtherPixel {
  id: string;
  offsetX: number;
  offsetY: number;
  animOffsetX: number;
  animOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  state: "IDLE" | "ANIMATING";
  animationTimer: number;
}

export const gameState = {
  state: IDLE as AnimationState,
  animPixelX: 0,
  animPixelY: 0,
  animCameraX: 0,
  animCameraY: 0,
  animationTimer: 0,
  targetOffsetX: 0,
  targetOffsetY: 0,
  otherPixels: {
    "dev-player2": {
      id: "dev-player2",
      offsetX: 2,
      offsetY: 0,
      animOffsetX: 2,
      animOffsetY: 0,
      targetOffsetX: 2,
      targetOffsetY: 0,
      state: "IDLE",
      animationTimer: 0,
    },
  } as Record<string, OtherPixel>,
};
