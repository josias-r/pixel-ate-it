export const PIXEL_SIZE = 10;
export const RASTER_SIZE = PIXEL_SIZE * 0.5;

export const PLAYER_PIXEL_COLOR = "white";
export const OTHER_PIXEL_COLOR = "lightgray";
export const RASTER_COLOR = "#212121";
export const RASTER_THICKNESS = 2;

export const PLAYER_ANIM_DURATION = 250;
export const CAMERA_ANIM_DURATION = 150;
export const OTHER_PIXEL_ANIM_DURATION = 400;

export const ANIMATING_CAMERA = "ANIMATING_CAMERA";
export const ANIMATING_PIXEL = "ANIMATING_PIXEL";
export const IDLE = "IDLE";
export type AnimationState =
  | typeof ANIMATING_CAMERA
  | typeof ANIMATING_PIXEL
  | typeof IDLE;
