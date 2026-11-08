# Findings: review of slice 17, part 2, "Three furniture sets"

Reviewer: a fresh agent that didn't build the slice, reading
`600e41a..slice-17-sets` (head `8126092`) cold, per
[the brief](slice-17-sets-brief.md). Everything was built and run in a
throwaway copy (`git archive slice-17-sets | tar -x -C /tmp/s17rev`), with
the café on port 18927, a fresh `DATA_DIR`, seeded with `cafe demo seed`.
Probe tests were added only to that copy, and nothing in this checkout
changed but this file.

Two major, five minor, three nits.

## Findings

### 1. Major: a lay-out stands people up and ends their walks without telling any page

**What's wrong.** `settle_for_layout` (`server/src/world/layout.rs:70-84`)
sets `p.sitting = None` and swaps a walk under way for the tile it has
reached (`p.walk.take()`, line 80), all in the server's own state, and
sends nothing about it. The only person messages after a lay-out come from
`step_off_new_pieces`, and only for someone left under a blocking piece. So:

- someone **seated** on a piece that's gone, or still there, is drawn
  seated on every page (`PersonView.sitting` stays `true` in every
  client's copy) until they next move. If the sofa is gone, they sit on
  bare floor;
- someone **mid-walk** keeps walking on every page, along a path planned
  through the old room, to a destination the server has dropped. It can
  end inside a new blocking piece, which is the "nobody is left on a
  blocking piece" line of "Done when": it holds on the server and fails
  on every screen;
- the same goes for bots, which are walking most of the time.

A jump gets away with the same settling because it sends everyone a fresh
welcome afterwards (`jump.rs:93`, `welcomes`). A lay-out sends only
`laidOut`, which carries furniture and no people.

**How I saw it.**
- Unit probe (in the copy's `layout_tests.rs`): person 1 seated on the sofa
  at (0, 5), person 3 walking from (12, 11) towards (1, 11), then demo2 lays
  out Lap time 400 ms later. The `Out`s carry **no** `personMoved`,
  `personSat` or `personPlaced` at all (`people messages: []`), while the
  server now has 1 standing (`sitting=None`) and 3 stopped at (12, 10).
- Against the running café (`spec/zz-review-probe.test.ts` in the copy): a
  visitor walks to (4, 8); 400 ms in, demo1 lays out Lap time. The visitor's
  own page gets no person message for them. The last path it holds ends at
  (4, 8), **under Lap time's lower sofa**. A page opened afterwards has
  them standing at (7, 2) with no walk. Every page open at the time shows
  the visitor walking into the new sofa and standing in it.
- `nobody_is_left_seated_or_on_a_blocking_piece` checks only the server's
  `Person` fields, so it can't see this. Removing `p.sitting = None` does
  fail it (mutation M4 below), but nothing checks what the pages are told.

**Fixed would look like:** every person whose walk was cut or who was
seated gets a `personMoved` (a walk of no steps from where they are, as
`stand_up` already does in `furniture.rs:62`), sent after `laidOut`
(or else `laidOut` carries every person's place). Add a test that, for a
seated person, a walking person and a bot, each gets a message that leaves
every page's copy matching the server: not sitting, no walk past the cut
tile. A `spec/` check like the probe above would hold it end to end.

### 2. Major: a public password can freeze the café ten times a second

**What's wrong.** A lay-out has no limit of its own. It's bounded only by
the connection's general action bucket (`ws.rs:296`, `action_burst = 10`,
`action_per_sec = 10`). Each lay-out:

- ends **every** walk in the café and calls off **every** errand (grab, sit,
  place, tidy, pet, pick up, treat), not just the demo account's own;
- makes every cat on any movable piece jump off, annoyed (see finding 3);
- puts down whatever anyone carries;
- sends every page the whole room (~2.3 KB `laidOut` each) and writes the
  store.

By hand the same account could move three pieces and then one every 20 s
(`furniture_burst`, `furniture_refill_secs`). The demo password is in the
README. One small script logged in as `demo1` can keep every visitor
inside from walking anywhere or doing anything, for as long as it runs.
That is a denial of the café, which is worse than ADR 0022's two accepted
costs (bots holding seats, the trust day resetting per jump), and neither
the ADR nor the plan names it.

**How I saw it.** `spec/zz-review-probe2.test.ts` in the copy: a visitor asks
to walk to (12, 12), and demo1 sends a lay-out every 125 ms for 5 s. Result:
`sent 40, laid out (seen by the visitor) 40, rate limited 0, laidOut bytes
to one page 92243`. Six seconds later the server has the visitor at (8, 1),
one tile from where they started, with no walk. They never got anywhere.

**Fixed would look like:** a cooldown of its own, as jumps have (one a
minute). A lay-out every few seconds would still do the marker's path
(Lap time, then Play room minutes later). It would be refused with
`tooSoon` and logged, and the bar would say why, as the Time group does
("next jump in 40 s"). Hold it with a `cargo test` like
`it_spends_no_ones_furniture_allowance`, in the opposite direction. If the
user would rather accept the cost, write it into ADR 0022's consequences
next to the bots. Note that `it_spends_no_ones_furniture_allowance`
currently asserts burst + 3 lay-outs in the same millisecond all succeed,
so it would need to change with the fix.

### 3. Minor: cats jump off pieces that didn't move

**What's wrong.** `lay_out` collects `old` as the tiles of **every** movable
piece (`layout.rs:42`), not of the pieces that move. So a cat on a piece
that stands in the same place in the new set still jumps off, annoyed, and
walks away. The spec says "A cat lying on a piece **that moves** jumps
off". All three sets keep the cat tower at (0, 1) and the window seat at
(2, 1), except Play room, which moves them. Laying out Opening day over
Opening day (the "put the room back" button) annoys every cat on any
piece.

**How I saw it.** Unit probe: Tora perched on the window seat at (2, 1),
then Lap time is laid out (the window seat stays at (2, 1)): `Tora annoyed
and off it: true`. Mochi napping on the cat bed, then Opening day is laid
out over Opening day: `Mochi woken off the unmoved bed, annoyed: true`.
`cats_on_the_old_pieces_jump_off` checks only a bed that does move, so it
can't tell the difference.

**Fixed would look like:** `old` is the tiles of pieces whose `(kind, x, y)`
isn't in the new set. A cat on a piece that stays keeps its place and
plan. Its plan's piece id is renewed by `restore`, so either keep the ids
of unchanged pieces or re-point the plan. Add a test with a cat on a piece
that stays put.

### 4. Minor: `check_layout` doesn't check what `restore` does, so a set can pass at start and lay out short

**What's wrong.** Decision 4 and `check_layout`'s doc say the order of a
set's pieces never matters: reachability and cat spots are checked once,
for the whole set (`room.rs:373-378`). But `lay_out` lays the set out with
`Room::restore` (`room.rs:501`), which places pieces one at a time (rugs
first, then file order) through `check_place`, and that checks
reachability **after each blocking piece**. A set whose final state is
fine but whose intermediate state cuts a tile off passes the start-up
check and silently loses a piece on every lay-out. That breaks "a set is a
data file" for any fourth set.

**How I saw it.** Unit probe in the copy's `content.rs`: Opening day with its
corner plant moved to after two chairs at (11, 12) and (12, 11) (the
chairs box in (12, 12) until the plant fills it). `check_layout: Ok(())`,
`set has 18 pieces, restore kept 17`. The three repo sets are safe, because
`every_set_passes_every_placement_rule` also restores each and counts its
pieces. But that guard lives in a test of the repo's content, not in
`load_layouts`, so it doesn't run on a new file at start.

**Fixed would look like:** `load_layouts` also restores each set on a clone
and refuses the file, naming it, if any piece is dropped. Or `check_layout`
places pieces in `restore`'s order with `check_place`'s per-piece rules,
so the two can't disagree. Add a case for this to
`a_set_breaking_a_rule_stops_the_cafe_naming_its_file`.

### 5. Minor: the phone's "one slim row" is two rows in most states

**What's wrong.** The spec: "On a phone it's one slim row: the time, and
Time, Furniture and Bots buttons". At 390×844 the row needs about 375 px in
a 374 px bar (clock 129 + toggles 57 + 87 + 54 + three 9.6 px gaps + padding),
so Bots wraps to a second line for most of what `aheadText` says. In
layout A it always wraps. The builder's `phone-b-furniture-open.png`
("6 min ahead") fits by a pixel or two. The change in `d5e74d8` made it
fit for one string, not for the bar.

**How I saw it.** `/tmp/s17probe/bar2.mjs` (Playwright, 390×844, touch), the
toggles' `top`s for each kind of `aheadText`:
layout B: "on Canberra time", "6 min ahead", "a day ahead", "a day and 9 h
ahead" and "2 days and 23 h ahead" all wrap (Bots, or Furniture and Bots,
on a second line). Only "23 h ahead" fits. Layout A: all six wrap. Logged
in as demo2 with nothing changed ("3 min ahead"), the screenshot shows Bots
on a second row.

**Fixed would look like:** a row that fits the longest `aheadText` at 390 px
in both layouts. Shorter words ("+2d 23h"), the ahead text moved into
the Time group, or icons would each do it. Add a browser check that the
three toggles share a `top` at 390×844 in layouts A and B with
`ahead` at its longest.

### 6. Minor: a resize across 960 px loses the keyboard's focus from a set button

**What's wrong.** At 1920×1080 the set buttons are always shown. Below
960 px `#demo-furniture` is `display: none` unless opened (`style.css`,
`.demo-group { display: none }`). Focus a set button, narrow the window,
and focus falls to `<body>`, so a keyboard user starts over from the top
of the page. The spec's bar "survives a resize". The Time group's buttons
from part 1 do the same, so the fix is shared, but part 2 adds three more
controls that do it.

**How I saw it.** `/tmp/s17probe/bar2.mjs`: focus "Lap time" at 1920×1080,
resize to 390×844: `focus after resize from a set button: BODY#`. The same
for part 1's "An hour on".

**Fixed would look like:** on crossing 960 px with focus inside a group
that hides, focus moves to that group's toggle (or the group opens). A
browser check would hold it.

### 7. Minor: the bar's Furniture group sits after Time in the tab order on a desktop

**What's wrong.** On a desktop, `d5e74d8` reorders the bar visually with
CSS `order`: clock, Furniture, Bots on the first row, the times on the
second. The DOM order is unchanged: Time group, then Furniture, then Bots.
So Tab goes through the second row (Morning ... Canberra time) before
reaching "Opening day" on the first row, then jumps back to the first
row's Bots. The focus order doesn't follow the reading order (WCAG 2.4.3).

**How I saw it.** `/tmp/s17probe/bar.mjs`, Tab from the clock at 1920×1080:
`Morning 07:00, Afternoon 13:30, Evening 18:30, Night 23:30, An hour on,
(the time field), Go, Canberra time, Opening day, Lap time, Play room, −/+`.
The screen (`desktop-lap-time.png`) shows Opening day, Lap time, Play room
and the bots on the row above the times.

**Fixed would look like:** the DOM in the order it's drawn on a desktop
(Furniture and Bots before Times), keeping the phone's toggle order. Or the
desktop rows laid out to match the DOM. Extend the desktop keyboard
browser check to assert the Tab order.

### 8. Nit: an open menu on a piece that's gone stays open

`apply`'s `laidOut` case (`client/src/state.ts:325`) replaces the furniture,
but `main.ts` doesn't close a menu opened on a piece. Its "Move the sofa"
or "Sit" then sends an id the server no longer has, and the visitor gets
"That isn't here any more." Harmless, and a piece taken by another visitor
has always done the same, but after a lay-out every piece id is new, so
any open piece menu is stale. Fixed: close the menu (and a phone ring) on
`laidOut` if its piece is gone.

### 9. Nit: the spec checks don't put the room back if they fail halfway

`spec/demo.test.ts`'s last check and the two in `spec/browser.test.ts` end on
Opening day, which keeps them order-safe when they pass. A failure between
"Lap time" and "Opening day" leaves the room in Lap time or Play room for
every later file (`furniture.test.ts` runs after `demo.test.ts`), whose
failures would then mislead. Fixed: lay out Opening day in an `afterEach`
or `finally`.

### 10. Nit: `step_off_new_pieces` doesn't count the tiles others are just stepping to

`taken` (`layout.rs:95`) is each other person's `p.at`. For someone already
sent off in this same loop, that's the tile they're leaving, not the one
they're heading to, so two people stepping off could be sent to the same
tile. I couldn't make it happen: all 171 pairs of people under Lap time's
and Play room's blocking pieces ended on different, walkable tiles (unit
probe, `0 ending on the same tile or a blocking piece`). Fixed: add each
chosen destination to `taken` as it's picked.

