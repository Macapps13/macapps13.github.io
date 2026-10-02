# benalv.xyz

My personal portfolio, hosted on GitHub Pages at [www.benalv.xyz](https://www.benalv.xyz). It's static HTML using the Tailwind Play CDN and Lucide icons, with no build step.

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Landing page with skills, selected work and contact details |
| `timeline.html` | Filterable timeline of experience, projects and education, plus certifications |
| `m26.html` | Case study on the MUR M26 firmware and telemetry, also used as the template for future case studies |
| `snake.html` | Snake DQN running in the browser, with modes to watch the trained agent, train one from scratch or play yourself |
| `basketball.html` | Live demo of the NBA predictor API |

Shared styling lives in `assets/tailwind-config.js` (brand colours, fonts) and `assets/site.css`.

## Case studies

`m26.html` has dashed **TODO** boxes (`class="todo"`) for details that still need to be filled in. Check none are left before publishing:

```sh
grep -n 'class="todo' m26.html
```

To add another case study, copy `m26.html` and link to it from the project card in `index.html` and from `timeline.html`.

## Snake AI

`assets/snake/` is a JavaScript port of [Macapps13/SnakeAI](https://github.com/Macapps13/SnakeAI) with no dependencies.

- `engine.js` has the game, `Linear_QNet` (11 → 256 → 3, Adam, MSE) and the DQN agent, using the same state, rewards and hyperparameters as the Python version. It doesn't touch the DOM, so it also runs in Node.
- `app.js` is the page UI (board, Q-values, input state, score chart and controls).
- `model.js` holds the trained agent's weights (base64 float32).

To regenerate the weights:

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

The version tag in each page footer (currently `v2.0.0`) is hard-coded, so search for it when updating:

```sh
grep -rn 'v2.0.0' --include='*.html' .
```
