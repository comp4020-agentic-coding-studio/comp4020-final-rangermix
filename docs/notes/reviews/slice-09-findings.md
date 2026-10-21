# Findings: review of slice 09, "The room seen at an angle"

Brief: [slice-09-brief.md](slice-09-brief.md). Read cold at `b805c70` (the
code from `aff9e71`). Built and run only in a throwaway copy
(`git archive b805c70`), never in the repo. Nothing live was touched.

**Count:** 0 critical, 3 major, 9 minor.

## What was run

- `pnpm -C client check`: typecheck and 113 client tests, green.
  `pnpm typecheck`, `cargo fmt --check` and
  `cargo clippy --all-targets -D warnings` are clean too.
- `cargo test`: 302 unit tests (1 ignored), then 5, 4, 3 and 1 in the
  integration suites. All green, including
  `every_kind_of_furniture_has_a_height_to_draw_at`.
- The spec against a local café (`PORT=18611`, fresh `DATA_DIR`):
  `browser.test.ts` 21 of 21. That includes slice 07's two waking checks,
  which passed this time. The other spec files: 43 passed, 1 skipped
  (`restart.test.ts`, which needs `APP_RESTART`).
- Throwaway probes in the copy, all deleted afterwards:
  - Client unit tests: `drawOrder` for lap cats, people round the sofa, and
    pieces on the rug. `inDrawOrder` on 4,000 random rooms with the
    renderer's nudges. `pickTile` swept over the whole floor on a 0.037-tile
    grid.
  - Browser probes that rewrite only what one page is shown, the way
    `lowCat` already does: screenshots of each scene, clicks where things
    are drawn, Tab order in layout B, resizes across 700 px, the room
    between 700 and 960 px wide, blocked storage, and bubbles.
  - One mutation in the copy: `main.ts:216`'s `stage.shiftBy(ringSlide(...))`
    removed, then restored. Finding 5 says what it showed.
- One mistake of mine: to restart my café I ran
  `pkill -f target/debug/cafe`. That matches any café debug build on this
  machine, not only mine, and nothing was listening on 18490 afterwards.
  I didn't check 18490 beforehand, so I can't say whether it was mine to
  stop. Every later server was stopped by its own PID. Port 8080 (Docker)
  was untouched.

## Findings

### 1. Major: a click or tap on a cat, person or piece where it's drawn picks the tile behind it, or the wall

`client/src/iso.ts:35-45` (`pickTile`), through `client/src/stage.ts:80-85`
and `client/src/input.ts:125-131`. The drawing, at `render.ts:137-140` and
`:405`, raises sprites off their tile; picking doesn't know.

**Scenario:** picking only ever finds the floor diamond, or row 0's wall,
under the pointer. But a figure's 16-px sprite stands with its feet 2 px
below its tile's centre, so its top 6 to 8 px are over the tile behind. A
cat on a piece is raised by the piece's height (12 to 44 px), and a block's
top face is its height above its footprint. In the browser at 1920×1080,
each click below was aimed at the middle of the thing as drawn:

| Clicked | Sent | What the visitor gets |
| --- | --- | --- |
| a cat napping on the window seat (3,1) | `walkTo (3,0)` | "You can't stand there." (the window) |
| a cat napping on the cat tower (1,2) | `walkTo (0,0)` | "You can't stand there." (the wall) |
| a cat sitting on the floor (5,8), its head | `walkTo (4,7)` | walks away from the cat |
| the chair (9,4), the middle of its seat | `walkTo (8,3)` | walks to (8,3), beside the table |
| the sofa, the middle of its top over (1,5) | `walkTo (0,4)` | walks behind the sofa |

The first two rows' errors come from `walk_to` (`room.rs:403-409`,
`people.rs:205-212`), read from the code: the probe held every walk back
from the server. Cats nap on the
tower, the window seat, the sofa, the box and the cat bed, so a cat drawn
up on a piece is a common sight. The top-down room had no such gap: each
sprite filled its own tile. The things can still be reached by keyboard,
or by clicking low on a block's front face, but nothing tells a visitor so.

**Would a test catch it?** No. Every browser check clicks
`window.cafeRoom.tileAt`, which is the floor diamond's centre, never where
the thing is drawn. The unit tests hold that picking inverts the floor
transform, which it does. Fix test first: a browser check that pins a cat
napping on the window seat (as `lowCat` pins one) and clicks its sprite's
middle, expecting its menu. Then pick what's drawn first: hit-test the
figures and blocks, topmost first, before the floor diamond.

