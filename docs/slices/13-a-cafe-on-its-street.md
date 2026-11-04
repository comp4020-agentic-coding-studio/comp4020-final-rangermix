# 13. A café on its street

- **Status:** Approved 2026-11-04, with the proposed defaults for its open questions (the same shadows by night; the street pans with the room)
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-13-street.md`
- **Design:** The client ("The look": the room is a diorama on its street;
  crisp, with outlines and shadows);
  [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md),
  [ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md);
  from [notes/art-style.md](../notes/art-style.md), sections 1b and 3

## Story

The café stops floating in the dark. It's a room with a floor you can see
the edge of, standing on its street: by day there's sky and the towers
across the road behind it, and at night the stars are out and the towers'
windows are lit. The corners round the room are the city, not a blank.
And the room is sharp: every edge crisp, each piece outlined against what's
behind it, the windows' light falling across the floor.

## In this slice

- **A diorama**: the floor drawn with a thickness, and the two walls with
  a top edge.
- **The street behind the café**: sky and towers by day; stars, a darker
  sky and lit windows by night; the pavement at the room's foot. Drawn
  from data in `content/` (an image or a description the client draws),
  and coloured by the same hour's light as the room, from
  `content/sprites/palettes.json`, blended in the evening as the room is.
- **The room drawn crisp** (ADR 0019): the floor, walls and furniture
  blocks drawn with no anti-aliasing, so every pixel is a palette colour,
  a shade of one, or an outline. They're redrawn here because this slice
  redraws the room's frame anyway.
- **A self outline**: a one-pixel line, the piece's own colour darkened,
  wherever a piece meets what's behind it.
- **Shadows cast from the windows**, through the panes, worked out from
  each piece's footprint and height when the furniture changes, and
  cached, not worked out every frame. Cats and people cast a small shadow
  away from the windows.
- **Ambient occlusion**: the floor darkened where it meets a wall or a
  piece's foot.

## Not in this slice

- Furniture art: slice 11. The blocks stay blocks, drawn crisp.
- Things moving in the street: cars, people walking past, weather.
- The floating panels: slice 14, though they float over this backdrop.

## Done when

| What must be true | Held by |
| --- | --- |
| The backdrop's colours come from the day and night palettes, blended as the room's are | client unit tests (`sprites`, `canberra`) |
| The street is data in `content/`, not code | `cargo test` (the content loader) |
| No pixel of the room is a colour outside its palettes, their shades, outlines and shadows: none is blended | client unit tests (the canvas read after a draw) |
| A piece's cast shadow falls away from the windows, through the panes, and moves when the piece does | client unit tests (the shadow worked out for a piece at two places) |
| Shadows are worked out when the furniture changes, not every frame | client unit tests (a draw with no furniture change reuses them) |
| The page draws the street by day at 10:00 and by night at 22:00 | browser check (the canvas's pixels, as slice 10's light check) |
| Nothing behind the room is clickable: a click on the street does nothing | browser check |
| The café reads as a sharp room on its street, by day and by night, at both sizes | judged: by the user, from screenshots at 10:00 and 22:00 at 1920×1080 and 390×844 |

## Rules it touches

- **Every action works at 390×844 and at 1920×1080:** the backdrop is
  behind everything and takes no input.
- **Cats change through `content/`, not code:** the street is data too.

## Numbers

- Day and night: morning from 6:00, afternoon from 12:00, evening from
  17:00, night from 21:00.

## Open questions

- **Which edges?** Settled 2026-11-04: option 9 of
  [the comparison](../notes/screens/art-style/1b-edges.png), crisp with a
  self outline, cast shadows and ambient occlusion (ADR 0019).
- **The shadows at night.** The windows are lit at night with the
  street's lamplight (slice 10), so the light still comes from them.
  Settled 2026-11-04, the default: the same shadows by night as by day,
  in the night palette, as in [the study's night picture](../notes/screens/art-style/1b-edges.png)
  the user chose from.
- **Does the street move with the phone's pan in layout B?** Settled
  2026-11-04, the default: yes, as part of the room, so it never slides
  against it.
