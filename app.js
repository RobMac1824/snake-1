const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

const scoreLabel = document.getElementById("score");
const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const summaryScreen = document.getElementById("summaryScreen");
const finalScore = document.getElementById("finalScore");
const startButton = document.getElementById("startButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");
const menuButton = document.getElementById("menuButton");
const soundtrackToggle = document.getElementById("soundtrackToggle");
const soundtrackStatus = document.getElementById("soundtrackStatus");
const soundtrackLabel = document.getElementById("soundtrackLabel");
const soundtrackSelect = document.getElementById("soundtrackSelect");
const dpadButtons = document.querySelectorAll(".dpad__button");
const scoreFireworks = document.getElementById("scoreFireworks");

const gridSize = 18;
const cellSize = canvas.width / gridSize;
const foodEmojis = ["🍒", "🍇", "🍉", "🍓", "🍍", "🍌", "🍑", "🥝", "🍪", "🧁"];
const rainbow = [
  "#ff4d4d",
  "#ff944d",
  "#ffd24d",
  "#a3ff4d",
  "#4dffcf",
  "#4d9dff",
  "#7b4dff",
  "#c44dff",
];

const soundtrackTracks = [
  {
    name: "Bit Bounce",
    src: "data:audio/midi;base64,TVRoZAAAAAYAAAABAGBNVHJrAAAAEwD/UQMHoSAAkDxkYIA8QAD/LwA=",
  },
  {
    name: "Pixel Hop",
    src: "data:audio/midi;base64,TVRoZAAAAAYAAAABAGBNVHJrAAAAEwD/UQMHoSAAkEBkYIBAQAD/LwA=",
  },
  {
    name: "Cloud Drift",
    src: "data:audio/midi;base64,TVRoZAAAAAYAAAABAGBNVHJrAAAAEwD/UQMHoSAAkENkYIBDQAD/LwA=",
  },
];

let soundtrackIndex = 0;
let soundtrack = createSoundtrack(soundtrackTracks[soundtrackIndex].src);

let gameState = null;
let rafId = null;
let lastTime = 0;
let accumulator = 0;
const stepDuration = 315 * 0.9;
const saveKey = "rainbow-snake-save";
const fireworks = [];
let soundtrackEnabled = true;

const defaultState = () => ({
  snake: [
    { x: 8, y: 9 },
    { x: 7, y: 9 },
    { x: 6, y: 9 },
  ],
  direction: { x: 1, y: 0 },
  queuedDirection: { x: 1, y: 0 },
  food: randomFoodPosition(),
  foodEmoji: randomEmoji(),
  score: 0,
  running: false,
});

function randomEmoji() {
  return foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
}

function randomFoodPosition() {
  return {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize),
  };
}

function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isOpposite(direction, next) {
  return direction.x + next.x === 0 && direction.y + next.y === 0;
}

function applyDirection(next) {
  if (!gameState || isOpposite(gameState.direction, next)) {
    return;
  }
  gameState.queuedDirection = next;
}

function saveGame() {
  if (!gameState || !gameState.running) {
    return;
  }
  const payload = {
    snake: gameState.snake,
    direction: gameState.direction,
    queuedDirection: gameState.queuedDirection,
    food: gameState.food,
    foodEmoji: gameState.foodEmoji,
    score: gameState.score,
  };
  localStorage.setItem(saveKey, JSON.stringify(payload));
}

