// Concept B — shared behaviour for index.html and basketball.html
(function () {
    'use strict';

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (id) => document.getElementById(id);

    document.documentElement.classList.add('js');

    // ----- Footer year + project counter -----
    const year = $('year');
    if (year) year.textContent = new Date().getFullYear();

    const count = $('project-count');
    if (count) {
        const total = document.querySelectorAll('.project').length;
        count.textContent = `01 — ${String(total).padStart(2, '0')}`;
    }

    // ----- Tiles pop in as they scroll into view -----
    const tiles = document.querySelectorAll('.pop');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.filter((e) => e.isIntersecting).forEach((entry, i) => {
                entry.target.style.setProperty('--i', i);
                entry.target.classList.add('in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.05 });
        tiles.forEach((el) => io.observe(el));
    } else {
        tiles.forEach((el) => el.classList.add('in'));
    }

    // ----- Skills marquee: duplicate the list so it can loop seamlessly -----
    const track = document.querySelector('.track');
    if (track && !reducedMotion) {
        const originals = Array.from(track.children);
        // enough copies to overflow any screen, in an even number so -50% loops cleanly
        for (let copy = 0; copy < 7; copy++) {
            originals.forEach((item) => {
                const clone = item.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                track.append(clone);
            });
        }
        track.classList.add('rolling');
    } else if (track) {
        track.style.flexWrap = 'wrap';
        track.style.width = 'auto';
        track.style.padding = '0 1.5rem';
        track.style.whiteSpace = 'normal';
    }

    // ----- Modals (native <dialog>) -----
    document.querySelectorAll('[data-open]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            const dialog = $(trigger.dataset.open);
            dialog.showModal();
            dialog.dispatchEvent(new Event('opened'));
        });
    });

    document.querySelectorAll('dialog').forEach((dialog) => {
        dialog.addEventListener('click', (e) => {
            // a click on the dialog element itself is a click on the backdrop
            if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
        });
    });

    // Gym Tracker gallery
    const gallery = $('gallery');
    if (gallery) {
        const images = [
            '../../assets/Simulator1.png',
            '../../assets/Simulator2.png',
            '../../assets/Simulator3.png',
            '../../assets/Simulator4.png'
        ];
        let current = 0;

        const show = (i) => {
            current = (i + images.length) % images.length;
            $('gallery-img').src = images[current];
            $('gallery-current').textContent = current + 1;
            $('gallery-total').textContent = images.length;
        };

        gallery.addEventListener('opened', () => show(0));
        $('gallery-prev').addEventListener('click', () => show(current - 1));
        $('gallery-next').addEventListener('click', () => show(current + 1));
        gallery.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') show(current + 1);
            if (e.key === 'ArrowLeft') show(current - 1);
        });
    }

    // Snake AI video
    const videoDialog = $('video');
    if (videoDialog) {
        const video = $('snake-video');
        videoDialog.addEventListener('opened', () => {
            const playing = video.play();
            if (playing) playing.catch(() => { /* autoplay blocked: controls are visible */ });
        });
        videoDialog.addEventListener('close', () => {
            video.pause();
            video.currentTime = 0;
        });
    }

    // ----- Self-playing snake (decorative; a simple BFS bot, not the DQN) -----
    const canvas = $('snake-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const COLS = 20, ROWS = 8;
        const CELL = canvas.width / COLS;
        const MOVES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const COLORS = { snake: '#9be7c4', head: '#ffd84d', food: '#ff9d80', grid: 'rgba(255,255,255,0.06)' };
        const key = (x, y) => y * COLS + x;
        const inside = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

        let snake, food;

        const placeFood = () => {
            const taken = new Set(snake.map(([x, y]) => key(x, y)));
            const free = [];
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    if (!taken.has(key(x, y))) free.push([x, y]);
                }
            }
            food = free[Math.floor(Math.random() * free.length)];
        };

        const reset = () => {
            snake = [[4, 4], [3, 4], [2, 4]];
            placeFood();
        };

        // Breadth-first search from the head to the food; returns the first step of the shortest path.
        const nextStep = () => {
            const [hx, hy] = snake[0];
            // the tail cell frees up as the snake moves, so it is not an obstacle
            const blocked = new Set(snake.slice(0, -1).map(([x, y]) => key(x, y)));
            const firstStep = new Map([[key(hx, hy), null]]);
            const queue = [[hx, hy]];

            while (queue.length) {
                const [x, y] = queue.shift();
                if (x === food[0] && y === food[1]) return firstStep.get(key(x, y));
                for (const [dx, dy] of MOVES) {
                    const nx = x + dx, ny = y + dy, k = key(nx, ny);
                    if (!inside(nx, ny) || blocked.has(k) || firstStep.has(k)) continue;
                    firstStep.set(k, firstStep.get(key(x, y)) || [nx, ny]);
                    queue.push([nx, ny]);
                }
            }

            // no route to the food: shuffle into any free neighbour and hope it opens up
            for (const [dx, dy] of MOVES) {
                const nx = hx + dx, ny = hy + dy;
                if (inside(nx, ny) && !blocked.has(key(nx, ny))) return [nx, ny];
            }
            return null;
        };

        const tick = () => {
            const step = nextStep();
            if (!step || snake.length > COLS * ROWS * 0.45) return reset();
            snake.unshift(step);
            if (step[0] === food[0] && step[1] === food[1]) placeFood();
            else snake.pop();
        };

        const block = (x, y, color, inset) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(x * CELL + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2, CELL * 0.22);
            ctx.fill();
        };

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) block(x, y, COLORS.grid, CELL * 0.42);
            }
            block(food[0], food[1], COLORS.food, CELL * 0.18);
            snake.forEach(([x, y], i) => block(x, y, i === 0 ? COLORS.head : COLORS.snake, CELL * 0.07));
        };

        reset();
        draw();

        if (!reducedMotion) {
            let timer = null;
            const start = () => { timer = timer || setInterval(() => { tick(); draw(); }, 120); };
            const stop = () => { clearInterval(timer); timer = null; };
            // only burn CPU while the board is actually on screen
            new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(canvas);
        }
    }

    // ----- Basketball Predictor demo -----
    const fetchButton = $('fetch-button');
    if (fetchButton) {
        const API_URL = 'https://basketballpredictor.onrender.com';
        const status = $('console-status');
        const list = $('games');

        const el = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        };

        const probabilityRow = (dl, label, value) => {
            const pct = Math.max(0, Math.min(100, Number(value) * 100));
            dl.append(el('dt', '', label));
            const bar = el('div', 'bar');
            const fill = el('i');
            fill.style.width = `${pct}%`;
            bar.append(fill);
            dl.append(bar, el('dd', '', `${pct.toFixed(2)}%`));
        };

        const renderGame = (game, i) => {
            const card = el('article', 'game');
            card.style.animationDelay = `${i * 60}ms`;

            if (game.error) {
                card.classList.add('failed');
                card.textContent = `Error: ${game.error}`;
                return card;
            }

            const title = el('h3');
            title.append(game.home, el('span', '', ' vs '), game.away);

            const pick = el('p', 'pick', 'Win prediction: ');
            pick.append(el('b', '', game.winner));

            const probabilities = el('dl');
            probabilityRow(probabilities, 'Logistic', game.logisticWinProb);
            probabilityRow(probabilities, 'Normal', game.normalWinProb);

            const odds = el('div', 'odds');
            const fair = el('span', '', 'Fair odds');
            fair.append(el('b', '', game.fairOdds));
            const market = el('span', '', 'Market odds');
            market.append(el('b', '', game.marketOdds));
            odds.append(fair, market);

            card.append(title, pick, probabilities, odds);
            return card;
        };

        fetchButton.addEventListener('click', async () => {
            fetchButton.disabled = true;
            list.replaceChildren();
            status.className = 'console-status mono';
            status.replaceChildren(el('span', 'spinner'), 'Connecting to custom backend API...');

            try {
                const response = await fetch(`${API_URL}/run`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const games = await response.json();
                if (!Array.isArray(games)) throw new Error('Unexpected response format');

                status.textContent = games.length
                    ? `NBA game predictions — ${games.length} game${games.length === 1 ? '' : 's'}`
                    : 'No games returned for today.';
                list.replaceChildren(...games.map(renderGame));
            } catch (error) {
                status.classList.add('error');
                status.textContent = `Error during API call: ${error.message}. Please check the API URL: ${API_URL}`;
                console.error('Fetch error:', error);
            } finally {
                fetchButton.disabled = false;
            }
        });
    }
})();
