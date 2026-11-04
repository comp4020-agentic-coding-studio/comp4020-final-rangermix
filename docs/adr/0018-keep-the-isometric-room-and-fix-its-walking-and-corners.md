# 0018. Keep the isometric room, fix how people walk in it, and use its empty corners

- **Status:** Accepted
- **Date:** 2026-11-04

## Context

[ADR 0017](0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)
chose an isometric camera at 32-px tiles in Catppuccin-led colours. Slices
09 and 10 built the camera and the colours; slice 11, the art, hadn't
started. On 2026-11-04, living with the result, the user asked whether the
room's blur, the way people and cats shake as they walk, and the empty
corners round the room meant isometric wasn't working out, and whether a
top-down 3/4 camera like Stardew Valley's would suit the café better.

The judgement, with studies drawn from the café's own room and colours, is
[notes/art-style.md](../notes/art-style.md). What it found:

- **The blur is the canvas anti-aliasing its polygons**, not the camera or
  the scale: one two-colour diamond comes out in 4 colours, and a live
  frame in 763. It would follow the room into any camera.
- **The shake is three things.** Walkers face by the grid's x and have
  only a front view, so on two of the four directions they moonwalk, and
  always show their faces. Positions rounded to the room's pixels every
  frame step unevenly along a 2:1 diagonal: 12 of 60 frames a second don't
  move, and each other step is a 3-px jump at 3×. Layout B's follow-camera
  wobbles a pixel against the walker.
- **The corners are the diamond's shape:** about 40% of the room's frame
  is backdrop, whatever the art.
- **Density:** at 32-px tiles, 24-px cats get faces, chests and stripes;
  48 doubles the drawing and no longer fits a phone.
- **Top-down 3/4** fills the frame (6% empty against 42%) and is simpler
  to draw, but reads as the ordinary look the user left in October, and
  rebuilding slice 09 would spend days of the five left before the final
  submission (Mon 9 November 2026, 12:00).

## Options

**The camera.**

1. **Stay isometric, and fix what's wrong with it.** Keeps slice 09 and its
   checks; the blur, shake and corners are each fixed on their own.
2. **Switch to top-down 3/4.** A new camera, picking and browser checks,
   which is slice 09 again, and every sprite drawn for a new view. Uses
   the screen better, and walks run along the screen's axes.

**Walking.**

1. **Face where you go**, with back views: needed in either camera.
2. **Move in whole 2:1 steps** (2 px across, 1 down), so x and y always
   change together. Even, and every pixel stays on the room's grid, but
   steppy.
3. **Move by screen pixels:** the sprite's own pixels stay whole, but
   where it stands moves one screen pixel at a time. The smoothest. It
   gives up "every pixel on the room's grid" for figures in motion, and
   the follow-camera has to move the same way.

**The corners.**

1. **Leave them.**
2. **A diorama:** the floor given a thickness and the walls a top, set on
   a soft glow, so the space reads as framing.
3. **The street behind the café:** sky and towers by day, stars and lit
   windows by night, in the top corners.
4. **The panels float over the room,** in the corners by default, so the
   room grows from 3× to 4× at 1920×1080. The page's layout changes.

**Density.** 16, 24, 32 or 48-px tiles.

## Decision

The user chose, on 2026-11-04:

- We will **keep the isometric camera** (option 1) and **32-px tiles**, as
  ADR 0017 has them.
- We will have walkers **face where they go**, with a back view when they
  walk away, and **move by screen pixels** (walking options 1 and 3).
- We will use the corners **all three ways**:
  - **a diorama**, the floor with a thickness and the walls with a top;
  - **the street behind the café**, by day and by night, coloured by the
    Canberra hour's light like the room;
  - **panels that float over the room** on the desktop. Each panel is half
    see-through and can be dragged, and can be pinned. A pinned panel
    can't be moved or selected, except by its Unpin button, and a click
    or tap on it goes through to the café under it. An unpinned panel that
    hasn't changed for some seconds dims and grows more see-through.

The blur's fix, crisp edges with outlines or shadows, is a separate
decision: [ADR 0019](0019-draw-the-room-crisp-with-outlines-and-shadows.md),
proposed from the comparison the user asked for.

## Consequences

- **Slice 09 stands**, with its camera module, picking and browser checks.
  Nothing reaches the server or the protocol: walks, picking and every
  rule stay about tiles.
- **Walking changes in the client only.** `motion.ts` gives a direction on
  screen, not on the grid; sprites need a back view as well as a front
  one; figures are placed at screen resolution, so the room is no longer
  one canvas scaled up as a whole while anyone walks. The design's "the
  largest whole-number scale, so pixels stay crisp" still holds for every
  sprite's own pixels.
- **The page's desktop layout changes.** The panels stop taking columns,
  so the room fits at 4× at 1920×1080 instead of 3×. Panels over the room
  must not hide what's under them from the mouse, touch or keyboard: a
  pinned panel passes clicks through, and every action stays reachable at
  both sizes, as AGENTS.md asks. On a phone, layout B already floats its
  bars over the room; how the floating panels behave below 960 px is the
  slice's to settle.
- **The backdrop becomes part of the art**, in both lights, and is drawn
  as data like the rest.
- **Slice 11 (the art) waits** on the walking slice, since every sprite
  needs a back view.
- The slices that carry this out are proposed in
  [docs/notes/plan.md](../notes/plan.md).
- What would make us revisit it: the floating panels failing the browser
  checks at 1920×1080 in a way a pinned or dimmed panel can't fix, or
  screen-pixel movement making the browser checks that find a walker
  flaky.
