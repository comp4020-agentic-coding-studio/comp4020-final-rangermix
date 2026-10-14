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
- **Dates:** crit 9 cutoff Wed 14 Oct, 13:30; crit 10 in week 11; final
  submission Mon 9 Nov, 12:00; showcase Wed 11 Nov.
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
| 01 | The café keeps living while it sleeps | Fast-forward on wake, with the saved clock and random state; the schedule during a replay; loud failures | [01](../slices/01-the-cafe-keeps-living-while-it-sleeps.md) | approved 2026-10-14; planned ([plan](plan-slice-01-fast-forward.md)), building |
| 02 | What the night left behind | The chalkboard over a rolling 24 hours, readable on both layouts; scattered toys as traces until tidied | [02](../slices/02-what-the-night-left-behind.md) | approved 2026-10-14; planned when 01 is done |
| 03 | Keeping it kind | Mute, the slur blocklist, the admin ban | [03](../slices/03-keeping-it-kind.md) | spec proposed |
| 04 | The showcase room | A load check at forty connections inside 256 MB; the window's count | [04](../slices/04-the-showcase-room.md) | spec proposed |
| 05 | The art pass | Every sprite reads at both scales; a pose for every behaviour | [05](../slices/05-the-art-pass.md) | spec proposed |
| 06 | The accessibility pass | Every action by keyboard, touch and screen reader, held by browser checks | [06](../slices/06-the-accessibility-pass.md) | spec proposed |

What the crits and reviews turn up becomes new slices here, each with a spec
before its plan.

## What the agent writes and what the user writes

`PROCESS.md` is written by the agent, with the user choosing what goes in it
([ADR 0013](../adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
`README.md` and the reflections are the user's; the agent drafts them only
when asked.

For crit 9 (Wed 14 Oct, 13:30), as of 2026-10-12:

- `reflections/crit-9.md`: a draft is in place for the user to make their
  own.
- `PROCESS.md`: rewritten for crit 9. It doesn't yet mention the switch to
  slices or ADR 0013, which is the user's choice.
- `README.md`: the user's. It promises soothing music the design doesn't have
  (slice 05's open question), and it has no sources yet;
  [readme-material.md](readme-material.md) gathers them.
- The multi-user decision crit 9 asks for is ADR 0009 (the quiet seat), built
  and linked. "First grab wins" (ADR 0004) is the other one the pod may argue
  with.

For crit 10 (week 11): the logging and the live view (`pnpm logs`) were built
in phase 3; `reflections/crit-10.md` and a rewritten `PROCESS.md` remain.
