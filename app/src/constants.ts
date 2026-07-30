export const PIXEL_SIZE = 16;
export const RASTER_SIZE = PIXEL_SIZE * 1;

export const PLAYER_PIXEL_COLOR = "#ff007b"; // Cyberpunk Cyan
export const OTHER_PIXEL_COLOR = "#e4e733"; // Cyberpunk Pink
export const RASTER_COLOR = "rgba(255, 255, 255, 0.07)";
export const RASTER_THICKNESS = 1;

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