### 2. Major: a cat asleep on someone's lap is drawn under them

`client/src/render.ts:199-203` with `:213-217`, and `onTop` at `:234-237`.

**Scenario:** someone sits on a seat (sofa, chair or window seat), and a
cat naps on their lap (`lapOf`). The comment at `:199` says the cat "is
drawn over them, as a held cat is". But when there's a piece `under`,
`onTop` ignores the `nudge` (0.3 for the cat, 0.15 for the person), so both
get the same footprint. `inDrawOrder` then ties on centre. The sort is
stable and cats are pushed before people, so the person is painted over
the cat. The probe's order on the chair:
`["piece chair","cat mochi","person 1"]`. In the screenshot only one ear
shows past the sitter. On the sofa, half the cat's face peeks past them.
Before the slice, the lap cat sorted at `y + 0.3`, after its sitter's
`y + 0.2`, and was drawn over them. The lap is what trust of 80 earns, and
the chalkboard tells of it.

**Would a test catch it?** No. `render.test.ts` has no seated person and
no lap. Fix test first: a `drawOrder` test with someone seated on the sofa
and a lap cat on them, expecting the cat after the person.

### 3. Major: what lies on the rug is drawn under it: treats, and toys or a cushion put there

`client/src/render.ts:249-255` (treats), and `:189` with `:226` (the flat
list).

**Scenario 1:** a visitor standing on the rug presses "Put a treat down".
`put_treat` puts it at their feet, on the rug, since the rug doesn't block
(`treats.rs:79-84`). But `draw` blits treats before `drawOrder`, which
then paints the rug over them. In the browser a treat at (5,5) on the rug
doesn't show at all; one at (3,7) on the bare floor does. The floor
cushion is drawn after treats too, so one put down on it is covered (read
from the code, not run). Before the slice, flat pieces were drawn first
and treats after them.

**Scenario 2:** someone carries the toys onto the rug. `check_place` allows
a piece that isn't `under` to stand on one that is (`room.rs:243-248`).
The toys (3 px) and the cushion (4 px) count as "flat", so they're sorted
among themselves and the rug by centre alone. The probe gave
`["piece toys","piece rug"]` for toys at (4,4), and
`["piece cushion","piece rug"]` for a cushion at (5,5). Either one is
painted under the rug and vanishes. Before the slice the toys were drawn
with the standing things, after the rug.

**Would a test catch it?** No. `render.test.ts` checks a cat on the rug,
not a piece or a treat. Fix test first: a `drawOrder` test for toys on the
rug, expecting the toys after it. Then a test that treats come after every
`under` piece, which means moving treats into the order or drawing
`under` pieces first.

### 4. Minor: in the bigger room, Shift+Tab from the room lands on a "Put a treat down" button nobody can see, and Enter spends a treat

`client/src/style.css:179`.

**Scenario:** to keep the chalkboard's copy for a screen reader in B, the
whole left panel is visually hidden, "Your cats" and its button included.
A phone in B, by keyboard: focus the room, then Shift+Tab. The focus goes
to "Put a treat down", whose box is at (-76, -20) inside a 1×1 clip.
Nothing on screen shows the focus. Pressing Enter took the probe's treats
from 3 to 2. Before the slice, B hid the panel with `display: none`, and
layout A only visually hides the `.chalkboard` section (`:163`). No space
is taken.

**Would a test catch it?** No. The keyboard check Shift+Tabs only after
resizing back to the desktop. Fix test first: in B with the drawer shut,
every element Tab or Shift+Tab reaches from the room has a box on screen.
Then hide only `.chalkboard` in B, as A does, and keep `#your-cats` out of
the Tab order.

### 5. Minor: the check that the room moves over by its edge no longer tests an edge, and passes without the move in 2 of 5 runs

`spec/browser.test.ts:534-559`.

**Scenario:** the check opens a ring on the sofa's end, (0,5), "against
the left wall", which "sits at the screen's edge". At an angle it doesn't:
its centre is 240 px into the 1,008-px canvas, so the pan can centre it,
and once the pan catches up the ring fits without any move. With the move
removed in the copy (`main.ts:216`), the check passed 2 of 5 runs. It
failed only when the pan hadn't caught up with the arrow keys by Enter,
since the room then holds still mid-pan. Tiles the pan can't centre do
need the move: to fit a ring round the box at (1,9), the real build moved
the room 20 px past its left edge.

