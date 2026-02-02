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
const dpadButtons = document.querySelectorAll(".dpad__button");

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

let gameState = null;
let rafId = null;
let lastTime = 0;
let accumulator = 0;
const stepDuration = 315;
const saveKey = "rainbow-snake-save";

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
  loop(lastTime);
}

function endGame() {
  if (!gameState) {
    return;
  }
  gameState.running = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
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
    gameState.food = placeFood();
    gameState.foodEmoji = randomEmoji();
  } else {
    gameState.snake.pop();
  }

  updateScore();
  saveGame();
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

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveGame();
  }
});

window.addEventListener("beforeunload", () => {
  saveGame();
});
