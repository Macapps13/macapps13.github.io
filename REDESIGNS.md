# Site redesigns

Three ground-up redesigns of benalv.dev, one per branch. Each is a complete site with the same core content (intro, skills, the five projects, the basketball demo, gym gallery, Snake video, resume and contact), rebuilt from scratch in plain HTML, CSS and JavaScript with no Tailwind or build step.

| Branch | Look | Extras |
| --- | --- | --- |
| [`redesign/pit-wall`](../../tree/redesign/pit-wall) | Dark motorsport timing screen | Start lights, simulated lap telemetry, skills as a CAN bus log, to-scale stint chart, Snake DQN as the "AI Driver" |
| [`redesign/benos`](../../tree/redesign/benos) | 1-bit retro desktop OS | Draggable windows, menu bar, working terminal, Snake.app, dithered screenshots, list view on phones |
| [`redesign/poster`](../../tree/redesign/poster) | Swiss/Bauhaus poster, light and dark | Cursor-reactive variable-font name, a geometric poster per project, live Snake poster, Swiss CV |

All three add an experience section (MUR, CISSA, Pitcrew AI), education, certifications, and the Snake DQN running live in the browser, ported from the `v2` branch.

## Preview one locally

```sh
git checkout redesign/pit-wall
python3 -m http.server 8000
```

## Ship one

Merge the branch you like into `main`. GitHub Pages will publish it to www.benalv.dev.
