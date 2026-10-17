# Slice 02: the board, live

[Slice 02](../slices/02-what-the-night-left-behind.md),
[plan](plan-slice-02-chalkboard.md), Task 8.

## Deployed

Slice 02 and its review's fixes went live with `be74a01` (CI green: the
spec's 59 checks, the restart among them, the browser checks, the log
check). Checked read-only on 2026-10-14 at 22:00 AEDT:

- `/` serves the board's panel (`#chalk-lines`), the dialog
  (`aria-modal="true"`) and its backdrop.
- `flyctl logs` shows the café waking from its idle stops, replaying
  between 2 seconds and 9 minutes each time. The cats' knock-overs and games
  in those replays are written to the board but, by design, not to the log.

Nothing was signed up on the live café to read the board then: an account
made there can't be deleted. Since ADR 0015 (2026-10-15) agents test there
with `agent_…` accounts.

## Read and tidied with agent accounts (2026-10-15, about 14:50 AEDT)

- **`agent_320aca` read the board: it was empty.** Both plants (11,1) and
  (3,8), and the toys (7,8), were down, and all three cats were napping.
  Those traces dated from before slice 02 went live, when a knock-over wrote
  no line. Nobody had tidied since, so there was nothing left for a cat to
  knock over or play with, and so no line to write. The board would have
  stayed empty however many nights passed.
- **`agent_659b4d` tidied all three**, by the `tidy` a visitor sends: each
  answered "stood up". A second read found nothing toppled.
- So tonight the cats have things to knock over and scatter again, and the
  board something to tell. That's what the judged line below needs.

- **About an hour later** (`agent_0c7e80`, after slice 07's review went
  live), the board held the cats' own lines from replays of the idle stops:

  ```
  Thu 2:47 pm  Tora  knockedOver toys    ("Tora scattered the toys")
  Thu 2:57 pm  Tora  knockedOver plant   ("Tora knocked over the plant")
  Thu 2:57 pm  Tora  knockedOver plant
  ```

  Everything knockable was down again within about ten minutes of an
  empty café. The two plants read as a repeat, as the reviewer noted.

An empty board on a café nobody tidies is worth weighing in the judged line:
the board tells what the cats did, and once everything is down, a quiet
café's cats do nothing it counts.

## The judged line

"The board reads like the café's own story, worth reading on arrival":
judged by the user. Since 2026-10-17 it's read on the board a mocked night
leaves (slice 08,
[ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)),
not on the live board after a real night:

```
cargo test -p cafe --test long_gaps a_night -- --nocapture
```

Two runs of it on 2026-10-17 (the night differs a little run to run):

```
Fri 11:00pm  Burakku  met regular
Fri 11:00pm  Burakku  knockedOver toys
Fri 11:04pm  Burakku  knockedOver plant
Fri 11:05pm  Burakku  knockedOver plant

Fri 11:00pm  Burakku  met regular
Fri 11:00pm  Burakku  knockedOver plant
Fri 11:00pm  Burakku  knockedOver toys
Fri 11:01pm  Burakku  knockedOver plant
```

Four lines from 8½ hours, all within five minutes of the visitor leaving,
and nothing after. It's what the live board showed on 15 October: once
everything knockable is down, the night's cats do nothing the board
counts. Waiting for the user's reading. The reviewer noted three things to
weigh when doing so (slice 02's findings, "Noted, out of scope"):

- two plants knocked over seconds apart read as a repeat;
- times carry no day, so yesterday's 4:00pm sits among this morning's lines;
- first meetings are told every time, so a morning's newcomers push the
  night off the latest eight within a few visits.
