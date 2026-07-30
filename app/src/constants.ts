export const PIXEL_SIZE = 50;
export const RASTER_SIZE = PIXEL_SIZE * 0.5;
export const ANIMATION_DURATION = 300;

export const ANIMATING_CAMERA = "ANIMATING_CAMERA";
export const ANIMATING_PIXEL = "ANIMATING_PIXEL";
export const IDLE = "IDLE";
export type AnimationState =
  | typeof ANIMATING_CAMERA
  | typeof ANIMATING_PIXEL
  | typeof IDLE;
