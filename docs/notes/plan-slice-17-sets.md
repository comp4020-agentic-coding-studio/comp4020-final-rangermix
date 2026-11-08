# Slice 17, part 2: three furniture sets, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> (this repo builds natively, AGENTS.md "How the work is built"). Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** a demo account lays out one of three furniture sets (Opening
day, Lap time, Play room) from `content/layouts/` at once, for everyone,
without the rate limit, from a Furniture group on the demo bar.

**Architecture:** each set is a TOML file of movable pieces, loaded with
the rest of `content/` and checked at start against every placement rule
on the room as it is (the bowls stay where the café fills them). A lay-out
is one world action: carried pieces and errands are called off, everyone
stands, every movable piece is replaced by the set's, anyone left on a
blocking piece walks to the nearest free floor, cats on the old pieces
jump off, and every page gets one `laidOut` message with the whole new
furniture list, then the walks. The arrangement is saved like any other.

**Tech Stack:** Rust (axum, ts-rs), TypeScript (Vite, vitest), Playwright.

**Spec:** [docs/slices/17-markers-see-weeks-in-ten-minutes.md](../slices/17-markers-see-weeks-in-ten-minutes.md),
"Three furniture sets (part 2, after slice 16)";
[ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md).
Part 1's plan: [plan-slice-17-demo.md](plan-slice-17-demo.md).

Written 2026-11-09 from the code at `600e41a` (main), on the branch
`slice-17-sets`.

## Decisions made here (the agent's, inside the approved spec)

1. **One message for the whole room, `laidOut { by, name, furniture }`**,
   not a `furniturePlaced` and `furnitureRemoved` per piece: one redraw,
   one screen-reader line, and no page ever sees half a set.
2. **The sets' names come from the files**, sent in every welcome as
   `layouts: [{ id, name }]`, so a fourth set is a data file, as a new cat
   is. The bar builds its buttons from them.
3. **Opening day is a file too**, held equal to `room.toml`'s movable
   pieces by `cargo test`, so the two can't drift apart.
4. **Every set is checked as a whole**, not piece by piece, so the order
   of a file's pieces never matters: on the floor, off the walkway, no
   overlap but on a rug, no floor cut off, every nap and hide spot
   pettable, no more than `furniture_max`, every kind known and movable.
   A set that fails stops the server at start, naming the file, as a bad
   cat does.
5. **The log line is an `action` line, `what = "lay_out"`**, with
   `set` named, as every other furniture change is an `action` line (the
   spec's "one `furniture` log line" means a line about furniture; CI's
   log check needs `who` and `uid` on action lines).
6. **A demo account at the window is refused** (`notFromWindow`): from
   the window you can only talk (AGENTS.md).
7. **People keep their walks' ends where they stand**: a walk under way
   ends at the tile it's on, as a jump does, since its path was planned
   round furniture that's gone. Errands (grab, place, sit, tidy) are
   called off; handling a cat is called off too, so nobody arrives at a
   cat by a path through a new sofa.
