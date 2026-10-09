# Phase 2, "All at once": Implementation Plan

> Method fixed by [ADR 0012](../adr/0012-plan-in-phases-and-build-each-phase-natively.md):
> built natively in one session, test first, committed and pushed per task
> (a push to `main` deploys through CI), with a whole-phase review at the end.

**Goal:** the café behaves well with several people at once, for crit 9
(Wed 14 Oct): a forgotten tab frees its seat only for someone waiting (ADR
0009, crit 9's recorded decision); anyone inside can rearrange the café, with
the first grab winning; people sit and share the sofa; emotes; the second
phone layout; and browser checks that hold the keyboard path at both marking
sizes. Rearranging also closes crit 8's items 16 to 24
([crit-8-mvp.md](crit-8-mvp.md)).

**Spec:** [`docs/design.md`](../design.md), ADRs 0004, 0008, 0009, and
`AGENTS.md`'s "What the app must keep". Roadmap: [plan.md](plan.md).
Written 2026-10-09 with what phase 1 taught: the world's `handle`/`tick`
split keeps every rule testable with a clock, so each server task below
starts with Rust tests and ends with a `spec/` check where a black box can
see it.

## Global constraints

Phase 1's still hold (one 256 MB machine, `/` and `/readme/`, `pnpm check`
against the running image, both marking sizes, every kept rule). Added:

- Every new number lives in `content/tuning.toml` and design.md's "Numbers
  to tune", changed together.
- The protocol changes in Rust only; `client/src/protocol/` is regenerated
  and `scripts/check-protocol.sh` passes.
- The live café stays usable at every push: a task that changes the protocol
  ships client and server in one commit.

## Not in this phase

Phase 3's: treats and bowls, giving treats, passing and carrying cats, laps,
cats investigating new furniture or noticing each other, anger, bans and
grudges, the narrating log tail. Phase 4's: fast-forward, traces, the
chalkboard, mute, the blocklist, the admin ban.

## Decisions made in this plan

Small enough not to need an ADR; each is recorded in design.md when built.

1. **Quiet signals.** The client sends `presence { hidden }` when its tab is
   hidden or shown, and `here {}` at most every 30 seconds while someone
   touches the page. Any message from a person counts as input. "Gone
   quiet" is hidden for 2 minutes or no input for 10 (ADR 0009's numbers).
2. **Walking out.** An unanswered nudge starts a walk to the door; the seat
   frees at once (the first in line walks in), and the person leaves when
   the walk ends. Their page says why and offers to come back, which joins
   the line.
3. **Carrying.** `grab` walks you beside a piece and picks it up; `take`
   puts a new piece from the catalogue in your hands; `place` walks you
   beside the spot and puts it down; `putBack` returns what you hold
   (a new piece just goes); `putAway` removes it from the café. A held
   piece leaves the floor and is drawn over its holder for everyone. The
   world handles messages one at a time, so the first grab wins and the
   second is told who has it. A disconnect that runs out its grace period,
   or Leave, puts the piece back.
