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
const scoreFireworks = document.getElementById("scoreFireworks");
const gateChargeLabel = document.getElementById("gateCharge");
const stormOverlay = document.getElementById("stormOverlay");
const summaryLine = document.getElementById("summaryLine");
const runTimeSummary = document.getElementById("runTimeSummary");
const maxIntensitySummary = document.getElementById("maxIntensitySummary");
const powerToast = document.getElementById("powerToast");
const newBestLine = document.getElementById("newBestLine");
const usernameOverlay = document.getElementById("usernameOverlay");
const usernameInput = document.getElementById("usernameInput");
const saveUsernameButton = document.getElementById("saveUsernameButton");
const cancelUsernameButton = document.getElementById("cancelUsernameButton");
const usernameWarning = document.getElementById("usernameWarning");
const usernameError = document.getElementById("usernameError");
const usernameLabel = document.getElementById("usernameLabel");
const changeUsernameButton = document.getElementById("changeUsernameButton");
const submitScoreButton = document.getElementById("submitScoreButton");
const submitScoreStatus = document.getElementById("submitScoreStatus");
const leaderboardBody = document.getElementById("leaderboardBody");
const leaderboardStatus = document.getElementById("leaderboardStatus");

const VERSION = "0.8";
const gridSize = 18;
const cellSize = canvas.width / gridSize;
const foodMargin = 1;
const emberColors = ["#ff7a63", "#ff9f45", "#ffd166", "#ff4fd8", "#3de7ff"];

const BASE_STEP_MS = 270;
const MIN_STEP_MS = 120;
const RAMP_PER_POINT = 2.3;
const COUNTDOWN_STEPS = ["3", "2", "1", "GO"];
const COUNTDOWN_STEP_MS = 250;
const SWIPE_THRESHOLD = 24;

const TRAIL_LIFETIME_MS = 2600;
const OVERHEAT_MS = 800;
const OVERHEAT_DAMPEN_MS = 180;
const STORM_MIN_MS = 20000;
const STORM_MAX_MS = 35000;
const STORM_DURATION_MIN = 3000;
const STORM_DURATION_MAX = 5000;
const STORM_SPEED_FACTOR = 0.88;
const OVERHEAT_SPEED_FACTOR = 1.35;
const TOTEM_MIN_MS = 18000;
const TOTEM_MAX_MS = 26000;
const TOTEM_DURATION_MS = 9000;
const GATE_DURATION_MS = 5000;
const TRAIL_PENALTY_COOLDOWN_MS = 320;

const saveKey = "neon-dust-save";
const bestScoreKey = "snakeBestScore";
const soundKey = "snakeSoundEnabled";
const hapticsKey = "snakeHapticsEnabled";
const usernameKey = "emberRunUsername";

const supabaseConfig = window.SUPABASE_CONFIG || {};
const supabaseUrl = "https://cqfcyezpcsaxaxrpcebr.supabase.co";
const supabaseAnonKey = "sb_publishable_PgxiGMNGhZxW342PKnyUwQ_2bjGRrfQ";


const summaryLines = [
  "The dust wins.",
  "Too hot to hold.",
  "You found the edge of the playa.",
  "Embers remember your run.",
  "Bass fades into dawn.",
  "The dust wins. lingo, lingo.",
];

let gameState = null;
let rafId = null;
let lastTime = 0;
let accumulator = 0;
let countdownTimer = null;
let bestScore = Number(localStorage.getItem(bestScoreKey) || 0);
let soundEnabled = localStorage.getItem(soundKey) !== "false";
let hapticsEnabled = localStorage.getItem(hapticsKey) !== "false";
let audioCtx = null;
let audioUnlocked = false;
let leaderboardUsername = null;
let supabaseClient = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      return null;
    }
    audioCtx = new AC();
  }
  return audioCtx;
}

