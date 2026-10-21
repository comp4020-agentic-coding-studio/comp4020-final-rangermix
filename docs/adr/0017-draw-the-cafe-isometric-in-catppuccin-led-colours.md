# 0017. Draw the café isometric, at 32-px tiles, in Catppuccin-led colours

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

The café is drawn as a 16-px top-down room: a 12 by 10 grid seen square-on,
lit evenly, with sprites typed as text grids of palette slots in
`content/sprites/` and a grey wash over everything after 21:00
(`client/src/canberra.ts`). On 2026-10-17 the user called the look "a bit...
normal, not standing out" and asked for a judgement on three changes: take
[Catppuccin](https://catppuccin.com/)'s colours, refine the pixel art, and
view the café from an angle like Neko Atsume's yard or Hades' rooms.

The judgement, with studies rendered from `content/`, is
[notes/visual-direction.md](../notes/visual-direction.md). What it found:

- Catppuccin has no brown, so a room snapped to its 26 colours loses its
  wood. Used as a source, its hues as anchors with browns mixed from its
  peach and rosewater, it keeps the warmth. A recolour alone still looked
  ordinary: most of the plainness comes from the flat, square-on drawing.
- At 16 px a cat is a silhouette. At 24 px it gets a face, markings and
  poses that read; at 32 px it crowds the people.
- Hades is a true 2:1 isometric grid, and Neko Atsume is one picture with
  spots placed on it. The café is already a tile grid that people, cats,
  furniture and the keyboard pointer move on, so only isometric keeps it.
- The isometric room at 32-px tiles is 336 by 232 px. It fits the desktop at
  3×, but the phone's layout A only at 1×.

Every rule in `docs/design.md` is about tiles, not pixels, so none of this
reaches the server or the protocol. It reaches every sprite, the renderer,
picking, and the browser checks that tap tiles by fractions of the canvas.
The final submission is Mon 9 November 2026, and the art is the long part.

## Options

**The look.**

1. **Keep the 16-px top-down room, and redraw what doesn't read** (slice 05
   as first written). The least work and no risk to the checks, but the
   user's complaint stands: the study shows the plainness is the drawing.
2. **Recolour only, Catppuccin-led.** A day and a night palette instead of
   the grey wash, and the name's reference made visible. Cheap, since every
   sprite is palette slots already, but on its own still "fairly ordinary".
3. **Recolour and redraw at 24-px cats, staying top-down.** Cats with faces
   and readable poses, no renderer change. Every sprite is redrawn once for a
   camera that still looks square-on.
4. **Isometric camera, 32-px tiles with 24-px cats, Catppuccin-led day and
   night palettes.** The room reads as a place you look into, the cats as
   themselves. The biggest client change since phase 1: a new renderer and
   picking, a new sprite pipeline, and all the art again.

**The phone, if the camera is angled.**

1. **Layout B by default**: the room at 3×, panned to follow you, with
   actions in a ring. Already built; layout A stays as the switch.
2. **Layout A at a fractional scale** (about 1.15×). Breaks "the largest
   whole-number scale", so pixels go uneven.
3. **A 16-px isometric room**, which fits A at 2× but is a lot of detail in
   very few pixels.

**Who draws the sprites.**

1. **The agent**, as PNGs, the way the density study's cats were built.
2. **A licensed pack**, if one fits the angle and size, credited in the
   README and recoloured to the palette.
3. **The user, by hand**, with placeholders until they're ready.

**The page around the room.** Catppuccin Latte for the light theme and
Mocha for the dark, or leave the page as it is and change only the room.

## Decision

The user chose, on 2026-10-21, the judgement's suggestion on every count:

- We will draw the café in a **2:1 isometric camera** on the same 12 by 10
  grid, with **32-px tiles** (a 32×16 diamond), **cats about 24 px** and
  **people about 32 to 36 px tall**.
- We will colour it **Catppuccin-led**: Mocha's pastels for cloth, cats and
  accents on wood mixed from its peach and rosewater, and a **night palette**
  pulled toward Mocha's dark base with the window lit, in place of the grey
  wash.
- We will make **layout B the phone's default**, with layout A as the switch.
- **The agent draws the sprites**, as PNGs in `content/sprites/` that the
  client turns into palette slots, judged by the user from screenshots.
- **The page follows Catppuccin**: Latte for the light theme, Mocha for the
  dark, with Latte's mauve for links and buttons, since its peach and maroon
  are too light for text on its base.

It is built camera first, then the palette, then the art, as slices that
each leave the café working.

## Consequences

- **The server and the protocol don't change.** Walks, placement, the door's
  walkway, the cap and the chalkboard stay about tiles. The tile grid stays
  the model; the camera is only how the client draws it.
- **The client's drawing is rewritten.** `render.ts` draws diamonds and
  orders by `x + y`; `stage.ts`'s `tileToCss` and `cssToTile` become the
  isometric transform and its inverse, which bubbles, menus and the ring
  already go through. Toppled pieces need a lying-down sprite instead of a
  rotation, and the street wall becomes the back-right wall, with a new
  back-left one.
- **The browser checks need a way to find a tile on screen**, since tapping
  `box.width / 12` stops meaning a tile. The test page exposes the stage's
  transform for that.
- **The sprite format changes from text grids to PNGs**, and the content
  checks that hold every sprite at 16 px (`server/src/content.rs`) change
  with it. A cat is still a data file, and art is still data, so "cats
  change through `content/`, not code" holds.
- **The phone's first view is the room at 3×, not the whole room.** Someone
  who wants the whole room taps the switch once, and the choice is
  remembered as now.
- **Slice 05 is replaced** by the slices that carry this out. Redrawing the
  16-px sprites now would be thrown away.
- **It is a lot of work before Mon 9 November**, most of it the art. If the
  art runs late, the camera and palette slices still ship on their own, with
  plain sprites. What would make us revisit it: the isometric room failing
  the browser checks at 390×844 in a way layout B can't fix, or the art
  not reading at 24 px when judged.
