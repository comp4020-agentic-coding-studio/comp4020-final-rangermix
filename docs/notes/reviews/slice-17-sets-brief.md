# Brief: review of slice 17, part 2, "Three furniture sets"

By [ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive slice-17-sets | tar -x -C <tmpdir>`, then
`pnpm install`, `pnpm -C client install` and `pnpm -C client build`
there), never in this checkout. Don't use ports 8080 or 8181 (other cafés
run on them); run the café on port 18927 with a fresh `DATA_DIR`, from the
copy's root (it reads `content/` from the working directory), with
`CLIENT_DIR` pointing at the copy's `client/dist`. Seed it first, as CI
does: `DATA_DIR=<dir> CAFE_DEMO_PASSWORD=catppuccino <copy>/target/debug/cafe demo seed`,
then point the spec at it with `APP_URL` and `APP_DEMO_PASSWORD=catppuccino`.
Stop only the servers you start, by their own process IDs (never `pkill`
by name). Don't touch the live café or the Fly app.

Review what part 2 of slice 17 adds: `600e41a..slice-17-sets` (the
repo at `/tmp/s17p2wt` has that branch checked out; read it there, or
with `git show`/`git diff` from any clone).

## What to read

- **The spec:** [`docs/slices/17-markers-see-weeks-in-ten-minutes.md`](../../slices/17-markers-see-weeks-in-ten-minutes.md),
  "Three furniture sets (part 2, after slice 16)", "The demo bar", the
  marker's path, and the two part 2 lines of "Done when". Part 1 is
  built, reviewed and live; it's out of scope except where part 2 changes it.
- **Why:** [ADR 0022](../../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md).
- **The rules:** `AGENTS.md`'s "What the app must keep": the door's
  walkway never blocked, the server decides every outcome, only a demo
  account lays out a set, every action by keyboard, touch and mouse at
  390×844 and 1920×1080, generated TypeScript never edited by hand.
- **The plan** [`docs/notes/plan-slice-17-sets.md`](../plan-slice-17-sets.md):
  its "Decisions made here", its Review Focus, and its execution log.
- **The code:** `content/layouts/*.toml`; `server/src/room.rs`
  (`Layout`, `LayoutFile`, `check_layout`), `server/src/content.rs`
  (`load_layouts`), `server/src/world/layout.rs`, the hooks in
  `world/{mod,people,furniture}.rs`, `server/src/protocol.rs`
  (`LayOut`, `LaidOut`, `LayoutName`, `Welcome.layouts`);
  `client/src/state.ts` (`laidOut`, the `notice` effect), `cafe.ts`,
  `demoBar.ts`, `main.ts`, `index.html`, `style.css`;
  `scripts/narrate.ts`. Their tests: `content.rs`'s set tests,
  `world/layout_tests.rs`, `client/test/{state,demoBar}.test.ts`,
  `spec/demo.test.ts`'s last check, the demo bar's checks in
  `spec/browser.test.ts`, `spec/narrate.test.ts`.
- **The screens:** `docs/notes/screens/slice-17-sets/` (and
  `shoot.mjs`, which made them).

## Out of scope

Part 1 (the clock, bots, the seed) except where part 2 touches it. The
README's prose is the user's to judge.

## What to look for

Whether each part 2 "done when" line is truly held, or only appears to
be, and whether the kept rules hold. The plan's Review Focus first:

1. **Someone mid-errand when a set lands**: walking to grab, carrying,
   sitting, walking to sit, walking to a cat to pet or pick up, holding a
   cat, a cat on their lap, dropped within the grace period, at the
   window. Is anything left pointing at a piece that's gone, or at a path
   through a piece that's new? Does anyone end on a blocking piece?
2. **Cats on, heading for, or planning around the old pieces**: a cat
   napping on a moved bed, perched on the window seat, mid-walk to
   investigate or knock over a piece, eating, held, on a lap. Do any of
   them end up somewhere they shouldn't (inside a blocking piece is fine
   for cats; on a person isn't), or keep a plan naming a piece id that's
   gone?
3. **The saved arrangement and a restart.** Does the café wake in the
   set? What about a set laid out during a jump's replay or while the
   café wakes?
4. **The page.** Does `laidOut` leave nothing stale: the furniture, what's
   carried, the carrying bar and its preview, an open menu on a piece
   that's gone, the shadows and the cached floor layer, the catalogue's
   "Add furniture" count?

Then:

- **The sets themselves.** Does each pass every placement rule on the
  room as `room.toml` builds it, and is `check_layout` the same rules
  as `check_place`, or could a set pass one and fail the other? Does each
  read as what the spec says (Lap time round the rug by the cat bed; Play
  room's pieces out in the open)?
- **Abuse.** The demo password is public. What can anyone do with lay-outs
  that's worse than moving furniture by hand: no rate limit on a world
  action that rebuilds the room, broadcasts every piece and writes the
  store. Is it bounded by the connection's own action limit? Is that
  enough, or does it need one of its own?
- **Logs.** One line per lay-out and per refusal, nothing anyone said,
  and CI's log check (`scripts/check-logs.ts`) passing.
- **The bar.** Keyboard, touch and mouse at 390×844 (layouts A and B) and
  1920×1080, a resize across 960 px, Escape, focus order, disabled states,
  its text against what's behind it, and that a visitor who isn't a demo
  account never sees it.
- **The checks themselves.** Would each new test fail if the behaviour it
  names broke? Are the spec's checks order-safe against each other and the
  rest of `spec/` (the room left as Opening day)?

## Findings

Write them to [`slice-17-sets-findings.md`](slice-17-sets-findings.md),
numbered, most serious first, each marked major, minor or nit. For each:
what's wrong, where (file and line), how you saw it (a command, a check,
a screenshot), and what "fixed" would look like. Say plainly what you
checked and found sound, so a line that holds is known to have been
looked at. Leave an empty "Answers" section at the end for the builder.
