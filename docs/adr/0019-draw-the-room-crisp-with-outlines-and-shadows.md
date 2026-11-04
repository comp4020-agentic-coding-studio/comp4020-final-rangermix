# 0019. Draw the room crisp, with outlines and shadows

- **Status:** Proposed
- **Date:** 2026-11-04

## Context

The live café looks blurred. The judgement in
[notes/art-style.md](../notes/art-style.md) found why: `render.ts` draws the
floor, walls and furniture blocks as canvas polygons, and a canvas
anti-aliases every polygon's edge. `imageSmoothingEnabled = false` affects
only scaled images, not shapes, so a two-colour diamond comes out in 4
colours, and a live frame in 763 where its flat areas use 37. Scaled 3×,
each blended pixel becomes a soft 3×3 smudge. Sprites drawn as images stay
crisp; slice 11 as written redraws sprites, not the floor and walls, so
the room would stay soft.

On 2026-11-04, choosing to stay isometric
([ADR 0018](0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)),
the user asked: "what if we add outlines and shadows for objects? try
render with each and combined". The comparison is section 1b of the study,
[screens/art-style/1b-edges.png](../notes/screens/art-style/1b-edges.png):
the same corner of the café drawn nine ways at 32-px tiles, shown at 3×,
lit from the street wall's windows at the screen's top left.

## Options

Counts are the colours in the whole room, by day.

1. **Soft, as now** (1,633 colours in the study). Every edge blurred.
2. **Soft, with outlines and cast shadows** (2,468). Outlines and shadows
   make shapes easier to tell apart, but every edge is still blended, the
   outlines included, so it reads as more detail under the same blur.
   Adding them doesn't fix the blur on its own.
3. **Crisp only** (115). Every pixel one colour. Sharp, but pieces of a
   similar colour run together: the chairs into the table, the box's faces
   into the floor.
4. **Crisp + self outline** (157): a one-pixel line, each piece's own
   colour darkened, where it meets what's behind it. Shapes separate, and
   the lines stay soft enough for Catppuccin's pastels.
5. **Crisp + one dark outline** (116). Separates shapes the most, but the
   same near-black line round every pastel piece is heavier than anything
   else in the room, the cats and people included.
6. **Crisp + blob shadows** (120): a patch under each piece. Grounds pieces
   on the floor; says nothing about where the light is.
7. **Crisp + cast shadows and ambient occlusion** (137): shadows thrown
   from the windows, light through the panes onto the floor, and the
   floor darkened where it meets a wall or a piece. The room gets a light
   source and depth.
8. **Crisp + self outline + blob shadows** (162).
9. **Crisp + self outline + cast shadows + ambient occlusion** (179).

What each costs: crisp edges mean drawing the floor and walls as tiles or
filling shapes pixel by pixel with no anti-aliasing, a change to
`render.ts`'s drawing and nothing else. Outlines and blob shadows go in
the art itself. Cast shadows are either drawn into each piece's sprite
for one light, or worked out from the pieces' footprints and heights each
time the furniture moves, since furniture moves. They'd be cached, not
drawn every frame. At night the light comes from the lamps, not the
windows, so cast shadows need a second direction or fade out.

## Decision

Proposed, for the user to choose from the comparison: **option 9**, crisp
edges with self outlines, shadows cast from the windows, and ambient
occlusion. Option 4 is the smaller step if the cast shadows cost too much:
crisp with self outlines, with blob shadows drawn into the art (option 8).

## Consequences

- **The floor and walls are redrawn crisp,** which slice 11 as written
  doesn't cover, so it joins the art slice or comes before it.
- **Outlines become part of every sprite's drawing,** as the study's
  selective outline: dark below and right, the shade colour on the lit
  rim.
- **Cast shadows follow the furniture,** worked out when a piece moves and
  cached, and fade or turn at night.
- **None of it reaches the server or the protocol.**
