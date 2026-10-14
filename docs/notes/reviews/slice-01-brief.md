# Brief: review of slice 01, "The café keeps living while it sleeps"

Slice 01, Task 7 ([plan-slice-01-fast-forward.md](../plan-slice-01-fast-forward.md)),
by [ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. You may build and run the code and
its tests in a throwaway copy (`cp -r` to a temporary directory), never in
this checkout, since another session may be working in it.

## What to read

- **The spec:** [`docs/slices/01-the-cafe-keeps-living-while-it-sleeps.md`](../../slices/01-the-cafe-keeps-living-while-it-sleeps.md),
  every "done when" line and how it says the line is held.
- **The design:** `docs/design.md` ("The world never stops", "Persistence
  and fast-forward", "Logging", "Checks", "Numbers to tune"),
  [ADR 0005](../../adr/0005-keep-all-state-in-sqlite-on-the-volume.md),
  [ADR 0006](../../adr/0006-fast-forward-the-world-when-the-server-wakes.md),
  and `AGENTS.md`'s "What the app must keep".
- **The plan:** `docs/notes/plan-slice-01-fast-forward.md`: its decisions,
  review focus, tasks and execution log. `docs/notes/slice-01-wake.md` has
  the measurements.
- **The code of the slice:** the commits from `a36c0b5` to `1125f0d`
  (`git log --oneline 6f4390a..1125f0d`; leave out `4e54ca4` and `f5b42f7`,
  which belong to another session's fix to a browser check). Chiefly:
  `server/src/wake.rs`, `server/src/world/replay.rs` and its tests in
  `replay_tests.rs`, `server/src/main.rs`, `World::new` and `World::save`
  in `server/src/world/mod.rs`, `server/tests/wont_open.rs`,
  `scripts/narrate.ts`, `scripts/check-logs.ts`, `spec/restart.test.ts`,
  `spec/narrate.test.ts`, `spec/check-logs.test.ts`,
  `.github/workflows/checks.yml`.
- **What the replay drives:** `World::tick` and what it calls (the cats in
  `world/cat_life.rs` and `cats.rs`, the bowls and treats in
  `world/treats.rs`, the furniture's knock-overs in `world/furniture.rs`,
  `time.rs`), since a replay is that code run with nobody inside.

## Out of scope

Slice 02's work (chalkboard lines, scattered toys) and the later slices'
work (mute, the blocklist, the admin ban, the load check, art,
accessibility) aren't findings. Neither is anything phases 1 to 3 already
had, unless this slice's code makes it worse or relies on it being right.

## What to look for

Whether each "done when" line is truly held by what the spec says holds it,
or only appears to be. Whether the kept rules still hold: trust never fades
with absence, the server decides, nothing said is stored or logged. And the
inputs and conditions most likely to break it:

- a gap across midnight, across both daylight-saving changes, across
  several refills, longer than a week, of zero, or with the saved clock
  ahead of now;
- a save that's partial, unreadable or from before this slice (no `rng`),
  a database that won't open, a stop signal mid-save, a crash right after
  waking;
- whether the same save and the same gap really give the same café (is
  anything in a tick or a load seeded from the wall clock, a hash map's
  order, or the process?), and whether anything a replay does to the room
  (a knock-over) or to bowls, treats or trust is lost, double-counted or
  wrongly kept;
- what a replay costs: time before the doors open on the live 256 MB
  machine, memory, store writes, and whether the 7-day cap holds;
- the wake-up's log line, its narration, and the CI log check: can a start
  slip by without one, or a wrong one pass?
- the spec's stop-and-start check: can it pass without testing what it
  claims (a vacuous comparison, a flaky one), and is the CI change safe
  for the deploy?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say what you checked and found sound, too,
briefly, so the record shows what was looked at. Write it all to
`docs/notes/reviews/slice-01-findings.md`.
