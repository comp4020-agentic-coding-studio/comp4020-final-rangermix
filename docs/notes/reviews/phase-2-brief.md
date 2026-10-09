# Brief: review of phase 2, "All at once"

Phase 2, Task 11 ([plan-phase-2.md](../plan-phase-2.md)), by
[ADR 0012](../../adr/0012-plan-in-phases-and-build-each-phase-natively.md).
Work read-only.

## What to read

- **The code of the phase:** commits from `207fa4b` (the quiet seat) to the
  current `HEAD` of `main`, chiefly `server/src/world/quiet.rs`,
  `server/src/world/furniture.rs`, `server/src/room.rs`,
  `server/src/world/people.rs`, `server/src/world/cat_life.rs`
  (`cats_jump_off`, `settle`), `server/src/ws.rs`, `server/src/protocol.rs`,
  and in the client `main.ts`, `state.ts`, `menus.ts`, `placing.ts`,
  `layout.ts`, `menu.ts`, `stage.ts`, `render.ts`, `talk.ts`, `cafe.ts`;
  `spec/furniture.test.ts`, `spec/browser.test.ts`.
- **The spec:** `docs/design.md`, ADRs 0004, 0008 and 0009, and `AGENTS.md`'s
  "What the app must keep", which no change may break.
- **The plan:** `docs/notes/plan-phase-2.md`, its decisions 1 to 11, its "Not
  in this phase" list, and its execution log.

## Out of scope

Anything in "Not in this phase" (phase 3 and 4 work) isn't a finding. A
finding is code that is wrong for what it claims to do, breaks a kept rule,
lets one visitor spoil the café for others (griefing, locking furniture,
starving the seat), loses or corrupts saved state, or lets a client decide
what the server should.

Inputs worth tracing: two people grabbing, placing and sitting at once; a
carrier who disconnects, reconnects, leaves, or is walked out mid-carry; a
piece placed where a cat or a person is walking; a saved arrangement from
phase 1, or one whose content changed; the floor limit with pieces in
hands; the quiet seat with a hidden tab, a dropped connection, and a line
that empties; layout B at 390×844 with a resize.

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it. Written to `docs/notes/reviews/phase-2-findings.md`.
