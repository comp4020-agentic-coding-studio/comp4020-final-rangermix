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

## Measured live

- **After the deploy:** pending until slice 01's last push has deployed.
  The redeploy's own wake-up is a gap of seconds.
- **After a real night:** pending. The machine stops itself when idle, so
  the first visit after a quiet night logs a wake-up with a gap of hours.
  Read it with `flyctl logs -a comp4020-final-rangermix | grep '"woke"'` (or
  `pnpm logs`) and record the line here. Until then this judged line is
  unmet, and the slice stays short of `Live` on it alone.