function loadGame() {
  const raw = localStorage.getItem(saveKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSavedGame() {
  localStorage.removeItem(saveKey);
}

function updateScore() {
  scoreLabel.textContent = gameState.score.toString();
}

function triggerScoreFireworks() {
  if (!scoreFireworks) {
    return;
  }
  scoreFireworks.classList.remove("is-active");
  void scoreFireworks.offsetWidth;
  scoreFireworks.classList.add("is-active");
}

function showScreen(screen) {
  [menuScreen, gameScreen, summaryScreen].forEach((panel) => {
    const isActive = panel === screen;
    panel.classList.toggle("is-active", isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });
  if (screen === menuScreen) {
    showResumeOption();
  }
}

function sanitizeStateForStart(state) {
  let sanitizedState = state;
  try {
    sanitizedState = structuredClone(state);
  } catch {
    sanitizedState = JSON.parse(JSON.stringify(state));
  }

  const baseState = defaultState();
  const safeState = {
    ...baseState,
    ...sanitizedState,
  };

  if (!Array.isArray(safeState.snake) || safeState.snake.length === 0) {
    safeState.snake = [{ x: 5, y: 5 }];
  }

  const direction = safeState.direction ?? safeState.dir ?? { x: 0, y: 0 };
  const dx = Number(direction.x ?? direction.dx ?? 0);
  const dy = Number(direction.y ?? direction.dy ?? 0);
  if ((dx === 0 && dy === 0) || Math.abs(dx) + Math.abs(dy) !== 1) {
    safeState.direction = { x: 1, y: 0 };
  } else {
    safeState.direction = { x: dx, y: dy };
  }

  const queuedDirection =
    safeState.queuedDirection ?? safeState.nextDir ?? safeState.direction;
  const qx = Number(queuedDirection.x ?? queuedDirection.dx ?? safeState.direction.x);
  const qy = Number(queuedDirection.y ?? queuedDirection.dy ?? safeState.direction.y);
  if ((qx === 0 && qy === 0) || Math.abs(qx) + Math.abs(qy) !== 1) {
    safeState.queuedDirection = safeState.direction;
  } else {
    safeState.queuedDirection = { x: qx, y: qy };
  }

  if (
    !safeState.food ||
    typeof safeState.food.x !== "number" ||
    typeof safeState.food.y !== "number"
  ) {
    safeState.food = placeFood(safeState.snake);
  } else if (safeState.snake.some((segment) => positionsEqual(segment, safeState.food))) {
    safeState.food = placeFood(safeState.snake);
  }

  if (!safeState.foodEmoji) {
    safeState.foodEmoji = randomEmoji();
  }

  if (typeof safeState.score !== "number" || safeState.score < 0) {
    safeState.score = 0;
  }

  return safeState;
}

function startGame(state = defaultState()) {
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  const mergedState = sanitizeStateForStart(state);
  gameState = {
    ...mergedState,
    running: true,
  };
  lastTime = performance.now();
  accumulator = 0;
  updateScore();
  showScreen(gameScreen);
  startSoundtrack();
  loop(lastTime);
}

function endGame() {
  if (!gameState) {
    return;
  }
  gameState.running = false;
  fireworks.length = 0;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  stopSoundtrack();
  finalScore.textContent = gameState.score.toString();
  clearSavedGame();
  showScreen(summaryScreen);
}

function loop(timestamp) {
  if (!gameState || !gameState.running) {
    return;
  }
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= stepDuration) {
    step();
    accumulator -= stepDuration;
  }

  updateFireworks(delta);
  draw();
  rafId = requestAnimationFrame(loop);
}

function step() {
  gameState.direction = gameState.queuedDirection;
  const head = gameState.snake[0];
  const next = { x: head.x + gameState.direction.x, y: head.y + gameState.direction.y };

  const hitWall = next.x < 0 || next.x >= gridSize || next.y < 0 || next.y >= gridSize;
  if (hitWall) {
    endGame();
    return;
  }

  const hitSelf = gameState.snake.slice(1).some((segment) => positionsEqual(segment, next));
  if (hitSelf) {
    endGame();
    return;
  }

  gameState.snake.unshift(next);

  if (positionsEqual(next, gameState.food)) {
    gameState.score += 10;
    spawnFireworks(next);
    triggerScoreFireworks();
    gameState.food = placeFood();
    gameState.foodEmoji = randomEmoji();
  } else {
    gameState.snake.pop();
  }

  updateScore();
  saveGame();
}

function startSoundtrack() {
  if (!soundtrackEnabled) {
    return;
  }
  if (!soundtrack.paused) {
    return;
  }
  soundtrack.currentTime = 0;
  soundtrack.play().catch(() => {});
}

function stopSoundtrack() {
  if (soundtrack.paused) {
    return;
  }
  soundtrack.pause();
  soundtrack.currentTime = 0;
}

function createSoundtrack(source) {
  const audio = new Audio(source);
  audio.loop = true;
  audio.volume = 0.35;
  return audio;
}

function setSoundtrack(index) {
  const nextTrack = soundtrackTracks[index];
  if (!nextTrack) {
    return;
  }
  const wasPlaying = soundtrackEnabled && !soundtrack.paused;
  soundtrack.pause();
  soundtrack.currentTime = 0;
  soundtrack = createSoundtrack(nextTrack.src);
  soundtrackIndex = index;
  updateSoundtrackUI();
  if (wasPlaying && gameState?.running) {
    startSoundtrack();
  }
}

function updateSoundtrackUI() {
  const track = soundtrackTracks[soundtrackIndex];
  if (soundtrackLabel) {
    soundtrackLabel.textContent = track?.name ?? "Soundtrack";
  }
  if (soundtrackSelect) {
    soundtrackSelect.value = String(soundtrackIndex);
  }
  soundtrackToggle.textContent = soundtrackEnabled ? "Mute" : "Play";
  soundtrackStatus.textContent = soundtrackEnabled ? "Playing" : "Muted";
}

function spawnFireworks(position) {
  const colors = ["#ff7a7a", "#ffd86b", "#8dffb7", "#6bb6ff", "#d48dff"];
  const centerX = position.x * cellSize + cellSize / 2;
  const centerY = position.y * cellSize + cellSize / 2;
  const burstCount = 18;

  for (let i = 0; i < burstCount; i += 1) {
    const angle = (Math.PI * 2 * i) / burstCount;
    const speed = 1.5 + Math.random() * 1.8;
    fireworks.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 520 + Math.random() * 260,
      maxLife: 780,
      color: colors[i % colors.length],
      size: 3 + Math.random() * 2,
    });
  }
}

