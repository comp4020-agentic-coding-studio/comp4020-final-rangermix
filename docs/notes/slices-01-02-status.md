# Slices 01 and 02: where the work stands

Kept up to date by session `efabe266`. Plans:
[slice 01](plan-slice-01-fast-forward.md), [slice 02](plan-slice-02-chalkboard.md).

Both slices are built, reviewed by a fresh agent with every finding
answered ([01](reviews/slice-01-findings.md), [02](reviews/slice-02-findings.md)),
recorded in design.md, and deployed (CI green through `be74a01`). What
remains in each is a judged line that needs a real night:

- **Slice 01:** read the first live `woke` line after a quiet night and
  record it in [slice-01-wake.md](slice-01-wake.md). Then the spec goes to
  `Live`. The live idle stops so far (up to 51 minutes) wake in under 20 ms.
- **Slice 02:** the user reads the live board after a night and judges
  whether it's worth reading on arrival ([slice-02-board.md](slice-02-board.md)).

For the user to decide:

- A first visitor after a break of more than a week may wait about 30 s at
  Fly's baseline CPU. If that's too long, shorten the cap or serve a page
  while the café wakes ([slice-01-wake.md](slice-01-wake.md)).
- What the slice 02 reviewer noted for the judged line: repeated plants,
  times with no day, and meetings crowding out the night.

Proposed follow-up, out of scope: a panic in the live world task doesn't
exit the process (phase 3's; noted by slice 01's reviewer).
