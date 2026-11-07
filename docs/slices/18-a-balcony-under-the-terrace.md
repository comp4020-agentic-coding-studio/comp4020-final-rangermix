# 18. A balcony under the terrace

- **Status:** Built 2026-11-07 ([plan](../notes/plan-slice-18-balcony.md), [screens](../notes/screens/slice-18/)); approved 2026-11-07: the glass 18 px high (question 1, A), and below the balcony the café's own building (question 2, D); proposed 2026-11-07 from the user's question of 2026-11-06, with a study ([notes](../notes/slice-18-study.md), [screens](../notes/screens/slice-18-study/))
- **Plan:** [`docs/notes/plan-slice-18-balcony.md`](../notes/plan-slice-18-balcony.md)
- **Design:** The client ("The room is a diorama on its street", "Crisp,
  with outlines and shadows");
  [ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)
  (crisp), [ADR 0021](../adr/0021-grow-the-floor-and-float-the-bars.md)
  (the terrace in the bottom corners); the study,
  [notes/slice-18-study.md](../notes/slice-18-study.md)

## Story

The café's terrace stands on its own balcony. Round the room's two front
edges there's a deck of light stone tiles, in the room's own angle, with
a glass balustrade at its edge, so the bench, the planters, the table and
its chairs and the lantern stand on something. The café reads as part of
the building it's in, as the user saw it, "a shopping centre or business
building": under the balcony the café's own building carries on down,
storeys of windows, standing on the street.

The user's question, 2026-11-06: "it looks like the stuff on terrace is
floating. how can we improve that? maybe some ground, or fencing? The
cafe feels like it belongs to a shopping centre or business building, so
maybe some balcony tiles with glass fence? what do you think"

The study's answer: they float because the street behind the room is a
flat backdrop, its pavement a level band across the screen, while the
terrace's things are drawn in the room's perspective; nothing under them
is. Ground on the room's own grid grounds them
([notes/slice-18-study.md](../notes/slice-18-study.md), section 1).

## In this slice

- **The deck**: an L of paving round the floor's left and front edges, as
  far out as `content/street.toml` says (2.6 tiles in the study), at the
  foot of the floor's slab: stone tiles in two tones, by day and by night,
  with its own thin slab under its outer edges, and a soft shadow under
  each terrace thing. Drawn on the room's canvas and the street's, so it
  runs to the window's edges as the street does.
- **The glass balustrade** at the deck's outer edges (question 1, A):
  glass panes 18 px high between posts every two tiles, with a handrail.
- **The café's building below the balcony** (question 2, D): its wall
  carried on down under the deck's outer edges in
  the room's colours and light, the balcony's shadow under its slab, and
  storeys of windows a tile apart, lit here and there at night; the
  street and the towers behind it as now.
- **It's all content**: `content/street.toml` gains a `[deck]` table (how
  far out, the rail's height, what shows below, the building's storey),
  its colours
  join the palette's slots by day and by night in
  `content/sprites/palettes.json`, and the terrace's things stay as they
  are, each standing on the deck.
- **The study's screens** made again from the slice's own code for the
  judged line.

## Not in this slice

- **A taller terrace.** The folded parasol and low lantern stay low:
  slice 16's review found anything tall out front stands over the floor's
  front tiles (its finding 2), and the deck doesn't change that.
- **A click or a walk onto the balcony.** It's scenery, as the terrace
  is: off the café's grid, not in the server's world.
- **The logged-out page's picture of the café.**

## Done when