async function unlockAudio() {
  const ctx = getAudioCtx();
  if (!ctx) {
    return;
  }

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {}
  }

  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.01);
  } catch {}

  audioUnlocked = true;
}

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey || !window.supabase) {
    return null;
  }
  return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
}

function normalizeUsername(value) {
  if (!value) {
    return "";
  }
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length < 1 || collapsed.length > 24) {
    return "";
  }
  if (/[\u0000-\u001F\u007F]/.test(collapsed)) {
    return "";
  }
  return collapsed;
}

function showUsernameError(message) {
  if (!usernameError) {
    return;
  }
  usernameError.textContent = message;
  usernameError.hidden = !message;
}

function loadUsername() {
  return normalizeUsername(localStorage.getItem(usernameKey));
}

function setUsername(value) {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return false;
  }
  leaderboardUsername = normalized;
  localStorage.setItem(usernameKey, normalized);
  updateUsernameUI();
  return true;
}

function updateUsernameUI() {
  if (usernameLabel) {
    usernameLabel.textContent = leaderboardUsername || "---";
  }
}

function openUsernameGate({ isChange } = { isChange: false }) {
  if (!usernameOverlay) {
    return;
  }
  usernameOverlay.classList.add("is-active");
  usernameOverlay.setAttribute("aria-hidden", "false");
  usernameInput.value = leaderboardUsername || "";
  if (usernameError) {
    usernameError.hidden = true;
  }
  usernameWarning.hidden = !isChange;
  cancelUsernameButton.hidden = !isChange;
  usernameInput.focus();
}

function closeUsernameGate() {
  if (!usernameOverlay) {
    return;
  }
  usernameOverlay.classList.remove("is-active");
  usernameOverlay.setAttribute("aria-hidden", "true");
}

function ensureUsername() {
  leaderboardUsername = loadUsername();
  updateUsernameUI();
  if (!leaderboardUsername) {
    openUsernameGate({ isChange: false });
  }
}

function setLeaderboardStatus(message, tone = "muted") {
  if (!leaderboardStatus) {
    return;
  }
  leaderboardStatus.textContent = message;
  leaderboardStatus.dataset.tone = tone;
}

function renderLeaderboard(rows) {
  if (!leaderboardBody) {
    return;
  }
  leaderboardBody.innerHTML = "";
  if (!rows.length) {
    const emptyRow = document.createElement("div");
    emptyRow.className = "leaderboard-row";
    emptyRow.innerHTML = "<span>—</span><span>No scores yet</span><span>—</span>";
    leaderboardBody.appendChild(emptyRow);
    return;
  }
  rows.forEach((row, index) => {
    const entry = document.createElement("div");
    entry.className = "leaderboard-row";
    entry.innerHTML = `<span>${index + 1}</span><span>${row.username}</span><span>${row.high_score}</span>`;
    leaderboardBody.appendChild(entry);
  });
}

async function loadLeaderboard() {
  if (!supabaseClient) {
    setLeaderboardStatus("SUPABASE NOT CONFIGURED");
    return [];
  }

  const { data, error } = await supabaseClient
    .from("leaderboard_scores")
    .select("username, high_score")
    .order("high_score", { ascending: false })
    .limit(50);

  if (error) {
    console.log("LEADERBOARD ERROR:", error);
    setLeaderboardStatus(`UNABLE TO LOAD: ${error.message}`);
    return [];
  }

  setLeaderboardStatus("Top 50");
  return data || [];
}


async function submitScoreViaSupabase(score) {
  try {
    if (!leaderboardUsername) {
      return { ok: false, message: "No username" };
    }

    const FUNCTION_URL =
      "https://cqfcyezpcsaxaxrpcebr.supabase.co/functions/v1/dynamic-responder";

    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        username: leaderboardUsername,
        score: score,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok !== true) {
      return {
        ok: false,
        message: data?.error || "Unable to submit score.",
      };
    }

    return { ok: true };

  } catch (err) {
    console.error("submitScoreViaSupabase failed", err);
    return { ok: false, message: "Unable to submit score." };
  }
}

