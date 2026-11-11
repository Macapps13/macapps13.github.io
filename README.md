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
| Blog | My posts, written in Markdown. Each post has its own link, like `benalv.dev/#post-building-benos`. |
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
assets/vendor/         marked 12.0.2 (MIT), renders the blog's Markdown
posts/posts.json       The list of blog posts
posts/*.md             One Markdown file per post
assets/*.png, *.mp4    Gym tracker screenshots, Snake gameplay video
BenAlvaroResume.pdf    Resume
CNAME                  www.benalv.dev
```

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Writing a blog post

1. Create a Markdown file in `posts/`, for example `posts/my-first-race.md`. Don't repeat the title as a `#` heading, the page shows it for you. Start sections at `##`.
2. Add an entry to the top of `posts/posts.json`:

   ```json
   {
     "slug": "my-first-race",
     "title": "My first race",
     "date": "2026-12-01",
     "summary": "One or two sentences shown in the post list.",
     "file": "my-first-race.md"
   }
   ```

   - `slug` is the post's link (`#post-my-first-race`). Use lowercase letters, numbers and hyphens only.
   - `date` is `YYYY-MM-DD`. Posts are listed newest first.
   - Add `"draft": true` to keep a post off the site while you work on it.
   - Keep the commas between entries valid, or no posts will load.
3. Images go in `posts/images/`. Reference them from the post as `images/photo.jpg`.
4. Preview with `python3 -m http.server 8000`, then commit and push.

Markdown supports headings, lists, links, images, block quotes, tables and fenced code blocks.

## Updating content

- Projects live in `index.html` as `<article class="pdetail">` blocks, with a matching button in the sidebar (`data-proj`) and an entry in the `FIND` list in the script.
- Now.txt is plain HTML in `#win-now`. Update the month in its heading when you change it.
- The basketball API is on a free tier, so the first request after a quiet period can take up to a minute.
