# Brief: review of slice 12, "Walking where you look"

Slice 12, Task 6 ([plan-slice-12-walking.md](../plan-slice-12-walking.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 2bebc92 | tar -x -C <tmpdir>`), never in this
checkout. Don't use port 8080; run the café on another port with a fresh
`DATA_DIR`, and point the spec at it with `APP_URL`. Stop only the servers
you start, by their own process IDs (never `pkill` by name: other cafés
run on this machine). Don't touch the live café or the Fly app.

## What to read

- **The spec:** [`docs/slices/12-walking-where-you-look.md`](../../slices/12-walking-where-you-look.md),
  every "done when" line and how it's held. One line was corrected in the
  build (the plan's decision 1): judge whether the correction is honest
  or a way round a line that couldn't be met.
- **Why:** [ADR 0018](../../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
  and [art-style.md](../art-style.md), section 2 (what the shake was).
- **The design:** `docs/design.md` ("The client": "The look", walkers
  face where they go), and `AGENTS.md`'s "What the app must keep",
  especially "every action works by keyboard, touch and mouse, at 390×844
  and at 1920×1080, and survives a resize mid-use" and "cats change
  through `content/`, not code".
- **The plan**, its decisions, review focus and execution log.
- **The code:** from `42958ec` to `2bebc92`: `client/src/motion.ts`,
  `state.ts` (the `facing` map and `keepFacing`), `render.ts` (`facingOf`,
  `onScreen`, the frames by view, `draw`'s transform), `stage.ts` (the
  canvas sized by scale), `sprites.ts`; `content/sprites/cat.txt` and
  `avatar.txt` (the back frames); `server/src/content.rs`'s sprite test;
  their tests in `client/test/` (`motion`, `render`, `stage`, `layout`,
  `sprites`); and `spec/browser.test.ts`'s light check, which now reads
  in room pixels.
- **The screenshots:** `docs/notes/screens/slice-12/`, and the script that
  takes them.

## Out of scope

The art's quality at 16 px (slice 11 redraws every sprite at 24), the
room's soft edges (slice 13), and the panels (slice 14). Earlier work this
slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **facing:** the four grid steps against the camera in `iso.ts`; a
  path that turns; a walk replaced mid-step; a walk that finishes and is
  never cleared (the server never says a walk ended); a walk of one tile;
  someone placed, sitting, standing up, leaving and coming back; a cat
  picked up, carried, put down; a welcome after a reconnect (does the
  `facing` map survive, or go stale?). Can a figure show a back view that
  doesn't exist (a napping cat, a held cat)?
- **placing:** `onScreen` reads the context's transform: is it the
  scale everywhere a sprite is drawn, including mirrored sprites (the
  `translate`/`scale(-1, 1)` in `drawFlipped`), the "you" marker, emotes,
  carried pieces, a held cat, the faces in the window, and the logged-out
  page's avatar previews (`auth.ts`)? Anything drawn before `draw` sets
  the transform, or a frame where the stage is refitted between `fit()`
  and `paint()`?
- **the canvas:** its backing store grew by the scale squared (5× on a
  big screen is 1680×1160). Memory and frame time at 5×, and a resize
  mid-walk between scales. Does picking (`hitAt`, `cssToTile`) still
  agree with what's drawn at every scale?
- **the phone's camera:** the test holds the walker still across at 3×;
  is that the case the user sees in layout B, at the room's edges, and at
  scales other than 3?
- **the checks:** can any pass without the behaviour it names? The
  placement tests use a stub context; would they fail if the stage passed
  the wrong scale? The light check now reads room pixels through the CSS
  size: does it still fail when it should?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-12-findings.md`.
