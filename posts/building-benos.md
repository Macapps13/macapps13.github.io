My old site was a single dark page built with Tailwind. It did the job, but it looked like a lot of other portfolios. So I rebuilt it as a small black-and-white desktop: windows you can drag around, a menu bar, and a few apps.

## No frameworks

Everything is plain HTML, CSS and JavaScript, with no build step. GitHub Pages serves the files exactly as they are in the repo.

## Icons drawn from text

Each icon is a 16×16 grid of characters in the source, like this folder:

```
  #####
  #...#
###...########
#............#
##############
```

A short function turns `#` into black pixels and `.` into white ones, and outputs an SVG. The icons stay sharp at any size and switch colours with the theme.

## Dithering in the browser

The Gym Tracker screenshots are colour PNGs, and that's how they show by default. Switch the viewer to 1-bit and the page draws each one onto a canvas and runs Floyd–Steinberg dithering, which spreads each pixel's rounding error onto its neighbours. The result is pure black and white that still reads as shading.

## A live Snake agent

Snake.app runs a JavaScript port of my Snake DQN with its trained weights. Each step it reads 11 features (danger ahead, right and left, which way it's heading, and where the food is), scores the three possible moves, and takes the best one. The bars under the board show those scores as it plays.

## Writing here

Each post is a Markdown file in the repo. I add the file, list it in `posts.json`, and push.
