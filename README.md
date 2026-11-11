# benalv.dev · BenOS

My portfolio as a calm black-and-white desktop: windows you can drag, a menu bar, desktop icons, and a few apps. Pixel type is used for the interface; everything you read is set in IBM Plex Sans.

It's plain HTML, CSS and JavaScript. No frameworks, no build step.

## On the desktop

The site opens with two windows side by side: **About Ben** and **Projects**. Everything else opens from the desktop icons, the **Go** menu, or **⌘K / Ctrl+K**.

| Window | What it is |
| --- | --- |
| About Ben | Name, roles, intro, links, and what I'm doing currently. |
| Projects | A two-pane browser: pick a project on the left, read the description, highlights and stack on the right. Use ↑ ↓ to move through the list. |
| Timeline | Work, study and projects from 2023 to now, plus certificates. |
| Now.txt | What I'm working on at the moment. |
| Contact | Email (with a copy button), LinkedIn and GitHub. |
| Snake.app | My Snake DQN playing live, with the network's score for each move. Switch to "You play" to take over. |
| Terminal | `help`, `projects`, `open timeline`, `theme dark`, `benfetch`, `sudo hire ben`… |
| Appearance | Theme (auto, light, dark), desktop pattern (dots, plain, classic) and text size. Saved in the browser. |
| Find | ⌘K launcher for every window, project and file. |

`basketball.html` is **Predictor.app**: the live NBA predictor API as a results table with a console for the raw feed. It uses the same appearance settings.

Keyboard: **⌘K** find, **Esc** closes the front window, double-click a title bar to collapse it.

On screens narrower than 860px, or with **View → As List**, the windows stack into one column and every project is shown in full.

## Files

```
index.html             The desktop (all CSS and JS inline; icons are drawn from 16x16 bitmaps)
basketball.html        Predictor.app, the live demo
assets/snake/engine.js Snake game + Linear_QNet + DQN agent, a JS port of Macapps13/SnakeAI
assets/snake/model.js  Trained weights (base64 float32)
assets/*.png, *.mp4    Gym tracker screenshots, Snake gameplay video
BenAlvaroResume.pdf    Resume
CNAME                  www.benalv.dev
```

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Updating content

- Projects live in `index.html` as `<article class="pdetail">` blocks, with a matching button in the sidebar (`data-proj`) and an entry in the `FIND` list in the script.
- Now.txt is plain HTML in `#win-now`. Update the month in its heading when you change it.
- The basketball API is on a free tier, so the first request after a quiet period can take up to a minute.
