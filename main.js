const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const speedEl = document.getElementById("speed");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");

// Мобильные элементы управления
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");
const btnLeft = document.getElementById("btnLeft");
const btnRight = document.getElementById("btnRight");

const GRID_CELLS = 30; // 30x30 grid
let CELL_SIZE;
const BASE_SPEED_FPS = 8; // base steps per second
const STORAGE_KEY = "snakeHighScore";

// Функция для расчета размера canvas
function calculateCanvasSize() {
    const container = canvas.parentElement;
    const containerRect = container.getBoundingClientRect();
    const padding = 24; // padding контейнера
    const availableWidth = containerRect.width - padding;
    const availableHeight = Math.min(containerRect.height - padding, window.innerHeight * 0.7);

    // Ограничения: максимум 80% ширины и 70% высоты экрана
    const maxWidth = Math.min(availableWidth, window.innerWidth * 0.8);
    const maxHeight = Math.min(availableHeight, window.innerHeight * 0.7);

    // Выбираем меньший размер для квадратного поля
    const maxSize = Math.min(maxWidth, maxHeight);

    // Рассчитываем размер клетки для сетки 30x30
    const cellSize = Math.floor(maxSize / GRID_CELLS);
    const canvasSize = cellSize * GRID_CELLS;

    return { size: canvasSize, cellSize };
}

// Функция для обновления размера canvas
function resizeCanvas() {
    const { size, cellSize } = calculateCanvasSize();
    CELL_SIZE = cellSize;

    canvas.width = size;
    canvas.height = size;

    // Перерисовываем игру
    if (state) {
        draw();
    }
}

function createInitialState() {
    const startX = Math.floor(GRID_CELLS / 2);
    const startY = Math.floor(GRID_CELLS / 2);
    return {
        snake: [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY },
        ],
        direction: { x: 1, y: 0 },
        queuedDirection: { x: 1, y: 0 },
        apple: spawnApple(new Set([key(startX, startY), key(startX - 1, startY), key(startX - 2, startY)])),
        score: 0,
        highScore: Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0,
        paused: false,
        gameOver: false,
        speedMultiplier: 1,
        stepAccumulator: 0,
        lastTs: performance.now(),
    };
}

function key(x, y) { return `${x},${y}`; }

function spawnApple(occupied) {
    while (true) {
        const x = Math.floor(Math.random() * GRID_CELLS);
        const y = Math.floor(Math.random() * GRID_CELLS);
        if (!occupied.has(key(x, y))) return { x, y };
    }
}

let state;

function resetGame() {
    state = createInitialState();
    // Устанавливаем скорость из слайдера при рестарте
    state.speedMultiplier = parseFloat(speedSlider.value);
    // Пересчитываем размер canvas
    resizeCanvas();
    updateHUD();
    hideOverlay();
}

function handleSpeedChange() {
    const newSpeed = parseFloat(speedSlider.value);
    state.speedMultiplier = newSpeed;
    updateHUD();
}

function updateHUD() {
    scoreEl.textContent = String(state.score);
    highScoreEl.textContent = String(state.highScore);
    speedEl.textContent = `${state.speedMultiplier.toFixed(1)}x`;
    speedValue.textContent = `${state.speedMultiplier.toFixed(1)}x`;
    pauseBtn.setAttribute("aria-pressed", state.paused ? "true" : "false");
    pauseBtn.textContent = state.paused ? "Resume (Space)" : "Pause (Space)";
}

function showOverlay(title, subtitle) {
    overlay.classList.remove("hidden");
    overlay.innerHTML = `<div class="panel"><h2 class="title">${title}</h2><p class="subtitle">${subtitle}</p></div>`;
}

function hideOverlay() {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
}

function togglePause() {
    if (state.gameOver) return;
    state.paused = !state.paused;
    state.lastTs = performance.now();
    updateHUD();
    if (state.paused) {
        showOverlay("Paused", "Press Space to resume");
    } else {
        hideOverlay();
    }
}

