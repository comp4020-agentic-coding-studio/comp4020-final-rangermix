# 09. The room seen at an angle

- **Status:** Reviewed, every finding answered ([findings](../notes/reviews/slice-09-findings.md)), and merged to `main` 2026-10-21 (approved, planned and built the same day, with the proposed default for its open question: the arrows move along the room's axes). Its judged line waits for the user, from [the screenshots](../notes/screens/slice-09/)
- **Plan:** [`docs/notes/plan-slice-09-isometric.md`](../notes/plan-slice-09-isometric.md)
- **Design:** The room (12 by 10 tiles); The client ("Phone", "Drawing",
  "The look");
  [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md),
  from [notes/visual-direction.md](../notes/visual-direction.md)

## Story

A visitor looks into the café from above and to one side, as into a room,
not down on a floor plan. The floor is a grid of diamonds, the street wall
with its window, door and chalkboard runs along the back right, and a cat on
the rug reads as on it. Everything they could do before, they still do, the
same way, by keyboard, touch and mouse, at both sizes. On a phone they land
in the bigger room, following them.

This slice is the camera. The things in the room are plain shaded blocks at
their real footprints, as in the study, until slice 11 draws them.

## In this slice

- **The transform.** `stage.ts`'s `tileToCss` and `cssToTile` become the 2:1
  isometric transform and its inverse, picking the diamond under the
  pointer. Bubbles, menus, the ring and layout B's panning already go
  through these, so they follow. The tile size becomes 32 px wide, and the
  canvas is sized to the room's diamond plus its walls.
- **The renderer.** `render.ts` draws the floor as diamonds, the two back
  walls with the window, door and chalkboard on the back-right one, and
  orders everything that stands by `x + y`. A piece several tiles long is
  ordered so a cat or person behind it isn't drawn in front. The line's
  faces still show through the window.
- **Placeholders for the new camera**: each piece of furniture a shaded
  block at its footprint, as tall as its kind's entry in
  `content/sprites/heights.json`, lying down as a lower, longer block when
  knocked over; cats and people as today's sprites stood on their tile, or
  up on the piece they're on. Slice 11 replaces them. (The plan's decision
  4, as built: blocks drawn from data, not text sprites slice 11 would
  throw away.)
- **The keyboard.** The arrows move the pointer along the room's axes, and
  the pointer is drawn as a diamond.
- **The phone's default becomes layout B** (`chooseLayout`), with A as the
  switch, remembered as now. A device that chose A keeps it.
- **The browser checks find tiles through the stage**, by a helper that asks
  the test page where a tile's centre is on screen, instead of fractions of
  the canvas.
- **The content checks** hold sprites at the new sizes.

## Not in this slice

- The colours: slice 10. The room keeps today's palettes, mapped onto the
  blocks, and today's tint.
- The art: slice 11. Nothing here is meant to be looked at for long.
- Turning furniture to face the other axis. Nothing rotates today; it can
  wait for a slice of its own.
- The server and the protocol: they don't change.

## Done when

| What must be true | Held by |
| --- | --- |
| A tile's centre, put through `tileToCss` then `cssToTile`, gives back the same tile, for every tile, at every scale, and a point just inside a diamond's edge picks that diamond | client unit tests |
| Of two things standing on the floor, the one nearer the viewer (by `x + y`, and along a long piece's footprint) is drawn after the other | client unit tests |
| Every action the browser checks already do still passes, by keyboard, touch and mouse, at 390×844 and 1920×1080, through a resize, with tiles found through the stage | browser check (`spec/browser.test.ts`) |
| A phone that hasn't chosen opens in layout B; one that chose A keeps A | client unit tests (`chooseLayout`), browser check |
| No placement is allowed, and no walk ends, anywhere the server didn't already allow it: the walkway, the cap and the line are unchanged | `spec/` and `cargo test`, unchanged and passing |
| Every kind of furniture has a height to draw its block at | `cargo test` (`every_kind_of_furniture_has_a_height_to_draw_at`, reading `content/sprites/heights.json`) |
| A click or tap on a cat, person or piece acts on it where it's drawn, up off its tile at an angle | client unit tests (`hitAt`), browser check (a cat napping on the window seat) |
| The room reads as a room you look into, with the street wall at the back right, and nothing hidden that shouldn't be | judged: by the user, from screenshots at both sizes in `docs/notes/screens/` |

## Rules it touches

- **Every action works by keyboard, touch and mouse**, at 390×844 and at
  1920×1080, and survives a resize mid-use.
- **The door's walkway is never blocked.** Picking a tile is new code; the
  server still refuses what it refused before.
- **The server decides every outcome.** The client only draws differently.
- **Generated TypeScript is never edited by hand.**

## Numbers

- The room: 12 by 10 tiles (unchanged).
- Tiles: 32×16 diamonds; walls about 56 px tall; the room about 336 by 232
  px at 1×, fitting the desktop at 3× and layout B at 3×.

## Open questions

- **The arrows: along the room's axes, or the screen's diagonals?**
  Settled 2026-10-21, the default: along the room's axes, with the pointer
  drawn as a diamond, the usual choice in isometric games.