## Mutations tried (did the new tests notice?)

In the copy, each change on its own, `cargo test -p cafe --bin cafe`:

- M1, `step_off_new_pieces` not called: `nobody_is_left_seated_or_on_a_blocking_piece` fails.
- M2, walks not ended in `settle_for_layout`: `whats_carried_goes_and_errands_are_called_off` fails.
- M3, the walkway check removed from `check_layout`: `a_set_breaking_a_rule_stops_the_cafe_naming_its_file` fails.
- M4, `p.sitting = None` removed: `nobody_is_left_seated_or_on_a_blocking_piece` fails.

So the server-side tests hold what they name. Nothing holds what the
pages are told about people (finding 1), and nothing tells a moved piece
from an unmoved one (finding 3).

## Checked and found sound

- **The suites.** `cargo test`: 378 unit tests plus the binary tests, all
  passed. `pnpm -C client check`: 425 passed. `spec/` against the copy's café
  with `APP_DEMO_PASSWORD`: 124 passed, `restart.test.ts` skipped (needs
  `APP_RESTART`). `cargo test -p cafe export_bindings` regenerates
  `client/src/protocol/` byte for byte the same (`diff -r` clean), so the
  generated TypeScript isn't hand-edited.
- **The sets against the rules.** Drawn tile by tile from the files and
  `room.toml` (the bowls at (10, 9)): none on the walkway (7, 1)-(7, 3), no
  overlaps but the cushion and toys on rugs, every floor tile reachable,
  every nap and hide spot pettable. Lap time does read as the spec says: a
  sofa above and below the rug, a chair each side, the cushion on it, the
  cat bed beside it. Play room has the tower, scratching post, box and toys
  in the open, and the lamp and plants standing free to be knocked over.
  Opening day equals `room.toml`'s movable pieces
  (`opening_day_is_room_toml_as_it_lays_out`).
