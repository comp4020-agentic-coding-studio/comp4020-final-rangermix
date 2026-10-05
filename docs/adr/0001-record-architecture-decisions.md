# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

The final project brief asks `PROCESS.md` to make the case for the stack and
agent workflow and the trade-offs weighed, within 900 to 1100 words, rewritten
at each crit. Big decisions need a fuller record than that budget allows, and
one that survives each rewrite. The brief suggests architecture decision
records, which don't count toward the word count and which `PROCESS.md` can
link to instead of restating.

`docs/design.md` already holds the settled specification, but it describes the
current state. It doesn't keep the options that were rejected, and editing it
erases what the decision used to be.

## Options

1. **`docs/design.md` only.** One place to read, but rejected options and
   superseded decisions disappear when the file is edited.
2. **Reasons in commit messages only.** The reason sits next to the change, but
   it's scattered across the history and hard for a marker to find.
3. **ADRs in `docs/adr/`, with `docs/design.md` as the current-state summary
   that links to them.** More files to keep, but each big decision keeps its
   context, options and costs, and `PROCESS.md` can cite it.

## Decision

We will record each significant decision as an ADR in `docs/adr/`, numbered
`NNNN-slug.md` and following `docs/adr/template.md`: context, options,
decision, consequences, after
[Nygard (2011)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
`docs/design.md` stays the summary of what is true now and links to the ADR
behind each entry.

## Consequences

- An accepted ADR is not edited for substance. Changing a decision means a new
  ADR that supersedes it, and the old one's status line says so. The history
  of the decision stays readable.
- Some decisions will be small enough for a line in `docs/design.md`; the bar
  is in `AGENTS.md`.
- `PROCESS.md` can stay within its word budget by linking to ADRs.
- It's one more thing to keep current. `AGENTS.md` makes writing the ADR part
  of the same commit as the decision, so it can't lag behind.
