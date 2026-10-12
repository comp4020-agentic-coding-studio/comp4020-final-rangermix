# 0014. Build the rest in vertical slices, each with a spec

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

[ADR 0012](0012-plan-in-phases-and-build-each-phase-natively.md) split the
spec into five phases lined up with the crits, each planned when it started,
built natively by one agent and reviewed fresh at its end. Phases 1 to 3 were
built that way and are live. Their reviews kept 17, 19 and 34 findings, the
last with 10 major, all arriving at once at the end of the phase.

What remains (phases 4 and 5 in the old roadmap) is a mix of separate
functions, such as fast-forward on wake, the chalkboard, mute and the
blocklist, an art pass and a load check. Each can be built and checked on its
own.

The user (2026-10-12): "This is a rather small MVP project, not a full on one,
so it's okay to stay tightly coupled as long as it won't affect speed too
much. Instead of phases, create virtical slices of functionalities, then create
spec for each of them. We'll have two level of plans: root-level plan for the
project itself and all slices, and slice-level plans prepared just before
implementation so it will be updated to the details of the project. Each slice
will be build natively as you said in option 1."

ADR 0012 gave option 1's cost as "no independent check until the end of the
phase". Independent means a reviewer who didn't build the work: a fresh agent,
briefed through a file, reading the result cold. The builder's own tests run
throughout, and the user's own checks are separate from both.

## Options

1. **Vertical slices, each with a spec, under a root plan.** A slice is one
   piece of the café a visitor (or the operator) can use, built through every
   layer it needs: Rust, the protocol, the client and the checks. The root
   plan lists every slice in order. Each slice has a spec saying what it does
   and how "done" is checked. Its detailed plan is written just before it's
   built, from the code as it then stands. One agent builds it natively, test
   first, and a fresh reviewer reads it at the end. The independent check comes
   per slice, so a mistake waits at most one slice to be found, and each review
   is small enough to answer in one sitting. The cost: more documents (a spec
   and a plan per slice), and review overhead paid more often.
2. **Keep the phases** for phases 4 and 5. Fewer documents and two reviews in
   all, but each review again lands at the end of a large mixed batch, as
   phase 3's 34 findings did.
3. **Slices built by a subagent each.** More independence between slices, but
   in a small, coupled app each subagent would have to rediscover what the
   others decided, and every slice pays a fresh context. The user judged the
   coupling acceptable.

## Decision

We will build the rest of the project as vertical slices, each with a spec in
`docs/slices/`, listed in a root plan in `docs/notes/plan.md`. Each slice gets
a detailed plan just before it's built, is built natively in one session test
first, and ends with a fresh reviewer whose brief and findings are files.

## Consequences

- ADR 0012 is superseded. Phases 1 to 3 stay as built; their plans and
  reviews remain the record of how they were made.
- A slice's spec is written before its plan, and the plan is written just
  before the build, so later slices are planned from what earlier ones left in
  the code.
- Every "done when" line in a spec names how it's held: `cargo test`, `spec/`,
  a browser check, or a judgement with who makes it and how.
- The app stays one tightly coupled system, built by one agent per slice.
  Revisit if coupling starts to slow slices down, for example if a small slice
  keeps forcing changes across every layer.
- Revisit if slice reviews keep finding little, which would mean the slices
  could be larger.
