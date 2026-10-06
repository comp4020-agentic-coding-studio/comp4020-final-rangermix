# 0006. Fast-forward the world when the server wakes

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The user wants a world that never stops: the cats go on moving and acting
whether or not anyone is there, and some characters are more active when no
humans are around, some less. But the course's `fly.toml` sets
`auto_stop_machines = "stop"` with `min_machines_running = 0`, so the machine
stops a few minutes after the last connection closes ("most of why the app
costs cents, not dollars"), and every deploy restarts it. A stop, idle or not,
sends SIGINT and waits a best-effort 5 seconds before forcing the process down
(checked in Fly's configuration reference on 2026-10-07).

## Options

1. **Fast-forward on wake.** The server saves the world and, on starting,
   replays the time it was down with the same step function in one-second
   steps, then opens the doors. Neko Atsume works the same way: cats visit
   while the app is closed. It gives a world that never stops as far as anyone
   can tell, and it covers deploys and crashes as well as idle stops. It costs
   a step function that tolerates big steps, and the first visitor waits for
   the machine to start and the replay to finish.
2. **Turn auto-stop off** (`min_machines_running = 1`). Literally always
   running, but against a setting the course chose, at the course's expense,
   and the machine still restarts for deploys and host maintenance, so a
   catch-up would be needed anyway.
3. **Freeze while asleep.** Nothing to build, but it breaks the world that never
   stops, the night leaves no traces, and a cat that is busier alone has no
   chance to show it.

## Decision

We will fast-forward the simulation through any downtime when the server
starts, using the same rules as live play.

## Consequences

- One seeded random generator drives the whole world and its state is saved,
  so the same saved world and the same gap always produce the same night,
  which makes fast-forward testable.
- With nobody present, behaviours that need people aren't on offer and each
  cat's activity when alone takes over. That is where the night's traces and
  chalkboard lines come from.
- The café's own schedule runs during the replay: bowls refill, treats reset
  at midnight Canberra time, and chalkboard lines older than 24 hours drop off.
- Gaps longer than a week replay only the last week, since by then the cats'
  needs have settled. Eight hours is about 29,000 steps.
- The commits that carry it out will be linked here as they land.
