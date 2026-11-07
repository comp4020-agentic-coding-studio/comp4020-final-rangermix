# Slice 18, "A balcony under the terrace": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed.

**Goal:** the café's terrace stands on a balcony: a deck of stone tiles in
the room's angle round the floor's two front edges, a glass balustrade 18
px high at its outer edges, and under it the café's own building carried
on down, storeys of windows, standing on the street. On the room's canvas
and the street's, so it runs to the window's edges.

**Approved:** the user, 2026-11-07: "1A but keep the deeper building edge
under the deck in consideration for now" (the glass, 18 px), then, after
the study's second round, "D" (the café's building below the balcony).

**Spec:** [`docs/slices/18-a-balcony-under-the-terrace.md`](../slices/18-a-balcony-under-the-terrace.md).
Written 2026-11-07 from `main` at `25f0c64`, on the branch
`slice-18-balcony` (another session is committing to `main`). Study:
[notes/slice-18-study.md](slice-18-study.md), its throwaway change
[spike.patch](screens/slice-18-study/spike.patch).

## Decisions made in this plan

1. **The balcony is content.** `content/street.toml` gains a `[deck]`
   table: `out` (tiles from the floor's left and front edges, 2.6), `slab`
   (its own slab's depth, 4 px), `rail` (the glass's height over the deck,
   18 px; 0 for none), `posts` (a post every this many tiles, 2), `glass`
   (how much the glass tints what's behind it, 0 to 1), `storey` (the
   building's storey, 56 px; 0 for no building) and `lit` (how many of its
   windows in ten are lit at night). A street with no `[deck]` draws no
   balcony, as before this slice. The client's reader (`street.ts`) reads
   it; the server's content test checks it, as it checks the rest of the
   file.
2. **Its colours are a new palette list, `balcony`**, written by
   `scripts/palettes.ts` like every other (palettes.json is never edited
   by hand): the deck's two stones, its slab's edge, the glass's tint, the
   rail's metal, a window dark and a window lit. By day the lit window is
   the dark one's colour, so windows light only toward night, as the
   room's window does, through the palette's blend. The building's wall,
   its bands and its frames are the room's own slots (3, 4 and 5), shaded
   as the room's blocks are: it's the café's wall carried on down.
3. **One backdrop for both canvases.** Today the room's floor layer draws
   the street, the street canvas draws the street again from the same
   `streetSlot`, and the terrace is drawn every frame over the room's
   canvas only. The balcony needs both canvases, and its glass needs to
   know what's behind it. So a new `backdrop(span, light)` in a new
   `client/src/backdrop.ts` returns a `Raster` of the street and the whole
   balcony (building, deck, terrace things, glass, rail) over any span of
   room pixels, cached by light, span and the street's content. The floor
   layer copies its room-sized span; the street canvas draws its wider
   span's runs. They're the same pixels, so they line up as the street
   does now. The terrace leaves the per-frame draw: it was drawn last only
   so it covered the street, and nothing in the room is drawn where it is
   (slice 16's render test holds that, and goes on holding it).
4. **The glass is a tint worked out per pixel**, not a see-through fill:
   each pixel inside a pane becomes what's behind it mixed toward the
   glass's colour by `glass`. Every pixel stays one solid colour (ADR
   0019), and a test can say exactly what each should be.
5. **`Raster` gains an origin**, so a context can draw a span that starts
   left of or above the room's canvas: `context(ox, oy)` takes room
   pixels, and the drawing helpers (`poly`, `block`, `outline`) work on it
   unchanged.
6. **No ADR.** This adds scenery inside the drawing ADR 0019 and ADR 0021
   already decided; it changes no stack, data, scope or workflow, and
   taking `[deck]` out of `street.toml` removes it.

## Tasks

1. **Content.** `[deck]` in `street.toml`, its reader, the `balcony`
   palette list. Tests first: `cargo test` (the deck's values in range;
   seven balcony colours by day and by night), the client's reader (reads
   `[deck]`; no `[deck]` is no balcony; a value out of range refused), and
   the palettes test (palettes.json is the script's).
2. **The backdrop.** `backdrop.ts` and `Raster`'s origin; the floor layer
   and the street canvas drawing from it; the terrace moved into it. Tests
   first: the backdrop over a wider span is the room's own span pixel for
   pixel; the terrace carries past the room's canvas; the floor layer's
   street is the backdrop's; slice 16's terrace tests, now through the
   backdrop.
3. **The deck.** Tests first: its tiles in both arms in the hour's light,
   each terrace thing's spot on it, its contact shadows; nothing of it
   over the floor, the walls or a figure's column (slice 16's test, the
   whole balcony switched off for the comparison); a browser check that
   at 1920×1080 the window's two bottom corners show the deck or the
   building past the room's canvas, lined up with it, by day and by night.
   The browser checks that read the window's foot or the room's bottom
   corners as the street (slices 13 and 16) are made to read the backdrop
   there instead, as the room's canvas and the street's agree.
4. **The glass balustrade.** Tests first: each pane's pixel is exactly
   what's behind it tinted; posts every two tiles and the handrail along
   the top in the rail's metal; the crisp test with the balcony drawn.
5. **The café's building.** Tests first: its pixels only on its two
   faces under the deck's outer edges, never over the deck, the rail or
   the room; windows lit here and there at night only; a browser check
   that a click or tap on the deck, the glass or the building does
   nothing.
6. **Screens** for the judged line in `docs/notes/screens/slice-18/` (by
   day and by night at 1920×1080, the phone's two layouts), `design.md`,
   the spec marked built.

## Execution log

Where the build departed from this plan, task by task.

- **Task 1.** As planned. The balcony's colours are a `balcony` list in
  `scripts/palettes.ts`, regenerated into palettes.json; by day its lit
  window is its dark one, so the building's windows light only toward
  night through the palette's blend, as the room's do.
- **Task 2.** As planned, with two things it brought. The room's shape
  helpers (`up`, `poly`, `block`, `outline`, `shade`) moved from
  `render.ts` into `shapes.ts`, unchanged, so the backdrop draws with the
  same ones. And slice 16's test that nothing of the terrace falls on the
  floor, the walls or a figure's place compared the room drawn with and
  without the terrace; with the terrace under the room that comparison
  could no longer fail, so it compares the backdrop with and without the
  terrace and the balcony instead, and was seen failing with a planter
  moved onto the floor. The backdrop keeps the last four spans it drew,
  so a resize doesn't keep every size it has seen.
- **Task 3.** As planned. The browser check reads the room's canvas and
  the street's under it at the same screen pixels; its first run found two
  pixels apart on the deck's top row, which was the check's own reader
  flooring 703.999… to the row above (`(704 / 1104) * 1104`), not the
  drawing: it now multiplies before it divides. With the deck taken out it
  fails (no deck beside the room's canvas). The whole `spec/` passes
  against a local café built from the branch.
- **Task 4.** As planned. The glass stands in front of the deck's outer
  tiles on screen and tints them, as in the study, so the deck's tests
  look at the deck with the rail off and leave the glass to the rail's
  own. The rail stands 0.08 tiles in from the deck's edge, so the slab's
  edge shows below it; posts are counted back from the floor's right end
  and down from the street wall's, with one at the corner. The contrast
  test's backgrounds now include every colour the glass makes of the
  palette's, which the panels' words keep 4.5:1 over.