async function submitScore(score) {
  if (!leaderboardUsername) {
    openUsernameGate({ isChange: false });
    return;
  }
  if (!submitScoreStatus) {
    return;
  }
  submitScoreStatus.textContent = "Submitting…";
  const trySupabaseFallback = async () => {
    const result = await submitScoreViaSupabase(score);
    if (result.ok) {
      submitScoreStatus.textContent = "Score locked in.";
      loadLeaderboard();
      return true;
    }
    if (result.message) {
      submitScoreStatus.textContent = result.message;
      return true;
    }
    return false;
  };
  try {
    const response = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: leaderboardUsername, score }),
    });
    if (!response.ok) {
      let payload = null;
      let rawText = "";
      try {
        payload = await response.json();
      } catch {
        rawText = await response.text().catch(() => "");
      }
      if (await trySupabaseFallback()) {
        return;
      }
      submitScoreStatus.textContent =
        payload?.error ||
        (rawText.trim().length > 0 ? rawText.trim() : "Unable to submit score.");
      return;
    }
    submitScoreStatus.textContent = "Score locked in.";
    loadLeaderboard();
  } catch {
    if (await trySupabaseFallback()) {
      return;
    }
    submitScoreStatus.textContent = "Network error. Try again.";
  }
}
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
  score: 0,
  running: false,
  paused: false,
  countdown: false,
  trail: [],
  overheatUntil: 0,
  lastTrailPenalty: 0,
  nextStormAt: 0,
  stormActiveUntil: 0,
  nextTotemAt: 0,
  totem: null,
  gateCharge: 0,
  gateExpiresAt: 0,
  newBestAchieved: false,
  startTime: 0,
  minStepMs: BASE_STEP_MS,
  lastDirectionChange: 0,
});

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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
  const now = performance.now();
  if (gameState.overheatUntil > now && now - gameState.lastDirectionChange < OVERHEAT_DAMPEN_MS) {
    return;
  }
  gameState.queuedDirection = next;
  gameState.lastDirectionChange = now;
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

function updateGateChargeUI() {
  if (!gateChargeLabel) {
    return;
  }
  const charge = gameState?.gateCharge ?? 0;
  gateChargeLabel.textContent = `Gate Charge: ${charge}`;
}

function triggerScoreFireworks() {
  if (!scoreFireworks) {
    return;
  }
  scoreFireworks.classList.remove("is-active");
  void scoreFireworks.offsetWidth;
  scoreFireworks.classList.add("is-active");
}

let toastTimeout = null;

function showToast(message, duration = 1200) {
  if (!powerToast) {
    return;
  }
  powerToast.textContent = message;
  powerToast.classList.add("is-active");
  powerToast.setAttribute("aria-hidden", "false");
  if (toastTimeout) {
    window.clearTimeout(toastTimeout);
  }
  toastTimeout = window.setTimeout(() => {
    powerToast.classList.remove("is-active");
    powerToast.setAttribute("aria-hidden", "true");
  }, duration);
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
  document.body.classList.toggle("is-game-active", isGame);
  document.body.style.overflow = isGame ? "hidden" : "";
  document.body.style.touchAction = isGame ? "none" : "";
  if (screen === menuScreen) {
    showResumeOption();
    loadLeaderboard();
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
  safeState.trail = Array.isArray(safeState.trail) ? safeState.trail : [];

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
    safeState.food = placeFood(safeState.snake, safeState.trail, safeState.totem);
  } else if (
    safeState.food.x < foodMargin ||
    safeState.food.x >= gridSize - foodMargin ||
    safeState.food.y < foodMargin ||
    safeState.food.y >= gridSize - foodMargin
  ) {
    safeState.food = placeFood(safeState.snake, safeState.trail, safeState.totem);
  } else if (safeState.snake.some((segment) => positionsEqual(segment, safeState.food))) {
    safeState.food = placeFood(safeState.snake, safeState.trail, safeState.totem);
  }

  if (typeof safeState.score !== "number" || safeState.score < 0) {
    safeState.score = 0;
  }

  safeState.running = true;
  safeState.paused = false;
  safeState.countdown = false;
  safeState.trail = [];
  safeState.overheatUntil = 0;
  safeState.lastTrailPenalty = 0;
  safeState.stormActiveUntil = 0;
  safeState.totem = null;
  safeState.gateCharge = 0;
  safeState.gateExpiresAt = 0;
  safeState.newBestAchieved = false;
  safeState.startTime = 0;
  safeState.minStepMs = BASE_STEP_MS;
  safeState.lastDirectionChange = 0;

  return safeState;
}

