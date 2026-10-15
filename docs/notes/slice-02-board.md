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

An empty board on a café nobody tidies is worth weighing in the judged line:
the board tells what the cats did, and once everything is down, a quiet
café's cats do nothing it counts.

## The judged line

"The board reads like the café's own story, worth reading on arrival":
judged by the user, reading the live board after a real night. Waiting for
them. The reviewer noted three things to weigh when doing so (slice 02's
findings, "Noted, out of scope"):

- two plants knocked over seconds apart read as a repeat;
- times carry no day, so yesterday's 4:00pm sits among this morning's lines;
- first meetings are told every time, so a morning's newcomers push the
  night off the latest eight within a few visits.
