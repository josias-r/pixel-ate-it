import { ctx, canvas } from "./canvas";
import { gameState } from "./state";
import {
  RASTER_SIZE,
  PIXEL_SIZE,
  PLAYER_PIXEL_COLOR,
  OTHER_PIXEL_COLOR,
  RASTER_COLOR,
  RASTER_THICKNESS,
} from "./constants";

export function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = RASTER_COLOR;
  ctx.lineWidth = RASTER_THICKNESS;

  const screenWorldLeft = gameState.animCameraX - window.innerWidth / 2;
  const screenWorldTop = gameState.animCameraY - window.innerHeight / 2;

  const startX = Math.floor(screenWorldLeft / RASTER_SIZE) * RASTER_SIZE;
  const startY = Math.floor(screenWorldTop / RASTER_SIZE) * RASTER_SIZE;

  for (
    let x = startX;
    x < screenWorldLeft + window.innerWidth;
    x += RASTER_SIZE
  ) {
    const screenX = x - screenWorldLeft;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, window.innerHeight);
    ctx.stroke();
  }

  for (
    let y = startY;
    y < screenWorldTop + window.innerHeight;
    y += RASTER_SIZE
  ) {
    const screenY = y - screenWorldTop;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(window.innerWidth, screenY);
    ctx.stroke();
  }

  // Draw other pixels
  Object.values(gameState.otherPixels).forEach((p) => {
    const pScreenX = p.animOffsetX * PIXEL_SIZE - screenWorldLeft;
    const pScreenY = p.animOffsetY * PIXEL_SIZE - screenWorldTop;

    ctx.fillStyle = OTHER_PIXEL_COLOR;
    ctx.fillRect(
      pScreenX - PIXEL_SIZE / 2,
      pScreenY - PIXEL_SIZE / 2,
      PIXEL_SIZE,
      PIXEL_SIZE,
    );
  });

  // Draw main player pixel
  const pixelScreenX = gameState.animPixelX - screenWorldLeft;
  const pixelScreenY = gameState.animPixelY - screenWorldTop;

  ctx.fillStyle = PLAYER_PIXEL_COLOR;
  ctx.fillRect(
    pixelScreenX - PIXEL_SIZE / 2,
    pixelScreenY - PIXEL_SIZE / 2,
    PIXEL_SIZE,
    PIXEL_SIZE,
  );
}
