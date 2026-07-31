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

// Helper to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mountJoinScreen() {
  const container = document.createElement("div");
  container.id = "join-screen";

  const title = document.createElement("h1");
  title.textContent = "PIXEL ATE IT";

  const subtitle = document.createElement("p");
  subtitle.textContent = "Choose your color:";

  const colorOptions = document.createElement("div");
  colorOptions.className = "color-options";

  const shuffledPresets = shuffleArray(PRESET_COLORS);

  // Try to load cached color from localStorage
  const cachedColor = localStorage.getItem("last_used_color");
  let selectedColor = cachedColor || shuffledPresets[0];

  const buttons: HTMLButtonElement[] = [];

  const updateSelection = (btn: HTMLButtonElement, color: string) => {
    buttons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedColor = color;
  };

  // Presets
  shuffledPresets.forEach((color) => {
    const btn = document.createElement("button");
    btn.className = "color-btn";
    btn.style.backgroundColor = color;

    // Select if it matches cached color, or if it's the first and there's no cached color
    if (color === selectedColor) {
      btn.classList.add("selected");
    }

    btn.addEventListener("click", () => updateSelection(btn, color));

    buttons.push(btn);
    colorOptions.appendChild(btn);
  });

  // Custom Color Wrapper
  const customWrapper = document.createElement("div");
  customWrapper.className = "custom-color-wrapper";

  const customBtn = document.createElement("button");
  customBtn.className = "color-btn custom-btn";

  if (!shuffledPresets.includes(selectedColor)) {
    customBtn.classList.add("selected");
    customBtn.style.background = selectedColor;
  } else {
    customBtn.style.background =
      "linear-gradient(45deg, #ff00aa, #00e5ff, #fce803)";
  }

  const customInput = document.createElement("input");
  customInput.type = "color";
  customInput.id = "custom-color";
  customInput.value = selectedColor;

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
    // Cache the chosen color
    localStorage.setItem("last_used_color", selectedColor);

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

export function showToast(message: string) {
  const toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;

  toast.addEventListener("click", () => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  });

  document.body.appendChild(toast);

  // Auto dismiss after 5 seconds if not clicked
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

export function mountLeaderboard() {
  const container = document.createElement("div");
  container.id = "leaderboard";

  const title = document.createElement("h2");
  title.textContent = "LEADERBOARD";
  container.appendChild(title);

  const list = document.createElement("ul");
  list.id = "leaderboard-list";
  container.appendChild(list);

  document.body.appendChild(container);
}

export function updateLeaderboardUI(
  entries: { id: string; color: string; score: number }[],
) {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;

  list.innerHTML = "";

  entries.forEach((entry, index) => {
    const li = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;

    const colorSwatch = document.createElement("div");
    colorSwatch.className = "swatch";
    colorSwatch.style.backgroundColor = entry.color;
    colorSwatch.style.boxShadow = `0 0 8px ${entry.color}`;

    const idSpan = document.createElement("span");
    idSpan.className = "id";
    // Show only first 6 chars of ID
    idSpan.textContent = entry.id.substring(0, 6);

    const score = document.createElement("span");
    score.className = "score";
    score.textContent = entry.score.toString();

    li.appendChild(rank);
    li.appendChild(colorSwatch);
    li.appendChild(idSpan);
    li.appendChild(score);

    list.appendChild(li);
  });
}
