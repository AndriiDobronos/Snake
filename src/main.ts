type Vector2 = { x: number; y: number };
interface GameState {
    snake: Vector2[];
    direction: Vector2;
    queuedDirection: Vector2;
    apple: Vector2;
    score: number;
    highScore: number;
    paused: boolean;
    gameOver: boolean;
    speedMultiplier: number;
    stepAccumulator: number;
    lastTs: number;
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
const scoreEl = document.getElementById("score") as HTMLElement;
const highScoreEl = document.getElementById("highScore") as HTMLElement;
const speedEl = document.getElementById("speed") as HTMLElement;
const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement;
const restartBtn = document.getElementById("restartBtn") as HTMLButtonElement;
const overlay = document.getElementById("overlay") as HTMLDivElement;

const GRID_CELLS = 30;
const CELL_SIZE = Math.floor(canvas.width / GRID_CELLS);
const BASE_SPEED_FPS = 8;
const STORAGE_KEY = "snakeHighScore";

function key(x: number, y: number): string { return `${x},${y}`; }

function spawnApple(occupied: Set<string>): Vector2 {
    while (true) {
        const x = Math.floor(Math.random() * GRID_CELLS);
        const y = Math.floor(Math.random() * GRID_CELLS);
        if (!occupied.has(key(x, y))) return { x, y };
    }
}

function createInitialState(): GameState {
    const startX = Math.floor(GRID_CELLS / 2);
    const startY = Math.floor(GRID_CELLS / 2);
    const initialSnake: Vector2[] = [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY },
    ];
    const occupied = new Set(initialSnake.map(p => key(p.x, p.y)));
    const high = Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    return {
        snake: initialSnake,
        direction: { x: 1, y: 0 },
        queuedDirection: { x: 1, y: 0 },
        apple: spawnApple(occupied),
        score: 0,
        highScore: high,
        paused: false,
        gameOver: false,
        speedMultiplier: 1,
        stepAccumulator: 0,
        lastTs: performance.now(),
    };
}

let state: GameState = createInitialState();

function resetGame(): void {
    state = createInitialState();
    updateHUD();
    hideOverlay();
}

function updateHUD(): void {
    scoreEl.textContent = String(state.score);
    highScoreEl.textContent = String(state.highScore);
    speedEl.textContent = `${state.speedMultiplier.toFixed(1)}x`;
    pauseBtn.setAttribute("aria-pressed", state.paused ? "true" : "false");
    pauseBtn.textContent = state.paused ? "Resume (Space)" : "Pause (Space)";
}

function showOverlay(title: string, subtitle: string): void {
    overlay.classList.remove("hidden");
    overlay.innerHTML = `<div class="panel"><h2 class="title">${title}</h2><p class="subtitle">${subtitle}</p></div>`;
}

function hideOverlay(): void {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
}

function togglePause(): void {
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

function handleInput(e: KeyboardEvent): void {
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
    let next: Vector2 | null = null;
    if (code === "ArrowUp" || code === "KeyW") next = { x: 0, y: -1 };
    if (code === "ArrowDown" || code === "KeyS") next = { x: 0, y: 1 };
    if (code === "ArrowLeft" || code === "KeyA") next = { x: -1, y: 0 };
    if (code === "ArrowRight" || code === "KeyD") next = { x: 1, y: 0 };
    if (!next) return;
    const curr = state.direction;
    if (curr.x + next.x === 0 && curr.y + next.y === 0) return;
    state.queuedDirection = next;
}

function step(): void {
    state.direction = state.queuedDirection;
    const head = state.snake[0];
    const newHead: Vector2 = { x: head.x + state.direction.x, y: head.y + state.direction.y };

    if (newHead.x < 0 || newHead.y < 0 || newHead.x >= GRID_CELLS || newHead.y >= GRID_CELLS) {
        return gameOver();
    }
    for (let i = 0; i < state.snake.length; i++) {
        const s = state.snake[i];
        if (s.x === newHead.x && s.y === newHead.y) return gameOver();
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

function gameOver(): void {
    state.gameOver = true;
    if (state.score > state.highScore) {
        state.highScore = state.score;
        localStorage.setItem(STORAGE_KEY, String(state.highScore));
    }
    updateHUD();
    showOverlay("Game Over", "Press R to restart");
}

function draw(): void {
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

function drawRoundedCell(gridX: number, gridY: number, color: string): void {
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

function loop(ts: number): void {
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
window.addEventListener("keydown", handleInput);

updateHUD();
requestAnimationFrame((ts) => { state.lastTs = ts; requestAnimationFrame(loop); });
// {
//     "name": "snake-ts",
//     "private": true,
//     "version": "0.0.1",
//     "type": "module",
//     "scripts": {
//     "dev": "vite --open",
//         "build": "tsc && vite build",
//         "preview": "vite preview --open"
// },
//     "devDependencies": {
//     "typescript": "^5.5.0",
//         "vite": "^5.4.0"
// }
// }
// {
//     "compilerOptions": {
//     "target": "ES2020",
//         "useDefineForClassFields": true,
//         "module": "ESNext",
//         "moduleResolution": "Bundler",
//         "strict": true,
//         "baseUrl": ".",
//         "skipLibCheck": true
// },
//     "include": ["src"]
// }