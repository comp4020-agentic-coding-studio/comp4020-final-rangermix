# Brief: review of slice 08, "Long gaps held by mocked time"

Slice 08, Task 5 ([plan-slice-08-mocked-time.md](../plan-slice-08-mocked-time.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 2d51fa3 | tar -x -C <tmpdir>`), never in this
checkout. Don't use port 8080. The binary tests pick their own ports.

## What to read

- **The spec:** [`docs/slices/08-long-gaps-held-by-mocked-time.md`](../../slices/08-long-gaps-held-by-mocked-time.md),
  every "done when" line and how it's held.
- **Why:** [ADR 0016](../../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md).
  The user asked: "for the long gap checks use unit test and integ test
  with mocked time. do not rely on realworld checks".
- **The design:** `docs/design.md` ("Persistence and fast-forward",
  "Checks", "Harness"), ADR 0006, and `AGENTS.md`'s "What the app must
  keep".
- **The plan**, its review focus and its execution log, which records two
  things to weigh: the bowls at 07:30, and a port race found and fixed.
- **The code:** commits `5805cdf` (`server/src/time.rs`'s clock,
  `config.rs`'s `clock_start`, `main.rs`'s `start_clock` and `listening`,
  `server/tests/clock.rs`, the log check in `scripts/check-logs.ts` and its
  test), `b167901` (`server/tests/common/mod.rs`, `long_gaps.rs`,
  `waking.rs` on the mocked clock, the port read from `listening`), and
  `2d51fa3` (the specs, design.md and notes).

## Out of scope

The other slices' work, and anything earlier that this slice doesn't make
worse or lean on. Whether the board is worth reading is the user's to
judge, not yours, though you may say whether the test that prints it holds
what slice 02 promises.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether any check in slices 01, 02, 07 or 08 still waits on a real night or
the live logs. Whether the kept rules hold: the live café always on the
wall clock; the server deciding every outcome; nothing said logged. And
the conditions most likely to break it:

- **the clock:** every place the server reads an instant (is any outside
  `now_ms`?); a start before 1970 or far in the future; an offset that's
  negative or larger than the wall clock; `start_at` called twice, or after
  something already read the time; the guard on Fly, and whether
  `FLY_APP_NAME` is the right signal; whether anything the café stores (a
  session's expiry, a ban, a treat's day, a board line) would be wrong or
  dangerous if a café once run on a mocked clock were later run on the
  wall clock with the same data;
- **the binary tests:** can any pass without the behaviour it names (a
  vacuous loop, a bound so loose it can't fail, a check on the wrong
  line)? Can any flake on a slow or loaded CI runner (fixed sleeps, timing
  windows, the evening's live seconds, the random generator)? Does the
  night test check a night, or only a gap?
- **`waking.rs`:** does it still hold what slice 07 promised, now that its
  sleep is on the mocked clock and the cap is raised to 7 days in a copy of
  `content/`?
- **the port change:** `listening` now logs the port bound, not the one
  configured. Is anything (the log check, the narrator, CI, Fly) relying
  on the old value?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-08-findings.md`.
