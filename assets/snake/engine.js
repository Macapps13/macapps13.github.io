// Snake DQN engine: a JavaScript port of https://github.com/Macapps13/SnakeAI
// (game.py, agent.py, model.py). No DOM access here, so it also runs under Node
// for headless benchmarking.
(function (root) {
    'use strict';

    // Same board as the PyGame version: 640x480 px with 20 px blocks.
    const COLS = 32;
    const ROWS = 24;

    // Clockwise order, as in game.py's _move.
    const DIRS = [
        { name: 'RIGHT', dx: 1, dy: 0 },
        { name: 'DOWN', dx: 0, dy: 1 },
        { name: 'LEFT', dx: -1, dy: 0 },
        { name: 'UP', dx: 0, dy: -1 },
    ];
    const RIGHT = 0, DOWN = 1, LEFT = 2, UP = 3;

    // Actions are relative to the current heading: [straight, right turn, left turn].
    const ACTIONS = ['Straight', 'Right', 'Left'];

    const STATE_LABELS = [
        'Danger straight', 'Danger right', 'Danger left',
        'Moving left', 'Moving right', 'Moving up', 'Moving down',
        'Food left', 'Food right', 'Food up', 'Food down',
    ];

    function randInt(lo, hi) { // inclusive, like Python's random.randint
        return lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    // ---------------------------------------------------------------- Game

    class SnakeGame {
        constructor(cols = COLS, rows = ROWS) {
            this.cols = cols;
            this.rows = rows;
            this.reset();
        }

        reset() {
            this.dir = RIGHT;
            const hx = this.cols / 2, hy = this.rows / 2;
            this.snake = [{ x: hx, y: hy }, { x: hx - 1, y: hy }, { x: hx - 2, y: hy }];
            this.score = 0;
            this.frame = 0;
            this.placeFood();
        }

        get head() { return this.snake[0]; }

        placeFood() {
            do {
                this.food = { x: randInt(0, this.cols - 1), y: randInt(0, this.rows - 1) };
            } while (this.snake.some(p => p.x === this.food.x && p.y === this.food.y));
        }

        isCollision(pt = this.head) {
            if (pt.x < 0 || pt.x >= this.cols || pt.y < 0 || pt.y >= this.rows) return true;
            for (let i = 1; i < this.snake.length; i++) {
                if (this.snake[i].x === pt.x && this.snake[i].y === pt.y) return true;
            }
            return false;
        }

        // action: 0 straight, 1 right, 2 left. Returns { reward, done, score }.
        step(action) {
            this.frame++;
            if (action === 1) this.dir = (this.dir + 1) % 4;
            else if (action === 2) this.dir = (this.dir + 3) % 4;

            const d = DIRS[this.dir];
            this.snake.unshift({ x: this.head.x + d.dx, y: this.head.y + d.dy });

            // The frame cap stops an agent from looping forever without eating.
            if (this.isCollision() || this.frame > 100 * this.snake.length) {
                return { reward: -10, done: true, score: this.score };
            }

            let reward = 0;
            if (this.head.x === this.food.x && this.head.y === this.food.y) {
                this.score++;
                reward = 10;
                this.placeFood();
            } else {
                this.snake.pop();
            }
            return { reward, done: false, score: this.score };
        }

        // The 11 boolean features from agent.py's get_state.
        getState() {
            const h = this.head;
            const l = { x: h.x - 1, y: h.y }, r = { x: h.x + 1, y: h.y };
            const u = { x: h.x, y: h.y - 1 }, dn = { x: h.x, y: h.y + 1 };
            const dl = this.dir === LEFT, dr = this.dir === RIGHT;
            const du = this.dir === UP, dd = this.dir === DOWN;
            const c = p => this.isCollision(p);

            return Float32Array.from([
                (dr && c(r)) || (dl && c(l)) || (du && c(u)) || (dd && c(dn)),
                (du && c(r)) || (dd && c(l)) || (dl && c(u)) || (dr && c(dn)),
                (dd && c(r)) || (du && c(l)) || (dr && c(u)) || (dl && c(dn)),
                dl, dr, du, dd,
                this.food.x < h.x, this.food.x > h.x,
                this.food.y < h.y, this.food.y > h.y,
            ].map(Number));
        }

        // Maps an absolute heading (e.g. from the keyboard) to a relative action.
        // Reversing into yourself is ignored, as in classic Snake.
        actionToward(dir) {
            if (dir === (this.dir + 1) % 4) return 1;
            if (dir === (this.dir + 3) % 4) return 2;
            return 0;
        }
    }

    // ------------------------------------------------------------- Network

    // Linear_QNet: Linear(in, hidden) -> ReLU -> Linear(hidden, out), trained
    // with Adam on MSE loss, mirroring model.py.
    class QNet {
        constructor(nIn = 11, nHidden = 256, nOut = 3) {
            this.nIn = nIn;
            this.nHidden = nHidden;
            this.nOut = nOut;
            // PyTorch's default nn.Linear init: U(-1/sqrt(fan_in), 1/sqrt(fan_in)).
            const init = (n, fanIn) => {
                const b = 1 / Math.sqrt(fanIn);
                return Float32Array.from({ length: n }, () => (Math.random() * 2 - 1) * b);
            };
            this.params = {
                w1: init(nHidden * nIn, nIn),
                b1: init(nHidden, nIn),
                w2: init(nOut * nHidden, nHidden),
                b2: init(nOut, nHidden),
            };
            this.adam = null;
        }

        static fromExport(model) {
            const net = new QNet(model.w1.shape[1], model.w1.shape[0], model.w2.shape[0]);
            for (const key of Object.keys(net.params)) {
                net.params[key] = decodeFloat32(model[key].data);
            }
            return net;
        }

        forward(x) {
            const { w1, b1, w2, b2 } = this.params;
            const { nIn, nHidden, nOut } = this;
            const h = new Float32Array(nHidden);
            for (let j = 0; j < nHidden; j++) {
                let s = b1[j];
                const row = j * nIn;
                for (let i = 0; i < nIn; i++) s += w1[row + i] * x[i];
                h[j] = s > 0 ? s : 0;
            }
            const q = new Float32Array(nOut);
            for (let k = 0; k < nOut; k++) {
                let s = b2[k];
                const row = k * nHidden;
                for (let j = 0; j < nHidden; j++) s += w2[row + j] * h[j];
                q[k] = s;
            }
            return { h, q };
        }

        predict(x) { return this.forward(x).q; }

        // One Adam step on a batch. Only the taken action's Q-value differs from
        // its target, so it is the only output with a non-zero gradient.
        // nn.MSELoss averages over batch * outputs, hence the 2 / (n * nOut).
        trainBatch(states, actions, targets, lr = 0.001) {
            const { w1, w2 } = this.params;
            const { nIn, nHidden, nOut } = this;
            const g = {
                w1: new Float32Array(w1.length), b1: new Float32Array(nHidden),
                w2: new Float32Array(w2.length), b2: new Float32Array(nOut),
            };
            const n = states.length;
            const scale = 2 / (n * nOut);

            for (let s = 0; s < n; s++) {
                const x = states[s];
                const a = actions[s];
                const { h, q } = this.forward(x);
                const dq = (q[a] - targets[s]) * scale;

                g.b2[a] += dq;
                const row2 = a * nHidden;
                for (let j = 0; j < nHidden; j++) {
                    g.w2[row2 + j] += dq * h[j];
                    if (h[j] <= 0) continue;
                    const dh = dq * w2[row2 + j];
                    g.b1[j] += dh;
                    const row1 = j * nIn;
                    for (let i = 0; i < nIn; i++) {
                        if (x[i] !== 0) g.w1[row1 + i] += dh * x[i];
                    }
                }
            }
            this.adamStep(g, lr);
        }

        adamStep(grads, lr, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
            if (!this.adam) {
                this.adam = { t: 0, m: {}, v: {} };
                for (const key of Object.keys(this.params)) {
                    this.adam.m[key] = new Float32Array(this.params[key].length);
                    this.adam.v[key] = new Float32Array(this.params[key].length);
                }
            }
            const st = this.adam;
            st.t++;
            const c1 = 1 - Math.pow(beta1, st.t);
            const c2 = 1 - Math.pow(beta2, st.t);
            for (const key of Object.keys(this.params)) {
                const p = this.params[key], gr = grads[key], m = st.m[key], v = st.v[key];
                for (let i = 0; i < p.length; i++) {
                    m[i] = beta1 * m[i] + (1 - beta1) * gr[i];
                    v[i] = beta2 * v[i] + (1 - beta2) * gr[i] * gr[i];
                    p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
                }
            }
        }
    }

    function decodeFloat32(b64) {
        let bytes;
        if (typeof atob === 'function') {
            const bin = atob(b64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
            bytes = new Uint8Array(Buffer.from(b64, 'base64'));
        }
        return new Float32Array(bytes.buffer);
    }

    function argmax(arr) {
        let best = 0;
        for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
        return best;
    }

    // --------------------------------------------------------------- Agent

    // Deep Q-learning agent with the hyperparameters from agent.py.
    class Agent {
        constructor(net = new QNet(), opts = {}) {
            this.net = net;
            this.gamma = opts.gamma ?? 0.9;
            this.lr = opts.lr ?? 0.001;
            this.maxMemory = opts.maxMemory ?? 100000;
            this.batchSize = opts.batchSize ?? 1000;
            this.nGames = 0;
            this.memory = [];
            this.memoryHead = 0;
        }

        // Exploration: random move with probability (80 - games) / 201,
        // so it fades to pure exploitation after 80 games.
        get epsilon() { return Math.max(0, 80 - this.nGames); }
        get exploreChance() { return this.epsilon / 201; }

        act(state, { explore = true } = {}) {
            const q = this.net.predict(state);
            if (explore && randInt(0, 200) < this.epsilon) {
                return { action: randInt(0, 2), q, random: true };
            }
            return { action: argmax(q), q, random: false };
        }

        remember(t) {
            if (this.memory.length < this.maxMemory) {
                this.memory.push(t);
            } else {
                this.memory[this.memoryHead] = t;
                this.memoryHead = (this.memoryHead + 1) % this.maxMemory;
            }
        }

        trainOn(batch) {
            const targets = batch.map(t => t.done
                ? t.reward
                : t.reward + this.gamma * Math.max(...this.net.predict(t.next)));
            this.net.trainBatch(batch.map(t => t.state), batch.map(t => t.action), targets, this.lr);
        }

        trainShort(t) { this.trainOn([t]); }

        trainLong() {
            const mem = this.memory;
            if (mem.length <= this.batchSize) {
                this.trainOn(mem);
                return;
            }
            // Sample without replacement, like random.sample.
            const picked = new Set();
            while (picked.size < this.batchSize) picked.add(randInt(0, mem.length - 1));
            this.trainOn([...picked].map(i => mem[i]));
        }
    }

    const api = { COLS, ROWS, DIRS, RIGHT, DOWN, LEFT, UP, ACTIONS, STATE_LABELS, SnakeGame, QNet, Agent, argmax };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SnakeAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
