# 16. The café fills the window

- **Status:** Proposed 2026-11-06, from the user's three asks of that day; the open questions below are theirs
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-16-fill.md`
- **Design:** The client ("Desktop (1920×1080)", "Drawing", "The look");
  [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
  (32-px tiles, the panels in the corners), which
  [ADR 0021](../adr/0021-grow-the-room-by-its-tile-and-float-the-bars.md),
  proposed, would amend; the study,
  [notes/slice-16-study.md](../notes/slice-16-study.md)

## Story

On a laptop or a 1080p screen the café is the whole window: the street's
sky and towers run edge to edge behind the room, the room is as big as
the window allows, drawn with bigger tiles rather than bigger pixels, and
the status and talk bars float over it as the panels do. The room's two
bottom corners are the café's terrace, with a bench and planters on one
side and a table under an umbrella on the other, so there's no bare
triangle where the room's diamond ends.

## In this slice

The proposed defaults below; each open question can change one.

- **The bars float on a desktop.** From 960 px wide, the status line and
  its buttons sit over the room's top edge, and the talk bar (the box,
  Say, the emotes, the treat button) over its bottom middle, on the
  panels' frosted glass. The room has the window's whole height.
- **The tile chosen by the window.** The room is drawn with 32-px tiles,
  or 36-px tiles where they give a bigger room, at the largest
  whole-number scale that fits: at 1920×1080, 36-px tiles at 4×, 1512×1040
  (now 1344×928); in a maximised browser on a 1080p screen (about
  1920×955), 32-px tiles at 4× (now 3×). Floor, walls, windows, door,
  chalkboard, furniture and shadows are all drawn to the tile. A resize
  that changes the tile refits the room, as a change of scale does now.
- **Cats and people stay their size** (24 and 32 px), as drawn in slice 11,
  so in a 36-px room they're a little smaller beside the furniture.
- **The street end to end.** The street's sky, towers, clouds, warm band,
  kerb and pavement are drawn across the whole window behind the room, by
  day and by night, at the room's scale, so its pixels match the room's.
  The page's own background no longer shows on a desktop, or in the
  phone's layout B as it pans.
- **The terrace in the bottom corners.** The pavement round the café's
  slab is paving, with a bench and two planters along its left side, and
  a table under an umbrella, two chairs and a street lamp out front on the
  right, lit at night. It's scenery: it takes no click, blocks no walk,
  and isn't in the server's world. Like the street, it's data in
  `content/street.toml` (each thing's kind and spot), drawn in the hour's
  light with the room's outlines.

## Not in this slice

- Redrawing cats and people at a bigger size: new art, which the user
  hasn't asked for now.
- A bigger floor, or terrace seats people can use: the floor is the
  server's grid, and changing it changes the world, the cap and its checks.
- The phone's layout A, which keeps the room in a column at its width,
  with the street inside the room as now.
- The logged-out page's picture of the café.

## Done when

| What must be true | Held by |
| --- | --- |
| The tile and scale are the biggest room that fits, never smaller than today's for the same window: 36 px at 4× at 1920×1080, 32 px at 4× at 1920×955, and as the study's table for 1728×1000, 1512×860, 1440×790 and 2560×1300 | client unit tests (the choice, over those windows) and browser checks at 1920×1080 and 1920×955 (the room's size on screen) |
| Clicks, taps, the keyboard's pointer, menus, bubbles, carrying and the drawn-under-the-pointer rule land on the same tiles at either tile size | the browser checks that read the tile through `window.cafeRoom` and the canvas's scale, run at both sizes |
| A resize mid-use that changes the tile (1920×1080 to 1920×955 and back) keeps everyone on their tile, and what's open (a menu, the keyboard's pointer, something carried) in place or closed, never pointing at the wrong tile | browser check |
| The status line and its buttons, and the talk bar, float over the room on a desktop; every control in them works by keyboard, touch and mouse; no floor tile is wholly under either bar at 1920×1080 or 1920×955 | browser checks |
| Their text and controls are 4.5:1 or better over anything the room and street can show behind them | client unit tests (`contrast`, as the panels') |
| The street covers the whole window behind the room by day and by night: no pixel of the page's own background shows at 1920×1080, 1920×955, or in layout B at 390×844 as it pans to each edge | browser checks (pixels sampled at the window's edges and corners) |
| The terrace is drawn in both bottom corners from `content/street.toml`, in the hour's light; a click or tap on it does nothing; a new thing on it is a line of data, not code | client unit tests (the reader, as the street's) and a browser check (a click on the bench neither walks nor opens a menu) |
| The phone's layouts are as they were at 390×844: A shows the whole room at 1×, B at 3× | the existing browser checks |
| It looks right: the room's size, the bars over it, the street to the edges, the terrace, by day and by night, at 1920×1080 and a laptop's size | judged: the user, from screens in `docs/notes/screens/slice-16/` |

## Rules it touches

- **Every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use.** The bars move over the
  room, and a resize can now change the tile, which every pointer-to-tile
  sum depends on.
- **The server decides every outcome.** Nothing here reaches the server:
  the terrace is drawn by the client alone, and the floor is unchanged.
- **The door's walkway is never blocked.** The terrace is outside the
  room, off the grid, so it can't block anything.

## Numbers

- The tile: 32 or 36 px across, whichever gives the bigger room; cats 24
  px and people 32 px at either.
- The room at 1×: 336×232 at 32-px tiles, 378×260 at 36 (the walls 56 and
  63 px high).
- The scale: the largest whole number that fits the window, less 8 px
  each side, never below 1.
- The floor's slab: 6 px deep, as now.

## Open questions

What the user decides before this is approved, each with the proposed
default first. The study's screens show each choice
([compare-day.png](../notes/screens/slice-16-study/compare-day.png),
[compare-night.png](../notes/screens/slice-16-study/compare-night.png)).

1. **How the room grows.** (A, proposed) The bars float, and the tile is
   32 or 36 by the window: the biggest room on every window, at the cost
   of every piece drawn at two sizes and checked at both. (B) The bars
   float, always 36: 26% bigger at exactly 1920×1080, but in a maximised
   browser on the same screen 3×, smaller than A. (C) The bars float,
   always 32: no bigger tile, the room up a step on most windows but not
   at exactly 1920×1080. (D) As now.
2. **The bottom corners.** (A, proposed) The terrace. (B) A garden: grass,
   a low hedge along the floor's front edges, a tree and a flower bed
   each side. (C) A deeper plinth (14 px), no scenery. (D) The terrace and
   the deeper plinth. (E) Only the street's pavement, as now but end to
   end.
3. **The floating bars' shape.** (A, proposed) As in the study: the status
   line a small pill top left, its buttons top right, the talk bar a
   glass bar across the bottom middle. (B) A full-width glass strip at the
   top and another at the bottom.
4. **Cats and people at 36-px tiles.** (A, proposed) They stay 24 and 32
   px, a little smaller in the bigger room. (B) Redrawn at 27 and 36 px,
   as a slice of its own after this one.
