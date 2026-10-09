# Crit 8: the bare-minimum cut, and what it simplified

On 2026-10-07 the user asked for the bare minimum crit 8 needs, simplified
where that helps, with every simplification written down here so it can be
picked up later. This file is that list. Phase 1's plan is
[`plan-phase-1.md`](plan-phase-1.md); its "Execution log" says how each task
went.

## What crit 8 asks for

From the [C8 page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/),
read on 2026-10-07:

| Requirement | Who | State |
|---|---|---|
| Deployed at its `*.fly.dev` URL by the cutoff | agent, with the user's Fly token | Done: live since 2026-10-07 (see "Deployed and shipped") |
| A visitor can do the core thing, and their trace is still there when they come back | agent | Done locally: sign up, walk, pet, talk; trust survives a restart of the built image |
| `README.md` saying what success means, with sources, published at `/readme/` | user's words; the server publishes it | `/readme/` serves it; the words are the user's |
| `PROCESS.md` with the technology choices (ADRs can be linked) | user's words | the user's |
| `reflections/crit-8.md` | user's words | the user's |
| Repo public at the cutoff; `/ship` tags | user (`/ship`) | Public since about 10:16 AEDT on 2026-10-07; tag `crit-8` on `659952a` |
| Commit history showing incremental work | both | yes |

## Done for the MVP

- Tasks 1 to 12 (the server, the protocol, accounts, trust, the cats, the
  world, the WebSocket, the client's way in), from the previous session.
- Task 13: the café drawn at a whole-number scale, walks, the window line,
  the light by the Canberra hour.
- Task 14: point then act by mouse, touch and keyboard; the cat menu (pet,
  call); talking, to the room or to one person; bubbles; the panels.
- A fix: a tab reloads at most once per server build, so a client and server
  from different builds can't loop.
- Task 15: the three-stage image, the Rust CI job, `pnpm dev`; rustfmt and
  clippy clean; `pnpm check` passes against the image.

## Simplified or skipped, to come back to

Each one is something the plan asked for and the MVP didn't do, or did more
cheaply. None of them breaks a rule in `AGENTS.md`'s "What the app must keep"
that a check already holds, but several are only held by review until done.

1. **No two-window check by hand (Task 14 Step 5).** Bubbles, walks and the
   status line were watched in one browser, with a second visitor scripted
   over a raw WebSocket, not in a second browser. The spec's `realtime` test
   covers a bubble reaching another socket; nobody has watched two pages side
   by side.
2. **The phone size is only checked for drawing.** At 390×844 the room was
   seen at 2× with no sideways scroll (Task 13), but the cat menu as a sheet
   from the bottom, the panels under the room and the keyboard pass weren't
   tried at that size.
3. **No art pass (Task 15 Step 7).** Nobody checked that each sprite reads as
   what it is, and no screenshots were saved to `docs/notes/screens/`.
4. **The restart check was a script, not a browser (Task 15 Step 8).** A
   script petted Tora, restarted the container on a volume and came back to
   the same trust and session. Not checked: that an open page shows
   "Reconnecting" and carries on by itself, and that the cats come back
   where they were.
5. **A version mismatch is handled by staying quiet.** If a reload still
   brings back a client from a different build, the tab carries on with
   the old client and says nothing. If the protocol changed between those
   builds, that tab may misbehave. Better: tell the person "The café was
   updated; refresh to get the new version." A tab without `sessionStorage`
   never reloads after a deploy at all.
6. **One look oddity wasn't chased.** Right after the first sign-up, one
   frame drew the avatar in a different look from the one the server held. A
   second sign-up, sampled pixel by pixel, and a reload were both right. Not
   reproduced, not explained.
7. **Petting from across the room is unexamined.** A script sent a pet to
   each of the three cats from where it stood; only Tora's was logged (a
   sniff). Whether the other two were refused as out of reach, ignored or
   rate-limited, and what the person is told, hasn't been looked at.
8. **Bubbles aren't placed with care.** A bubble near the top wall can cover
   the cat next to the speaker; no clamping or nudging yet.
9. **Two pieces kept for later are switched off, not built.**
   `FurnitureKind.perch` (phase 3) and `store::get_world` (phase 4) carry
   `#[allow(dead_code)]` so clippy's `-D warnings` passes.
10. **rustfmt runs at width 140, not the default 100**, to keep the diff of
    the first formatting pass small (`rustfmt.toml`).
11. **No pre-flight scan of the plan.** The subagent run for it was cut off
    when the previous session's budget ran out, and wasn't re-run.
12. **No README material (Task 17).** No sources gathered, and no "enforced
    and judged" list written for the user to draw on. The README still
    promises soothing music, which the design doesn't have.
13. **No whole-phase review (Task 18).** No fresh reviewer has read phase 1
    against the spec.
14. **CI hasn't run.** The repo is private, so the new Rust job and the
    image build in CI are untested there; the same commands passed locally.
15. **`placeholder/`, the starter's page, is still in the repo**, unused
    since the new `Dockerfile`.

## Added after the cut: one cushion that moves

The user asked for "one furniture you can move around" (2026-10-07). It is
the first piece of design.md's rearranging (phase 2 in
[plan.md](plan.md)), cut down the same way. What's built: a floor cushion
(people walk over it, cats nap on it); choose it by click, tap or Tab and
Enter, pick "Move the cushion", then pick a spot. The server refuses
anything off the floor, over another piece, or on the door's walkway. It
tells everyone who moved it, saves the arrangement so it survives a restart,
and allows 3 moves at once, then 1 every 20 seconds.
`spec/furniture.test.ts` checks the real-time move, the walkway and the
limit; Rust tests check the placement rules and the restore.

