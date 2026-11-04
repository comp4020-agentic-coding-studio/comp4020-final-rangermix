# Brief: review of slice 13, "A café on its street"

Slice 13, Task 5 ([plan-slice-13-street.md](../plan-slice-13-street.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive e049217 | tar -x -C <tmpdir>`), never in this
checkout. Don't use ports 8080 or 18612 (other cafés, including slice 12's
reviewer, run on them); run the café on port 18713 with a fresh `DATA_DIR`,
and point the spec at it with `APP_URL`. Stop only the servers you start,
by their own process IDs (never `pkill` by name). Don't touch the live café
or the Fly app.

Slice 13 is built on slice 12 (branch `slice-12-walking`, up to `9877c81`),
which another reviewer is reading at the same time. Review only what slice
13 adds: `9877c81..e049217`.

## What to read

- **The spec:** [`docs/slices/13-a-cafe-on-its-street.md`](../../slices/13-a-cafe-on-its-street.md),
  every "done when" line and how it's held, and its settled open
  questions (the same shadows by night; the street pans with the room).
- **Why:** [ADR 0018](../../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
  (corners, option C: the diorama on its street),
  [ADR 0019](../../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)
  (option 9: crisp, self outline, cast shadows, ambient occlusion), and
  [art-style.md](../art-style.md), sections 1, 1b and 3, with the study's
  pictures in `docs/notes/screens/art-style/` (`1b-edges.png`,
  `3-corners.png`) that the user chose from.
- **The design:** `docs/design.md` ("The client": "The look", the
  diorama and the crisp entries), and `AGENTS.md`'s "What the app must
  keep", especially "every action works by keyboard, touch and mouse, at
  390×844 and at 1920×1080, and survives a resize mid-use" and "cats
  change through `content/`, not code" (the street is data too).
- **The plan**, its decisions, review focus and execution log.
- **The code:** `client/src/crisp.ts` (scanline spans, crisp fill and
  stroke, open and closed), `client/src/shadows.ts` (the mask, its key,
  `blocks`, `wallShades`, the panes), `client/src/street.ts` and
  `content/street.toml`, `client/src/render.ts` (`poly`, `outline`,
  `block`'s self outline, `drawShadows` and `boardAt`'s seam rule,
  `drawStreet` and its cache by light, the slab and wall tops, what went:
  the footprint patch and `BACKDROP`), `scripts/palettes.ts` and
  `content/sprites/palettes.json` (the nine "street" slots by day and by
  night), `server/src/content.rs`'s street test; their tests in
  `client/test/` (`pixels.ts`, the software canvas; `crisp`, `shadows`,
  `render`); and `spec/browser.test.ts`'s new street check.
- **The screenshots:** `docs/notes/screens/slice-13/`, and the script that
  takes them.

## Out of scope

The sprites' art (slice 11), the panels and the treat button (slice 14),
the facing and screen-pixel placement (slice 12, reviewed separately).
Earlier work this slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **no blended pixel:** every scale from 1× to 5×, all four lights and
  the blends between them, layouts A and B, a toppled piece, a piece
  being placed, a cat hiding, carried furniture, the keyboard pointer, a
  resize mid-use. Is any room shape still drawn as a canvas path? Does
  the software canvas in `pixels.ts` record everything a real canvas
  would blend, or could a blended draw slip past it (`drawImage` at a
  fraction, `globalAlpha`, a stroke the stub doesn't see)?
- **the spans:** concave shapes, a vertex exactly on a pixel centre's row,
  zero-height and one-pixel shapes, and shapes off the canvas. Do two
  shapes that share an edge leave a gap or overlap a pixel?
- **the outlines:** is each piece's outline its own colour darkened, and
  only where it meets what's behind it? Does the open slab line stay
  open, and do any other outlines close across the room?
- **shadows:** the direction against `iso.ts`'s camera; through the panes,
  and not through the plain wall or the door; pieces of every height,
  toppled, under (rugs), and at the room's edges; the cache key (does it
  change for every change that moves a shadow, and stay the same when
  nothing has? would a new kind of piece, a different room shape, or a
  change of `tiles` miss it?); the mask's cost when it is worked out, and
  the per-frame runs at 5×. Does the seam rule in `boardAt` match
  `drawFloor` everywhere, so a shaded pixel is always what's under it,
  darkened?
- **the street:** by day at 10:00, by night at 22:00, and in the evening
  and morning blends; the cache by light (does it go stale when the hour
  turns, or rebuild every frame?); both layouts, and the phone's pan; the
  corners filled at both sizes; nothing behind the room takes a click or
  a tap, at either size. Can `street.toml` be edited to something the
  client's small parser reads differently from `cargo test`'s real one?
- **the checks:** can any pass without the behaviour it names? Would the
  street browser check fail if the street were drawn in one flat colour,
  or not at all? Would the shadow tests fail if the light came from the
  other side, or if the cache were never reused?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-13-findings.md`.
