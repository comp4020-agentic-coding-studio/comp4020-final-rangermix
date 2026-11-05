# 16. The café fills the window

- **Status:** Built 2026-11-06 ([plan](../notes/plan-slice-16-fill.md), [screens](../notes/screens/slice-16/)); approved 2026-11-06: the floor 13 by 12 at 4× (question 1, C), on the phone's layout A the room centred with its side corners cut a little; the terrace, the bars as in the study, cats and people as drawn (questions 2 to 4, A)
- **Plan:** [`docs/notes/plan-slice-16-fill.md`](../notes/plan-slice-16-fill.md)
- **Design:** The client ("Desktop (1920×1080)", "Drawing", "The look");
  [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
  (32-px tiles, the panels in the corners), which
  [ADR 0021](../adr/0021-grow-the-floor-and-float-the-bars.md),
  proposed, would amend; the study,
  [notes/slice-16-study.md](../notes/slice-16-study.md)

## Story

At the 1920×1080 the course marks at, the café is the whole window: the
street's sky and towers run edge to edge behind the room, the status and
talk bars float over it as the panels do, and the room itself is bigger.
There's more floor for people, cats and furniture, not bigger pixels. The
room's two bottom corners are the café's terrace, with a bench and
planters on one side and a table under an umbrella on the other.

The user's answer, 2026-11-06: "I was asking to increase the size of
room, from 9x12 to 10x13 or something else. try different size for both
3x and 4x zoom. keep the 32 px tiles." And on the viewport: "the course
explicitly asked for 1080p viewport instead of screen resolution, which
I think justifies the expansion." The course's marking environment
agrees: prototypes are marked at "1920×1080 --- desktop" and "390×844 ---
phone", and "Those are _viewports_, not monitor sizes"
([assessment, marking environment](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#marking-environment)).

## In this slice

- **A bigger floor** (the size is question 1), in `content/room.toml`: the
  street wall widened to match with more window panes, the door and the
  chalkboard after them, and the furniture spread over the new floor,
  with a few more pieces so it doesn't look bare. Tiles stay 32 px, cats
  24 and people 32.
- **The bars float on a desktop.** From 960 px wide, the status line sits
  as a small pill top left, its buttons top right, and the talk bar (the
  box, Say, the emotes, the treat button) as glass across the bottom
  middle, so the room has the window's whole height.
- **The street end to end.** The street's sky, towers, clouds, warm band,
  kerb and pavement are drawn across the whole window behind the room, by
  day and by night, at the room's scale. The page's own background no
  longer shows on a desktop, or in layout B as it pans.
- **The terrace in the bottom corners**, placed from the floor's size: the
  pavement round the café's slab as paving, a bench and two planters along
  its left side, a table under an umbrella, two chairs and a street lamp
  out front on the right, lit at night. Scenery: no click, no walk, not
  in the server's world. It's data in `content/street.toml`, drawn in the
  hour's light with the room's outlines.
- **A café that saved at the old size wakes at the new one.** Saved
  furniture keeps its spots, since the floor only grows. The new pieces
  are added if they fit. A cat saved at a spot that's now under a new
  piece moves to the nearest free floor.

## Not in this slice

- A bigger tile, or redrawn cats and people.
- The phone's layouts get the bigger floor too, since it's the one world,
  but no other change. In layout B at 3× the room pans as now. In layout
  A the room is shown at 1× and centred, its side corners cut by 5 px
  each at 390 px (the user, 2026-11-06: "on the phone put the camera at
  the central of the room. it's okay to hide a bit of the corner of the
  room for now").
- More than six inside: the cap is unchanged.
- The logged-out page's picture of the café.

## Done when

| What must be true | Held by |
| --- | --- |
| At 1920×1080 the room fits at the scale question 1 settles (4× or 3×) with the bars floating, and fills the window by the study's measure | browser check (the room's size on screen) and client unit tests (the room's size at 1× from the floor's) |
| Every rule about the floor holds at the new size: walking, the walkway, placing furniture, the cap, cats' spots | `cargo test` (the room's tests run on `content/room.toml` as it is) and the existing `spec/` checks |
| A café saved at 12×9 wakes at the new size with every piece and cat where it was, or a cat moved to free floor | `cargo test` (waking from a saved 12×9 world) |
| Clicks, taps, the keyboard's pointer, menus, bubbles, carrying and the drawn-under-the-pointer rule land on the right tiles | the browser checks that read tiles through `window.cafeRoom`, with their 336 and 1344 read from the client instead |
| The status line and its buttons, and the talk bar, float over the room on a desktop; every control works by keyboard, touch and mouse; no floor tile is wholly under either bar | browser checks |
| Their text and controls are 4.5:1 or better over anything the room and street can show behind them | client unit tests (`contrast`, as the panels') |
| The street covers the whole window behind the room by day and by night: no pixel of the page's own background shows at 1920×1080, or in layout B at 390×844 as it pans to each edge | browser checks (pixels sampled at the window's edges) |
| The terrace is drawn in both bottom corners from `content/street.toml`, in the hour's light; a click or tap on it does nothing | client unit tests (the reader) and a browser check (a click on the bench neither walks nor opens a menu) |
| The phone's layouts work at 390×844 with the bigger floor: A shows the whole room, B pans to every edge | the existing browser checks, at the new size |
| It looks right: the room's size, the bars over it, the street to the edges, the terrace, by day and by night | judged: the user, from screens in `docs/notes/screens/slice-16/` |

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

- Tiles 32 px across; cats 24 px and people 32 px.
- The room at 1×, for a floor `w` wide and `d` deep: (w + d) × 16 px across
  and (w + d) × 8 + 64 px high. Today, 12 by 9, it's 336×232.
- At 1920×1080 with the bars floating (8 px kept clear each side), a
  floor fits at 4× while w + d ≤ 25, and at 3× while w + d ≤ 35. The
  phone's layout A fits the room at 1× in 390 px while w + d ≤ 24.
- The cap stays six inside.

## Open questions

1. **The floor's size**, from the study's screens
   ([compare-day.png](../notes/screens/slice-16-floor/compare-day.png),
   [compare-night.png](../notes/screens/slice-16-floor/compare-night.png)):
   - (A, proposed) **12 by 12** (144 tiles, +33%) at 4×, 1536×1024: the
     biggest floor that fits both 4× at 1920×1080 and the phone's whole
     room at 1×; cats and people stay as big on screen as now. (13 by 12,
     156 tiles, is the biggest at 4× but 10 px too wide for a phone;
     see below.)
   - (B) **13 by 10** (130 tiles, +20%) at 4×, 1472×992, the user's
     example: a little room to spare at the bottom.
   - (C) **16 by 13** (208 tiles, +93%) at 3×, 1392×864: the room nearly
     twice as big, but everyone and everything in it three quarters the
     size on screen, as on a phone.
   - (D) **20 by 15** (300 tiles, +178%) at 3×, 1680×1032: the most that
     fits 3×; with six people and three cats it reads as empty.

   **On a phone** the room is one world, so it grows there too. Layout B
   (3×, panned) takes any size. Layout A shows the whole room at 1× in a
   390-px window, which a floor fits while w + d ≤ 24 (384 px). A (24, 384 px) and B (23, 368 px)
   fit. C and D are far over. 13 by 12 (sum 25)
   would be 10 px too wide, which is why A is 12 by 12.
