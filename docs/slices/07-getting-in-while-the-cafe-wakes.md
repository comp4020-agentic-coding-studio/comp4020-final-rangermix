# 07. Getting in while the café wakes

- **Status:** Reviewed, every finding answered, and deployed (approved 2026-10-15, asked for by the user)
- **Plan:** [`docs/notes/plan-slice-07-waking.md`](../notes/plan-slice-07-waking.md)
- **Design:** Persistence and fast-forward ("Waking"); The client; Logging;
  [ADR 0006](../adr/0006-fast-forward-the-world-when-the-server-wakes.md).
  Changes slice 01's "before it lets anyone in": the doors now open at
  once, and only the café itself waits.

## Story

A regular comes back after a long weekend, and the machine has slept for
days. The page appears at once and they log in as usual. The café opens
straight away on "Dusting off the café…", with a little animation, while
the server replays the days it was asleep. A few seconds later the cats are
where those days took them, and the café carries on.

## In this slice

- The server binds its port before the replay and runs the replay in the
  background. `/`, `/readme/` and sign-up, log-in and recovery work
  throughout.
- A WebSocket that connects during the replay is told `waking` at once. Its
  welcome follows when the café is ready, then everything as usual. Nothing
  of the café (people, cats, room, board) is sent before the welcome.
- The café page, given `waking`, shows the room's frame with no state and
  "Dusting off the café…" with an animation (still, under reduced motion)
  and a status line that says so, read once by a screen reader. All of it
  goes when the welcome arrives.
- A stop signal during the replay stops the process. The store still holds
  the last save, so the next start replays again.
- If the café's world task dies, while waking or awake, the process logs
  one JSON error line and exits, so Fly restarts it from the last save.
  Before, a world-task panic left the server up with no café (slice 01's
  review, noted).
- Every start logs `listening` and then its `woke` line. The log check
  follows that order.

## Not in this slice

- Making the replay itself faster, or a progress bar.
- Any action during the replay: the café isn't there to act on.

## Done when

| What must be true | Held by |
| --- | --- |
| `/` and sign-up answer while a replay of days runs | `cargo test`, the built binary woken from a week asleep (the test raises the cap in a copy of `content/`, so the replay outlasts what it checks on a slow machine) |
| A visitor connecting during the replay gets `waking` first, then the welcome once the café is ready; a Leave sent meanwhile frees the seat when it wakes | `cargo test`, the same binary |
| A stop during the replay leaves the save as it was, and exits cleanly within Fly's five seconds even with a request in flight | `cargo test`, the same binary |
| A panic in the world task ends the process with a JSON error line | `cargo test`, on `supervise` with tasks that panic or fail; that `run` hands the world task to `supervise` is checked by reading, and by the reviewer's patched build |
| The café page shows "Dusting off the café…", animated, with no café state, until the welcome, then the café | browser check, with the welcome held back, at 390×844 and 1920×1080, through a resize |
| Under reduced motion the animation is still | browser check |
| Every start logs `listening` and then `woke` | `spec/` (the log check) |
| A first visitor after a long sleep gets the page at once and the café within seconds, on the image at Fly's baseline CPU | judged: by the agent, on the image under `--cpus=0.0625` with the saved clock set back three days, recorded in `docs/notes/` |

## Rules it touches

- **The server decides every outcome.** Nothing is decided before the café
  is awake. A client message sent while waking waits its turn behind the
  join.
- **Every action works by keyboard, touch and mouse.** There's nothing to do
  while waking, and the page mustn't trap focus or scroll sideways.
- **Never store or log what anyone says.** Unchanged.

## Numbers

- Replay cap: 3 days (`replay_max_days`).

## Open questions

None: the user chose the words and the animation.
