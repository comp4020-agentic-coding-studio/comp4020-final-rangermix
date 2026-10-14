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

Nothing was signed up on the live café to read the board: an account made
there can't be deleted, and reading the board is the judged line below.

## The judged line

"The board reads like the café's own story, worth reading on arrival":
judged by the user, reading the live board after a real night. Waiting for
them. The reviewer noted three things to weigh when doing so (slice 02's
findings, "Noted, out of scope"):

- two plants knocked over seconds apart read as a repeat;
- times carry no day, so yesterday's 4:00pm sits among this morning's lines;
- first meetings are told every time, so a morning's newcomers push the
  night off the latest eight within a few visits.
