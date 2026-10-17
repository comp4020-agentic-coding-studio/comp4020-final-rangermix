# Plan

The settled design is [`docs/design.md`](../design.md). This is the root plan
for building it: the project as a whole, and every slice in order. The work is
built in vertical slices
([ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md)),
which on 2026-10-12 replaced the phases of
[ADR 0012](../adr/0012-plan-in-phases-and-build-each-phase-natively.md).

## The project

- **What:** a 2D pixel-art cat café, one shared room where up to six people
  sit with three cats who each have a character and remember everyone they
  meet. The brief's "multi-user, real-time website that's good".
- **Dates:** crit 9 cutoff Wed 14 Oct, 13:30 (passed); crit 10 cutoff
  Wed 21 Oct, 13:30, inferred from the crit group, which the user hasn't
  confirmed ([brief-and-crits.md](brief-and-crits.md)); final submission
  Mon 9 Nov, 12:00; showcase Wed 11 Nov.
- **Done means:** everything in `docs/design.md` is built, held by its
  checks and live, and `README.md`, `PROCESS.md` and the three reflections
  are in place.

## Built as phases

Phases 1 to 3 were built under ADR 0012. Each phase's plan, execution log and
review stay as the record.

| Phase | Crit | Delivered | Plan | Status |
| --- | --- | --- | --- | --- |
| 1. It's alive | C8 | Accounts with recovery codes; the room, with six inside and a line at the window; walking by mouse, touch and keyboard; public, fleeting bubbles; Mochi, Burakku and Tora with a first set of behaviours; pet and call; trust that grows, persists and shows; `/readme/`; deployed. | [plan-phase-1.md](plan-phase-1.md) | done 2026-10-09: deployed 2026-10-07 as a cut version (tag `crit-8`, see [crit-8-mvp.md](crit-8-mvp.md)), then closed and reviewed ([reviews/phase-1-findings.md](reviews/phase-1-findings.md)) |
| 2. All at once | C9 | The quiet-seat rule; rearranging furniture together, first grab wins; sitting; emotes; phone layout B; browser checks at both sizes. | [plan-phase-2.md](plan-phase-2.md) | done 2026-10-09: built, reviewed ([reviews/phase-2-findings.md](reviews/phase-2-findings.md)), deployed through CI |
| 3. Fly by instruments | C10 | Logging every action and the narrating log tail; treats and bowls; play, picking up, carrying and passing cats; laps; knocking things over and tidying; anger, scratches and bans. | [plan-phase-3.md](plan-phase-3.md) | done 2026-10-10: built, reviewed ([reviews/phase-3-findings.md](reviews/phase-3-findings.md)), deployed through CI |

## Slices

The rest of the old roadmap's phases 4 and 5, as slices. Each spec is
`Proposed` until the user approves it. Its plan is written when the slice
starts, from the code as it then stands, and it ends with a fresh review.

| # | Slice | Delivers | Spec | Status |
| --- | --- | --- | --- | --- |
| 01 | The café keeps living while it sleeps | Fast-forward on wake, with the saved clock and random state; the schedule during a replay; loud failures | [01](../slices/01-the-cafe-keeps-living-while-it-sleeps.md) | reviewed and deployed ([plan](plan-slice-01-fast-forward.md), [findings](reviews/slice-01-findings.md)); live once a real night's wake is read |
| 02 | What the night left behind | The chalkboard over a rolling 24 hours, readable on both layouts; scattered toys as traces until tidied | [02](../slices/02-what-the-night-left-behind.md) | reviewed ([plan](plan-slice-02-chalkboard.md), [findings](reviews/slice-02-findings.md)); live once deployed and the user has read the board after a night |
| 03 | Keeping it kind | Mute, the slur blocklist, the admin ban | [03](../slices/03-keeping-it-kind.md) | spec proposed |
| 04 | The showcase room | A load check at forty connections inside 256 MB; the window's count | [04](../slices/04-the-showcase-room.md) | spec proposed |
| 05 | The art pass | Every sprite reads at both scales; a pose for every behaviour | [05](../slices/05-the-art-pass.md) | spec proposed |
| 06 | The accessibility pass | Every action by keyboard, touch and screen reader, held by browser checks | [06](../slices/06-the-accessibility-pass.md) | spec proposed |
| 07 | Getting in while the café wakes | The port opens at once; the page and accounts work during a replay; the café shows "Dusting off the café…" until it's ready; a dead world task restarts the machine | [07](../slices/07-getting-in-while-the-cafe-wakes.md) | reviewed and live ([plan](plan-slice-07-waking.md), [findings](reviews/slice-07-findings.md), [notes](slice-07-waking.md)) |

What the crits and reviews turn up becomes new slices here, each with a spec
before its plan.

## What the agent writes and what the user writes

`PROCESS.md` is written by the agent, with the user choosing what goes in it
([ADR 0013](../adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
`README.md` and the reflections are the user's; the agent drafts them only
when asked.

Crit 9 (Wed 14 Oct, 13:30) has passed. `reflections/crit-9.md` is the
user's, `PROCESS.md` was rewritten for it, including the switch to slices
and ADR 0013
([`8960bd4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8960bd4)),
and its multi-user decision is ADR 0009 (the quiet seat). The repo has no
`crit-9` tag; `crit-8` is the only crit tag on the remote (read 17 Oct).

## Where it stands (2026-10-17)

Read by session `013dedec`. CI on `main` is green through `7b1a740`, and the
machine serves version 64 of the app.

- **Done and live:** phases 1 to 3, and slice 07.
- **Built and deployed, each short of one judged line that needs a real
  night:** slice 01, the first live `woke` line after a quiet night
  ([slice-01-wake.md](slice-01-wake.md)); slice 02, the user reading the
  board after a night ([slice-02-board.md](slice-02-board.md)).
- **Specs waiting for the user's approval:** slices 03 to 06. None is planned.

## What's left, in order

1. **Crit 10 (cutoff Wed 21 Oct, 13:30).**
   - The log line for every action and the live view (`pnpm logs`) were
     built in phase 3.
   - `PROCESS.md` rewritten for crit 10: the options first, for the user to
     choose from.
   - The demo by the logs alone, while the group uses the café: not yet
     rehearsed.
   - `reflections/crit-10.md`: the user's, still the empty template.
2. **The two judged lines:** slice 01's, read by an agent after a night;
   slice 02's, read by the user. Then both specs go to `Live`.
3. **Approve and build slices 04, then 03.** The showcase puts a full room
   of strangers in the café, so the load check and the window's count come
   first, then mute, the blocklist and the admin ban. This order is the
   agent's suggestion; the user hasn't chosen one.
4. **Approve and build slices 05 and 06**, the art and accessibility passes.
5. **Final submission (Mon 9 Nov, 12:00).** `PROCESS.md` rewritten again,
   and the user's `README.md`. The README still promises soothing music the
   design doesn't have (slice 05's open question) and has no sources yet;
   [readme-material.md](readme-material.md) gathers them.
