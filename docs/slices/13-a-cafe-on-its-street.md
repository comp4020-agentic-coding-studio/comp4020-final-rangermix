# 13. A café on its street

- **Status:** Proposed
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-13-street.md`
- **Design:** The client ("The look": the room is a diorama on its street);
  [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md),
  and [ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)
  once the user chooses; from [notes/art-style.md](../notes/art-style.md),
  sections 1b and 3

## Story

The café stops floating in the dark. It's a room with a floor you can see
the edge of, standing on its street: by day there's sky and the towers
across the road behind it, and at night the stars are out and the towers'
windows are lit. The corners round the room are the city, not a blank.

## In this slice

- **A diorama**: the floor drawn with a thickness, and the two walls with
  a top edge.
- **The street behind the café**: sky and towers by day; stars, a darker
  sky and lit windows by night; the pavement at the room's foot. Drawn
  from data in `content/` (an image or a description the client draws),
  and coloured by the same hour's light as the room, from
  `content/sprites/palettes.json`, blended in the evening as the room is.
- **The room's edges crisp**, if the user approves ADR 0019: the floor,
  walls and furniture blocks drawn without the canvas's anti-aliasing,
  with whichever outlines and shadows the user chooses. They're redrawn
  here because this slice redraws the room's frame anyway.

## Not in this slice

- Furniture art: slice 11. The blocks stay blocks, drawn crisp.
- Things moving in the street: cars, people walking past, weather.
- The floating panels: slice 14, though they float over this backdrop.

## Done when

| What must be true | Held by |
| --- | --- |
| The backdrop's colours come from the day and night palettes, blended as the room's are | client unit tests (`sprites`, `canberra`) |
| The street is data in `content/`, not code | `cargo test` (the content loader) |
| If ADR 0019 is approved: no pixel of the room is a colour outside its palettes, its shades and its outlines | client unit tests (the canvas read after a draw) |
| The page draws the street by day at 10:00 and by night at 22:00 | browser check (the canvas's pixels, as slice 10's light check) |
| Nothing behind the room is clickable: a click on the street does nothing | browser check |
| The café reads as a room on its street, by day and by night, at both sizes | judged: by the user, from screenshots at 10:00 and 22:00 at 1920×1080 and 390×844 |

## Rules it touches

- **Every action works at 390×844 and at 1920×1080:** the backdrop is
  behind everything and takes no input.
- **Cats change through `content/`, not code:** the street is data too.

## Numbers

- Day and night: morning from 6:00, afternoon from 12:00, evening from
  17:00, night from 21:00.

## Open questions

- **Which edges?** ADR 0019 is proposed, with option 9 (self outline, cast
  shadows and ambient occlusion) suggested and option 8 (self outline and
  blob shadows) as the smaller step. The user chooses from
  [the comparison](../notes/screens/art-style/1b-edges.png).
- **Does the street move with the phone's pan in layout B?** Proposed
  default: yes, as part of the room, so it never slides against it.
