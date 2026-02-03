const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");

const scoreLabel = document.getElementById("score");
const bestScoreTop = document.getElementById("bestScoreTop");
const bestScoreMenu = document.getElementById("bestScoreMenu");
const bestScoreSummary = document.getElementById("bestScoreSummary");
const versionLabel = document.getElementById("versionLabel");
const menuScreen = document.getElementById("menuScreen");
const gameScreen = document.getElementById("gameScreen");
const summaryScreen = document.getElementById("summaryScreen");
const finalScore = document.getElementById("finalScore");
const startButton = document.getElementById("startButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");
const menuButton = document.getElementById("menuButton");
const pauseButton = document.getElementById("pauseButton");
const pauseOverlay = document.getElementById("pauseOverlay");
const resumePauseButton = document.getElementById("resumePauseButton");
const pauseMenuButton = document.getElementById("pauseMenuButton");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownText = document.getElementById("countdownText");
const soundToggle = document.getElementById("soundToggle");
const hapticsToggle = document.getElementById("hapticsToggle");
const dpadButtons = document.querySelectorAll(".dpad__button");
const scoreFireworks = document.getElementById("scoreFireworks");

const VERSION = "0.8";
const gridSize = 18;
const cellSize = canvas.width / gridSize;
const foodEmojis = ["🍒", "🍇", "🍉", "🍓", "🍍", "🍌", "🍑", "🥝", "🍪", "🧁"];
const foodMargin = 2;
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

const BASE_STEP_MS = 285;
const MIN_STEP_MS = 135;
const RAMP_PER_POINT = 2.4;
const COUNTDOWN_STEPS = ["3", "2", "1", "GO"];
const COUNTDOWN_STEP_MS = 250;
const SWIPE_THRESHOLD = 24;

const saveKey = "rainbow-snake-save";
const bestScoreKey = "snakeBestScore";
const soundKey = "snakeSoundEnabled";
const hapticsKey = "snakeHapticsEnabled";

let gameState = null;
let rafId = null;
let lastTime = 0;
let accumulator = 0;
let countdownTimer = null;
let bestScore = Number(localStorage.getItem(bestScoreKey) || 0);
let soundEnabled = localStorage.getItem(soundKey) !== "false";
let hapticsEnabled = localStorage.getItem(hapticsKey) !== "false";
let audioContext = null;
const fireworks = [];

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
  paused: false,
  countdown: false,
});

function randomEmoji() {
  return foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
}