function startGame(state = defaultState()) {
  stopLoop();
  const mergedState = sanitizeStateForStart(state);
  gameState = {
    ...mergedState,
  };
  const now = performance.now();
  gameState.nextStormAt = now + randomBetween(STORM_MIN_MS, STORM_MAX_MS);
  gameState.nextTotemAt = now + randomBetween(TOTEM_MIN_MS, TOTEM_MAX_MS);
  lastTime = now;
  accumulator = 0;
  updateScore();
  updateGateChargeUI();
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
  const isNewBest = gameState.newBestAchieved || gameState.score > bestScore;
  fireworks.length = 0;
  clearCountdown();
  hidePauseOverlay();
  stopLoop();
  updateBestScore(gameState.score);
  finalScore.textContent = gameState.score.toString();
  updateSummaryStats();
  updateNewBestLine(isNewBest);
  if (submitScoreStatus) {
    submitScoreStatus.textContent = "Send your score to the global board.";
  }
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

function getStepDuration(now) {
  const points = gameState ? gameState.score / 10 : 0;
  let duration = Math.max(MIN_STEP_MS, BASE_STEP_MS - points * RAMP_PER_POINT);
  if (now < gameState.stormActiveUntil) {
    duration *= STORM_SPEED_FACTOR;
  }
  if (now < gameState.overheatUntil) {
    duration *= OVERHEAT_SPEED_FACTOR;
  }
  return duration;
}

function loop(timestamp) {
  if (!gameState || !gameState.running) {
    return;
  }
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  if (!gameState.paused && !gameState.countdown) {
    updateStateTimers(timestamp);
    accumulator += delta;
    const stepDuration = getStepDuration(timestamp);
    gameState.minStepMs = Math.min(gameState.minStepMs, stepDuration);
    while (accumulator >= stepDuration) {
      step(timestamp);
      accumulator -= stepDuration;
    }
    updateFireworks(delta);
  } else {
    accumulator = 0;
  }

  draw(timestamp);
  rafId = requestAnimationFrame(loop);
}

function updateStateTimers(now) {
  trimTrail(now);
  updateStorm(now);
  updateTotem(now);
  if (gameState.gateCharge > 0 && now > gameState.gateExpiresAt) {
    gameState.gateCharge = 0;
    updateGateChargeUI();
  }
}

function updateStorm(now) {
  if (now >= gameState.nextStormAt) {
    gameState.stormActiveUntil = now + randomBetween(STORM_DURATION_MIN, STORM_DURATION_MAX);
    gameState.nextStormAt = now + randomBetween(STORM_MIN_MS, STORM_MAX_MS);
  }
  const stormActive = now < gameState.stormActiveUntil;
  if (gameScreen) {
    gameScreen.classList.toggle("storm-active", stormActive);
  }
  if (stormOverlay) {
    stormOverlay.setAttribute("aria-hidden", String(!stormActive));
  }
}

function updateTotem(now) {
  if (gameState.totem && now > gameState.totem.expiresAt) {
    gameState.totem = null;
    gameState.nextTotemAt = now + randomBetween(TOTEM_MIN_MS, TOTEM_MAX_MS);
  }
  if (!gameState.totem && now >= gameState.nextTotemAt) {
    gameState.totem = placeTotem(gameState.snake, gameState.trail, gameState.food);
    gameState.totem.expiresAt = now + TOTEM_DURATION_MS;
    gameState.nextTotemAt = now + randomBetween(TOTEM_MIN_MS, TOTEM_MAX_MS);
  }
}

function step(now) {
  gameState.direction = gameState.queuedDirection;
  const head = gameState.snake[0];
  let next = { x: head.x + gameState.direction.x, y: head.y + gameState.direction.y };

  const hitWall = next.x < 0 || next.x >= gridSize || next.y < 0 || next.y >= gridSize;
  const canUseGate = gameState.gateCharge > 0 && now < gameState.gateExpiresAt;
  if (hitWall && canUseGate) {
    gameState.gateCharge = 0;
    updateGateChargeUI();
    next = {
      x: (next.x + gridSize) % gridSize,
      y: (next.y + gridSize) % gridSize,
    };
  } else if (hitWall) {
    endGame();
    return;
  }

  const hitSelf = gameState.snake.slice(1).some((segment) => positionsEqual(segment, next));
  if (hitSelf) {
    endGame();
    return;
  }

  if (isTrailHit(next, now)) {
    applyTrailPenalty(now);
  }

  gameState.trail.push({ x: head.x, y: head.y, time: now });
  gameState.snake.unshift(next);

  if (gameState.totem && positionsEqual(next, gameState.totem)) {
    gameState.gateCharge = 1;
    gameState.gateExpiresAt = now + GATE_DURATION_MS;
    updateGateChargeUI();
    gameState.totem = null;
    showToast("Totem hears you: lingo, lingo.");
    playPowerupEffects();
  }

  if (positionsEqual(next, gameState.food)) {
    gameState.score += 10;
    if (!gameState.newBestAchieved && gameState.score > bestScore) {
      gameState.newBestAchieved = true;
    }
    spawnFireworks(next);
    triggerScoreFireworks();
    gameState.food = placeFood();
    playEatEffects();
  } else {
    gameState.snake.pop();
  }

  updateScore();
  saveGame();
}

function isTrailHit(position, now) {
  return gameState.trail.some(
    (segment) =>
      now - segment.time <= TRAIL_LIFETIME_MS && positionsEqual(segment, position)
  );
}

function applyTrailPenalty(now) {
  if (now - gameState.lastTrailPenalty < TRAIL_PENALTY_COOLDOWN_MS) {
    return;
  }
  gameState.overheatUntil = Math.max(gameState.overheatUntil, now + OVERHEAT_MS);
  gameState.lastTrailPenalty = now;
  playPenaltyEffects();
}

function playEatEffects() {
  haptic(15);
  sfxEat();
}

function playPenaltyEffects() {
  haptic(35);
  sfxPenalty();
}

function playPowerupEffects() {
  haptic(22);
  sfxPowerUp();
}

function playGameOverEffects() {
  haptic(60);
  sfxGameOver();
}

function playTone({
  freq = 440,
  dur = 0.08,
  type = "sine",
  vol = 0.07,
  slideTo = null,
}) {
  if (!soundEnabled || !audioUnlocked) {
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== "running") {
    return;
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo != null) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  }

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + dur);
}

