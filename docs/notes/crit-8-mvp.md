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
| Deployed at its `*.fly.dev` URL by the cutoff | agent, with the user's Fly token | **Blocked**: no Fly token on this machine (see "Blocked" below) |
| A visitor can do the core thing, and their trace is still there when they come back | agent | Done locally: sign up, walk, pet, talk; trust survives a restart of the built image |
| `README.md` saying what success means, with sources, published at `/readme/` | user's words; the server publishes it | `/readme/` serves it; the words are the user's |
| `PROCESS.md` with the technology choices (ADRs can be linked) | user's words | the user's |
| `reflections/crit-8.md` | user's words | the user's |
| Repo public at the cutoff; `/ship` tags | user (`/ship`) | private as of 2026-10-07 09:50 AEDT |
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

## Blocked

**The deploy (Task 16).** `flyctl auth whoami` says there's no access token,
and there's no `mise.local.toml` holding `FLY_API_TOKEN`. By the plan, the
user adds the course's token (agents don't enter it), in `mise.local.toml` at
the repo root:

```toml
[env]
FLY_API_TOKEN = "..."
```

Then: `mise exec flyctl@0.4.106 -- flyctl deploy --remote-only --ha=false -a comp4020-final-rangermix`.
That `flyctl` isn't pinned for this directory, hence `mise exec`.

As of 2026-10-07 09:50 AEDT, `https://comp4020-final-rangermix.fly.dev/`
accepts a connection but sends nothing back within 20 seconds.
