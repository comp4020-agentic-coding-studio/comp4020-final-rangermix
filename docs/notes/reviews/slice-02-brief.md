# Brief: review of slice 02, "What the night left behind"

Slice 02, Task 7 ([plan-slice-02-chalkboard.md](../plan-slice-02-chalkboard.md)),
by [ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive HEAD | tar -x -C <tmpdir>`), never in this
checkout.

## What to read

- **The spec:** [`docs/slices/02-what-the-night-left-behind.md`](../../slices/02-what-the-night-left-behind.md),
  every "done when" line and how it says the line is held.
- **The design:** `docs/design.md` ("The room": traces and the chalkboard;
  "The client"; "Persistence and fast-forward"; "Checks"; "Numbers to
  tune"), [ADR 0002](../../adr/0002-make-a-cat-cafe-where-company-forms-around-the-cats.md),
  and `AGENTS.md`'s "What the app must keep".
- **The plan:** `docs/notes/plan-slice-02-chalkboard.md`: decisions, review
  focus, tasks and execution log.
- **The code of the slice:** commits `11dbf30`, `857d7c8`, `8a893ed`,
  `53fa6af`, `b8a4800` (and the docs in `33e742d`). Chiefly
  `server/src/world/chalk.rs` and `chalk_tests.rs`, the `ChalkLine` and
  `ChalkWhat` types in `server/src/protocol.rs`, `settle`, `scatter_toys`,
  `chalk_line` and `laps_tick` in `server/src/world/cat_life.rs`, the first
  meeting in `world/handling.rs`, migration 3 and the chalk functions in
  `server/src/store.rs`, `wake.rs`'s load, `client/src/chalk.ts`,
  `panels.ts`, `input.ts` (the board target, the Tab cycle, Shift+Tab),
  `menus.ts`, `main.ts` (the board dialog), `render.ts` (strewn toys),
  `index.html`, `style.css`, `scripts/narrate.ts`, and the checks in
  `spec/chalkboard.test.ts`, `spec/restart.test.ts`, `spec/browser.test.ts`
  and `client/test/`.
- Slice 01's review fixes changed the code this slice sits on (each cat's
  doings kept across a restart, one-job saves, the replay's panic catch).
  They are in `docs/notes/reviews/slice-01-findings.md` and aren't this
  review's subject, except where slice 02's code relies on them.

## Out of scope

The later slices' work (mute, the blocklist, the admin ban, the load check,
the art pass and the accessibility pass) isn't a finding. Neither is
anything phases 1 to 3 or slice 01 already had, unless this slice's code
makes it worse or relies on it being right.

## What to look for

Whether each "done when" line is truly held by what the spec says holds it,
or only appears to be. Whether the kept rules hold: nothing said is stored
or logged (can any path put typed text into a line?); the server decides;
every action works by keyboard, touch and mouse at 390×844 and 1920×1080
through a resize; generated TypeScript isn't edited by hand. And the inputs
and conditions most likely to break it:

- a busy café (forty first meetings) against a quiet night's lines; the
  hourly rule's key; the 500-line cap; a line exactly 24 hours old, on the
  server and on a client whose clock is wrong;
- a replay's lines and drops reaching the store; an unreadable row; a
  restart mid-day; the snapshot's eight against the client's eight;
- scattered toys: drawn, tidied, saved, restored, played with, carried
  while scattered, knocked over again;
- the board dialog with a menu, a ring, the drawer, the talk box or the
  "still there?" nudge open; focus, Escape, a resize mid-dialog, layout B;
  a username that looks like markup; a screen reader's view of the panel
  and the dialog;
- what the checks really hold: can a browser or spec check pass without the
  board working, or fail on a working one?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-02-findings.md`.
