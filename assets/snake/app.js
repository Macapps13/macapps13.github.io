// UI for snake.html: renders the board, runs the selected mode, and shows the
// network's inputs and outputs live. Game/network logic lives in engine.js.
(function () {
    'use strict';

    const { SnakeGame, QNet, Agent, ACTIONS, COLS, ROWS, RIGHT, DOWN, LEFT, UP, argmax } = window.SnakeAI;

    const CELL = 20;
    const COLORS = {
        bg: '#0a0f12',
        grid: '#172227',
        body: '#608a6d',
        head: '#a3c2ae',
        food: '#f1f5f9',
        text: '#f1f5f9',
        muted: '#94a3b8',
    };
    const SPEEDS = [5, 10, 20, 40, 80, Infinity];
    const PLAY_SPEED = 10;
    const FRAME_BUDGET_MS = 12;

    const STATE_SHORT = [
        'Danger ahead', 'Danger right', 'Danger left',
        'Heading ←', 'Heading →', 'Heading ↑', 'Heading ↓',
        'Food ←', 'Food →', 'Food ↑', 'Food ↓',
    ];

    const $ = id => document.getElementById(id);
    const board = $('board');
    const ctx = board.getContext('2d');
    const chart = $('chart');
    const chartCtx = chart.getContext('2d');

    const trainedNet = window.SNAKE_MODEL ? QNet.fromExport(window.SNAKE_MODEL) : null;

    // ------------------------------------------------------------ Sessions

    // One session per mode, kept when switching tabs so training progress
    // isn't lost. Reset replaces the current mode's session.
    function newSession(mode) {
        const s = { mode, game: new SnakeGame(), scores: [], means: [], total: 0, record: 0, last: null };
        if (mode === 'train') s.agent = new Agent(new QNet());
        else s.agent = new Agent(trainedNet || new QNet());
        if (mode === 'play') {
            s.started = false;
            s.over = false;
            s.dirQueue = [];
        }
        return s;
    }

    const sessions = {};
    let mode = 'watch';
    let paused = false;
    let speedIdx = 2;
    let acc = 0;
    let lastTs = 0;

    const session = () => sessions[mode] || (sessions[mode] = newSession(mode));

    // ---------------------------------------------------------------- Step

    function step(s) {
        const state = s.game.getState();
        let action, q, random = false;

        if (s.mode === 'play') {
            // Show what the trained network would do, but follow the player.
            q = s.agent.net.predict(state);
            const dir = s.dirQueue.length ? s.dirQueue.shift() : s.game.dir;
            action = s.game.actionToward(dir);
            s.last = { state, q, action: argmax(q), random: false };
        } else {
            ({ action, q, random } = s.agent.act(state, { explore: s.mode === 'train' }));
            s.last = { state, q, action, random };
        }

        const { reward, done, score } = s.game.step(action);

        if (s.mode === 'train') {
            const t = { state, action, reward, next: s.game.getState(), done };
            s.agent.trainShort(t);
            s.agent.remember(t);
        }

        if (done) endGame(s, score);
        return done;
    }

    function endGame(s, score) {
        s.scores.push(score);
        s.total += score;
        s.means.push(s.total / s.scores.length);
        s.record = Math.max(s.record, score);
        s.agent.nGames++;
        if (s.mode === 'train') s.agent.trainLong();
        drawChart();

        if (s.mode === 'play') {
            s.over = true;
            s.lastScore = score;
            showOverlay('Game over', `You scored ${score}. Press an arrow key (or swipe) to go again.`);
        } else {
            s.game.reset();
            s.last = null;
        }
    }

    // ---------------------------------------------------------------- Loop

    function frame(ts) {
        const dt = Math.min(100, ts - (lastTs || ts)) / 1000;
        lastTs = ts;
        const s = session();
        const running = !paused && !(s.mode === 'play' && (!s.started || s.over));

        if (running) {
            const sps = s.mode === 'play' ? PLAY_SPEED : SPEEDS[speedIdx];
            if (sps === Infinity) {
                const until = performance.now() + FRAME_BUDGET_MS;
                while (performance.now() < until) step(s);
            } else {
                acc += dt * sps;
                while (acc >= 1) {
                    acc -= 1;
                    if (step(s) && s.mode === 'play') break;
                }
            }
        }

        drawBoard(s);
        updatePanel(s);
        requestAnimationFrame(frame);
    }

    // ----------------------------------------------------------- Rendering

    function drawBoard(s) {
        const g = s.game;
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, board.width, board.height);

        ctx.fillStyle = COLORS.grid;
        for (let x = 1; x < COLS; x++) {
            for (let y = 1; y < ROWS; y++) ctx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
        }

        // Food
        ctx.save();
        ctx.shadowColor = 'rgba(163, 194, 174, 0.8)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = COLORS.food;
        ctx.beginPath();
        ctx.arc(g.food.x * CELL + CELL / 2, g.food.y * CELL + CELL / 2, CELL / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Snake, fading towards the tail. Skip segments outside the board
        // (the head after hitting a wall).
        const n = g.snake.length;
        for (let i = n - 1; i >= 0; i--) {
            const p = g.snake[i];
            if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) continue;
            ctx.globalAlpha = i === 0 ? 1 : 0.95 - 0.55 * (i / n);
            ctx.fillStyle = i === 0 ? COLORS.head : COLORS.body;
            roundRect(p.x * CELL + 1.5, p.y * CELL + 1.5, CELL - 3, CELL - 3, 5);
        }
        ctx.globalAlpha = 1;
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.fill();
    }

    function drawChart() {
        const s = session();
        const dpr = window.devicePixelRatio || 1;
        const w = chart.clientWidth, h = chart.clientHeight;
        if (chart.width !== Math.round(w * dpr) || chart.height !== Math.round(h * dpr)) {
            chart.width = Math.round(w * dpr);
            chart.height = Math.round(h * dpr);
        }
        chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        chartCtx.clearRect(0, 0, w, h);

        const pad = { l: 30, r: 8, t: 8, b: 18 };
        const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
        const yMax = Math.max(5, Math.ceil(s.record / 5) * 5);
        const n = s.scores.length;

        chartCtx.font = '10px "Fira Code", monospace';
        chartCtx.fillStyle = COLORS.muted;
        chartCtx.strokeStyle = COLORS.grid;
        chartCtx.lineWidth = 1;
        for (const frac of [0, 0.5, 1]) {
            const y = pad.t + ph - frac * ph;
            chartCtx.beginPath();
            chartCtx.moveTo(pad.l, y);
            chartCtx.lineTo(w - pad.r, y);
            chartCtx.stroke();
            chartCtx.textAlign = 'right';
            chartCtx.fillText(String(Math.round(frac * yMax)), pad.l - 6, y + 3);
        }
        chartCtx.textAlign = 'left';
        chartCtx.fillText(n ? `game ${n}` : 'no games yet', pad.l, h - 4);

        if (n < 2) return;
        const line = (data, color, width) => {
            chartCtx.strokeStyle = color;
            chartCtx.lineWidth = width;
            chartCtx.beginPath();
            data.forEach((v, i) => {
                const x = pad.l + (i / (n - 1)) * pw;
                const y = pad.t + ph - (v / yMax) * ph;
                i ? chartCtx.lineTo(x, y) : chartCtx.moveTo(x, y);
            });
            chartCtx.stroke();
        };
        line(s.scores, 'rgba(96, 138, 109, 0.85)', 1.25);
        line(s.means, COLORS.text, 1.75);
    }

    // --------------------------------------------------------------- Panel

    const qRows = ACTIONS.map(name => {
        const row = document.createElement('div');
        row.className = 'q-row';
        row.innerHTML =
            `<div class="flex justify-between text-xs font-mono mb-1">
                <span class="q-label text-brand-muted">${name}</span>
                <span class="q-val text-brand-muted"></span>
            </div>
            <div class="h-1.5 rounded-full bg-brand-gray/60 overflow-hidden">
                <div class="q-fill h-full rounded-full bg-brand-muted/40" style="width: 0%"></div>
            </div>`;
        $('q-rows').appendChild(row);
        return { row, val: row.querySelector('.q-val'), fill: row.querySelector('.q-fill') };
    });

    const chips = STATE_SHORT.map(label => {
        const chip = document.createElement('span');
        chip.className = 'state-chip px-2 py-1 rounded-md text-[11px] font-mono border border-brand-gray/60 text-brand-muted/70';
        chip.textContent = label;
        $('state-chips').appendChild(chip);
        return chip;
    });

    function updatePanel(s) {
        $('stat-score').textContent = s.game.score;
        $('stat-record').textContent = s.record;
        $('stat-games').textContent = s.scores.length;
        $('stat-mean').textContent = s.scores.length ? (s.total / s.scores.length).toFixed(1) : '–';

        const last = s.last || { state: s.game.getState(), q: s.agent.net.predict(s.game.getState()), random: false };
        const action = s.last ? last.action : argmax(last.q);
        const lo = Math.min(...last.q), hi = Math.max(...last.q);
        qRows.forEach((r, i) => {
            r.row.dataset.chosen = !last.random && i === action ? '1' : '0';
            r.val.textContent = last.q[i].toFixed(2);
            r.fill.style.width = `${hi > lo ? 8 + 92 * (last.q[i] - lo) / (hi - lo) : 50}%`;
        });
        $('q-random').classList.toggle('hidden', !last.random);
        chips.forEach((chip, i) => { chip.dataset.on = last.state[i] ? '1' : '0'; });

        if (s.mode === 'train') {
            $('stat-eps').textContent = `${(s.agent.exploreChance * 100).toFixed(0)}%`;
            $('stat-mem').textContent = s.agent.memory.length.toLocaleString();
        }
    }

    // ------------------------------------------------------------- Overlay

    function showOverlay(title, text) {
        $('overlay-title').textContent = title;
        $('overlay-text').textContent = text;
        $('overlay').classList.remove('hidden');
        $('overlay').classList.add('flex');
    }

    function hideOverlay() {
        $('overlay').classList.add('hidden');
        $('overlay').classList.remove('flex');
    }

    function syncOverlay() {
        const s = session();
        if (s.mode === 'play' && !s.started) {
            showOverlay('Your turn', 'Press an arrow key or WASD (or swipe on the board) to start.');
        } else if (s.mode === 'play' && s.over) {
            showOverlay('Game over', `You scored ${s.lastScore}. Press an arrow key (or swipe) to go again.`);
        } else {
            hideOverlay();
        }
    }

    // ------------------------------------------------------------ Controls

    function setMode(next) {
        mode = next;
        acc = 0;
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.setAttribute('aria-selected', String(tab.dataset.mode === next));
        });
        const s = session();
        $('speed-wrap').classList.toggle('invisible', next === 'play');
        $('play-hint').classList.toggle('hidden', next !== 'play');
        $('train-panel').classList.toggle('hidden', next !== 'train');
        $('q-title').textContent = next === 'play' ? 'What the AI would do' : 'Network Output (Q-values)';
        setPaused(false);
        syncOverlay();
        drawChart();
        updatePanel(s);
    }

    function setPaused(p) {
        paused = p;
        const btn = $('btn-pause');
        btn.querySelector('span').textContent = p ? 'Resume' : 'Pause';
        btn.querySelector('svg, i')?.remove();
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', p ? 'play' : 'pause');
        icon.className = 'w-4 h-4';
        btn.prepend(icon);
        if (window.lucide) lucide.createIcons();
    }

    function setSpeed(idx) {
        speedIdx = idx;
        const sps = SPEEDS[idx];
        $('speed-label').textContent = sps === Infinity ? 'Max' : `${sps}/s`;
        acc = 0;
    }

    // Player input: queue up to two turns so quick double-taps register.
    function steer(dir) {
        const s = session();
        if (s.mode !== 'play') return;
        if (!s.started || s.over) {
            if (s.over) {
                s.game.reset();
                s.last = null;
                s.over = false;
            }
            s.started = true;
            s.dirQueue = [];
            acc = 0;
            hideOverlay();
        }
        const lastDir = s.dirQueue.length ? s.dirQueue[s.dirQueue.length - 1] : s.game.dir;
        if (dir !== lastDir && dir !== (lastDir + 2) % 4 && s.dirQueue.length < 2) s.dirQueue.push(dir);
    }

    const KEYS = {
        ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
        w: UP, s: DOWN, a: LEFT, d: RIGHT, W: UP, S: DOWN, A: LEFT, D: RIGHT,
    };

    window.addEventListener('keydown', e => {
        if (e.target.closest('input, button, a, textarea')) {
            if (!(e.key in KEYS) || e.target.matches('input[type="range"]')) return;
        }
        if (e.key === ' ') {
            e.preventDefault();
            setPaused(!paused);
            return;
        }
        if (mode === 'play' && e.key in KEYS) {
            e.preventDefault();
            steer(KEYS[e.key]);
        }
    });

    let touchStart = null;
    board.addEventListener('touchstart', e => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });
    board.addEventListener('touchend', e => {
        if (!touchStart || mode !== 'play') return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
        touchStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) {
            if (!session().started || session().over) steer(session().game.dir);
            return;
        }
        steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP));
    });

    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => setMode(tab.dataset.mode));
    });
    $('btn-pause').addEventListener('click', () => setPaused(!paused));
    $('btn-reset').addEventListener('click', () => {
        sessions[mode] = newSession(mode);
        setMode(mode);
    });
    $('speed').addEventListener('input', e => setSpeed(Number(e.target.value)));
    window.addEventListener('resize', drawChart);

    // ---------------------------------------------------------------- Init

    const meta = window.SNAKE_MODEL && window.SNAKE_MODEL.meta;
    if (meta) {
        $('model-note').textContent =
            `Trained agent weights: ${meta.trainedGames} training games using this exact engine (tools/train_snake.js). ` +
            `Averages ${meta.evalMean} points per game over ${meta.evalGames} evaluation games, with a best of ${meta.evalBest}.`;
    }
    $('year').textContent = new Date().getFullYear();

    if (window.lucide) lucide.createIcons();
    setSpeed(speedIdx);
    setMode('watch');
    requestAnimationFrame(frame);
})();