8. **Everyone sees a notice.** The page shows a toast and says it to a
   screen reader: "demo1 laid out Lap time." (to the demo account: "You
   laid out Lap time.").

## Global Constraints

- The sets: `content/layouts/opening_day.toml`, `lap_time.toml`,
  `play_room.toml`; ids are the file stems; each has a `name` and an
  `order` (the bar's order) and `[[furniture]]` like `room.toml`.
- No rate limit, no furniture allowance spent.
- Never log what anyone says. The new line carries who and which set.
- Generated TypeScript is regenerated, never edited:
  `cargo test -p cafe export_bindings`.
- The door's walkway is never blocked: held at start for every set, and
  by `check_layout` sharing `check_place`'s rules.

## Review Focus

1. **Someone mid-errand when a set lands** (walking to grab, carrying,
   sitting, walking to sit or to a cat). Expect: nothing carried, no
   errand left pointing at a piece that's gone, nobody standing on a
   blocking piece. Pinned in task 2.
2. **Cats on, or heading for, the old pieces.** Expect: a cat lying on
   a movable piece jumps off; a plan naming an old piece id finds it gone
   and idles, as when a person carries a piece off.
3. **The saved arrangement after a lay-out** matches the set exactly,
   and a restart wakes in it.
4. **A page that misses nothing:** `laidOut` replaces the furniture and
   clears what the page thought was carried; the following walks move
   anyone who had to step off.

## Tasks

### Task 1: the sets as content, checked at start

**Files:** `content/layouts/*.toml` (new), `server/src/room.rs`,
`server/src/content.rs`, `server/src/world/mod.rs` (Content destructure).

- [ ] Tests first (`content.rs`, `room.rs`):
  `the_three_sets_load_in_order` (ids, names, order);
  `opening_day_is_room_toml_as_it_lays_out`;
  `every_set_passes_every_placement_rule` (each repo set through
  `check_layout`, and its tiles: none on the walkway);
  `a_set_breaking_a_rule_stops_the_cafe_naming_its_file`, one case per
  rule: on the walkway, overlapping, cutting the floor off, a cat bed
  boxed in, past `furniture_max`, an unknown kind, the bowls (not
  movable).
- [ ] `Layout { id, name, order, pieces: Vec<Saved> }`;
  `Room::check_layout(&self, &[Saved], cap) -> Result<(), String>`;
  `content::load` reads `layouts/` in `order`.

### Task 2: laying one out, in the world

**Files:** `server/src/protocol.rs`, `server/src/world/layout.rs` (new),
`server/src/world/layout_tests.rs` (new), `server/src/world/mod.rs`,
`server/src/world/furniture.rs`, `server/src/world/people.rs` (welcome),
`client/src/protocol/` (regenerated).

- [ ] Tests first (`world::layout_tests`):
  `only_a_demo_account_inside_lays_out_a_set` (`notDemo`,
  `notFromWindow`, an unknown set `cantPlace`);
  `a_set_is_laid_out_at_once_for_everyone` (one `laidOut` to all, its
  furniture the set's pieces and the bowls; the room the same);
  `it_spends_no_ones_furniture_allowance` (more lay-outs in a row than
  the burst, each laid out; a place after still has its full burst);
  `whats_carried_goes_and_errands_are_called_off` (a carried piece, a
  grab on the way, a sit on the way: nothing held or reserved after,
  no pending errand);
  `nobody_is_left_seated_or_on_a_blocking_piece`;
  `cats_on_the_old_pieces_jump_off`;
  `knocked_over_pieces_stand_and_the_cats_notice_the_new_ones`;
  `the_set_is_saved_as_the_arrangement`;
  `the_welcome_names_the_sets`; a log test: one `lay_out` line naming
  who and the set, and a refusal's line with its code.
- [ ] `ClientMsg::LayOut { set }`, `ServerMsg::LaidOut { by, name,
  furniture }`, `LayoutName { id, name }` and `Welcome.layouts`.
- [ ] `World::lay_out`.

### Task 3: the page

**Files:** `client/src/state.ts`, `client/src/cafe.ts`,
`client/src/demoBar.ts`, `client/src/main.ts`, `client/index.html`,
`client/src/style.css`, `client/test/state.test.ts`,
`client/test/demoBar.test.ts`, the test welcomes that list fields.

- [ ] Tests first: `laidOut` replaces the furniture, empties what's
  carried, and gives a notice (another's name, or "You"); the bar builds
  one button per set in the welcome's order, each sending `layOut`, and
  disables them while the café wakes.
- [ ] A `notice` effect (announce + toast); the Furniture toggle and
  group between Time and Bots.

### Task 4: the checks against the running café, and the log tools

**Files:** `spec/demo.test.ts`, `spec/browser.test.ts`,
`scripts/narrate.ts`, `spec/narrate.test.ts`.

- [ ] `spec/demo.test.ts`: a visitor's `layOut` refused `notDemo`; demo1
  lays out Lap time and a second client sees it within a second, then
  Opening day puts it back.
- [ ] `spec/browser.test.ts`: on a phone by touch, Furniture opens, Play
  room lays out (the notice is heard), Escape closes; at 1920×1080 by
  keyboard, Opening day.
- [ ] `narrate.ts`: "demo1 laid out Lap time".

### Task 5: the docs

- [ ] `README.md` "For markers": Lap time in the afternoon step, Play
  room in the together step (the user's file; this section is the agent's
  draft at their asking, per the spec).
- [ ] `docs/design.md`, the spec's status, `docs/notes/plan.md`, and
  notes in `docs/notes/slice-17-demo.md`.

### Task 6: review, merge, deploy, check live

- [ ] A fresh reviewer reads it cold: brief and findings in
  `docs/notes/reviews/slice-17-sets-brief.md` and `-findings.md`; every
  finding fixed test first or answered.
- [ ] Pushed to `main` (CI deploys); on the live café as `demo1`, each
  set laid out and seen from a second page, then Opening day; recorded
  in the notes.

## Execution log

Where the build departed from this plan.

- **Task 1:** Lap time's cat bed moved from (1, 6) to (2, 5) on the first
  run, so it stands beside the rug as `each_set_holds_what_it_says` wants.
- **Task 3, after the screens:** the bar's third group wrapped it to three
  rows on a desktop with a stray rule, and pushed Bots to a second line on
  a phone. Fixed in `d5e74d8` with CSS `order` on a desktop, which the
  review then found put Tab out of reading order (finding 7): the times
  are now last in the page instead.
- **Decision 6 held, decision 7 extended:** the review (finding 1) found
  that ending walks and standing people up in the server alone left every
  page showing them walking or seated. They're now each told by a walk of
  no steps.
- **A new number, `layout_every_secs = 10`** (finding 2): the decision
  "without the rate limit" stays true of the furniture allowance, but the
  café lays out at most one set every ten seconds, since the demo password
  is public and a set stops everyone's walks.
- **`Room::lay_out` instead of `restore`** (findings 3 and 4): unchanged
  pieces keep their ids, and the set lands whole.
- **Review:** 2 major, 5 minor, 3 nits, all fixed:
  [findings](reviews/slice-17-sets-findings.md).
- **Task 6, the deploy:** the merge's CI run (`2714714`) failed twice on
  older checks, slice 16's phone-pan edges and then slice 14's panels
  after a reload, so it was the next run on `main` (`0085c3c`) that
  deployed. The live check then went as planned
  ([notes](slice-17-demo.md)). The live record's push failed the edge check
  again: Burakku's coat at the phone screen's edge, which a colour
  list took for the dark page. Fixed in the check (`dd76464`,
  [edge-check-flake.md](edge-check-flake.md)), not in the café.
