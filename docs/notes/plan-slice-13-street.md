# Slice 13, "A café on its street": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why:
> [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
> (the diorama and street) and
> [ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)
> (crisp, self outline, cast shadows, ambient occlusion).

**Goal:** the room is drawn crisp, every pixel one colour; pieces are
outlined against what's behind them; the windows cast shadows across the
floor and the floor darkens where it meets walls and pieces; the room is a
diorama, a floor with a thickness and walls with a top, standing on its
street, with sky and towers by day and stars and lit windows by night.

**Architecture:** all in the client's drawing, nothing in the server.

- **Crisp fills.** `render.ts` draws every shape through `poly` and
  `outline`, which ask the canvas to fill and stroke paths; the canvas
  anti-aliases them. They're replaced by a scanline fill in room pixels:
  each polygon is split into rows, each row into one span from its left
  edge to its right edge, rounded by a fixed rule, and filled with
  `fillRect` on whole room pixels. The stage's transform (slice 12) scales
  each to a whole block of screen pixels. Nothing else in the draw order
  changes, so picking and the draw-order tests hold.
- **Self outline.** A block draws a one-pixel rim along its silhouette,
  in its own colour darkened, as the study did where a piece meets what's
  behind it.
- **Shadows and occlusion.** A shadow mask over the floor, worked out from
  each piece's footprint and height against the light from the windows,
  with the panes letting light through; and an occlusion mask where the
  floor meets the walls and the pieces' feet. Both are a grid of room
  pixels, cached by the furniture's state (positions, toppled or not), so
  they're worked out when the furniture changes, not every frame. Drawn
  after the floor and before anything standing.
- **The diorama and street.** The floor gets a slab under its front
  edges, the walls a top. The street is data in `content/street.toml`:
  how far the skyline is, the towers' widths and heights, and the colours
  of sky, towers, lit windows and pavement by day and by night, coloured
  through the same day/night blend as the room. It's drawn behind the room
  into the canvas's whole backdrop, cached by light.

**Spec:** [`docs/slices/13-a-cafe-on-its-street.md`](../slices/13-a-cafe-on-its-street.md).
Written 2026-11-04 from the code at `9877c81`, on branch `slice-13-street`
from `slice-12-walking` (it builds on slice 12's canvas at the room's
scale), merged to `main` after slice 12 and once reviewed.

## What the code does now

- `client/src/render.ts`: `poly(ctx, pts, colour)` fills a path, rounding
  its points; `outline` strokes one. `drawFloor` fills 216 diamonds and
  seams; `drawWalls` the two walls, wainscot, window panes, door and
  board; `drawPiece` a footprint shadow (a diamond in a darker floor
  colour) and a `block` of three faces. `BACKDROP` fills the canvas first.
- `content/sprites/palettes.json`: `room` has 13 slots (floor 0-2, walls
  3-4, frames 5, ... glass 8, ...), written by `scripts/palettes.ts`.
- The study the user chose from: `docs/notes/screens/art-style/scripts/study.html`
  (`inShadow`, the occlusion pass, `backdrop("city")`).

## Global constraints

- AGENTS.md's rules hold. The street is data. Every action works at both
  sizes; the backdrop takes no input. The server and protocol don't
  change.
- `pnpm -C client check`, `pnpm typecheck`, the spec against a fresh local
  café, `cargo fmt --check`, clippy and `cargo test` pass before each
  push.

## Decisions made in this plan

1. **Scanline fills, not a cached bitmap of the room.** Pieces and
   figures are interleaved in one draw order (a cat behind the sofa is
   drawn before it), so the room can't be one picture drawn first. Making
   each shape's fill crisp keeps the order and every test of it.
2. **The fill rule:** a pixel is filled when its centre is inside the
   polygon, the same rule the canvas uses before blending. So a crisp
   shape covers what the soft one covered at full strength, and picking,
   which tests points against the same polygons, still agrees.
3. **The light comes from the street wall's windows**, as in the study:
   toward `(0.2, -0.6, 0.78)` in room terms. The same by day and by night
   (the spec's settled default), coloured in the hour's palette.
4. **Shadow and occlusion colours** are the floor's own, darkened, as the
   study did, not new palette slots: they follow the hour's light with
   the floor.
5. **The street's colours** are new slots in `palettes.json`, under a
   `street` list in each set, written by `scripts/palettes.ts` from
   Catppuccin as the rest are, so a test that the file is what the
   script writes still holds. Its shapes (the towers' rhythm, how high
   the skyline stands) are `content/street.toml`.
6. **The slab and the walls' tops** are drawn by `drawFloor` and
   `drawWalls`, in the wood and wall colours darkened and lightened.

## Review focus

1. **No blended pixel** anywhere in the room at any scale, light or
   layout, and picking still matches what's drawn.
2. **Shadows** fall the right way, move with a moved piece, and aren't
   worked out every frame.
3. **The street** at every hour, both layouts, and that nothing behind the
   room takes a click.
4. **Frame time** at 5× with the scanline fills.

## Tasks

### Task 1: Crisp fills

Files: `client/src/render.ts`, `client/test/render.test.ts`.

- Tests first: `draw` at 1× into a real canvas (jsdom's canvas isn't one;
  a pixel buffer behind a stub context that implements `fillRect` and the
  transform) leaves no pixel of the room a colour outside the palette and
  its shades; a diamond's filled pixels are exactly those whose centres
  are inside it.
- Then `poly` and `outline` as scanline fills.

### Task 2: Self outline

Files: `client/src/render.ts`, `client/test/render.test.ts`.

- Tests first: a block's silhouette edge pixels are its colour darkened;
  its inside isn't.
- Then the rim in `block`.

### Task 3: Shadows and occlusion, cached

Files: `client/src/shadows.ts` (new), `client/src/render.ts`,
`client/test/shadows.test.ts`.

- Tests first: a piece's shadow falls away from the street wall (toward
  +y); a window pane lets light through where the wall beside it doesn't;
  moving a piece moves its shadow; the mask is reused while the furniture
  is unchanged and worked out again when it changes; the floor at a wall's
  foot is darker than in the open.
- Then the module and its use in `draw`.

### Task 4: The diorama and the street

Files: `content/street.toml`, `scripts/palettes.ts`,
`content/sprites/palettes.json`, `server/src/content.rs`,
`client/src/street.ts` (new), `client/src/render.ts`,
`client/test/street.test.ts`, `spec/browser.test.ts`.

- Tests first: `cargo test` loads `street.toml` and checks its numbers;
  the palettes hold a `street` list by day and by night; the street draws
  in the hour's colours; the canvas's corners at 10:00 and 22:00 show the
  street's day and night colours (a browser check); a click on the street
  does nothing (a browser check).
- Then the data, the drawing, the slab and the walls' tops.

### Task 5: Screens, review, deploy

- Screenshots at 10:00 and 22:00, at both sizes, into
  `docs/notes/screens/slice-13/`.
- `docs/design.md`, the spec's status.
- Review brief and findings in `docs/notes/reviews/`; merged to `main`;
  deployed and checked live.

## Execution log

Where the build departed from this plan, as it happened.

- **Task 1: the fills are a module, `crisp.ts`,** so the spans can be
  tested on their own. The check that no shape is left soft is stronger
  than counting colours: a small software canvas (`client/test/pixels.ts`)
  records any `fill` or `stroke` of a path, and any `fillRect` off the
  pixel grid, and `draw` makes none at 1× and 3× in three lights with a
  toppled piece, the toys and the keyboard's pointer showing. Two
  see-through draws stay on purpose: the ghost of a piece being placed,
  and a hiding cat. They're overlays, not the room's edges, and being seen
  through is what they're for.
- **Task 3: the light through the panes lands a tile or two in front of
  the wall, not at its foot.** The light comes down steeply, so the wall
  below each sill shades the strip at its foot, and what comes through a
  pane falls between about 1.9 and 2.9 tiles out. The first pane test
  looked at the foot and failed; the model was right and the test was
  moved. Shadows draw per frame as runs of `fillRect` over the cached
  mask, a few hundred a frame, not a cached image: a cached canvas is
  invisible to the pixel tests, and the runs are cheap. The old footprint
  patch under each piece (slice 09) went: the cast shadow replaces it.
- **A seam rule caught by measuring.** The shadow's colour has to be the
  board or seam under it, darkened. The first rule put the seam at a
  tile's far end; measured, `drawFloor` paints it over the *next* row's
  first 0.06. The first test of it passed either way (it only counted
  colours); the second checks every shaded pixel against what's under it,
  and fails on the wrong rule at the pixel it gets wrong.
- **Task 4: the street's colours are nine slots, its shapes data.**
  `content/street.toml` holds the skyline's height and the towers' widths
  and heights; the client reads that one flat file itself (`street.ts`),
  and `cargo test` reads it with a real TOML parser. The towers went
  taller than first written, once seen: at the first heights most of them
  stood behind the walls. The pavement below the room steps darker in a
  dither, so it reads as ground, not a slab of grey.
- **A stray line, found by zooming in.** The slab's outline is an open
  line under the floor's two front edges, but `strokeCrisp` closed every
  shape, drawing back from the last point to the first, across the room;
  the floor hid most of it, and a stub showed past the floor's left
  corner. `strokeCrisp` now takes `closed`, and a test holds an open line
  open.
- **The night's sky has the old backdrop's colour** (Mocha's base), so the
  street test checks the corners hold the street's colours, several of
  them, not that one colour is absent.
- **Two slice 07 waking checks failed locally,** on slice 12's client too,
  against a café that had run for hours; both pass on a fresh one. Added
  to [slice-07-waking.md](slice-07-waking.md). The full spec passes on a
  fresh café: 70, one skipped (restart, which needs Docker).

- **Task 5: the screens,** from `docs/notes/screens/slice-13/shoot.mjs`
  against a fresh local café: the page at 10:00 and 22:00 at both sizes,
  and the room's canvas on its own at both hours for the judged line. Seen
  before committing: no soft edge at either size; each piece outlined in
  its own colour; the light through the panes lying in bars a tile or two
  out from the street wall, with the wall's shade at its foot; shadows
  toward the viewer behind the sofa, the counter and the boxes; the slab
  under the floor's front edges; the street filling the corners, with
  stars and lit windows by night. On the phone the street shows above the
  wall's top and below the floor's edge as the room pans.