function sfxEat() {
  playTone({ freq: 880, dur: 0.06, type: "triangle", vol: 0.06 });
}

function sfxPenalty() {
  playTone({ freq: 130, dur: 0.16, type: "sawtooth", vol: 0.05 });
}

function sfxGameOver() {
  playTone({ freq: 220, slideTo: 90, dur: 0.25, type: "sawtooth", vol: 0.05 });
}

function sfxPowerUp() {
  playTone({ freq: 520, slideTo: 1040, dur: 0.12, type: "square", vol: 0.04 });
}

function canVibrate() {
  return "vibrate" in navigator && typeof navigator.vibrate === "function";
}

function pulseUI() {
  const el = document.querySelector(".app");
  if (!el) {
    return;
  }
  el.classList.remove("pulse");
  void el.offsetWidth;
  el.classList.add("pulse");
}

function haptic(ms) {
  if (!hapticsEnabled) {
    return;
  }
  if (!canVibrate()) {
    pulseUI();
    return;
  }
  navigator.vibrate(ms);
}

function spawnFireworks(position) {
  const colors = ["#ff7a63", "#ffd166", "#3de7ff", "#ff4fd8"];
  const centerX = position.x * cellSize + cellSize / 2;
  const centerY = position.y * cellSize + cellSize / 2;
  const burstCount = 16;

  for (let i = 0; i < burstCount; i += 1) {
    const angle = (Math.PI * 2 * i) / burstCount;
    const speed = 1.4 + Math.random() * 1.6;
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

function placeFood(snake = gameState.snake, trail = gameState.trail, totem = gameState.totem) {
  let position = randomFoodPosition();
  while (
    snake.some((segment) => positionsEqual(segment, position)) ||
    trail.some((segment) => positionsEqual(segment, position)) ||
    (totem && positionsEqual(totem, position))
  ) {
    position = randomFoodPosition();
  }
  return position;
}

function placeTotem(snake, trail, food) {
  let position = randomFoodPosition();
  while (
    snake.some((segment) => positionsEqual(segment, position)) ||
    trail.some((segment) => positionsEqual(segment, position)) ||
    positionsEqual(food, position)
  ) {
    position = randomFoodPosition();
  }
  return { ...position };
}

function trimTrail(now) {
  gameState.trail = gameState.trail.filter(
    (segment) => now - segment.time <= TRAIL_LIFETIME_MS
  );
}

function draw(timestamp) {
  context.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#060610");
  gradient.addColorStop(0.5, "#120c24");
  gradient.addColorStop(1, "#0b0a18");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 255, 255, 0.03)";
  for (let x = 0; x < gridSize; x += 1) {
    for (let y = 0; y < gridSize; y += 1) {
      if ((x + y) % 2 === 0) {
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  drawTrail(timestamp);
  drawFood();
  drawTotem();
  drawSnake();

  fireworks.forEach((spark) => {
    const alpha = Math.max(spark.life / spark.maxLife, 0);
    context.fillStyle = `rgba(${hexToRgb(spark.color)}, ${alpha})`;
    context.beginPath();
    context.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    context.fill();
  });

  if (timestamp < gameState.overheatUntil) {
    context.fillStyle = "rgba(255, 116, 77, 0.08)";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawTrail(now) {
  gameState.trail.forEach((segment) => {
    const age = now - segment.time;
    if (age > TRAIL_LIFETIME_MS) {
      return;
    }
    const alpha = 1 - age / TRAIL_LIFETIME_MS;
    const glow = context.createRadialGradient(
      segment.x * cellSize + cellSize / 2,
      segment.y * cellSize + cellSize / 2,
      2,
      segment.x * cellSize + cellSize / 2,
      segment.y * cellSize + cellSize / 2,
      cellSize
    );
    glow.addColorStop(0, `rgba(255, 148, 84, ${0.45 * alpha})`);
    glow.addColorStop(1, "rgba(255, 148, 84, 0)");
    context.fillStyle = glow;
    context.fillRect(
      segment.x * cellSize,
      segment.y * cellSize,
      cellSize,
      cellSize
    );
  });
}

function drawFood() {
  const centerX = gameState.food.x * cellSize + cellSize / 2;
  const centerY = gameState.food.y * cellSize + cellSize / 2;
  const orb = context.createRadialGradient(centerX, centerY, 2, centerX, centerY, cellSize);
  orb.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  orb.addColorStop(0.2, "rgba(255, 180, 84, 0.95)");
  orb.addColorStop(0.6, "rgba(255, 96, 88, 0.5)");
  orb.addColorStop(1, "rgba(255, 96, 88, 0)");
  context.fillStyle = orb;
  context.beginPath();
  context.arc(centerX, centerY, cellSize * 0.4, 0, Math.PI * 2);
  context.fill();
}

function drawTotem() {
  if (!gameState.totem) {
    return;
  }
  const centerX = gameState.totem.x * cellSize + cellSize / 2;
  const centerY = gameState.totem.y * cellSize + cellSize / 2;
  context.save();
  context.strokeStyle = "rgba(61, 231, 255, 0.9)";
  context.lineWidth = 2;
  context.shadowColor = "rgba(61, 231, 255, 0.8)";
  context.shadowBlur = 10;
  context.beginPath();
  context.moveTo(centerX, centerY - 10);
  context.lineTo(centerX + 10, centerY);
  context.lineTo(centerX, centerY + 10);
  context.lineTo(centerX - 10, centerY);
  context.closePath();
  context.stroke();
  context.restore();
}

function drawSnake() {
  gameState.snake.forEach((segment, index) => {
    const isHead = index === 0;
    const color = emberColors[index % emberColors.length];
    context.fillStyle = color;
    context.shadowColor = isHead ? "rgba(255, 79, 216, 0.6)" : "rgba(255, 180, 84, 0.3)";
    context.shadowBlur = isHead ? 14 : 8;
    context.beginPath();
    context.roundRect(
      segment.x * cellSize + 2,
      segment.y * cellSize + 2,
      cellSize - 4,
      cellSize - 4,
      8
    );
    context.fill();
  });
  context.shadowBlur = 0;
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
  gameState.startTime = performance.now();
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

function updateSummaryStats() {
  if (summaryLine) {
    summaryLine.textContent = summaryLines[Math.floor(Math.random() * summaryLines.length)];
  }
  if (runTimeSummary) {
    const endTime = performance.now();
    const duration = Math.max(0, endTime - (gameState.startTime || endTime));
    runTimeSummary.textContent = formatTime(duration);
  }
  if (maxIntensitySummary) {
    const intensity = Math.round(1000 / Math.max(gameState.minStepMs, MIN_STEP_MS));
    maxIntensitySummary.textContent = intensity.toString();
  }
}

function updateNewBestLine(isNewBest) {
  if (!newBestLine) {
    return;
  }
  newBestLine.hidden = !isNewBest;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function bindButtons() {
  startButton.addEventListener("click", () => {
    clearSavedGame();
    unlockAudio();
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
    unlockAudio();
    updateSoundToggle();
  });

  hapticsToggle.addEventListener("click", () => {
    hapticsEnabled = !hapticsEnabled;
    localStorage.setItem(hapticsKey, String(hapticsEnabled));
    updateHapticsToggle();
  });

  saveUsernameButton.addEventListener("click", () => {
    const nextName = usernameInput.value;
    if (!setUsername(nextName)) {
      showUsernameError("Use 1–24 characters with no control symbols.");
      return;
    }
    showUsernameError("");
    closeUsernameGate();
    loadLeaderboard();
  });

  cancelUsernameButton.addEventListener("click", () => {
    closeUsernameGate();
  });

  changeUsernameButton.addEventListener("click", () => {
    openUsernameGate({ isChange: true });
  });

  submitScoreButton.addEventListener("click", () => {
    if (!gameState) {
      return;
    }
    submitScore(gameState.score);
  });

  const directionMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  document.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    if (keyMap[event.key]) {
      event.preventDefault();
      applyDirection(keyMap[event.key]);
    }
    if (event.key === " ") {
      event.preventDefault();
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

  const touchTarget = gameScreen || canvas;
  touchTarget.addEventListener("touchstart", trackTouchStart, { passive: true });
  touchTarget.addEventListener("touchend", trackTouchEnd, { passive: true });
}

function showResumeOption() {
  const saved = loadGame();
  resumeButton.hidden = !saved;
}

bindButtons();
supabaseClient = createSupabaseClient();
ensureUsername();
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
