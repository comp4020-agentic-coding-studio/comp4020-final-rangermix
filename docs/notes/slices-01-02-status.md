# Slices 01 and 02: where the work stands

Kept up to date by session `efabe266`. Plans:
[slice 01](plan-slice-01-fast-forward.md), [slice 02](plan-slice-02-chalkboard.md).

## Slice 01, "The café keeps living while it sleeps"

Built, deployed, reviewed, and every finding answered
([findings](reviews/slice-01-findings.md), "Answers"). What's left is the
judged line: the live `woke` line after a real night, recorded in
[slice-01-wake.md](slice-01-wake.md). Then the spec goes to `Live`.

Left for the user to decide: if a first visitor after a week-plus break
mustn't wait about 30 s (at the baseline CPU) for the replay, shorten the cap
or serve a page at once while the café wakes (slice-01-wake.md).

Proposed follow-up, out of scope: a panic in the live world task doesn't
exit the process (phase 3's; noted by slice 01's reviewer).

## Slice 02, "What the night left behind"

Built (Tasks 1 to 6), recorded in design.md, and with its fresh reviewer
([brief](reviews/slice-02-brief.md)). Left: answer the findings, deploy, the
read-only live check (recorded in `slice-02-board.md`), and the user's
judged line ("worth reading on arrival", after a real night).
