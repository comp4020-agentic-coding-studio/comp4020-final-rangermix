# Slice 12, "Walking where you look": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why:
> [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md).

**Goal:** walkers face the way they're going on screen, showing their back
when they walk away, and move evenly along the room's diagonals instead of
stalling and jumping; the phone's follow-camera moves with them.

**Architecture:** two changes, both in the client.

- **Facing.** `motion.ts` reports a walker's step as it looks on screen:
  `view` (`front` toward the viewer, `back` away) and `mirror` (whether
  the sprite is flipped). The four grid steps map onto the four screen
  diagonals of the camera in `iso.ts`. A walker who stops keeps the view
  they last walked with: the client remembers it in a small map, since
  the server's messages don't carry facing and needn't.
- **Placing.** The canvas's backing store becomes the room at its
  on-screen scale (`ISO.width × scale` by `ISO.height × scale`), with
  `ctx.setTransform(scale, …)` so everything drawn in room pixels draws
  exactly as now, scaled. A walker's sprite is then placed at its exact
  position rounded to *screen* pixels: its own pixels stay `scale` wide,
  but it moves `scale` times more finely. The canvas's CSS size doesn't
  change, so every tile-to-CSS mapping, bubble, menu, ring and pick
  stays as it is.

**Spec:** [`docs/slices/12-walking-where-you-look.md`](../slices/12-walking-where-you-look.md).
Written 2026-11-04 from the code at `3ea8e85`, on branch
`slice-12-walking`, merged to `main` once reviewed.

## What the code does now

- `client/src/motion.ts`: `positionAt(walk, at, now)` gives a fractional
  tile position and `facing: 1 | -1`, from the grid step's x alone
  (`b.x < a.x`). Standing still, it faces the last step's x, or 1 with no
  walk.
- `client/src/render.ts`: `feetAt` turns a tile spot into a sprite's
  top-left on the 336×232 canvas; `blit` and `drawFlipped` round it to
  whole room pixels. Cats: frames `sit`, `walk_a`, `walk_b`, `nap`;
  people: `stand`, `walk_a`, `walk_b`. All front views.
- `client/src/stage.ts`: the canvas is 336×232, its CSS size
  `336 × scale` by `232 × scale`; `fit()` sets both; `paint()` calls
  `draw()` every frame; `pan()` shifts the canvas in layout B by whole
  CSS pixels from `toCanvas(spot) × scale`.
- `content/sprites/cat.txt`, `avatar.txt`: 16×16 text grids of palette
  slots; `server/src/content.rs` holds each frame's size.
- The room's drawing (`drawFloor`, `drawWalls`, `drawPiece`) is polygons
  in room pixels; slice 13 redraws it crisp, and this slice leaves it.

## Global constraints

- AGENTS.md's rules hold. Every action works by keyboard, touch and mouse
  at 390×844 and 1920×1080, and survives a resize. Sprites are data. The
  server and protocol don't change.
- `pnpm -C client check`, `pnpm typecheck`, the spec against a fresh local
  café, `cargo fmt --check`, clippy and `cargo test` pass before each
  push.

## Decisions made in this plan

1. **The spec's "at most one screen pixel per frame" is wrong, and is
   corrected here.** At 3 tiles a second and 3×, a walker covers about
   2.4 screen pixels a frame along x at 60 frames a second, so no smooth
   walk is under one. What the user chose ("move by screen pixels") is
   that steps are even: every frame moves, by the distance the walk
   covers, rounded to screen pixels, never 0 then 3. The test holds that:
   along a walk, no frame stands still, and no two frames' steps differ
   by more than one screen pixel on either axis. The spec's line is
   changed to say so in this slice's commits.
2. **Four screen directions from four grid steps.** From the front-right
   corner (`iso.ts`): +x goes up-right, −x down-left, +y down-right, −y
   up-left. Up-left and up-right walk away (`back`); down-left and
   down-right come toward you (`front`). Mirroring: the sprites are drawn
   facing right, so a step whose screen x goes left is mirrored.
3. **Standing, the last view stays**, as the spec's settled default. The
   client keeps a map from walker to its last `{view, mirror}`, updated
   while a walk is drawn; someone placed inside who hasn't walked faces
   `front`. `positionAt` stays pure; the memory lives in render state.
4. **Back views are new frames, not a flag.** People: `back`,
   `back_walk_a`, `back_walk_b`. Cats: `back_sit`, `back_walk_a`,
   `back_walk_b`. A nap has no back. At today's 16 px, drawn by hand from
   the front frames (the back of a head is hair; a cat's back shows ears
   and tail).
5. **The canvas at the room's scale, not the device's pixel ratio.**
   Matching `devicePixelRatio` too would make the placement finer on a
   retina screen, but doubles the backing store and changes what the
   browser checks read. The room's own scale (1 to 5) is what "screen
   pixels" means here.
6. **The follow-camera moves by CSS pixels, from the same float.** In
   `pan()`, the walker's on-screen point is `toCanvas(spot) × scale`; it's
   rounded once, the same way the sprite's placement is, so the two never
   disagree by a pixel.

## Review focus

1. **Facing on all four steps,** and standing after each; a mirrored back
   view and a mirrored front view both read right.
2. **No stall and no jump** along a diagonal walk at 1× to 5×.
3. **Nothing moved that shouldn't have:** picking, bubbles, menus, the
   ring and the browser checks still find what's drawn where it's drawn.
4. **Layout B:** the followed walker stays centred while walking.

