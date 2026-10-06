# 0012. Plan in phases and build each phase natively

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

`AGENTS.md` names the agent workflow itself as a decision worth an ADR, and the
brief asks `PROCESS.md` to justify it. The design came out of a brainstorm with
the user, recorded in `docs/notes/brainstorm.md`, and was written into
`docs/design.md` with ADRs 0002 to 0011. What remained was how to get from that
spec to working software.

The app is one tightly coupled system: Rust message types generate the
TypeScript the client uses, the world task's rules decide what every client
draws, and a change to one interface ripples through the others. There are
crits in weeks 9, 10 and 11, each judged on its own terms.

The user asked for the plan and the first phase to be carried through in one go
("finish spec and the implementation plan, then separate a first phase
deliverable for crit 8, then finish that phase"), leaving the execution method
to the agent. This ADR records the method chosen under that instruction.

## Options

1. **Phased plans, each built natively.** A roadmap in `docs/notes/plan.md`
   splits the spec into phases lined up with the crits. Each phase gets a
   detailed plan (files, interfaces, tests first, then code) when it starts.
   One agent builds the whole phase in the session, test first, committing
   and pushing per task, and then a fresh reviewer reads the whole phase,
   briefed through a file and writing its findings to one. One mind keeps the
   cross-language interfaces consistent, and it's the cheapest in context. The
   cost: no independent check until the end of the phase.
2. **Subagent per task, with a reviewer per task.** A fresh subagent builds each
   task from the plan, and a fresh reviewer checks it before the next starts.
   The most independent checking, but every task pays a new context, and with
   interfaces this coupled each subagent has to rediscover what its neighbours
   decided.
3. **No plan, build straight from the spec.** Fastest to start, but nothing
   records how the spec became code, which is exactly what `PROCESS.md` has to
   show, and nothing stops scope from drifting.

## Decision

We will split the spec into phases lined up with the crits, write a detailed
plan for each phase when it starts, build each phase natively in one session
with tests written before code, and end each phase with a fresh reviewer whose
brief and findings are files in `docs/notes/reviews/`.

## Consequences

- Plans live in `docs/notes/` as working state, per `AGENTS.md`, and record
  where execution departed from them.
- Later phases are planned with what earlier ones taught, so the roadmap stays
  short and only the current phase is detailed.
- The per-phase review is the independent check; its findings are fixed or
  answered before the phase is called done.
- Revisit if a phase's review keeps finding mistakes that a per-task review
  would have caught earlier.
- The commits that carry it out will be linked here as they land.
