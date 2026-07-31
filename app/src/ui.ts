import { gameState } from "./state";
import { initNetwork, transport } from "./network";

const PRESET_COLORS = [
  "#00e5ff", // Cyan
  "#ff00aa", // Pink
  "#39ff14", // Acid Green
  "#fce803", // Yellow
  "#ff3300", // Neon Orange
  "#bd00ff", // Purple
  "#ffffff", // White
];

export function mountJoinScreen() {
  const container = document.createElement("div");
  container.id = "join-screen";

  const title = document.createElement("h1");
  title.textContent = "PIXEL ATE IT";

  const subtitle = document.createElement("p");
  subtitle.textContent = "Choose your color:";

  const colorOptions = document.createElement("div");
  colorOptions.className = "color-options";

  let selectedColor = PRESET_COLORS[0];
  const buttons: HTMLButtonElement[] = [];

  const updateSelection = (btn: HTMLButtonElement, color: string) => {
    buttons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedColor = color;
  };

  // Presets
  PRESET_COLORS.forEach((color, index) => {
    const btn = document.createElement("button");
    btn.className = "color-btn";
    btn.style.backgroundColor = color;
    if (index === 0) btn.classList.add("selected");
    
    btn.addEventListener("click", () => updateSelection(btn, color));
    
    buttons.push(btn);
    colorOptions.appendChild(btn);
  });

  // Custom Color Wrapper
  const customWrapper = document.createElement("div");
  customWrapper.className = "custom-color-wrapper";

  const customBtn = document.createElement("button");
  customBtn.className = "color-btn custom-btn";
  customBtn.style.background = "linear-gradient(45deg, #ff00aa, #00e5ff, #fce803)";
  
  const customInput = document.createElement("input");
  customInput.type = "color";
  customInput.id = "custom-color";
  customInput.value = "#00e5ff";

  customBtn.addEventListener("click", () => {
    customInput.click();
  });

  customInput.addEventListener("input", (e) => {
    const color = (e.target as HTMLInputElement).value;
    customBtn.style.background = color;
    updateSelection(customBtn, color);
  });

  buttons.push(customBtn);
  customWrapper.appendChild(customBtn);
  customWrapper.appendChild(customInput);
  colorOptions.appendChild(customWrapper);

  const joinBtn = document.createElement("button");
  joinBtn.id = "join-btn";
  joinBtn.textContent = "JOIN GAME";

  joinBtn.addEventListener("click", () => {
    gameState.myColor = selectedColor;
    container.remove();
    initNetwork(selectedColor);
  });

  container.appendChild(title);
  container.appendChild(subtitle);
  container.appendChild(colorOptions);
  container.appendChild(joinBtn);

  document.body.appendChild(container);
}

export function showGameOverScreen() {
  const container = document.createElement("div");
  container.id = "game-over";

  const title = document.createElement("h1");
  title.textContent = "YOU WERE EATEN";

  const respawnBtn = document.createElement("button");
  respawnBtn.textContent = "Respawn";
  respawnBtn.addEventListener("click", () => {
    location.reload();
  });

  container.appendChild(title);
  container.appendChild(respawnBtn);

  document.body.appendChild(container);
  
  if (transport) {
    transport.close();
  }
}
