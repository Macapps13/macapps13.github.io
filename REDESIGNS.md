# Site redesign: BenOS

The redesign lives on the [`redesign/benos`](../../tree/redesign/benos) branch: my portfolio rebuilt from scratch as a calm black-and-white desktop, in plain HTML, CSS and JavaScript with no build step.

It keeps the core content (intro, skills, the five projects, the basketball demo, Gym gallery, Snake video, resume and contact) and adds a projects browser, a timeline of experience and education, Now.txt, an appearance panel with light and dark themes, a ⌘K launcher, a terminal, and the Snake DQN running live in the browser.

See the branch's README for details.

## Preview locally

```sh
git checkout redesign/benos
python3 -m http.server 8000
```

## Ship it

Merge `redesign/benos` into `main`. GitHub Pages will publish it to www.benalv.dev.