**Would a test catch it?** This is the test. Point it at a tile by the
room's corner on screen, such as the box (1,9) or the cat bed (0,7), where
the slice-07 CI failure was. Without the move it would then fail every
time.

### 6. Minor: no browser check uses the keyboard in layout A at 390×844 any more

`spec/browser.test.ts:219-258` and `:657-686`.

**Scenario:** the keyboard pass at 390×844, and reading the board by
keyboard on a phone, now both run in B, the new default. Before the slice
both ran in A. Now no check uses the keyboard in layout A at 390×844. The
AGENTS.md rule ("every action works by keyboard ... at 390×844") is held
in layout A only by review.

**Would a test catch it?** Only one that switches to the whole room
first, as the sheet check does, and then opens a menu and the board with
Tab and Enter.

### 7. Minor: someone behind the sofa's far end is drawn over it, and a cat walking over furniture is drawn at floor level, then jumps up when it stops

`client/src/render.ts:217` and `:234-235` (the nudge), `iso.ts:55-57`,
and `render.ts:201` and `:213` (`spot.moving ? null`).

**Scenario 1:** a person standing at (2,4), just behind the sofa's right
end. Their footprint is nudged 0.15 toward the viewer, which pushes it
into the sofa's row. So neither is "wholly behind" the other, and centre
order (7.3 against 7.0) puts the person after the sofa. They're drawn over
it, as the probe and its screenshot show. At (0,4) and (1,4) the centre
order happens to come out right. A cat at (2,4) has no nudge and is drawn
correctly; that's the case `render.test.ts` and `iso.test.ts` check. The
same thing makes a person walking along row 4 pop in front of the sofa
once they're past its middle.

**Scenario 2:** cats walk over everything. While a cat moves, it has no
`under`, so it's drawn at floor level across the block's face. A cat
walking to a nap on the tower crosses the tower's footprint 44 px below
its top, then jumps up when it stops. It drops to the floor the moment it
leaves. When still, positions are whole tiles, so `standingOn`'s rounding
never flickers, and a seated person is on the tile the server says.

**Would a test catch it?** No. Fix test first: the `render.test.ts`
sofa test, with a person instead of a cat at (2,4).

### 8. Minor: bubbles ignore how high someone is drawn, and a face in the window is hidden by its own bubble

`client/src/stage.ts:74-77` (`figureToCss`) and
`client/src/bubbles.ts:78` and `:95-98` (`windowFace`).

**Scenario:** someone seated is drawn 8 to 12 px up, but their bubble is
placed for someone standing on the floor, so it sits on top of their head
(screenshot of the chair at (9,4)). For a face in the window,
`windowFace` gives head and feet both as the wall's midpoint, z = 28. The
face is drawn from z = 30 to 39, so the bubble lands on it, and the window
shows only the bubble while it lasts. Before the slice, that bubble fell
below the window. Only where the bubble sits says who's speaking, and the
face is gone.

**Would a test catch it?** No. `bubbles.test.ts` tests `placeBubble` in
isolation. A unit test that `figureToCss` and the face's spot clear the
drawn figure would catch it.

### 9. Minor: in the bigger room at 390×844, the front corner tile sits under the talk bar, and the view never moves up or down to show it

`client/src/stage.ts:147-152` with `client/src/layout.ts:37-38`.

**Scenario:** at 3× the room is 696 px tall, in an 844-px view. `panOffset`
centres a room smaller than the view, so it's always at top 74 and never
pans vertically. Tile (11,9), the bowls' right end where a cat may stand
to eat, has its centre at y 746, under the talk bar (top 740). Only the
top of its diamond shows. Most of the cat that shows is over the tiles
behind it, which a tap picks instead (finding 1). That cat can be reached by keyboard, or by
switching to the whole room. Before the slice, B's room was 480 px tall
and every tile was clear of both bars.

**Would a test catch it?** No. A check that every floor tile's centre in
B is on screen and clear of the bars, once the view follows it, would.

### 10. Minor: between about 816 and 959 px wide, the room is cut off and part of the floor can't be reached, with no switch

`client/src/stage.ts:110-116`, `client/src/style.css:66` and `:81`.

**Scenario:** above 700 px the desktop grid applies, and the stage is the
window's width less about 624 px of panels and gaps. The room is never
drawn below 1×, which is now 336 px. At 820×1180 (an iPad Air upright) the
stage is 196 px wide: the room is cropped, and 36 of 108 floor tiles can't
be clicked or tapped. At 768×1024 it's 72, though 768 was already cropped
before (a 144-px stage for the 192-px room). The layout switch is phone
only. Before, the room fitted from about 816 px up. Now it needs 960.
Neither marking size is affected, but a desktop window resized through
that range loses part of the room.

