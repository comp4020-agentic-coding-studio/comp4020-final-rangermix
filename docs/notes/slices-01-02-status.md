# Slices 01 and 02: where the work stands

Kept up to date by session `efabe266`, and since by later sessions. Plans:
[slice 01](plan-slice-01-fast-forward.md), [slice 02](plan-slice-02-chalkboard.md).

Both slices are built, reviewed by a fresh agent with every finding
answered ([01](reviews/slice-01-findings.md), [02](reviews/slice-02-findings.md)),
recorded in design.md, and deployed (CI green through `be74a01`). Since
2026-10-17 nothing in them waits on a real night: slice 08 holds the night
with the built café on mocked time
([ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)).

- **Slice 01** is `Live`. Waking after a night is `cargo test`'s
  ([slice-01-wake.md](slice-01-wake.md)).
- **Slice 02** is `Live`. The user read the board the night test prints
  and passed it on 2026-10-21 ([slice-02-board.md](slice-02-board.md)).

Settled since: a first visitor after a long break would have waited about
30 s at Fly's baseline CPU. The user took both ways out on 2026-10-15. The
cap is now 3 days (`replay_max_days`,
[`fc086c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fc086c6)),
and slice 07 serves the page at once while the café wakes.

For the user to weigh when reading the board: what the slice 02 reviewer
noted, which is repeated plants, times with no day, and meetings crowding
out the night.

Checked again on 2026-10-17 at 17:09 AEDT (session `013dedec`): no night's
wake read yet. Fly's log buffer held only the last 100 lines, from 16:09
AEDT on ([slice-01-wake.md](slice-01-wake.md)). The user then asked for long
gaps to be held by mocked time instead, which became slice 08.

Slice 07 (getting in while the café wakes) is built, reviewed and live
([notes](slice-07-waking.md)). It also made a dead world task end the
process, so Fly restarts it, which was slice 01's reviewer's open note.

For the judged line on the board: since the live café was tidied, the cats
knock everything over within about ten minutes of it emptying, so a night's
lines come in a cluster at its start ([slice-02-board.md](slice-02-board.md)).
