# Brief: review of phase 1, "It's alive"

Phase 1, Task 18 ([plan-phase-1.md](../plan-phase-1.md)), by
[ADR 0012](../../adr/0012-plan-in-phases-and-build-each-phase-natively.md):
a fresh reviewer reads the whole phase against the spec. Work read-only.

## What to read

- **The code of the phase:** commits `b6d6949` (the server's start) to the
  current `HEAD` of `main`: `server/`, `client/src/`, `content/`, `spec/`,
  `scripts/`, `Dockerfile`, `.github/workflows/checks.yml`. Never
  `client/src/protocol/`'s content as a thing to change: it is generated.
- **The spec:** `docs/design.md`, the ADRs in `docs/adr/`, and `AGENTS.md`'s
  "What the app must keep", which no change may break.
- **The plan:** `docs/notes/plan-phase-1.md`: its Global Constraints, its
  Review Focus (five inputs most likely to break the café), its "Not in this
  phase" list, and its execution log. `docs/notes/crit-8-mvp.md` lists what
  was deliberately cut.

## Out of scope

Anything in "Not in this phase" or cut on purpose in `crit-8-mvp.md` isn't a
finding: its absence is planned. A finding is code that is wrong for what it
claims to do, breaks a rule in "What the app must keep", fails a Review Focus
input, or lets a client decide something the server should.

## The answer's form

Each finding, most severe first:

- severity: critical (breaks a kept rule, loses data, or lets one visitor
  spoil the café for others), major (wrong behaviour a visitor will meet),
  minor (wrong only at the edges);
- `file:line`;
- the failure scenario: an input, then the wrong behaviour;
- whether a test would catch it, and which.

Write them to `docs/notes/reviews/phase-1-findings.md`.
