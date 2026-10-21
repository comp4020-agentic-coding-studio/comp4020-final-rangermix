# Brief: review of slice 09, "The room seen at an angle"

Slice 09, Task 6 ([plan-slice-09-isometric.md](../plan-slice-09-isometric.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive b805c70 | tar -x -C <tmpdir>`), never in this
checkout. Don't use port 8080 or 18490 (both taken on this machine); run
the café on another port with a fresh `DATA_DIR`, and point the spec at it
with `APP_URL`.

## What to read

- **The spec:** [`docs/slices/09-the-room-seen-at-an-angle.md`](../../slices/09-the-room-seen-at-an-angle.md),
  every "done when" line and how it's held.
- **Why:** [ADR 0017](../../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)
  and the judgement it came from,
  [visual-direction.md](../visual-direction.md). The user chose an
  isometric camera, 32-px tiles, layout B as the phone's default.
- **The design:** `docs/design.md` ("The room", "The client"), and
  `AGENTS.md`'s "What the app must keep", especially "every action works
  by keyboard, touch and mouse, at 390×844 and at 1920×1080, and survives
  a resize mid-use".
- **The plan**, its decisions, review focus and execution log, which
  records where the build departed: the draw order, heights in
  `content/sprites/heights.json`, cats raised onto furniture,
  `window.cafeRoom`, and layout B's hidden chalkboard panel.
- **The code:** on branch `slice-09-isometric`, from `aff9e71` to
  `b805c70`: `client/src/iso.ts`, `stage.ts`, `scale.ts`, `render.ts`,
  `bubbles.ts`, `main.ts`, `layout.ts`, `style.css`; their tests in
  `client/test/`; `server/src/content.rs`'s new test;
  `content/sprites/heights.json`; and `spec/browser.test.ts`.
- **The screenshots:** `docs/notes/screens/slice-09/`.

## Out of scope

The colours and the art (slices 10 and 11), and whether the room looks
good, which is the user's to judge. Earlier work this slice doesn't make
worse or lean on.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **picking:** is `pickTile` the exact inverse of `toCanvas` everywhere,
  at the diamonds' edges and corners, at every scale, with the canvas
  panned (layout B) or placed off-centre? Row 0 on the wall's face: can a
  click on the wall above the window, or on the back-left wall, pick
  something it shouldn't? Can any tile be unreachable by mouse or touch?
- **the draw order:** can anything nearer the viewer be painted over by
  something behind it (long pieces, cats walking between tiles, a cat on
  a lap, a person sitting, a carried piece, the ghost)? Is `inDrawOrder`
  stable and does it always terminate?
- **things on furniture:** `standingOn` decides who stands on what by
  rounding a spot. Can a walking cat or person flick up and down at a
  tile's edge? Is a person on a seat the same tile the server says?
- **the stage's callers:** bubbles, menus, rings, the ring following its
  tile while layout B pans, the board's tile, the keyboard pointer, the
  placing ghost and hover: all through the camera?
- **layout B by default:** a phone's first visit, a saved choice, a
  resize across 700 px wide and back, the layout switch's label. The
  chalkboard's copy for a screen reader in both layouts, and whether
  making the left panel visually hidden in B leaks focus or takes space.
- **the browser checks:** can any pass without the behaviour it names
  now that tiles come from the page's own `tileAt` (it shares the code
  under test)? Is anything still found by a fraction of the canvas? Is
  every action still covered by keyboard, touch and mouse at both sizes?
- **`window.cafeRoom`:** does it reveal anything the canvas doesn't, or
  let a page script do anything a visitor can't?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-09-findings.md`.
