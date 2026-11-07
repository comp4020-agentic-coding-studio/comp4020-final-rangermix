# 19. The balcony ends with the café

- **Status:** Built 2026-11-08 ([plan](../notes/plan-slice-19-balcony-ends.md), [screens](../notes/screens/slice-19/)); approved 2026-11-08: "1A 2A 3A", the balcony ending at the
  café's walls, the street beside it as now, the glass turning both ends;
  planned ([plan](../notes/plan-slice-19-balcony-ends.md)); proposed
  2026-11-08 from the user's judgement of slice 18, with a study
  ([notes](../notes/slice-19-study.md), [screens](../notes/screens/slice-19-study/))
- **Plan:** [`docs/notes/plan-slice-19-balcony-ends.md`](../notes/plan-slice-19-balcony-ends.md)
- **Design:** The client ("The room is a diorama on its street", "The café
  is upstairs, on a balcony", "Crisp, with outlines and shadows");
  [ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)
  (crisp); slice 18's spec, [18](18-a-balcony-under-the-terrace.md); the
  study, [notes/slice-19-study.md](../notes/slice-19-study.md)

## Story

A visitor sees the café as one corner of its building, cut out the way
the room is. The balcony, its glass and the building under it end where
the café's walls end. The glass turns each end back to the wall, and
beside the building the street shows, as it does beside the walls above.
Nothing suggests the building runs on along the street, at any window
size.

The user, 2026-11-08, judging slice 18 on a wide window by night: "still
some issue: it looks like the balcony is extending to the whole
building, but it should just show the cafe corner, like we don't show
other part of the building. how do we make the infinite balcony and
building more make sense? maybe give the building a fixed size? or let
it fade? or something else? help me on this"

The study's answer: the room is a diorama, its walls cut away and its
floor ending at its corners, and the run-on balcony was the one thing
showing the building past them. It was the agent's own call in slice 18,
made to hide a cut edge. Ending the balcony and building at the café's
walls, a fixed size, treats the building as the walls are treated
([notes/slice-19-study.md](../notes/slice-19-study.md), sections 1 and 2).

## In this slice

The answers the user chose, 2026-11-08: "1A 2A 3A".

- **The balcony's ends at the café's walls** (question 1, A): the deck,
  the glass and the building under it end at the street wall's line
  (y = 1) on the left and the plain wall's line (x = width) at the front,
  whatever the window's size. The building's wall ends at the same two
  lines, with a dark edge down each.
- **The glass turns both ends** (question 3, A): a short run of glass
  with its handrail, from the deck's outer corner back to each wall, and
  a post at the wall. Drawn behind the terrace's things, tinting what's
  behind it pixel by pixel as the front glass does.
- **Beside the building, the street as now** (question 2, A): past each
  end the backdrop shows the street and its towers, as it does past the
  walls above.
- **Slice 18's run-on reach goes**: the reach worked out from the span's
  corners and stepped by `REACH_STEP` gives way to the walls' fixed lines.
  The backdrop draws the same over any span, as it does now, and checks
  that held it running to the window's edges are turned to hold it
  ending at the walls.
- **The screens** made again from the slice's own code for the judged
  line, at 2560×1080, 1920×1080 and on a phone, by day and by night.

## Not in this slice

- **A neighbouring building past the ends.** It would carry the café's
  line on, which is what the user asked to remove (the study, section 2).
- **The balcony's depth, glass or storeys.** They stay slice 18's.
- **The logged-out page's picture of the café.**

## Done when

| What must be true | Held by |
| --- | --- |
| The deck, the glass and the building end at the walls' lines, y = 1 on the left and x = width at the front, by day and by night: nothing of them past those lines, the street there instead | client unit tests (the backdrop's pixels either side of each end; the street's own pixels past it) |
| The ends don't depend on the window: the backdrop over a one-pixel span is the wide one's pixel there, and a narrow window and a wide one show the ends in the same places | client unit tests (slice 18's one-pixel test, kept, across both ends) |
| The glass turns each end back to its wall, 18 px over the deck, with its handrail and a post at the wall, and tints what's behind it, every pixel one solid colour | client unit tests (its pixels along each return, at its height; the crisp test with the returns drawn) |
| The building's wall ends at each line with a dark edge down it, and never shows over the deck, the glass or the room | client unit tests |
| Nothing of the balcony falls on the floor, its walls, or where anyone standing on a tile is drawn | client unit tests (slice 18's test, kept) |
| On the page, by day and by night, at 2560×1080, 2560×540 and 1920×1080: past each end the street's canvas shows the street, every point sampled being the backdrop's own, and the two canvases agree across the seam | a browser check (slice 18's `spec/balcony.test.ts`, its window-edge check turned to the ends) |
| A click or tap on the balcony, the returns included, does nothing | a browser check (slice 18's, kept) |
| The panels' and bars' words keep 4.5:1 over anything shown behind them | client unit tests (`contrast`) |
| A light turn at 1920×1080, with the CPU slowed 4×, takes no longer than slice 18's 108 to 114 ms | measured, as slice 18's was, and written in the slice's notes |
| The phone's layouts work as they did | the existing browser checks |
| It looks right: the café reads as its building's corner, by day and by night, on a wide window, a desktop and a phone | judged: the user, from screens in `docs/notes/screens/slice-19/` |

## Rules it touches

- **Every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use.** The balcony takes no input.
  It's drawn on the street's canvas, which a resize redraws, and after
  this slice the ends no longer move with the window's size.
- **The server decides every outcome.** Nothing here reaches the server.

## Numbers

- The ends: the street wall's line (y = 1) and the plain wall's line
  (x = width, 13 tiles), with the deck 2.6 tiles out as now. So each end's
  glass return is 2.6 tiles long.
- The returns: the front glass's 18 px, the same tint and handrail, a post
  at each wall.
- Everything else is slice 18's.

## Open questions

All three answered 2026-11-08: "1A 2A 3A".

The study's screens, by day:
[compare-day.png](../notes/screens/slice-19-study/compare-day.png); by
night: [compare-night.png](../notes/screens/slice-19-study/compare-night.png);
both ends close, by day and by night:
[compare-ends.png](../notes/screens/slice-19-study/compare-ends.png); the
phone: [compare-phone.png](../notes/screens/slice-19-study/compare-phone.png);
a tall window: [compare-tall.png](../notes/screens/slice-19-study/compare-tall.png).

1. **Where the balcony ends.** Answered: A.
   - (A) **At the café's walls, a fixed size**: the deck, glass and
     building end at the walls' two lines; the street beside them. The
     café is its building's corner, cut out as the room is, and it looks
     the same at any window size.
   - (B) **A fade**: run on 4 tiles past the walls, then dithered into the
     street. In the screens it reads as speckle, not distance, and still
     says the building goes on.
   - (C) **As live**: run on to the window's edges. The gallery the user
     objects to.
2. **What shows beside the building, past each end.** Answered: A.
   - (A) **The street, as now**: the skyline's foot and the pavement
     band, with the building standing in front. The least change, and
     never sky beside the building.
   - (B) **The city carried on down beside it**, as from a high floor:
     says "upstairs" more strongly, striking by night, busier by day. It
     would be a key in `street.toml`. Slice 18's study turned the city
     down under the balcony; here it shows only beside the building.
   - (C) **The city fading to sky** below the skyline's foot: sky beside
     the building, which floats.
3. **The glass at the ends.** Answered: A.
   - (A) **Turns both ends back to the walls**: a balcony closed on every
     side.
   - (B) **Stops open** at the deck's outer corner: reads as cut off.