4. **What moves.** Everything but the bowls (and the walls, window, door
   and chalkboard, which aren't furniture). A rug (`under`) can have other
   pieces on it; nothing else overlaps. A rug with something on it doesn't
   move.
5. **Placement rules**, all on the server: on the floor; never on the door's
   walkway; no overlap but onto a rug; a piece that blocks may not cover
   anyone standing or heading there, may not cut any floor tile off from the
   entry, and may not leave a cat's nap or hide spot unreachable; at most 30
   movable pieces on the floor and in hands.
6. **Saving the arrangement** as the whole list of movable pieces by kind and
   place, not by their order in `room.toml` (crit 8's item 23); a saved piece
   that no longer fits is dropped, and `room.toml` seeds only a fresh café.
7. **Rate limits.** `take`, `place` and `putAway` spend the furniture bucket
   (3, then 1 every 20 s); `grab` and `putBack` are ordinary actions.
8. **Sitting.** Sofa, chairs, window seat and cushion have seats, one person
   each; `sit { id }` walks you beside the piece and seats you on a free
   seat tile; any walk stands you up. A piece someone sits on can't be
   grabbed.
9. **Emotes:** wave, laugh, heart, yawn; public; spend the speech bucket;
   refused from the window, which can only talk; logged as `emote`, kind
   only.
10. **Phone layout B** is chosen by a button and remembered in
    `localStorage`; the room fills the screen at 3× and pans to keep you
    centred; actions open as a ring of buttons around what you tapped.
11. **Browser checks** use Playwright's library inside the existing Vitest
    spec, driving Chromium against the running app; CI installs Chromium
    before `pnpm check`.

## Tasks

1. **The quiet seat (server).** Tuning `quiet_hidden_secs = 120`,
   `quiet_idle_secs = 600`, `nudge_answer_secs = 60`. Tests first in
   `world/people.rs` with a controllable clock: no nudge with nobody waiting
   however long someone is idle; a nudge to the quiet person alone once
   someone waits; an answer (any message) cancels it; no answer walks them
   out, frees the seat, brings the first in line in, and they leave when the
   walk ends; the line emptying cancels a pending nudge; a hidden tab counts
   after 2 minutes. Protocol: `ClientMsg::{Presence, Here}`,
   `ServerMsg::{StillThere, NudgeOver}`.
2. **The quiet seat (client).** `presence` on `visibilitychange`, throttled
   `here` on input; a "Still there?" dialog with "I'm here" focused and
   announced; on being walked out, the left-café page says why. Client tests
   for the throttle and the state.
3. **Emotes.** Server tests (reaches everyone, window refused, limited,
   logged without text); protocol `ClientMsg::Emote`, `ServerMsg::Emoted`;
   three new emote sprites; an emote row by the talk box, keyboard
   reachable; drawn over the avatar for 2.5 s and announced. Spec: an emote
   reaches another visitor within a second.
4. **Furniture content and rules.** `furniture.toml` gains `under`, `seats`,
   `catalogue`; every kind but bowls movable; scratching post and lamp
   kinds and sprites; tuning `furniture_max = 30`. `room.rs` tests first for
   every rule in decision 5, then the general `Room::check_place`.
5. **Carrying (server).** `world/furniture.rs` rewritten around decision 3,
   tests first: first grab wins, held piece leaves the floor, put down by
   walking, refused spots keep it in hand, put back on disconnect and
   Leave, catalogue take and put away with the floor limit, a cat lying on
   a grabbed piece jumps off annoyed (`Reaction::Annoyed`), a cat heading
   for a moved spot settles idle instead. Arrangement saved per decision 6.
   `MoveFurniture`/`FurnitureMoved` go; the spec's furniture checks move to
   the new messages, plus "first grab wins" across two visitors.
6. **Sitting (server).** Tests first: sit walks then seats, one per seat,
   two can share the sofa, a walk stands you up, grabbing an occupied piece
   is refused. `PersonView.sitting`, `ServerMsg::PersonSat`.
7. **The client for furniture and sitting.** Every target on a tile in one
   menu, cat first (item 21); furniture menu: Move, Sit, Put away; a
   catalogue panel to add a piece; the held piece drawn over its holder; a
   preview while placing that follows the pointer, tinted by a client-side
   guess at the rules (item 22); Escape puts it back. Client tests for the
   menu building, the preview's guess and the state.
8. **Phone layout B.** Pure functions tested first: the pan offset that
   keeps you centred and clamps at the room's edges, and ring positions
   that stay on screen. Then the switch button, the floating controls, the
   ring menu and the remembered choice.
9. **Browser checks.** `playwright` as a dev dependency; `spec/browser.test.ts`
   signs up two visitors in two contexts and checks: the keyboard-only pass
   at 390×844 and 1920×1080 with a resize mid-use; a tap on a cat opening
   the sheet with touch emulated (item 24); the layout switch and that it
   is remembered; a placement seen by the other visitor. CI installs
   Chromium before `pnpm check`.
10. **design.md and the ADRs.** Record decisions 1 to 11 where they belong,
    link the commits from ADR 0009, and update "Numbers to tune" and
    "Checks".
11. **Whole-phase review.** As phase 1's Task 18: a brief in
    `docs/notes/reviews/phase-2-brief.md`, independent reviewers with
    skeptics, findings in `phase-2-findings.md`, fixed test first or
    answered; everything green; deployed and checked.

## Execution log

Where carrying out this plan departed from it, task by task, and why.

- **Task 1 and 2 (2026-10-09).** Built as planned in one commit, since the
  protocol changed on both sides. The quiet seat lives in its own module,
  `world/quiet.rs`; a person walking out is ignored until they've gone,
  and doesn't count toward the six, so the first in line comes in at once.
- **Before Task 3: phase 1's review.** Its findings were answered between
  Tasks 2 and 3 (see `reviews/phase-1-findings.md`); four of them (8, 13,
  14, 15) were folded into Task 5.
- **Task 3.** As planned. Emote kinds are logged in lower case to match the
  wire.
- **Tasks 4 to 7.** Built together in one commit, because removing the
  cushion's `moveFurniture` changed the protocol for client and server at
  once. Two changes from the plan: the furniture limit moved from the
  connection into the world, per person, so a reconnect doesn't refill it
  and only an accepted change spends a token (it also answers review
  findings 5 and 6 for furniture); and a grab reserves the piece the moment
  the server accepts it, so "first grab wins" means the first request, not
  the first to arrive. The "cut off" rule caught two of the plan's own test
  spots (the sofa at (1, 8) would have shut in (0, 8) and (0, 9)), and the
  tests moved to spots that don't. Cats coming to look at moved furniture
  stays phase 3's ("investigating"), as the roadmap had it.
- **Task 8.** In a browser the first version showed three faults: the room
  at 3x is shorter than a 844-pixel phone and sat at the top, the ring's
  top button hid under the floating status bar, and the menu's note showed
  behind it. The room is now centred when smaller than the screen, the ring
  stays between the bars, and the note is for screen readers only.
- **Task 9.** Playwright 1.63.0, the newest release older than two weeks.
  The first full run failed six checks, none of them faults in the café:
  spec files ran in parallel against one café that seats six, so visitors
  landed at the window. Files now run one at a time, and each browser check
  walks its visitors out. The same crowding had already failed CI on
  `77dbe99` and `d3ef876` (the cap check found a seventh visitor inside,
  where another file's visitor had just left); those two never deployed,
  and `e42f2a4` passed the Rust job, the checks and the deploy.
- **Task 10.** design.md records decisions 1 to 11; ADRs 0004 and 0009 link
  their commits.
