# 08. Long gaps held by mocked time

- **Status:** Approved (2026-10-17, asked for by the user: "for the long gap
  checks use unit test and integ test with mocked time. do not rely on
  realworld checks")
- **Plan:** [`docs/notes/plan-slice-08-mocked-time.md`](../notes/plan-slice-08-mocked-time.md)
- **Design:** Persistence and fast-forward ("Waking"); Checks;
  [ADR 0006](../adr/0006-fast-forward-the-world-when-the-server-wakes.md),
  [ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md).
  Replaces the judged night lines of slices
  [01](01-the-cafe-keeps-living-while-it-sleeps.md) and
  [02](02-what-the-night-left-behind.md), and the saved-clock rewrite in
  slice [07](07-getting-in-while-the-cafe-wakes.md)'s tests.

## Story

This one is for the operator, and for whoever changes the café next. Every
promise the café makes about long sleeps (a night, a weekend, a week) is
checked before a deploy, on the built server, in seconds. Nobody waits for a
real night or reads Fly's logs to know the cats lived through one. A test
starts the café at 23:00 on a Friday, a visitor meets a cat and leaves, the
café stops, and it starts again at 07:30 on Saturday. The night's wake-up
line, the cats, the 7:00 refill, the board and the visitor's trust are all
checked, as the next morning's first visitor would find them.

## In this slice

- **One clock for the server.** Every instant the server reads (ticks,
  saves, sessions, rate-limit windows, sign-ups, the wake-up's `now`) comes
  from one clock in `server/src/time.rs`, set once at start.
- **`CAFE_CLOCK_START`.** If it's set, to an RFC 3339 time with an offset
  (`2026-10-16T23:00:00+11:00`), the clock starts there and runs at real
  speed. Unset, it's the wall clock, as now. A value that won't parse
  stops the server with one JSON error line. So does any value at all when
  `FLY_APP_NAME` is set: the live café is always on the wall clock.
- **`listening` says which clock.** The start's `listening` line carries
  `clock = "wall"`, or the time it was started from.
- **Integration tests of the built binary on mocked time**, in a new
  `server/tests/long_gaps.rs`:
  - **A night.** Start at 23:00 Canberra time; a visitor signs up, meets a
    cat and leaves; stop. Start again at 07:30 the next morning. The `woke`
    line says a gap of 8½ hours, that many steps, one refill, not capped,
    not failed, and walks for every cat. `took_ms` is within the bound
    below. The visitor comes back to their trust as it was, and the bowls
    full from 7:00. The board holds at least one line from the night,
    knocked-over or scattered things are still down, and the furniture
    stands where it was.
  - **A long sleep.** Stopped at 23:00 and started 9 days later: the `woke`
    line says a gap of 9 days, 3 days of steps (`replay_max_days`), and
    capped.
  - **Midnight.** Treats used up at 23:00 come back after a night: the
    morning's welcome has the day's allowance again.
- **Slice 07's binary tests on mocked time.** `server/tests/waking.rs` makes
  its sleep by starting the café days later on the mocked clock, not by
  rewriting `saved_at` in the database.
- **The night lines move off the live café.** Slice 01's and slice 02's
  specs, `docs/design.md` and the notes say their night lines are held by
  these tests. Slice 02's "worth reading on arrival" is judged on the board
  the night test leaves, not on the live café.

## Not in this slice

- **Time running faster than real time** in the binary. The replay already
  covers long spans in one-second steps. Speeding up the live loop would
  test something the café never does.
- **The browser checks and `spec/` on mocked time.** `spec/restart.test.ts`
  still stops and starts the Docker image with a real 30-second pause: it
  checks the image, its volume and its stop signal, not long gaps.
- **Wake-up speed on Fly's CPU.** The numbers measured at the baseline share
  ([slice-01-wake.md](../notes/slice-01-wake.md)) stay as they are, as a
  record. They aren't re-measured live.
- **Reading the live logs after a night.** No check needs it now. The
  operator can still do it for interest.

## Done when

| What must be true | Held by |
| --- | --- |
| The server reads every instant from one clock, and only `time.rs` reads the wall clock | `cargo test` (the clock's unit tests); a grep in the plan's review, recorded in the findings |
| `CAFE_CLOCK_START` starts the clock at its time and lets it run at real speed; unset, it's the wall clock | `cargo test` |
| A `CAFE_CLOCK_START` that won't parse, or any `CAFE_CLOCK_START` on Fly, stops the server with one JSON error line and never listens | `cargo test`, the built binary |
| `listening` says which clock the start is on | `cargo test`, the built binary; `spec/` (the log check reads `clock` from every start) |
| A night from 23:00 to 07:30 wakes with the gap, the steps, one refill and walks for every cat, within the bound | `cargo test`, the built binary on mocked time |
| After that night the visitor's trust is as it was, the bowls are full, the board has a night's line, traces are still down and the furniture stands where it was | `cargo test`, the built binary on mocked time |
| Nine days asleep replay only the last 3, and say so | `cargo test`, the built binary on mocked time |
| Treats used up before midnight come back the next morning | `cargo test`, the built binary on mocked time |
| Slice 07's binary tests make their sleep on the mocked clock, with no rewrite of `saved_at` | `cargo test`, and by reading `server/tests/waking.rs` |
| No done-when line in slices 01, 02 or 08 waits on a real night or the live logs | reading the specs, in the review |
| The board after a mocked night reads like the café's own story | judged: by the user, reading the board the night test prints (`cargo test -p cafe --test long_gaps -- --nocapture`) |

## Rules it touches

- **The server decides every outcome.** It still does, on whichever clock
  it was started with. A client can't set the clock.
- **Trust never fades with absence.** Held again here, after a night on the
  built binary.
- **Never store or log what anyone says.** The tests' visitors say nothing.
  The clock adds no field to any line but `listening`.

## Numbers

- The night: 23:00 to 07:30 Canberra time, 30,600 seconds; bowl refills at
  7:00, 12:00 and 18:00; 3 treats a Canberra day.
- The cap: `replay_max_days = 3`.
- **The bound on `took_ms`:** 8½ hours replay in about 0.6 s in a debug
  build on the development machine (Apple M4, 0.55 s for 8 hours, measured
  2026-10-17). The test allows 20 s, for CI's slower, shared runners and a
  debug build. A replay that slow is a fault worth seeing, and well inside
  "a few seconds" in a release build.

## Open questions

None. The user asked for this slice and its approach.
