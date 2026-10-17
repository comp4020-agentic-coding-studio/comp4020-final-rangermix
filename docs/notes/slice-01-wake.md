# Slice 01: how long waking takes

The spec's judged line: "waking after eight hours takes a few seconds at
most on the live machine", measured by the agent from the live summary line
after a real night ([slice 01](../slices/01-the-cafe-keeps-living-while-it-sleeps.md),
[plan](plan-slice-01-fast-forward.md), Task 8). Every wake-up logs one
`cafe` line, `what = "woke"`, with `gap_secs`, `steps` and `took_ms`;
`pnpm logs` narrates it ("The café woke after 8h 2m asleep and caught up in
412 ms; …").

## Measured here

A release build on the development machine (Apple M4), from a fresh world,
by the ignored test `measure_replay_times` in
`server/src/world/replay_tests.rs`
(`cargo test --release -p cafe measure_replay_times -- --ignored --nocapture`),
2026-10-14:

| Gap | Steps | Took |
| --- | --- | --- |
| 8 hours | 28,800 | 54 ms |
| 7 days (the cap) | 604,800 | 708 ms |

The live machine is a `shared-cpu-1x` with 256 MB, slower than this one, so
these numbers bound the work, not the live time. In a debug build the 7-day
replay takes about 20 seconds; it is the slowest test in `cargo test`.

The local Docker image (the one Fly runs, on this machine), stopped for 30
seconds and started again by `spec/restart.test.ts`, logged
`"gap_secs":30,"steps":30,"took_ms":0` each time.

## Measured at Fly's baseline CPU

Slice 01's review, finding 8. A `shared-cpu-1x` is guaranteed 1/16 of a core
and bursts above it while it has credit, so the image was run here with
`--cpus=0.0625`, with `/data` bind-mounted so the saved clock could be set
back, then stopped and started (2026-10-14, after the review's fixes):

| Asleep | Steps | Replay (`took_ms`) | Start to answering |
| --- | --- | --- | --- |
| 8 hours | 28,800 | 1,301 ms | 1.9 s |
| 8 days (capped at 7) | 604,800 | 28,893 ms | 29.5 s |

So the judged line, "waking after eight hours takes a few seconds at most
on the live machine", holds even at the baseline. The week's cap costs
about half a minute at the baseline, before the port opens. Whether Fly's
proxy holds a first request that long, or shows its own error first, isn't
verified. If it errors, the visitor's next try finds the café awake,
because the replay has saved by then. If that's not good enough, there are
two ways out, both the user's to choose: a shorter cap (it's a tunable
number), or a page served at once while the café wakes.

The first try at this, after finding 1's fix and before its guard, showed
every cat standing still for the whole week. The saved clock had been set back but
the cats' saved timers hadn't, so finding 1's restored timers froze them.
A normal save can't do that, but a clock that steps back can. It's guarded
in `a35beb1`: a timer further ahead than any pose lasts, or a walk not yet
begun, isn't kept.

## Measured live

- **After the deploys, and the machine's own idle stops** (2026-10-14,
  read with `flyctl logs` and narrated), with the review's fixes live from
  `1a8745f`:

  ```
  20:57:41  The café woke after 51m asleep and caught up in 14 ms; meanwhile Burakku walked 20 times, Mochi 58 and Tora 293
  21:10:45  The café woke after 7m asleep and caught up in 2 ms; meanwhile Burakku walked 31 times, Mochi 10 and Tora 11
  21:15:42  The café woke after 5s asleep and caught up in 4 ms; meanwhile Burakku walked 0 times, Mochi 0 and Tora 1
  ```

  The machine stops itself when idle and wakes on the next request, so these
  are real sleeps, not only redeploys. Earlier redeploys took 0 ms for gaps
  of 3 to 5 seconds.
- **After a real night:** no longer needed. Since 2026-10-17 the judged
  line is held by `cargo test` on mocked time instead (slice 08,
  [ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)):
  see "On mocked time" below. Until then it was pending, read from
  `flyctl logs -a comp4020-final-rangermix | grep '"woke"'` after a quiet
  night.
- **Read on 2026-10-17 at 17:09 AEDT** (session `013dedec`, read-only).
  Three wake-ups, all from idle stops that afternoon, on version 64 of the
  app (build `mv91rjsh`):

  | Woke (AEDT) | `gap_secs` | `took_ms` |
  | --- | --- | --- |
  | 16:09:38 | 324 | 3 |
  | 16:32:10 | 916 | 8 |
  | 16:48:46 | 599 | 6 |

  Each logged `listening` before `woke`, as slice 07 expects. None was a
  night. `flyctl logs --no-tail` returns only Fly's last 100 lines, which
  reached back to 16:09 that day. The 16:09 wake's gap of 324 s means the
  machine was already up before then, so the first wake after the night of
  16 to 17 October had already left the buffer.

  The machine's own `/data` holds no log, since the café writes only to
  stdout. That, and the user's ask the same day ("do not rely on realworld
  checks"), is why the night moved to mocked time.

## On mocked time (slice 08)

`server/tests/long_gaps.rs`, `a_night_from_eleven_to_half_past_seven`,
starts the built binary at 23:00 on Friday 16 October 2026 (Canberra) with
`CAFE_CLOCK_START`, lets a visitor meet a cat and leave, stops it, and starts
it at 07:30 on Saturday with the save the café wrote. It requires the
wake-up line's gap to be within a minute of 30,600 s (the evening's
seconds), the steps to match, one refill, and `took_ms` under 20,000. The
test prints its wake-up line. On the development machine (Apple M4, debug
build, 2026-10-17):

```
"gap_secs":30584,"steps":30584,"refills":1,"capped":false,"failed":false,
"took_ms":570,"walks":"[[\"Burakku\",1501],[\"Mochi\",183],[\"Tora\",1071]]"
```

Burakku, who is nocturnal, walked eight times as often as Mochi. The
evening runs live for a few seconds before the stop, and how many ticks it
gets varies from run to run, so the night differs a little between runs;
the test asserts only what held for every one of 300 seeds. CI's runners
run it on every push, so a slower replay fails before a deploy rather than
after a night. The baseline-CPU numbers above stay as the record of how the
live machine compares.