| What must be true | Held by |
| --- | --- |
| The deck stands round the floor's two front edges in the room's angle, from `street.toml`, in the hour's light, and each terrace thing stands on it | client unit tests (the reader; the deck's pixels in both corners, by day and by night; each thing's spot inside the deck) |
| It runs to the window's edges: at 1920×1080 the window's two bottom corners show the deck or what's below the balcony, never the deck cut off at the room's canvas | a browser check (pixels sampled along the window's foot past the room's canvas) |
| The glass balustrade stands at the deck's outer edges, 18 px over the deck | client unit tests (its pixels at its height over the deck's edge) |
| Below the balcony the café's building shows, by day and by night: its two faces under the deck's outer edges, never over the deck, the rail or the room; its windows lit here and there only at night | client unit tests (the building's pixels under the deck's edges; none above them) |
| Nothing of the deck, the balustrade or the terrace falls on the floor, its walls, or where anyone standing on a tile is drawn | client unit tests (slice 16's test of the terrace over the real floor, with the deck and the balustrade in it) |
| It's drawn crisp: no shape the canvas would anti-alias, and the glass's every pixel one solid colour, what's behind it tinted | client unit tests (the crisp test with the balcony drawn; the glass's pixels the tint of what's behind them) |
| A click or tap on the deck or the balustrade does nothing | a browser check (neither walks nor opens a menu) |
| The panels' and bars' words keep 4.5:1 over anything the balcony shows behind them | client unit tests (`contrast`, the deck's and the glass's colours among what's behind) |
| The phone's layouts work as they did: A shows the whole room, B pans to every edge | the existing browser checks |
| It looks right: the balcony grounds the terrace, by day and by night, on a desktop and a phone | judged: the user, from screens in `docs/notes/screens/slice-18/` |

## Rules it touches

- **Every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use.** The balcony takes no input,
  but it's drawn on the street's canvas, which a resize redraws.
- **The server decides every outcome.** Nothing here reaches the server.
- **The door's walkway is never blocked.** The balcony is outside the
  room, off the grid.

## Numbers

- The deck: 2.6 tiles out from the floor's left and front edges, at the
  floor slab's foot (6 px under the floor), its own slab 4 px deep.
- The glass balustrade: 18 px over the deck (people are 32 px tall), posts
  every 2 tiles. Its handrail is about 27 room px below the floor's front
  and left edges on screen (the rail 2.52 tiles out is 40 px lower, less
  its 12 px over the floor's level and the handrail's second line), so
  it's clear of the floor and of anyone on it.
- The café's building: storeys 56 px apart (the
  room's wall is 56 px), a window a tile wide and 26 px tall in each,
  four in ten lit at night by a fixed pattern; drawn down past the
  window's foot.
- The study's 12-px glass, 7-px parapet and other things below are in
  its screens.

## Open questions

The study's first round, by day:
[compare-day.png](../notes/screens/slice-18-study/compare-day.png); by
night: [compare-night.png](../notes/screens/slice-18-study/compare-night.png);
the front corner close:
[compare-corner.png](../notes/screens/slice-18-study/compare-corner.png).
Its second round, what shows below the balcony, by day:
[below-day.png](../notes/screens/slice-18-study/below-day.png); by night:
[below-night.png](../notes/screens/slice-18-study/below-night.png).

Both answered.

1. **The balcony's edge.** Answered 2026-11-07: A, glass 18 px high,
   "but keep the deeper building edge under the deck in consideration for
   now". (B was glass at 12 px, C a 7-px parapet.)
2. **What's below the balcony.** Answered 2026-11-07: D, the café's
   building. The user, 2026-11-07, on the first
   round's city: "the city background make it a bit wierd or too
   'floaty'. can we try something between A and B? for example the
   building start to fade at the current street height, or something
   extending the cafe's wall, or something else." The second round shot
   three more ([notes](../notes/slice-18-study.md), section 5):
   - (D, chosen) **the café's building**: its wall carried on down under
     the balcony, storeys of windows lit here and there at night, the
     street behind as now. It extends the café's wall and is the deep
     edge kept: the balcony stands out from a building and the building
     on the street, so nothing floats. A storey and a half shows at
     1920×1080, in the bottom corners and under the talk bar.
   - (E) **the café's building with haze behind it**: D, with the towers
     behind fading into the sky below the street's height. The haze
     shows only past the building's corners and adds little.
   - (C) **the towers fading into haze** below the street's height, no
     building: the balcony gets sky under it and floats more.
   - (A) **the city**, the towers carried on below: turned down as too
     floaty.
   - (B) **the street's pavement**, as now: the café at street level.