function handleInput(e) {
    const code = e.code;
    if (code === "Space") {
        e.preventDefault();
        togglePause();
        return;
    }
    if (code === "KeyR") {
        e.preventDefault();
        resetGame();
        return;
    }
    let next = null;
    if (code === "ArrowUp" || code === "KeyW") next = { x: 0, y: -1 };
    if (code === "ArrowDown" || code === "KeyS") next = { x: 0, y: 1 };
    if (code === "ArrowLeft" || code === "KeyA") next = { x: -1, y: 0 };
    if (code === "ArrowRight" || code === "KeyD") next = { x: 1, y: 0 };
    if (!next) return;
    const curr = state.direction;
    if (curr.x + next.x === 0 && curr.y + next.y === 0) return;
    state.queuedDirection = next;
}

// Функция для обработки мобильного ввода
function handleMobileInput(direction) {
    if (state.gameOver || state.paused) return;

    const curr = state.direction;
    if (curr.x + direction.x === 0 && curr.y + direction.y === 0) return;
    state.queuedDirection = direction;
}

function step() {
    state.direction = state.queuedDirection;
    const head = state.snake[0];
    const newHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };

    if (newHead.x < 0 || newHead.y < 0 || newHead.x >= GRID_CELLS || newHead.y >= GRID_CELLS) {
        return gameOver();
    }
    for (let i = 0; i < state.snake.length; i++) {
        const s = state.snake[i];
        if (s.x === newHead.x && s.y === newHead.y) {
            return gameOver();
        }
    }

    state.snake.unshift(newHead);

    if (newHead.x === state.apple.x && newHead.y === state.apple.y) {
        state.score += 1;
        const occupied = new Set(state.snake.map(p => key(p.x, p.y)));
        state.apple = spawnApple(occupied);
        if (state.score % 5 === 0) {
            state.speedMultiplier = Math.min(3, state.speedMultiplier + 0.1);
        }
    } else {
        state.snake.pop();
    }

    updateHUD();
}

function gameOver() {
    state.gameOver = true;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem(STORAGE_KEY, String(state.highScore));
    }
    updateHUD();
    showOverlay("Game Over", "Press R to restart");
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let i = 0; i <= GRID_CELLS; i++) {
        const p = i * CELL_SIZE;
        ctx.fillRect(p, 0, 1, canvas.height);
        ctx.fillRect(0, p, canvas.width, 1);
    }

    drawRoundedCell(state.apple.x, state.apple.y, "#ff6b6b");

    for (let i = state.snake.length - 1; i >= 0; i--) {
        const seg = state.snake[i];
        const isHead = i === 0;
        const color = isHead ? "#6ae36a" : "#3acb3a";
        drawRoundedCell(seg.x, seg.y, color);
    }
}

function drawRoundedCell(gridX, gridY, color) {
    const x = gridX * CELL_SIZE;
    const y = gridY * CELL_SIZE;
    const r = Math.max(3, Math.floor(CELL_SIZE * 0.2));
    const w = CELL_SIZE;
    const h = CELL_SIZE;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
}

function loop(ts) {
    const dt = Math.min(64, ts - state.lastTs);
    state.lastTs = ts;
    if (!state.paused && !state.gameOver) {
        const stepIntervalMs = 1000 / (BASE_SPEED_FPS * state.speedMultiplier);
        state.stepAccumulator += dt;
        while (state.stepAccumulator >= stepIntervalMs) {
            state.stepAccumulator -= stepIntervalMs;
            step();
        }
    }
    draw();
    requestAnimationFrame(loop);
}

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);
speedSlider.addEventListener("input", handleSpeedChange);
window.addEventListener("keydown", handleInput);
window.addEventListener("resize", resizeCanvas);

// Обработчики для мобильных кнопок
btnUp.addEventListener("click", () => handleMobileInput({ x: 0, y: -1 }));
btnDown.addEventListener("click", () => handleMobileInput({ x: 0, y: 1 }));
btnLeft.addEventListener("click", () => handleMobileInput({ x: -1, y: 0 }));
btnRight.addEventListener("click", () => handleMobileInput({ x: 1, y: 0 }));

// Обработчики для touch событий (предотвращение двойного тапа)
btnUp.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleMobileInput({ x: 0, y: -1 });
});
btnDown.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleMobileInput({ x: 0, y: 1 });
});
btnLeft.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleMobileInput({ x: -1, y: 0 });
});
btnRight.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleMobileInput({ x: 1, y: 0 });
});

// Инициализация
resizeCanvas();
state = createInitialState();
updateHUD();
requestAnimationFrame((ts) => { state.lastTs = ts; requestAnimationFrame(loop); });