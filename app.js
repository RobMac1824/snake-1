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
const joystick = document.getElementById("joystick");
const joystickThumb = document.getElementById("joystickThumb");

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
const stepDuration = 140;
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

function startGame(state = defaultState()) {
  if (rafId) {
    cancelAnimationFrame(rafId);
  }
  const baseState = defaultState();
  const mergedState = {
    ...baseState,
    ...state,
  };
  if (!mergedState.direction || (mergedState.direction.x === 0 && mergedState.direction.y === 0)) {
    mergedState.direction = baseState.direction;
  }
  if (
    !mergedState.queuedDirection ||
    (mergedState.queuedDirection.x === 0 && mergedState.queuedDirection.y === 0)
  ) {
    mergedState.queuedDirection = mergedState.direction;
  }
  if (!mergedState.food) {
    mergedState.food = placeFood(mergedState.snake);
  } else if (mergedState.snake?.some((segment) => positionsEqual(segment, mergedState.food))) {
    mergedState.food = placeFood(mergedState.snake);
  }
  if (!mergedState.foodEmoji) {
    mergedState.foodEmoji = randomEmoji();
  }
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

function handleJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxDistance = rect.width / 2 - joystickThumb.offsetWidth / 2;
  const deltaX = event.clientX - centerX;
  const deltaY = event.clientY - centerY;
  const distance = Math.min(Math.hypot(deltaX, deltaY), maxDistance);
  const angle = Math.atan2(deltaY, deltaX);

  const thumbX = Math.cos(angle) * distance;
  const thumbY = Math.sin(angle) * distance;
  joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX > absY) {
    applyDirection({ x: deltaX > 0 ? 1 : -1, y: 0 });
  } else {
    applyDirection({ x: 0, y: deltaY > 0 ? 1 : -1 });
  }
}

function resetJoystick() {
  joystickThumb.style.transform = "translate(0, 0)";
}

function bindJoystick() {
  let active = false;

  joystick.addEventListener("pointerdown", (event) => {
    active = true;
    joystick.setPointerCapture(event.pointerId);
    handleJoystick(event);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (!active) {
      return;
    }
    handleJoystick(event);
  });

  joystick.addEventListener("pointerup", () => {
    active = false;
    resetJoystick();
  });

  joystick.addEventListener("pointercancel", () => {
    active = false;
    resetJoystick();
  });
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
bindJoystick();
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
