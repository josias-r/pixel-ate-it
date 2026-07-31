import { IDLE, type AnimationState } from "./constants";

export interface OtherPixel {
  id: string;
  color: string;
  offsetX: number;
  offsetY: number;
  animOffsetX: number;
  animOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  state: "IDLE" | "ANIMATING";
  animationTimer: number;
  score: number;
}

export interface GameState {
  state: AnimationState;
  animPixelX: number;
  animPixelY: number;
  animCameraX: number;
  animCameraY: number;
  animationTimer: number;
  targetOffsetX: number;
  targetOffsetY: number;
  otherPixels: Record<string, OtherPixel>;
  isGameOver: boolean;
  myColor: string;
  myScore: number;
  leaderboard: { id: string; color: string; score: number }[];
}

export const gameState: GameState = {
  state: IDLE as AnimationState,
  animPixelX: 0,
  animPixelY: 0,
  animCameraX: 0,
  animCameraY: 0,
  animationTimer: 0,
  targetOffsetX: 0,
  targetOffsetY: 0,
  otherPixels: {} as Record<string, OtherPixel>,
  isGameOver: false,
  myColor: "#00e5ff",
  myScore: 0,
  leaderboard: [],
};
