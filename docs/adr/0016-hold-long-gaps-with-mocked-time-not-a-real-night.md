# 0016. Hold long gaps with mocked time, not a real night

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Slices 01 and 02 each ended on a judged line that needed a real night.
Slice 01's was "waking after eight hours takes a few seconds at most on the
live machine", read from the first live `woke` line after a quiet night.
Slice 02's was "the board reads like the café's own story", read by the user
on the live board after a night. Three days on, neither had been read. Fly's
`flyctl logs --no-tail` keeps only the last 100 lines, so a morning's
traffic pushes the night's wake-up out before anyone looks
([slice-01-wake.md](../notes/slice-01-wake.md)). Both slices stayed short of
`Live`, waiting on the calendar rather than on the code.

The unit tests already pass time in. `wake()` and the replay take `now` as
an argument, and their tests pin Canberra times: an 8-hour night, 9 days
capped at 3, daylight saving. The built binary can't be given a time. It
reads the wall clock, so `server/tests/waking.rs` makes a long sleep by
rewriting `saved_at` in the database, and `spec/restart.test.ts` waits a
real 30 seconds. Rewriting `saved_at` leaves every cat's saved timers ahead
of the clock it wakes to, a state no real save can produce, and its replay
always covers the hours just before the test runs, never a night.

On 2026-10-17 the user asked: "for the long gap checks use unit test and
integ test with mocked time. do not rely on realworld checks".

## Options

1. **Keep the real-night checks.** Agents read the live logs after a night,
   and the user reads the board. Nothing to build, and it checks the real
   machine. But it waits on the calendar, it can be missed for good once the
   log buffer turns over, and it can't fail before a deploy.
2. **A clock the test sets, in the built binary.** The server reads every
   instant from one clock. A test sets where it starts with an environment
   variable, and from there it runs at real speed, so ticks, saves and timers
   behave as they do live. A test starts the binary at 23:00 on a given
   night, stops it, and starts it again at 07:30 the next morning, with a
   save the café wrote itself. It costs a small seam in `time.rs` and a
   guard so it can't be set on Fly.
3. **Only rewrite the saved clock in the database, as now.** Nothing new in
   the server. But the gap's state is one no real save can produce, the
   night's schedule (the 7:00 refill, midnight's treats) depends on when
   the test runs, and nothing but `saved_at` is mocked.
4. **Unit tests only.** `wake()` is already tested with mocked `now`. This
   leaves the binary's own wiring untested over a long gap: the order of
   `listening` and `woke`, the store as the process left it, a visitor's
   welcome after the night.

## Decision

We will hold every long-gap check with mocked time: unit tests that pass
`now`, and integration tests that run the built binary on a clock set by
`CAFE_CLOCK_START`. That clock is refused when the server runs on Fly. No
done-when line waits on a real night or on the live logs.

## Consequences

- Slice 01's and slice 02's judged night lines are replaced by tests. The
  board's "worth reading" stays judged, by the user, but on a board a test
  produces from a mocked night, not on the live café.
- The test that wakes the binary from days asleep no longer rewrites
  `saved_at`. Its sleep is real in every way but the calendar.
- Wake-up times are bounded on the development machine and in CI, not on the
  live machine's CPU. The numbers measured at Fly's baseline CPU
  (`--cpus=0.0625`, [slice-01-wake.md](../notes/slice-01-wake.md)) stay as
  the record of that.
- The server has one more environment variable. A café started with it is
  logged as such (`listening` carries the clock it started from), and
  refused on Fly, so the live café is always on the wall clock.
- The commits that carry it out are in slice 08
  ([spec](../slices/08-long-gaps-held-by-mocked-time.md)).