What it simplifies, against design.md:

16. **Only the cushion moves.** The design says everything but the walls,
    window, door, chalkboard and bowls moves. A piece that blocks can't be
    marked movable yet (the content check refuses it), because moving one
    needs two more checks: that it cuts nobody off from the door, and that
    nobody is standing where it lands.
17. **No catalogue.** Nothing can be added or removed, so the floor limit (30
    movable pieces) isn't needed yet.
18. **No carrying.** The cushion goes straight to the chosen spot, from
    anywhere in the room. Nobody walks over to pick it up, nobody sees it
    carried, there's no "first grab wins", and nothing drops back on a
    disconnect.
19. **Cats don't notice.** A cat napping on the cushion when it moves stays
    where it was, asleep on the bare floor, instead of jumping off annoyed;
    no cat comes to investigate where it went.
20. **Nothing overlaps.** The cushion can't go on the rug, though a cushion
    on a rug would be natural.
21. **A cat on the cushion hides it from a click.** Clicking that tile opens
    the cat's menu (cats come first); Tab still reaches the cushion.
22. **No preview while placing.** The pointer box starts on the cushion and
    the cursor turns to a crosshair, with a short note; there's no ghost of
    the cushion under the pointer.
23. **Saved by piece number.** The arrangement is saved as JSON in the
    `world` table under each piece's number and kind. If `room.toml` changes
    the order of its pieces, a saved position whose kind no longer matches
    is dropped, and the piece starts where `room.toml` puts it.
24. **Phone checked with a mouse, not a touch.** At 390×844 the menu came up
    as a sheet and the move went through, but under a mouse in a narrow
    window, not a touch-emulating device.

## Where each one went

On 2026-10-09 the user asked for these to go into the plan. Items 16 to 24
are the cushion's, so they go to phase 2, whose rearranging replaces the
cushion's cut-down move; the rest close phase 1, mostly through a new Task 19
in [plan-phase-1.md](plan-phase-1.md).

| Item | Goes to | Outcome |
|---|---|---|
| 1. No two-window check | phase 1, Task 19 Step 6 | Done 2026-10-09: two contexts, two accounts; a walk reached the other in 7 ms, a bubble in 19 ms, a cushion move in 1 ms (announced), a pet's sniff as it happened |
| 2. Phone checked only for drawing | phase 1, Task 19 Step 6 | Done: at 390×844 with touch, no sideways scroll, room at 2×, panels below, the cat menu a full-width sheet, pet and cushion move by tap; a keyboard-only pass with a resize to 1920×1080 and back (384, 960, 384 px) reached every action and Leave |
| 3. No art pass | phase 1, Task 19 Step 7 (a first look); phase 5 (the pass) | First look: every piece, coat and avatar reads; the window seat reads as a shelf and the cushion as a blue box, both for phase 5. Screens in `screens/` |
| 4. Restart checked by script | phase 1, Task 19 Step 6 | Done: an open page showed "Reconnecting", came back without a reload, cats on the same tiles |
| 5. A stale tab says nothing | phase 1, Task 19 Step 2 | Fixed: a refresh notice (`dfb30b9`) |
| 6. The wrong look, once | phase 1, Task 19 Step 5 | Found and fixed: everyone walked in to the same tile, so the person standing there hid the newcomer; newcomers now go to a free tile (`8cbdedf`) |
| 7. Far pets unexamined | phase 1, Task 19 Step 3 | Explained: a second pet on the way replaces the first; pinned by tests (`2756005`); every far pet that fails says why |
| 8. Bubbles placed without care | phase 1, Task 19 Step 4 | Fixed: kept inside the room, under the speaker at the top (`4fc73eb`) |
| 9. Two pieces switched off | phase 1, Task 19 Step 8; `perch` in phase 3 | `get_world` is in use since the cushion; only `perch` waits, for phase 3 |
| 10. rustfmt at width 140 | phase 1, Task 19 Step 8 | Kept: rewrapping every file gains no reader anything |
| 11. No pre-flight scan | phase 1, Task 19 Step 8 | Replaced by Task 18's review of the built phase |
| 12. No README material | phase 1, Task 17 | Done: `readme-material.md` (`343d8be`) |
| 13. No whole-phase review | phase 1, Task 18 | |
| 14. CI hadn't run | phase 1, Task 19 Step 8 | Ran at the flip on 2026-10-07 and on every push since |
| 15. `placeholder/` still there | phase 1, Task 19 Step 1 | Removed (`a41b6a2`) |
| 16. Only the cushion moves | phase 2, rearranging | |
| 17. No catalogue | phase 2, rearranging | |
| 18. No carrying | phase 2, rearranging | |
| 19. Cats don't notice | phase 2, rearranging | |
| 20. Nothing overlaps | phase 2, rearranging | |
| 21. A cat hides the cushion from a click | phase 2, rearranging | |
| 22. No preview while placing | phase 2, rearranging | |
| 23. Saved by piece number | phase 2, rearranging | |
| 24. Phone checked with a mouse | phase 2, the browser checks | |
| The core interaction untried live | the user's own visit (no test accounts on the real café); CI runs the whole spec against the same image before each deploy | |

## Deployed and shipped

The deploy was blocked on the Fly token until the user added it. On
2026-10-07 commit `ed466d4` was deployed by hand; then the user ran `/ship`,
the repo went public, and CI (checks, the Rust job, deploy) deployed
`659952a`, which is tagged `crit-8`. Checked live: the page and its assets
load, and `spec/invariants.test.ts` and `spec/login-page.test.ts` pass
against `https://comp4020-final-rangermix.fly.dev`. Not done live: anything
that signs up, so the core interaction there has only been tried locally and
in CI's run against the image.
