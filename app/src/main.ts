import "./style.css";
import "./canvas";
import { initInput } from "./input";
import { update } from "./update";
import { draw } from "./render";
import { mountJoinScreen } from "./ui";

initInput();
mountJoinScreen();

let lastTime = 0;
function loop(time: number) {
  if (lastTime === 0) {
    lastTime = time;
  }
  const dt = time - lastTime;
  lastTime = time;

  update(dt);
  draw();

  window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);
