// Concept A — shared behaviour for index.html and basketball.html
(function () {
    'use strict';

    const root = document.documentElement;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const $ = (id) => document.getElementById(id);

    root.classList.add('js');

    // ----- Footer year + project counter -----
    const year = $('year');
    if (year) year.textContent = new Date().getFullYear();

    const count = $('project-count');
    if (count) {
        const total = document.querySelectorAll('.project').length;
        count.textContent = `01 — ${String(total).padStart(2, '0')}`;
    }

    // ----- Theme toggle -----
    const toggle = document.querySelector('.theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            root.dataset.theme = next;
            try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
        });
    }

    // ----- Scroll reveal -----
    const revealables = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            // stagger items that enter together
            entries.filter((e) => e.isIntersecting).forEach((entry, i) => {
                entry.target.style.setProperty('--i', i);
                entry.target.classList.add('in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.05 });
        revealables.forEach((el) => io.observe(el));
    } else {
        revealables.forEach((el) => el.classList.add('in'));
    }

    // ----- "I build ___" rotating word -----
    const rotator = document.querySelector('.rotator');
    if (rotator && !reducedMotion) {
        const words = rotator.dataset.words.split('|');
        let index = 0;
        setInterval(() => {
            rotator.classList.add('out');
            setTimeout(() => {
                index = (index + 1) % words.length;
                rotator.textContent = words[index];
                rotator.classList.remove('out');
            }, 300);
        }, 2400);
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
