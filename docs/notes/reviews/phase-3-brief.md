# Brief: review of phase 3, "Fly by instruments"

Phase 3, Task 10 ([plan-phase-3.md](../plan-phase-3.md)), by
[ADR 0012](../../adr/0012-plan-in-phases-and-build-each-phase-natively.md).
Work read-only.

## What to read

- **The code of the phase:** commits from `a086231` (logging) to the
  current `HEAD`, chiefly `server/src/world/mod.rs` (`log_request`,
  `action_name`, dispatch), `server/src/anger.rs`, `server/src/cats.rs`
  (needs, choices, `handling_outcome`, `hold_ms`),
  `server/src/world/cat_life.rs` (plans, `settle`, `held_tick`,
  `laps_tick`, `nap_spot`), `server/src/world/handling.rs`,
  `server/src/world/treats.rs`, `server/src/world/furniture.rs` (tidy,
  knock over), `server/src/room.rs` (toppled), `server/src/store.rs`
  (migration 2), `server/src/main.rs` (restores), `scripts/narrate.ts`,
  and the client's `state.ts`, `menus.ts`, `render.ts`, `panels.ts`,
  `menu.ts`, `main.ts`; the spec's `cats.test.ts`, `narrate.test.ts`,
  `browser.test.ts`.
- **The spec:** `docs/design.md` ("The cats", "People", "Logging",
  "Numbers to tune"), ADRs 0010 and 0011, and `AGENTS.md`'s "What the app
  must keep" (never store or log what anyone says; trust never fades with
  absence; the server decides).
- **The plan:** `docs/notes/plan-phase-3.md`, decisions 1 to 9, "Not in
  this phase", and the execution log.

## Out of scope

Phase 4's (fast-forward, traces, chalkboard, mute, blocklist, admin ban)
and phase 5's (art) aren't findings.

Inputs worth tracing: an action that is refused, or walks over first, or is
stopped by the rate limit, and whether exactly one line tells it; a dozen
visitors at once and whether the narrated log reads as their story; a cat
held when its holder leaves, drops, is walked out, sits, or reaches the
door; two people offering, picking up or passing the same cat; a ban
across a restart, and its time left; treats across a Canberra midnight and
a restart; the bowls' refill across a restart and before 7:00; a cat
heading for a treat someone else's cat eats first; a lap whose person
stands; a knocked-over piece that's carried, saved, restored or tidied;
anything that lets trust fade with absence or puts what was said in a log.

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it. Written to `docs/notes/reviews/phase-3-findings.md`.