function randomFoodPosition() {
  const min = foodMargin;
  const max = gridSize - foodMargin;
  const safeRange = Math.max(max - min, 1);
  return {
    x: Math.floor(Math.random() * safeRange) + min,
    y: Math.floor(Math.random() * safeRange) + min,
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

function updateBestScoreUI() {
  const label = `Best ${bestScore}`;
  if (bestScoreTop) {
    bestScoreTop.textContent = label;
  }
  if (bestScoreMenu) {
    bestScoreMenu.textContent = bestScore.toString();
  }
  if (bestScoreSummary) {
    bestScoreSummary.textContent = bestScore.toString();
  }
}

function updateBestScore(score) {
  if (score <= bestScore) {
    return;
  }
  bestScore = score;
  localStorage.setItem(bestScoreKey, String(bestScore));
  updateBestScoreUI();
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
  const isGame = screen === gameScreen;
  pauseButton.toggleAttribute("hidden", !isGame);
  pauseButton.disabled = !isGame;
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
  } else if (
    safeState.food.x < foodMargin ||
    safeState.food.x >= gridSize - foodMargin ||
    safeState.food.y < foodMargin ||
    safeState.food.y >= gridSize - foodMargin
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

  safeState.running = true;
  safeState.paused = false;
  safeState.countdown = false;

  return safeState;
}

function startGame(state = defaultState()) {
  stopLoop();
  const mergedState = sanitizeStateForStart(state);
  gameState = {
    ...mergedState,
  };
  lastTime = performance.now();
  accumulator = 0;
  updateScore();
  showScreen(gameScreen);
  hidePauseOverlay();
  startCountdown();
  loop(lastTime);
}

function endGame() {
  if (!gameState) {
    return;
  }
  gameState.running = false;
  fireworks.length = 0;
  clearCountdown();
  hidePauseOverlay();
  stopLoop();
  updateBestScore(gameState.score);
  finalScore.textContent = gameState.score.toString();
  clearSavedGame();
  showScreen(summaryScreen);
  playGameOverEffects();
}

function stopLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function stopGame({ save = true } = {}) {
  if (!gameState) {
    return;
  }
  gameState.running = false;
  gameState.paused = false;
  gameState.countdown = false;
  if (save) {
    saveGame();
  }
  clearCountdown();
  hidePauseOverlay();
  stopLoop();
}

function getStepDuration() {
  const points = gameState ? gameState.score / 10 : 0;
  return Math.max(MIN_STEP_MS, BASE_STEP_MS - points * RAMP_PER_POINT);
}

function loop(timestamp) {
  if (!gameState || !gameState.running) {
    return;
  }
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if (!gameState.paused && !gameState.countdown) {
    accumulator += delta;
    const stepDuration = getStepDuration();
    while (accumulator >= stepDuration) {
      step();
      accumulator -= stepDuration;
    }
    updateFireworks(delta);
  } else {
    accumulator = 0;
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
    spawnFireworks(next);
    triggerScoreFireworks();
    gameState.food = placeFood();
    gameState.foodEmoji = randomEmoji();
    playEatEffects();
  } else {
    gameState.snake.pop();
  }

  updateScore();
  saveGame();
}

function playEatEffects() {
  vibrate(18);
  playTone(540, 90, "triangle", 0.05);
}

function playGameOverEffects() {
  vibrate(50);
  playTone(160, 220, "sawtooth", 0.08);
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency, duration, type, volume) {
  if (!soundEnabled) {
    return;
  }
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
  oscillator.stop(ctx.currentTime + duration / 1000);
}

function vibrate(pattern) {
  if (!hapticsEnabled || !navigator.vibrate) {
    return;
  }
  navigator.vibrate(pattern);
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

  context.fillStyle = "#dbe5ff";
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

function startCountdown() {
  clearCountdown();
  if (!countdownOverlay || !countdownText) {
    return;
  }
  let stepIndex = 0;
  gameState.countdown = true;
  countdownOverlay.classList.add("is-active");
  countdownOverlay.setAttribute("aria-hidden", "false");
  countdownText.textContent = COUNTDOWN_STEPS[stepIndex];

  countdownTimer = window.setInterval(() => {
    stepIndex += 1;
    if (stepIndex >= COUNTDOWN_STEPS.length) {
      finishCountdown();
      return;
    }
    countdownText.textContent = COUNTDOWN_STEPS[stepIndex];
  }, COUNTDOWN_STEP_MS);
}

function finishCountdown() {
  clearCountdown();
  if (countdownOverlay) {
    countdownOverlay.classList.remove("is-active");
    countdownOverlay.setAttribute("aria-hidden", "true");
  }
  gameState.countdown = false;
  lastTime = performance.now();
  accumulator = 0;
}

function clearCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function setPaused(isPaused) {
  if (!gameState || !gameState.running || gameState.countdown) {
    return;
  }
  gameState.paused = isPaused;
  pauseButton.setAttribute("aria-pressed", String(isPaused));
  if (isPaused) {
    showPauseOverlay();
  } else {
    hidePauseOverlay();
    lastTime = performance.now();
    accumulator = 0;
  }
}

function showPauseOverlay() {
  if (!pauseOverlay) {
    return;
  }
  pauseOverlay.classList.add("is-active");
  pauseOverlay.setAttribute("aria-hidden", "false");
}

function hidePauseOverlay() {
  if (!pauseOverlay) {
    return;
  }
  pauseOverlay.classList.remove("is-active");
  pauseOverlay.setAttribute("aria-hidden", "true");
}

function updateSoundToggle() {
  soundToggle.textContent = soundEnabled ? "Sound: On" : "Sound: Off";
}

function updateHapticsToggle() {
  hapticsToggle.textContent = hapticsEnabled ? "Haptics: On" : "Haptics: Off";
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
    stopGame({ save: false });
    showScreen(menuScreen);
  });

  pauseButton.addEventListener("click", () => {
    setPaused(!gameState?.paused);
  });

  resumePauseButton.addEventListener("click", () => {
    setPaused(false);
  });

  pauseMenuButton.addEventListener("click", () => {
    stopGame();
    showScreen(menuScreen);
  });

  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(soundKey, String(soundEnabled));
    updateSoundToggle();
  });

  hapticsToggle.addEventListener("click", () => {
    hapticsEnabled = !hapticsEnabled;
    localStorage.setItem(hapticsKey, String(hapticsEnabled));
    updateHapticsToggle();
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
    if (event.key === " ") {
      setPaused(!gameState?.paused);
    }
  });

  let touchStart = null;

  const trackTouchStart = (event) => {
    if (!event.changedTouches?.length) {
      return;
    }
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  };

  const trackTouchEnd = (event) => {
    if (!touchStart || !event.changedTouches?.length) {
      return;
    }
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      return;
    }

    const nextDirection =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? directionMap.right
          : directionMap.left
        : dy > 0
          ? directionMap.down
          : directionMap.up;

    applyDirection(nextDirection);
  };

  canvas.addEventListener("touchstart", trackTouchStart, { passive: true });
  canvas.addEventListener("touchend", trackTouchEnd, { passive: true });
}

function showResumeOption() {
  const saved = loadGame();
  resumeButton.hidden = !saved;
}

bindButtons();
updateBestScoreUI();
updateSoundToggle();
updateHapticsToggle();
showResumeOption();
showScreen(menuScreen);
if (versionLabel) {
  versionLabel.textContent = `v${VERSION}`;
}

const persistGame = () => {
  if (document.visibilityState === "hidden") {
    saveGame();
  }
};

document.addEventListener("visibilitychange", persistGame);

window.addEventListener("beforeunload", () => {
  saveGame();
});