## Tasks

### Task 1: Facing from the screen direction

Files: `client/src/motion.ts`, `client/test/motion.test.ts`.

- Tests first: for each grid step (+x, −x, +y, −y), `positionAt` gives the
  view and mirror of decision 2; arriving keeps the last step's; no walk
  gives `front`, unmirrored.
- Then the code. `facing` goes; callers move to `view` and `mirror`.

### Task 2: Back views, as data

Files: `content/sprites/cat.txt`, `content/sprites/avatar.txt`,
`client/src/sprites.ts`, `server/src/content.rs`, `client/test/sprites.test.ts`.

- Tests first: `cargo test` holds every frame, back views included, at
  16×16; a client test colours every frame at every light.
- Then the frames, and the frame names in `sprites.ts`.

### Task 3: Drawing the view, and remembering it

Files: `client/src/render.ts`, `client/test/render.test.ts`.

- Tests first: `draw` asks `Sprites` for a back frame while someone walks
  toward the street wall, and a front frame toward the viewer; after the
  walk ends they keep it; a cat likewise.
- Then the code.

### Task 4: Placed by screen pixels

Files: `client/src/stage.ts`, `client/src/render.ts`,
`client/test/stage.test.ts`, `client/test/render.test.ts`.

- Tests first: the canvas's backing store is the room at the stage's
  scale and its CSS size is unchanged; along a diagonal walk at 3× and
  60 frames a second, a sprite's top-left in backing-store pixels moves
  every frame, and no two frames' steps differ by more than one pixel on
  either axis; tile-to-CSS round trips still hold.
- Then: `fit()` sizes the backing store; `draw()` takes the scale, sets
  the transform for the room and blits sprites at rounded screen pixels.

### Task 5: The phone's camera with the walker

Files: `client/src/stage.ts`, `client/src/layout.ts`, `client/test/layout.test.ts`.

- Tests first: in layout B, along a walk, the walker's on-screen point
  stays within one CSS pixel of the view's middle (away from the room's
  edges).
- Then the code.

### Task 6: Screens, review, deploy

- Screenshots of a walk away and toward at both sizes, into
  `docs/notes/screens/slice-12/`.
- `docs/design.md`, the spec's status and decision 1's line.
- Review brief and findings in `docs/notes/reviews/`, every finding fixed
  test first or answered; merged to `main`; deployed and checked live.

## Execution log

Where the build departed from this plan, as it happened.

- **Task 2: the cat's back views took three drawings.** The first walking
  one read as a lump, the second as a dog (head at the far end, tail
  curled); the third holds the tail straight up at the near end, with the
  back of the head and its ears at the far end. Judged from a sheet of
  every frame at 8×, at today's 16 px; slice 11 redraws them at 24.
- **Task 3: facing is kept in `CafeState`, not render state.** The walk is
  gone by the time it's drawn standing (`catPosed` and `personSat` clear
  it), so `apply` records the side a walker shows, where its walk stands,
  just before replacing or clearing it. A held cat shows its holder's
  side.
- **Task 4: the placement is a transform plus a rounding, not a new
  layer.** `draw` sets `ctx.setTransform(scale, …)` and the room draws in
  room pixels as before; sprites, the "you" marker and emotes round to
  `1/scale` (`onScreen`). The light check in `spec/browser.test.ts` read
  in canvas pixels, which are now screen pixels; it now counts room pixels
  through the room's CSS size, and still fails when aimed off the cat.
- **A bug the screenshots caught.** Someone sent the other way mid-walk,
  then arriving, stood facing the way the *replaced* walk went. The
  server never tells the client a walk is over, so a finished walk stays
  in the client's state; the side kept when a walk is replaced was
  winning over that finished walk's own last step. Now a walk the client
  holds, under way or finished, decides the side; the kept side is only
  for when there's no walk. A test reproduces it and failed first.
- **Task 5 needed no code.** With sprites placed to screen pixels, the
  follow-camera's rounding and the sprite's agree: a walker it follows
  holds one screen position across, where before it took three (170, 171,
  172). A test holds it, and fails on the old placement. Up and down the
  camera doesn't move at 3× on a phone (the room is shorter than the
  view), so the walker moves there as it should.

### After the review

- **The cat walked away tail first** (finding 1): its back walking
  frames were drawn head on the left, the opposite of every other frame,
  and the mirroring treated them like the rest. Redrawn head right; a
  test holds every frame's head right of the middle, and another holds
  the mirroring itself on all four diagonals, which nothing did.
- **The camera test held arithmetic, not the café** (finding 2): it's
  now the real `Stage` and `draw` together in jsdom, painting a walk in
  layout B. It caught odd widths turning between two pixels (finding 7),
  fixed by rounding the view's middle once, and it fails on both of the
  reviewer's mutants.
- **Facing through a reconnect** (finding 3) and **arriving into the
  room** (finding 4): a welcome records each walker's side from the walk
  the old state still holds; a walk in from the door, over, faces front,
  by the same rule in `facingOf` and `keepFacing`.
- **A carried piece moves with its carrier** (finding 6), by the screen
  pixels the sprite is placed at.
- **The evenness line** holds from 2× up, tested at 2×, 3×, 5× and a
  cat's pace; at 1× whole pixels can't move every frame. The story says
  "by screen pixels" now. The changed line goes to the user (finding 8).
- **The screenshots** (finding 9) shoot "away" while the walk is under
  way, as the café's own messages say, after letting the walk toward the
  viewer finish; all six now differ.
