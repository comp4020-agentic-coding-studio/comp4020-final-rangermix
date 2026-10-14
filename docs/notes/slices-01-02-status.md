# Slices 01 and 02: where the work stands

Written 2026-10-14 by session `efabe266` when its usage limit ran out. The
next session picks up from here. Plans:
[slice 01](plan-slice-01-fast-forward.md), [slice 02](plan-slice-02-chalkboard.md).

## Slice 01, "The café keeps living while it sleeps"

Built, deployed through CI, and reviewed
([findings](reviews/slice-01-findings.md): 1 major, 8 minor). Answered so
far, each test first:

| Finding | Answer | Commit |
| --- | --- | --- |
| 1 (major) cats get up on waking | a cat's save keeps what it's doing, until when, and a walk under way | `96a6cca` |
| 2 the DST test couldn't fail | checks a minute either side of 7:00 and 18:00; seen failing under fixed UTC+10 and UTC+11 | `1e84f3d` |
| 3 the cap untested in `wake` | a nine-day wake test; seen failing without the cap | `1e84f3d` |
| 5 a save wasn't one transaction | every fired job under a savepoint; one-job saves; `wake` flushes | `afdc819` |
| 6 a panicking replay loops | `catch_unwind`, wake at now, `failed` on the woke line; JSON panic hook | `8866b2b` |
| 7 an unreadable clock said `first` | `first` means nothing was ever saved | `779fa45` |
| 9 names with spaces | walks logged as JSON pairs; the narrator reads both forms | `779fa45` |

Still to do:

- **Finding 4**, the restart spec check. Read the restart's own `woke` line
  (CI to pass `APP_LOGS="docker logs app"` beside `APP_RESTART`) and assert
  `first: false` and `steps` of about the sleep. Move a piece before the
  stop, so "furniture as it was" compares a layout only the store could
  keep. Drop the "cats moved" tile comparison, which since finding 1 can
  fail on a café where every cat is napping, and leave "moved by the gap" to
  `cargo test`. Say so in the plan's execution log.
- **Finding 8**: measure a capped (8-day) wake in Docker with
  `--cpus=0.0625`, with `saved_at` set back in a bind-mounted `/data`.
  Record it in `slice-01-wake.md`. Correct design.md: a new visitor waiting
  on a wake sees the browser loading (Fly's proxy holds the request); only
  an open tab shows "Reconnecting…".
- Write the answers into `reviews/slice-01-findings.md`, and add the
  execution log for the review fixes to the plan.
- The judged line: the live `woke` line after a real night (see
  `slice-01-wake.md`). Then set the spec to `Live`.
- Proposed follow-up, out of scope: a panic in the live world task doesn't
  exit the process (phase 3's; noted by the reviewer).

## Slice 02, "What the night left behind"

Tasks 1 to 5 built and pushed (`11dbf30`, `857d7c8`, `8a893ed`, `53fa6af`,
`b8a4800`), with every check passing locally, the restart included, against
a fresh image. Still to do:

- Task 6: design.md ("The room": what makes a line, the hourly rule,
  scattered toys and "Gather up the toys"; "The client": the board in the
  panel, the dialog, the board last in the Tab cycle; "Persistence": the
  `chalkboard` table; "Numbers to tune": `chalk_hours`, `chalk_shown`), the
  spec's status, the root plan, and the plan's execution log. Departures to
  log there: the store writes moved from Task 1 to Task 2; the welcome's
  snapshot is boxed (clippy); the chalkboard is last in the Tab cycle, and
  the first Shift+Tab of a fresh cycle now lands on the last thing; the
  tidied-trace test passed at once (phase 3's code).
- Task 7: a fresh review (brief and findings files), each finding answered.
- Task 8: CI green and deployed, the live board read and recorded in
  `slice-02-board.md`. The judged line ("worth reading on arrival") is the
  user's, after a real night.