- **`check_layout` against `check_place`.** It applies the same floor,
  walkway and overlap-but-on-a-rug rules, and the same reachability and
  cat-spot rules for the whole set. It adds known-and-movable kinds and the
  cap. It drops only `check_place`'s "someone's in the way", on purpose,
  since the step-off handles that. The one difference is order (finding 4).
- **Who may.** A visitor is refused `notDemo`, a demo account at the window
  `notFromWindow`, an unknown set `cantPlace`, each with one refusal line
  (`only_a_demo_account_inside_lays_out_a_set`, and live:
  `spec/demo.test.ts`). The set id a client sends is never logged.
- **Errands and hands.** A carried piece goes (`put_back`, `why =
  "laid_out"`), and reservations, grabs, sits, places, tidies and cat
  handling on the way are called off. No walk's end touches the new room
  (`whats_carried_goes_and_errands_are_called_off`, and M2). A person
  holding a cat keeps it, which the spec allows.
- **Nobody ends on a blocking piece**, on the server: one person, two under
  one sofa (they step to (4, 7) and (5, 7)), and every pair under each set's
  pieces (finding 10's probe). Someone walking out after a nudge whose walk
  is cut is still removed on the next tick (probe: `removed at once =
  true`).
- **Cats.** Plans naming an old piece id find it gone, because `restore`
  gives every piece a new id, and `settle` turns Nap, Hide, Perch, Knock and
  Investigate into Idle. Held and lap cats are skipped by `cats_jump_off`. A
  lap cat whose person is stood up gets down on the next tick
  (`laps_tick`). It ends idle on its person's tile, exactly as after a
  `take` (probe: the same outcome), so that predates this slice. Every new
  piece goes into `new_pieces` for the cats to look at
  (`knocked_over_pieces_stand_and_the_cats_notice_the_new_ones`).
- **Saved, and a restart.** On the running café: Play room laid out, the
  café stopped (SIGTERM to its own pid) and started on the same `DATA_DIR`,
  and a new page's welcome had exactly Play room's pieces (probe: `woke in
  the set: true`).
- **During a jump or a wake.** A lay-out queued while a jump runs is refused
  `movedOn` (`ws::moved_on` covers every action name, `lay_out` included).
  The bar disables the set buttons while the café wakes (`demoBar.test.ts`).
- **The page's state.** `laidOut` replaces `room.furniture` and clears
  `held`. The carrying bar and its preview follow `held` on the next frame.
  The floor layer's cache key and the shadows are built from
  `room.furniture`, so they redraw. The catalogue has no count to go stale.
- **Logs.** One `action` line per lay-out (`what = "lay_out"`, `who`, `uid`,
  the set's name) and per refusal with its code. Over the copy's café, 615
  lines including 8 `lay_out` lines, `scripts/check-logs.ts` passed. The
  narrations in `narrate.ts` are right and tested.
- **The bar, otherwise.** Every control is a real `<button>`. On a phone,
  Escape closes the Furniture group and returns focus to its toggle. A set
  chosen closes its group. Touch and keyboard each lay out a set in the
  browser checks. A visitor who isn't a demo account never sees the bar:
  it's `hidden` unless `state.demo`, and the server refuses them anyway.
  The set buttons are `.demo-group button` on the bar's opaque card, the
  same ink as part 1's controls, which `contrast` and `demoBar.test.ts`
  already hold.
- **The "done when" lines for part 2.** "Each of the three sets passes every
  placement rule" is held by `cargo test` for the repo's sets (finding 4 is
  about a future file). "Laid out at once for everyone, without spending
  the rate limit; carried pieces go back, nobody left on a blocking piece,
  cats jump off what moves" is held on the server, and `spec/` holds the
  second client seeing it within a second. On the pages it isn't held
  (finding 1), and "what moves" is wider than the spec (finding 3).

## Answers

By the builder, 2026-11-09. Every finding was fixed, each test seen
failing first: against the code before the fix, or for the browser lines
against part 2's client as it was at `8126092`.

1. **Fixed** ([`50dc122`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/50dc122)). `settle_for_layout` says whether someone was
   seated or walking; after `laidOut`, each of them who didn't step off
   gets a walk of no steps where they stand, as `stand_up` does. Held by
   `every_page_is_told_who_stood_and_whose_walk_ended` (a seated person, a
   walker and a bot: each page's copy, rebuilt from the messages, equals
   the server's, and none ends on a blocking piece), and end to end by
   `spec/demo.test.ts`'s last check (a visitor walking to (4, 8) is told,
   after the room, a walk ending off Lap time's sofa).
2. **Fixed** ([`50dc122`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/50dc122), [`58b8c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/58b8c9a)). The café lays out a set at
   most every `layout_every_secs = 10` (`content/tuning.toml`), whoever
   asks, refused `tooSoon` with the seconds left and logged. The welcome
   (`nextLayout`) and every `laidOut` (`next`) say when; the bar holds the
   set buttons off until then, saying "Next set in 6 s". Ten seconds still
   does the marker's path, where sets are minutes apart. Held by
   `a_set_waits_for_the_last_one_whoever_asks`, the reworked
   `it_spends_no_ones_furniture_allowance` (sets spread past the wait),
   `demoBar.test.ts`, `spec/demo.test.ts` (`tooSoon` at once) and the
   desktop browser check.
3. **Fixed** ([`50dc122`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/50dc122)). The new `Room::lay_out` keeps a movable piece
   already where the set puts one of its kind, with its id, stood up, and
   returns only the tiles of the pieces that went; only those make a cat
   jump off. Held by `a_cat_on_a_piece_that_stays_is_left_alone` (Tora on
   the unmoved window seat; and Lap time over Lap time disturbs no cat).
4. **Fixed, another way** ([`50dc122`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/50dc122)). Rather than refusing such a file,
   `Room::lay_out` puts the set down whole, as `check_layout` checked it
   against the pieces that never move, so the order of a file's pieces and
   the room before can't drop one. Held by
   `a_set_lays_out_whole_whatever_its_order_or_the_room_before` (the
   reviewer's boxed-in corner: whole on the opening room and on a room
   holding part of it), which fails with a per-piece `check_place` put back.
5. **Fixed** ([`58b8c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/58b8c9a)). Below 960 px how far ahead is drawn in a few
   characters (`aheadShort`: "+6m", "+2d 23h", never over 8), the words kept
   in the page for a screen reader. Held by `demoBar.test.ts` and by the
   phone browser check, which asserts the three toggles share one `top` in
   layout B, and again after a resize back from a desktop (it failed on
   the old client: two rows).
6. **Fixed** ([`58b8c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/58b8c9a)). The bar remembers its last focused control;
   on a resize, if the focus fell to the page because that control's group
   hid, it goes to the group's toggle. Held by the phone browser check
   (focus "Lap time" at 1920, narrow to 390: "Furniture" has the focus).
   This also covers part 1's Time group.
7. **Fixed** ([`58b8c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/58b8c9a)). The times are now last in the page, as
   they're drawn on a desktop; the CSS `order` rules are gone, and the
   phone's toggles keep Time, Furniture, Bots. Held by the desktop browser
   check of the bar's controls in page order, plus the sets drawn above
   the times (it failed on the old client: the times came first).
8. **Fixed** ([`58b8c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/58b8c9a), [`1fcd021`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1fcd021)). `laidOut` gives a `laidOut`
   effect, and the page closes any menu. Held by `state.test.ts` and a
   browser check: the visitor opens the cat bed's menu, Lap time lands,
   the menu closes (it fails with the close taken out).
9. **Fixed** ([`58b8c9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/58b8c9a)). Each set check lays out Opening day in a
   `finally`, waiting out the café's wait (`putBack` in `spec/demo.test.ts`,
   `putBackThroughPage` in `spec/browser.test.ts`).
10. **Fixed** ([`50dc122`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/50dc122)). Each destination chosen joins `taken` as it's
    picked. `two_people_stepping_off_go_to_different_tiles` holds it. As the
    reviewer found, it couldn't be made to fail before, so it stands as a guard.

After the fixes: `cargo test -p cafe` (384 unit tests and the binary
tests), `pnpm -C client check` (427), and the whole `spec/` against a
seeded café on port 8181 (124 passed, `restart.test.ts` skipped without
`APP_RESTART`); the log check over its 639 lines passed with `catppuccino`
never logged.

