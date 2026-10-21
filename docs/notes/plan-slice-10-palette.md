# Slice 10, "Catppuccin by day and by night": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why this look:
> [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md).

**Goal:** the room is coloured from Catppuccin, by day and by night, and
steps between them by the Canberra hour in place of today's grey wash; the
page around it follows the device's setting in Latte or Mocha, with text
and controls at 4.5:1 or better.

**Architecture:** palettes stay data. `content/sprites/palettes.json`
becomes two sets of the same shape, `day` and `night`, written by a repo
script (`scripts/palettes.ts`) from Catppuccin's published values, so they
can be made again and the mixing is reviewable. `canberra.ts`'s `nightTint`
becomes `lightAt(hour)`, how far toward night the light is: 0 by day, 0.5
in the evening, 1 at night. The client blends the two sets by that weight
(`paletteAt(light)`), and recoloured sprites are cached per light step as
they are per coat. `render.ts` takes its room and furniture colours from
the same palette. The window's glass is lit by the night set. The page's
tokens in `style.css` become Latte for light and Mocha for dark.

**Spec:** [`docs/slices/10-catppuccin-by-day-and-by-night.md`](../slices/10-catppuccin-by-day-and-by-night.md).
Written 2026-10-22 from the code at `35b1947`, on branch
`slice-09-isometric` (slice 09 merged; this slice builds on it and merges
to `main` once reviewed).

## What the code does now

- `content/sprites/palettes.json`: one set; `room` (13 slots), `furniture`
  (16), `coats` (3 coats × 6), `avatars` (`skins`, `hair`, `colours`,
  `base`), `emotes` (5).
- `client/src/sprites.ts` colours each text-grid sprite from a palette and
  caches it by name (and coat or look); `render.ts` reads `palettes.room`
  and `palettes.furniture` for the floor, walls and blocks.
- `client/src/canberra.ts`: `nightTint(hour)` gives a colour and alpha
  laid over the whole canvas: none before 12, an orange wash in the
  afternoon, blue at 17 and darker at 21.
- `client/src/style.css`: page tokens on `:root` for light and under
  `prefers-color-scheme: dark`; some colours written in place (the error
  text, the chalkboard dialog, bubbles).
- `server/src/content.rs`: `every_cat_coat_has_a_palette` reads
  `palettes["coats"]`.
- Catppuccin's values: `@catppuccin/palette` 1.7.1's
  `css/catppuccin.css` (MIT, © 2021 Catppuccin), read as data.

## Global constraints

- AGENTS.md's rules hold. Cats change through `content/`: palettes stay a
  data file, and a coat is still a key in it. Every action works at both
  sizes; the page's colours must keep every control visible in both
  themes. The server and protocol don't change.
- `pnpm -C client check`, `pnpm typecheck`, the spec against a fresh local
  café, fmt, clippy and `cargo test` pass before each push.

## Decisions made in this plan

1. **Two sets, blended, not three.** The evening is the halfway blend of
   day and night (the spec's settled default), computed in the client, so
   there's no third set to keep in step.
2. **The day set is the study's "Catppuccin-led" mix**
   (`docs/notes/screens/visual-direction/scripts/gen_palettes.mjs`):
   Mocha's darks for outlines, its pastels for cloth, cats and plants, and
   wood mixed from peach and rosewater toward its surfaces.
3. **The night set keeps each colour's hue family but pulls it toward
   Mocha's base and lavender**, darker and cooler, except the window's
   glass, which is lit with Mocha's yellow, the street's lamplight. Cats
   and people darken less than the room, so they still read.
4. **A script writes the palettes**, `scripts/palettes.ts`, run by hand
   with Node; its Catppuccin values are written into it (26 colours × 2
   flavours used), with the source and licence named, so it needs nothing
   downloaded to run.
5. **Blending happens per slot in sRGB**, rounded to whole hex. Coarse,
   but at three steps (day, evening, night) it's only computed three
   times, and cached.
6. **The page:** Latte's tokens in light (base, mantle, text, subtext0,
   surface1 for lines, mauve for the accent), Mocha's in dark (base,
   mantle, text, subtext0, surface1, peach for the accent). The bubble
   and chalkboard dialog keep their own fixed colours (a bubble is the
   room's, the board is a chalkboard); the error text uses Latte's red /
   Mocha's red. Contrast is held by a unit test that parses `style.css`.
7. **Credits:** Catppuccin's licence is named in `scripts/palettes.ts`
   and in `content/sprites/CREDITS.md`. `README.md` is the user's: the
   line for its sources is proposed to them, not written.

## Review focus

1. **Every sprite colours in every light** (day, evening, night), with no
   missing slot. (Tasks 1 and 2.)
2. **The hour's light matches "Numbers to tune"** across the day, and the
   evening is between day and night. (Task 2.)
3. **Contrast:** every text and control colour on the page against its
   background, in both themes. (Task 4.)
4. **Night reads as lamplit, not grey:** the window brighter at night than
   by day. (Task 3.)

## Tasks

### Task 1: The palettes as data

Files: `scripts/palettes.ts`, `content/sprites/palettes.json`,
`content/sprites/CREDITS.md`, `server/src/content.rs`.

- Tests first: `cargo test` holds that `palettes.json` has `day` and
  `night`, each with every coat at six slots or more, and the same number
  of slots as each other in every list.
- Then the script and its output.

### Task 2: The light by the hour, and sprites coloured by it

Files: `client/src/canberra.ts`, `client/src/sprites.ts`,
`client/test/canberra.test.ts`, `client/test/sprites.test.ts`.

- Tests first: `lightAt` is 0 at 9 and 13, 0.5 at 18, 1 at 22 and 3;
  `paletteAt(0)` is the day set, `paletteAt(1)` the night set,
  `paletteAt(0.5)` between them slot by slot; every sprite colours at
  each light with no missing slot; the night window glass is brighter
  than the day's.
- Then the code.

### Task 3: The room drawn in the light

Files: `client/src/render.ts`, `client/src/stage.ts`.

- Tests first: a `render.test.ts` check that `draw` takes the palette for
  the hour and draws no tint.
- Then: ROOM and FURNITURE from the light's palette; the tint removed;
  the window's glass from the light's palette.

### Task 4: The page in Latte and Mocha

Files: `client/src/style.css`, `client/test/contrast.test.ts`,
`spec/browser.test.ts`.

- Tests first: a unit test that reads `style.css`'s tokens for each
  theme and computes contrast for text on paper and card, muted on
  paper and card, the accent's ink on the accent, and links on paper,
  each at least 4.5:1; a browser check that the page's background
  follows `emulateMedia({ colorScheme })` at both sizes.
- Then the tokens.

### Task 5: Screens, review, deploy

- Screenshots at 10:00, 18:00 and 22:00, light and dark page, into
  `docs/notes/screens/slice-10/`.
- design.md's entries for slice 10 made present tense.
- A fresh review: brief and findings in `docs/notes/reviews/`.
- Merge to `main`, watch CI deploy, check live, record it in
  `docs/notes/slice-10-palette.md`.

## Execution log

Where the build departed from this plan, task by task.
