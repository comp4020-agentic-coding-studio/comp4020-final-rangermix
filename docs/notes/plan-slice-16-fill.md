# Slice 16, "The café fills the window": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why:
> [ADR 0021](../adr/0021-grow-the-floor-and-float-the-bars.md).

**Goal:** at the 1920×1080 viewport the course marks at, the café is the
whole window: a 13 by 12 floor at 32-px tiles fills it at 4×, the status
and talk bars float over the room, the street runs edge to edge behind
it, and a terrace fills the room's bottom corners.

**Approved:** the user, 2026-11-06 05:46 AEDT: "C. on the phone put the
camera at the central of the room. it's okay to hide a bit of the corner
of the room for now. build it and I'll judge it when finished." Question
1 is C, 13 by 12; questions 2 to 4 were answered A at 04:40 (the terrace;
the bars as in the study; cats and people as drawn). On the phone's
layout A, where 13 by 12 is 400 px at 1× in a 390-px window, the room is
centred and its two side corners cut by 5 px each.

**Spec:** [`docs/slices/16-the-cafe-fills-the-window.md`](../slices/16-the-cafe-fills-the-window.md).
Written 2026-11-06 from `main` at `5a3a1df`. Study:
[notes/slice-16-study.md](slice-16-study.md).

## Decisions made in this plan

1. **The floor is content.** `content/room.toml` grows to 13 wide and 13
   rows (row 0 the street wall, 12 of floor). The street wall keeps its
   four panes, door and chalkboard where they are, and gains a wall tile
   on the right. Today's pieces stay where they stand; three more go on
   the new strip, a sofa, a lamp and a plant, so it isn't bare. Only three
   server tests name today's size (a spot past the old edge, the street
   wall's row, a saved cat's spot); they're rewritten from the room's
   numbers.
2. **A café saved at the old size wakes at the new one.** The saved
   arrangement is a list of pieces; today it carries no floor size. It
   gains one, `{"floor":[13,13],"pieces":[...]}`, and a bare list reads
   as a café saved at a size it doesn't know. Waking at a size other than
   the saved one, every saved piece goes back where it was (the floor
   only grows, so each still fits), then each `room.toml` piece standing
   wholly on tiles the saved floor didn't have is added, if it fits and
   the furniture cap allows. The live café keeps everyone's arrangement
   and gains the new strip's furniture once. Cats saved on what is now a
   new piece are moved by the rule that's already there
   (`place_cat` drops a saved spot that isn't walkable and pettable).
3. **The client's room comes from the same file.** `client/src/iso.ts`
   imports `content/room.toml` (`?raw`, read by a small reader of its
   own, as `street.ts` reads `street.toml`) for the floor's width and
   height, and works the canvas out from them: (w + d) × 16 by
   (w + d) × 8 + 64 px at 1×, the origin at (−16, 56 + (w − 1) × 8). The
   server and the client are one build (the build id), so they can't
   disagree; a client test holds that the reader gives what the server's
   `room.toml` says. Everything that read `ISO.width`, `ISO.height` and
   `originY` keeps reading them.
4. **The street is laid out for the room it's behind.** Its clouds are
   placed in room pixels on the 336 by 232 backdrop; they're moved to the
   bigger backdrop's top corners, and the server's test bounds read the
   room's size the same way.
5. **The street end to end is a second canvas, `#street`**, behind the
   room's, the size of the stage, drawn at the room's scale and lined up
   with the room's canvas to the pixel, so its towers and pavement carry
   on where the room's canvas ends. It's redrawn when the light changes,
   the stage is resized or the room pans (layout B). The room's own canvas
   keeps the street inside it, as now, so picking and every check's
   coordinates are unchanged.
6. **The terrace is data in `content/street.toml`**: `[[terrace]]` tables,
   each a kind (bench, planter, table, umbrella, chair, lamp) and a spot
   in tiles relative to the floor's left side or front edge, drawn as
   blocks in the hour's light with the room's outlines, after everything
   in the room (it's nearest the viewer), on the room's canvas and the
   street's. It takes no click: `hitAt` never sees it.
7. **The bars float from 960 px**, as layout B's do: the status line a
   small pill top left, its buttons top right, the talk bar a glass bar
   across the bottom middle, at most 60 rem. The stage is the whole
   window; the room's scale is from the window less 8 px each side. The
   panels start below the status row and above the talk bar. The bars'
   glass uses the panels' tokens, so the contrast test covers them.
8. **The phone's layout A** shows the room at 1× and centred: a room
   wider than the window is cut evenly at both sides (5 px each at 390),
   never scrolled sideways.

## Tasks

1. The bigger floor and the old café waking at it: `room.toml`, the
   saved arrangement's floor, the new strip's pieces added once; `cargo
   test` first.
2. The client's room from `room.toml`: the reader, the geometry, every
   test that held 336, 232 and 1344 read from it; client tests first.
3. The bars float on a desktop, the stage the whole window, the panels'
   starts; browser checks first (the room at 1600×1056 at 1920×1080, no
   floor tile under a bar, every bar control by keyboard, touch and
   mouse).
4. The street end to end: the `#street` canvas; a browser check first
   (no page background at the window's edges and corners, at 1920×1080
   and in layout B as it pans).
5. The terrace: `street.toml`'s `[[terrace]]`, its reader and drawing;
   client tests and a browser check first (a click on the bench does
   nothing).
6. The phone's layout A centred and cut evenly; a browser check first.
7. Screens for the judged line, `design.md`, the spec marked built.

## Execution log

Where the build departed from this plan, task by task.

- **Task 1.** As planned, with one more test touched: the saved-cat test
  placed Burakku at random before Mochi's saved spot was checked, and on
  the bigger floor the draw landed on Mochi's spot. It now saves Burakku
  too, so it holds what it says whatever the floor. `long_gaps.rs` reads
  the stored arrangement's `pieces`.
- **Task 2.** As planned. `window.cafeRoom` gained `size`, the room's 1×
  canvas, for the browser checks.
- **Task 3.** Three things the plan didn't foresee, each found by an
  existing check. At 18rem the cats panel covered the left corner tile's
  middle, so the panels are 17rem. A desktop menu opened low ran under the
  floating talk bar, so it's kept between the bars as the ring is. The
  music panel's title wraps at 17rem and its box, held at its last
  height, couldn't tell, so its title and controls are watched. The
  street check's fixed points fell under panels and bars over the bigger
  room; it finds its points off the room's shape instead.
- **Task 4.** The street canvas is drawn once per light, scale and stage
  size, a stage's size past the room on each side, and moved as the room
  pans, rather than redrawn per frame. The room's frame (rounded corners,
  shadow) is kept only on the phone's layout A, where the street doesn't
  carry on. The phone's layout B never showed the page, as its pan stops
  at the room's edges, so its check is a guard that passed before.
- **Task 5.** The terrace is placed by where 1920×1080 shows it, clear of
  the panels and the talk bar where they start: by the left edge 4 to 7
  tiles along, out front 5.7 to 9.2. The lamp is lit in the window's glass
  slot, warm yellow at night. Its things share the furniture's colours, so
  the slice 13 rim test now leaves out pixels the room has without its
  pieces. The browser check clicks the bench's seat and the table's top,
  having read that what's drawn there is the thing.
- **Task 6.** As planned. The stage places the phone's whole room from
  the left to a whole pixel, centring it on any phone: cut 5 px each side
  at 390, centred with room to spare at 430.