**Would a test catch it?** No. One at 820×1180 checking that every tile's
`tileAt` point is on `#room` would.

### 11. Minor: with site data blocked, the switch can't leave the bigger room

`client/src/layout.ts:14-16` and `:26-32`, and `client/src/main.ts:116-127`.

**Scenario:** when `localStorage` throws, `savedLayout()` is always null,
so `chooseLayout` always gives B on a phone. Tapping "Whole room" saves
nothing, re-reads null, and stays in B: the probe showed `layout-b` and
1008 px both before and after the tap. `layout.ts:30`'s comment ("the
choice lasts this visit only") isn't true. The switch was just as dead
before, but then it was stuck in A, which shows the whole room. Now it's
stuck in B.

**Would a test catch it?** No. A unit test of the choice with storage
throwing would, given a fallback that keeps the choice in memory.

### 12. Minor: the spec and design.md don't say what was built

`docs/slices/09-the-room-seen-at-an-angle.md:35-36` and `:67`;
`docs/design.md:423-424`; `docs/notes/plan-slice-09-isometric.md:96`.

The spec still says each block is "as tall as its kind's `height` in
`content/furniture.toml`". It holds "a height for every kind" by "the
content loader". The heights are in `content/sprites/heights.json`, read
by a test of its own and not by the loader (the plan's execution log says
so). `design.md`, which is settled, says a toppled piece is shown "by its
own lying-down sprite (slice 09)". It's a block. The plan's decision 8 has
the tint "over the floor and walls only". It covers the whole canvas, as
before. Task 6 plans to update `design.md`; these three should be part of
that.

## What I checked and found sound

- **Picking against drawing.** `pickTile` inverts `toCanvas` on the
  floor: the 0.037-tile sweep missed nothing more than 1e-6 from an edge.
  The stage turns every tile into CSS and back at 1× and 3×, centred,
  off-centre and panned. Points above the street wall, on the back-left
  wall and off the floor pick nothing. A click on the wall over a window,
  or on the door, sends the same row-0 `walkTo` as the top-down room did,
  and the server answers as before. Every floor tile's diamond can be
  clicked at 1920×1080 and in B once panned there (52 of 52 on-screen
  tiles hit `#room`). At 390×844 in A the whole room is on screen, at 1×,
  with 32 by 16 px diamonds, as ADR 0017 accepted.
- **`inDrawOrder`.** It always ends: each pass draws one thing, with a
  fallback. It found a pick at every step, without the fallback, in 4,000
  random rooms with the renderer's nudges, and drew nothing wholly behind
  after what it's behind. It's stable, with ties falling to the order
  things were pushed in, which is how finding 2 happens. At 40 things it's
  about 64k comparisons a frame, which is affordable.
- **The stage's callers.** Bubbles, desktop menus, rings, the ring
  following its tile while B pans, the board's tile, the keyboard pointer
  (as a diamond, or a panel on the wall), the ghost and hover all go
  through `tileToCss`/`wallToCss`/`cssToTile`. No caller still uses
  `TILE` for placement. B's pan follows the floor in front of the
  chalkboard.
- **Layout B by default.** A phone's first visit opens in B, with "Whole
  room" and `aria-pressed="true"`. A saved A stays A through a reload and
  through a resize to 800 px and back. A device with no saved choice goes
  to A above 700 px and back to B, with the label following. The panel
  takes no space, and the chalkboard's copy is still read in B.
- **The browser checks.** None still finds a tile by a fraction of the
  canvas. The two `room.width * 32 / 336` and width strings that remain
  are sizes, not tiles. Sharing `tileAt` with the code under test is fine
  for floor tiles, since drawing and picking both use `toCanvas`. What
  `tileAt` can't see is where a thing is drawn above its tile (finding 1).
- **`window.cafeRoom`.** It's frozen, with one function from grid
  coordinates to viewport pixels. It reads no state and sends nothing, so
  it tells nothing the canvas doesn't show, and lets a page script do
  nothing a visitor can't.
- **The kept rules.** The server and the protocol are unchanged, bar one
  content test, and `client/src/protocol/` wasn't touched. Placement is
  still the server's to refuse: the ghost's colour is a guess. Nothing new
  is stored or logged. A furniture kind with no entry in the colour or
  inset tables falls back to defaults, and `cargo test` makes sure it has
  a height, so a new kind needs data, not code.
