# benalv.xyz

Personal portfolio for Ben Alvaro, served by GitHub Pages at [www.benalv.xyz](https://www.benalv.xyz). Static HTML, styled with the Tailwind Play CDN and Lucide icons. There's no build step.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Landing page: hero, skills, selected work, contact |
| `timeline.html` | Experience, projects and education as a filterable timeline, plus certifications |
| `m26.html` | Case study: MUR M26 firmware & telemetry. Doubles as the template for future case studies |
| `snake.html` | Snake DQN running live in the browser: watch the trained agent, train one from scratch, or play yourself |
| `basketball.html` | Live demo of the NBA predictor API |

Shared styling lives in `assets/tailwind-config.js` (brand colours, fonts) and `assets/site.css`.

## Case studies

`m26.html` contains dashed **TODO** boxes (`class="todo"`) for details that still need filling in. Before publishing, check none are left:

```sh
grep -n 'class="todo' m26.html
```

To add another case study, copy `m26.html`, keep the numbered section layout, and link it from the project card in `index.html` and from `timeline.html`.

## Snake AI

`assets/snake/` is a dependency-free JavaScript port of [Macapps13/SnakeAI](https://github.com/Macapps13/SnakeAI):

- `engine.js`: game, `Linear_QNet` (11 → 256 → 3, Adam, MSE) and DQN agent, using the same state, rewards and hyperparameters as the Python version. It has no DOM access, so it also runs under Node.
- `app.js`: page UI (board, Q-values, input state, score chart, keyboard/swipe controls).
- `model.js`: the trained agent's weights (base64 float32).

Regenerating the weights:

```sh
# Train headlessly with the browser engine (~40s), keeping the best greedy checkpoint
node tools/train_snake.js 400

# Or convert a PyTorch checkpoint from the SnakeAI repo (no torch install needed)
python3 tools/export_snake_weights.py path/to/model/model.pth assets/snake/model.js
```

## Local preview

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Versioning

The version tag in each page footer (currently `v2.0.0`) is hard-coded. Search for it when bumping:

```sh
grep -rn 'v2.0.0' --include='*.html' .
```
