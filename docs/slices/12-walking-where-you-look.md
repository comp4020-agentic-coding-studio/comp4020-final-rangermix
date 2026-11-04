# 12. Walking where you look

- **Status:** Built 2026-11-04 ([plan](../notes/plan-slice-12-walking.md), [screens](../notes/screens/slice-12/)); approved 2026-11-04, with the proposed default for its open question (standing still, a figure faces the way it last walked; someone arriving faces into the room)
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-12-walking.md`
- **Design:** The client ("The look": walkers face where they go);
  [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md),
  from [notes/art-style.md](../notes/art-style.md), section 2

## Story

Someone crossing the café walks the way they're going: walking toward the
street wall they show their back, walking toward you their face, turning
left or right as the path does. A cat trotting to the bowls does the same.
And they glide: on the room's diagonals they move evenly, one screen pixel
at a time, instead of stalling and jumping.

## In this slice

- **A direction on screen** from `motion.ts`: which way a walker is going
  as the camera shows it (up-left, up-right, down-left, down-right), not
  the grid's x. A walker who stops keeps the way they last faced.
- **A back view** for people and cats, walking and standing, as text grids
  in today's format beside the front view, so every walk away shows a
  back. Slice 11 redraws both at the new density.
- **Placed by screen pixels**: a walker's sprite is drawn at its exact
  position on screen, rounded to the screen's pixels, not the room's. Its
  own pixels stay whole and square. The room behind it is drawn as now.
- **The phone's follow-camera** (layout B) moves the same way, so the
  walker it follows stays still in the middle of the screen.
- **What it's built on**: the room, furniture and floor stay one canvas at
  the room's scale; walkers go on a layer over it at the screen's
  resolution, or the whole room is drawn at the screen's resolution. The
  plan chooses from the code.

## Not in this slice

- New sprites at the new density: slice 11. The back views here are at
  today's 16 px.
- Diagonal paths. The server's four-way paths stay; this is how they're
  drawn.
- Sideways views. Front and back, mirrored for left and right, are enough
  for an isometric camera.

## Done when

| What must be true | Held by |
| --- | --- |
| A step toward the street wall shows the walker's back; a step away from it, their face; left and right mirror as the path turns on screen | client unit tests (`motion`: the direction for each of the four steps) |
| A walker on a diagonal moves on screen every frame, by steps that differ from frame to frame by at most one screen pixel on either axis: even, never standing still then jumping. (Written first as "at most one screen pixel per frame", which no walk at 3 tiles a second can meet at 3×; corrected in the plan, decision 1.) | client unit tests (positions at 60 frames a second at 3×) |
| In layout B the walker the camera follows stays within a pixel of the screen's middle while walking | client unit tests (`layout`) |
| Every sprite the client draws has a front and a back view | `cargo test` (the content loader) |
| The browser checks that click a walker or a tile still pass at 390×844 and 1920×1080 | `spec/` |
| Walks read as walking, not shaking, at both sizes | judged: by the user, live, by watching a cat and a person cross the room |

## Rules it touches

- **Every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080:** clicking a walker must still find them where they're drawn.
- **Cats change through `content/`, not code:** the back views are data.

## Numbers

- Walking speed: people 3 tiles a second, cats 2 (`content/tuning.toml`).

## Open questions

- **Standing still, which way does a figure face?** Settled 2026-11-04,
  the default: the way they last walked. Someone who arrives faces into
  the room.
