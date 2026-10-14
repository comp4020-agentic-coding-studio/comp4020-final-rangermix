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

- **After the deploy:** pending until slice 01's last push has deployed.
  The redeploy's own wake-up is a gap of seconds.
- **After a real night:** pending. The machine stops itself when idle, so
  the first visit after a quiet night logs a wake-up with a gap of hours.
  Read it with `flyctl logs -a comp4020-final-rangermix | grep '"woke"'` (or
  `pnpm logs`) and record the line here. Until then this judged line is
  unmet, and the slice stays short of `Live` on it alone.
