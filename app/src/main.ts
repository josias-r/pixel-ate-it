import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App element not found");
}

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
app.appendChild(canvas);

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

const ctxTemp = canvas.getContext("2d");
if (!ctxTemp) {
  throw new Error("Canvas context not found");
}
const ctx = ctxTemp;

const PIXEL_SIZE = 50;
const RASTER_SIZE = PIXEL_SIZE * 0.5;

function draw() {
  ctx.fillStyle = "white";
  ctx.fillRect(
    window.innerWidth / 2 - PIXEL_SIZE / 2,
    window.innerHeight / 2 - PIXEL_SIZE / 2,
    PIXEL_SIZE,
    PIXEL_SIZE,
  );

  const offsetStartX =
    Math.floor(window.innerWidth / 2 / RASTER_SIZE) * RASTER_SIZE;
  const offsetStartY =
    Math.floor(window.innerHeight / 2 / RASTER_SIZE) * RASTER_SIZE;

  // start drawing raster lines from center
  const startX = window.innerWidth / 2 - offsetStartX;
  const startY = window.innerHeight / 2 - offsetStartY;

  ctx.strokeStyle = "gray";
  ctx.lineWidth = 1;

  // draw vertical lines
  for (let x = startX; x < window.innerWidth; x += RASTER_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, window.innerHeight);
    ctx.stroke();
  }

  // draw horizontal lines
  for (let y = startY; y < window.innerHeight; y += RASTER_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(window.innerWidth, y);
    ctx.stroke();
  }

  window.requestAnimationFrame(draw);
}

draw();
