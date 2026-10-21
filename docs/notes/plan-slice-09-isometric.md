# Slice 09, "The room seen at an angle": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why this look:
> [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md).

**Goal:** the café is drawn in a 2:1 isometric camera on the same 12 by 10
grid. Everything a visitor could do, they still do the same way, by
keyboard, touch and mouse, at both sizes. A phone opens in layout B. The
things in the room are plain shaded blocks until slice 11 draws them.

**Architecture:** one pure module, `client/src/iso.ts`, owns the camera:
the canvas size, where a tile point lands on the canvas, which tile a
canvas point picks (floor diamonds, and the street wall's face for row 0),
and the order things are drawn in. `stage.ts`'s `tileToCss` and
`cssToTile` become that transform times the scale, so bubbles, menus, the
ring and layout B's panning, which all go through them, follow. `render.ts`
draws the floor, the two back walls and blocks from `iso.ts`'s geometry.
The server, the protocol and `content/` stay as they are.

**Spec:** [`docs/slices/09-the-room-seen-at-an-angle.md`](../slices/09-the-room-seen-at-an-angle.md).
Written 2026-10-21 from the code at `aff9e71`, on branch
`slice-09-isometric`, merged to `main` only once reviewed, since every push
to `main` deploys.

## What the code does now

- `client/src/scale.ts`: `TILE = 16`, and `fitScale` fits a 192×160 canvas
  by whole numbers.
- `client/src/stage.ts`: the canvas is `w*TILE` by `h*TILE`, scaled by CSS.
  `tileToCss(x, y)` is `offset + x*TILE*scale`; `cssToTile` is the floor of
  the inverse, null outside the grid. Layout B pans by `panOffset` on the
  pixel spot of your avatar or the keyboard pointer.
- `client/src/render.ts`: draws 16-px tiles from `room.txt` by the floor
  plan's letters, the line's faces on the window tiles, flat pieces first,
  then everything standing ordered by `y`, then a night tint, the placing
  ghost and the keyboard pointer as squares. A toppled piece is its sprite
  rotated 90°.
- Callers of the transform: `bubbles.ts` (the room's box, heads and feet),
  `main.ts` (menu and ring anchors, the ring following its tile), `input.ts`
  (picking for clicks, taps and hover).
- `layout.ts` `chooseLayout(saved, phone)` gives B only when saved as B.
- `server/src/content.rs` holds every sprite at 16 px a tile, 8 px emotes.
- `spec/browser.test.ts` finds tiles by fractions of the canvas
  (`box.width / 12`, `box.height / 10`) in six places, and checks the canvas
  CSS width (`960px`, `384px`, `576px`) in five.

## Global constraints

- AGENTS.md's rules hold. Nothing here touches what's said, stored or
  decided: the server still decides every outcome, and placement is still
  refused there.
- Every action works by keyboard, touch and mouse, at 390×844 and
  1920×1080, through a resize mid-use.
- Generated TypeScript in `client/src/protocol/` isn't touched.
- `pnpm -C client check`, `pnpm typecheck`, the spec against a local café,
  fmt, clippy and `cargo test` pass before each push.

## Decisions made in this plan

1. **The camera's numbers.** A tile is a 32×16 diamond. Grid point
   `(gx, gy)` lands at `(160 + 16(gx − gy), 56 + 8(gx + gy))` on a 336×232
   canvas, the study's numbers, so the room matches the pictures the user
   chose from. The floor is rows 1 to 9. Row 0 is the street wall: its
   tiles are drawn up the back-right wall, along `gy = 1`, 56 px tall.
2. **Row 0 is picked on the wall's face.** The chalkboard is the only row 0
   tile anything acts on, and the arrows reach it today. A point on the
   back-right wall picks row 0 at the column under it, so clicking the
   chalkboard still opens the board. Anywhere else off the floor and the
   wall picks nothing.
3. **Depth is `x + y` of a thing's front corner.** Something standing at
   `(x, y)` sorts at `x + y + 1` plus a small bias by kind, as the study
   did. A piece sorts at the front corner of its footprint,
   `x + w + y + h − 1`, so a cat behind a 3-long sofa isn't drawn over it.
4. **Placeholders are drawn in code, not sprites, for this slice.** The
   spec asked for placeholder sprites in `content/`. Drawing shaded blocks
   from each piece's footprint and a height per kind is a few lines and
   reads the same; making them text sprites at the new size would be
   thrown away by slice 11, which brings PNGs. The heights per kind go in
   `content/furniture.toml` as `height`, so even the blocks are data. The
   cats and people keep today's 16-px sprites, stood on their tile's
   centre, which is what "plain silhouettes" was for. The content check
   holds the new `height` field. This departs from the spec's "placeholder
   sprites in `content/sprites/`" line, and the spec says so.
5. **A toppled piece lies down as a block** half its height and twice as
   long along the axis it fell, inside its footprint's diamond, not a
   rotated sprite.
6. **The page says where a tile is.** The browser checks run in Node and
   can't import `iso.ts`. The page exposes `window.cafe = { tileAt(x, y) }`,
   read-only, giving a tile's centre in viewport pixels, through the same
   `tileToCss` everything else uses. It's what a screen reader or an
   extension could use too, and it reveals nothing the canvas doesn't show.
7. **Layout B by default on a phone.** `chooseLayout(saved, phone)` gives B
   unless this device saved A. A saved B stays B.
8. **The night tint stays** until slice 10, over the floor and walls only.

## Review focus

1. **Picking is the exact inverse of drawing**, for every tile, at every
   scale, and at a diamond's edges. (Task 1.)
2. **Nothing is drawn in front of what's nearer the viewer**, around long
   pieces especially. (Tasks 1 and 3.)
3. **Every browser check finds tiles through the page's `tileAt`**, none by
   fractions of the canvas. (Task 5.)
4. **The chalkboard is still reached by click, tap, arrows and Tab.**
   (Tasks 2 and 5.)
5. **No rule moves to the client.** Placement guesses still only tint the
   ghost. (Task 3.)

## Tasks

### Task 1: The camera, as a pure module

Files: `client/src/iso.ts`, `client/test/iso.test.ts`.

- Tests first: `toCanvas(gx, gy)` gives the numbers in decision 1 for the
  four floor corners; `pickTile(px, py, room)` gives back every floor tile
  from its centre and from points just inside each of its diamond's four
  corners; row 0 from the back-right wall's face; null off the room and on
  the back-left wall; `depth` orders a cat behind the sofa before the sofa
  and one in front after it; `ISO.width` and `ISO.height` are 336 and 232.
- Then the code.

### Task 2: The stage on the new camera

Files: `client/src/stage.ts`, `client/src/scale.ts`,
`client/test/scale.test.ts`, `client/test/stage.test.ts` (new).

- Tests first: `fitScale` fits 336×232 (3× at the desktop's stage of
  1296×947, 1× at a 390-wide phone); a jsdom stage at scale 3 turns a tile
  into CSS and back for every tile; a panned stage (offsets set) does too.
- Then: `tileToCss` and `cssToTile` through `iso.ts`; the canvas sized
  `ISO.width × ISO.height`; layout B's pan on the iso spot.

### Task 3: Draw the room

Files: `client/src/render.ts`, `content/furniture.toml`,
`server/src/content.rs`.

- Tests first: `cargo test` holds that every kind has a `height` above
  zero; a client unit test that `drawOrder` (exported from `render.ts`)
  puts the rug first, a cat on the rug after it, and a cat behind the sofa
  before the sofa.
- Then: floor diamonds in the room palette's two floor colours; the
  back-left and back-right walls with the wainscot; the window, door and
  chalkboard on the back-right wall; the line's faces in the window;
  furniture as shaded blocks (top, left face, right face), toppled ones
  lying; cats and people at their tile's centre, ordered by depth; emotes,
  the "you" marker, carried pieces and held cats over their people; the
  placing ghost as a block outline on the floor, green or red; the keyboard
  pointer as a diamond.

### Task 4: Layout B by default on a phone

Files: `client/src/layout.ts`, `client/test/layout.test.ts`.

- Tests first: `chooseLayout(null, true)` is B, `("a", true)` is A,
  `("b", false)` is A.
- Then the code, and the switch's label follows.

### Task 5: The browser checks through the page

Files: `client/src/main.ts`, `spec/browser.test.ts`.

- Tests first: a browser check that `window.cafe.tileAt` gives, for each
  of a cat, a chair and the chalkboard, a point that `elementFromPoint`
  finds on `#room` and that opens that thing's menu or the board. Seen
  failing (no `window.cafe`).
- Then `window.cafe.tileAt`, and every `box.width / 12` and canvas-width
  assumption in `spec/browser.test.ts` replaced: tiles through `tileAt`,
  widths by `ISO.width × scale`. The phone checks open in B now; the
  sheet check switches to A first.

### Task 6: Screens, review, deploy

- Screenshots at 1920×1080 and 390×844 (A and B), day and night, into
  `docs/notes/screens/slice-09/`, for the user's judged line.
- Spec, `design.md`'s "The look" entries for slice 09 made present tense.
- A fresh review: brief and findings in `docs/notes/reviews/`.
- Merge to `main`, watch CI deploy, check the live café with an `agent_`
  account, record it in `docs/notes/slice-09-isometric.md`.

## Execution log

Where the build departed from this plan, task by task.

- **Task 1** ([`23ab0f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/23ab0f5)).
  Decision 3 didn't hold: a single depth number, the front corner's
  `x + y`, tied a cat beside the sofa with the sofa (the test caught it).
  The order is `inDrawOrder`, a sort on "wholly behind" (one footprint's
  x-range or y-range ends where the other's starts), with nearer centres
  later among the rest, held by a test over the starting room's
  footprints.
- **Task 2** ([`5af5571`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5af5571)).
  Added `wallToCss` for row 0's spot halfway up the street wall, and
  `roomBox` and `figureToCss` for bubbles: the old room box was the
  corners `tileToCss(0,0)` and `(w,h)`, which aren't the canvas's corners
  at an angle. `main.ts`'s menu anchor is the diamond's left and right
  corners; row 0's is on the wall. `TILE` stays in `scale.ts` for the
  16-px sprites till slice 11.
- **Task 3** ([`32cbf7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/32cbf7f)).
  The heights went in `content/sprites/heights.json`, beside the
  palettes, not `furniture.toml`: they're the client's to draw by, and
  the server would otherwise have had to serve them through the protocol,
  which ADR 0017 keeps unchanged. `cargo test` holds that every kind has
  one. The first screenshot showed two cats missing: napping on the window
  seat and the cat tower, they were drawn inside the blocks. A cat or
  person on a standing piece is now raised by its height and sorts just
  in front of it (two tests, seen failing). The room has a dark backdrop,
  the study's, rather than the page showing round the diamond.
- **Task 4** ([`7bbcd4e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7bbcd4e)).
  As planned.
- **Task 5** ([`4fd3746`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4fd3746)).
  `window.cafe` is already the `#cafe` element (named access), so the
  page's hook is `window.cafeRoom.tileAt`. Making B the phone's default
  exposed a phase 2 gap: B hid both panels with `display: none`, which
  took the chalkboard's copy from screen readers on every phone; slice
  02's check caught it. With the drawer shut, the left panel is now
  visually hidden instead. Six checks that switched a phone into B now
  start there; the sheet check and one board tap switch to the whole
  room, so both layouts stay covered. Locally 19 of 21 browser checks
  pass; the two that don't are slice 07's routed-socket waking checks,
  which time out on this machine on `main` too and pass in CI
  ([slice-07-waking.md](slice-07-waking.md)).
- **Task 6.** Screenshots in
  [screens/slice-09/](screens/slice-09/): the desktop, a phone in the
  bigger room and in the whole room, and the room at 10:00 and 22:00 by
  the page's clock.