function updateFireworks(delta) {
  for (let i = fireworks.length - 1; i >= 0; i -= 1) {
    const spark = fireworks[i];
    spark.life -= delta;
    spark.x += spark.vx * (delta / 16);
    spark.y += spark.vy * (delta / 16);
    spark.vy += 0.02 * (delta / 16);
    if (spark.life <= 0) {
      fireworks.splice(i, 1);
    }
  }
}

function placeFood(snake = gameState.snake) {
  let position = randomFoodPosition();
  while (snake.some((segment) => positionsEqual(segment, position))) {
    position = randomFoodPosition();
  }
  return position;
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#e8ebff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  gameState.snake.forEach((segment, index) => {
    context.fillStyle = rainbow[index % rainbow.length];
    context.beginPath();
    context.roundRect(
      segment.x * cellSize + 2,
      segment.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4,
      6
    );
    context.fill();
  });

  context.font = "20px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    gameState.foodEmoji,
    gameState.food.x * cellSize + cellSize / 2,
    gameState.food.y * cellSize + cellSize / 2
  );

  fireworks.forEach((spark) => {
    const alpha = Math.max(spark.life / spark.maxLife, 0);
    context.fillStyle = `rgba(${hexToRgb(spark.color)}, ${alpha})`;
    context.beginPath();
    context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    context.fill();
  });
}

function hexToRgb(hex) {
  const sanitized = hex.replace("#", "");
  const value = parseInt(sanitized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r}, ${g}, ${b}`;
}

function bindButtons() {
  startButton.addEventListener("click", () => {
    clearSavedGame();
    startGame();
  });

  resumeButton.addEventListener("click", () => {
    const saved = loadGame();
    if (saved) {
      startGame(saved);
    }
  });

  restartButton.addEventListener("click", () => {
    startGame();
  });

  menuButton.addEventListener("click", () => {
    showScreen(menuScreen);
    stopSoundtrack();
  });

  soundtrackToggle.addEventListener("click", () => {
    soundtrackEnabled = !soundtrackEnabled;
    if (soundtrackEnabled && gameState?.running) {
      startSoundtrack();
    } else {
      stopSoundtrack();
    }
    updateSoundtrackUI();
  });

  soundtrackSelect?.addEventListener("change", (event) => {
    const nextIndex = Number(event.target.value);
    if (!Number.isNaN(nextIndex)) {
      setSoundtrack(nextIndex);
    }
  });

  const directionMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  dpadButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.direction;
      if (direction && directionMap[direction]) {
        applyDirection(directionMap[direction]);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    if (keyMap[event.key]) {
      applyDirection(keyMap[event.key]);
    }
  });
}

function showResumeOption() {
  const saved = loadGame();
  resumeButton.hidden = !saved;
}

bindButtons();
showResumeOption();
showScreen(menuScreen);
updateSoundtrackUI();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveGame();
  }
});

window.addEventListener("beforeunload", () => {
  saveGame();
});
