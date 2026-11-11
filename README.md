# benalv.dev · BenOS

A redesign of my portfolio as a 1-bit desktop operating system. Black and white only, pixel fonts, dithered patterns, and windows you can drag around.

It's plain HTML, CSS and JavaScript. No frameworks, no build step, no Tailwind.

## What's on the desktop

| Window | What it is |
| --- | --- |
| About Ben | Name, roles, the typed intro, and links to the resume, GitHub and LinkedIn. |
| Projects | A Finder-style list of the five projects with descriptions, tags and links. |
| Experience.txt | MUR, CISSA and Pitcrew AI roles, plus education and certificates. |
| Control Panel | Skills as checkboxes. Try unticking one. |
| Snake.app | My Snake DQN running live, with its Q-values. Switch to "You play" to take over. |
| Terminal | A small shell: `help`, `ls`, `cat experience.txt`, `open snake`, `benfetch`, `sudo hire ben`… |
| Mail | Contact details with a copy button. |
| Gym Tracker | The iOS screenshots, Floyd–Steinberg dithered to 1-bit in the browser (with a colour toggle). |
| SnakeAI Demo.mov | The original gameplay video. |
| Trash | Holds the files this redesign replaced. |

The menu bar has File, View (desktop or list), Go, and Special (clean up, invert screen). `⌘W` closes the front window and `⌘O` opens the resume.

On screens narrower than 860px, or with **View → As List**, the windows stack into a single readable column so the site works on phones.

`basketball.html` is Predictor.app: the live NBA predictor API rendered as a 1-bit results table with a console window for the raw feed.

## Files

```
index.html             The desktop (all CSS and JS inline, icons drawn from 16x16 bitmaps)
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

## Notes

- The boot screen shows once per browser session. **BenOS menu → Restart** replays it.
- Animations respect `prefers-reduced-motion`. With reduced motion on, Snake.app steps on click.
- The basketball API is hosted on a free tier, so the first request after a quiet period can take up to a minute.
