# 01. The café keeps living while it sleeps

- **Status:** Live. Reviewed, every finding answered, and deployed
  (approved 2026-10-14 with the proposed default for its open question).
  Its last line, waking after a night, was judged on the live machine after
  a real night until 2026-10-17, and is now held by `cargo test` on mocked
  time ([slice 08](08-long-gaps-held-by-mocked-time.md),
  [ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md))
- **Plan:** [`docs/notes/plan-slice-01-fast-forward.md`](../notes/plan-slice-01-fast-forward.md)
- **Superseded in part** by [slice 07](07-getting-in-while-the-cafe-wakes.md)
  (2026-10-15): the doors now open at once, and only the café itself waits
  for the replay.
- **Design:** "The world never stops" under The café; Persistence and
  fast-forward; Logging ("each wake-up's fast-forward summary");
  [ADR 0005](../adr/0005-keep-all-state-in-sqlite-on-the-volume.md),
  [ADR 0006](../adr/0006-fast-forward-the-world-when-the-server-wakes.md)

## Story

A regular says goodnight to the cats and closes the tab. Nobody else is in, so
the machine stops. Next morning they open the café and the cats are where the
night took them: Burakku, who is nocturnal, has been up and about, Mochi is
curled up somewhere new, and the bowls were refilled at 7:00. Nothing
gives away that the café was switched off. A redeploy is the same thing over
a few seconds.

## In this slice

- The world clock and the random generator's state are saved with the cats,
  every 5 seconds and on the stop signal.
- On waking, the server loads everything and replays the gap in one-second
  steps with the same rules it runs live, at most the last 7 days, before it
  lets anyone in.
- The café's schedule runs during the replay: bowls refill, and treats reset
  at midnight Canberra time.
- One log line per wake-up summarises the replay (the gap, the steps, how long
  it took), and `pnpm logs` says it in words.
- Failures stay loud. A database that won't open stops the server rather than
  letting it serve an empty café.

## Not in this slice

- Chalkboard lines and the night's traces are slice 02's. Once slice 02 adds
  them, the replay writes them like any other step.
- Nothing about people changes in a replay: nobody is inside, so no trust
  moves.

## Done when

| What must be true | Held by |
| --- | --- |
| The same saved state and the same gap replay to the same café | `cargo test` |
| An empty eight-hour night moves the cats in character (Burakku more than Mochi) | `cargo test`, seeded |
| A gap longer than a week replays only the last 7 days | `cargo test` |
| Bowls refill and treats reset during a replay, including across a daylight-saving change | `cargo test`, with a controllable clock |
| A replay changes no one's trust | `cargo test` |
| Stopping the image and starting it again after a pause brings the cats back moved by the gap, with furniture and trust as they were | `spec/`, a stop and start of the container |
| A database that won't open stops the server instead of serving an empty café | `cargo test` |
| Every wake-up logs its summary, and the narrator has words for it | `spec/` (the log check), narrator tests |
| Waking after a night takes a few seconds at most | `cargo test`, the built binary started at 23:00 and again at 07:30 on mocked time, its replay bounded at 20 s in a debug build (0.6 s on the development machine) (slice 08). Until 2026-10-17 this was judged from the live summary line after a real night; the baseline-CPU numbers stay in [slice-01-wake.md](../notes/slice-01-wake.md) |

## Rules it touches

- **Trust never fades with absence.** A replay is absence by definition.
- **The server decides every outcome.** The replay runs on the server only.

## Numbers

- Simulation: 10 steps a second live; 1-second steps in fast-forward, at most
  7 days. (Tuned to 3 days on 2026-10-15, as `replay_max_days` in
  `content/tuning.toml`.)
- Cat state saved every 5 seconds, and on stop.
- Bowl refills at 7:00, 12:00 and 18:00 Canberra time; 3 treats per visitor
  per Canberra day.

## Open questions

- **What does a visitor see while the café wakes?** Proposed: the page's usual
  "Connecting…" until the doors open, since the replay should take seconds.
