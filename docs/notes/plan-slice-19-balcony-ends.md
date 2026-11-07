# Slice 19, "The balcony ends with the café": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed.

**Goal:** the balcony, its glass and the café's building under it end
where the café's walls end, whatever the window's size. The glass turns
each end back to its wall, and the street shows beside the building, so
the café reads as its building's corner, cut out the way the room is.

**Approved:** the user, 2026-11-08: "1A 2A 3A". The balcony ends at the
café's walls, a fixed size (1A). Beside the building the street shows,
as now (2A). The glass turns both ends back to the walls (3A).

**Spec:** [`docs/slices/19-the-balcony-ends-with-the-cafe.md`](../slices/19-the-balcony-ends-with-the-cafe.md).
Written 2026-11-08 from `main` at `a6eea05`, on the branch
`slice-19-balcony-ends`. Study:
[notes/slice-19-study.md](slice-19-study.md), its throwaway change
[spike.patch](screens/slice-19-study/spike.patch).

## Where the code stands

`client/src/backdrop.ts` draws the street, the building, the deck, the
terrace and the glass as one `Raster` over any span of room pixels.
`reach(span, deck)` decides how far the balcony runs. It works out, from
the span's four corners, how far along each of the deck's edges the span
reaches, adds spare, and snaps to `REACH_STEP = 8` tiles from the floor's
corners. The building (`drawBuilding`), the deck (`drawDeck`) and the
glass (`drawRail`) each ask `reach` for their two ends, `back` (along the
left edge, from y = 1 backwards) and `right` (along the front, past
x = width). Posts are counted from the floor's corners, and windows by
their tile along each face, so the pixels already don't depend on where
the ends are. Only the extent does.

The checks that hold the run-on:

- `client/test/backdrop.test.ts`:
  - "the café's building under the balcony" has an `onFace` helper that
    lets the faces reach 40 tiles each way;
  - "the backdrop at one pixel" has three points "far up the street
    wall's line … where the deck's left arm runs on";
  - "the balcony reaching the window's edges at every window's shape"
    compares the street canvas's span with one far wider. It holds the
    backdrop the same over any span, which stays true, but its name and
    reason are the run-on's.
- `spec/balcony.test.ts`, "runs the balcony past the room's canvas on
  both sides to the window's edges":
  - each side of the room's canvas shows "the balcony or the building"
    (more than 5 points);
  - at the window's own edges, under the deck's outer line, nothing of
    the street.

  Both fail once the balcony ends at the walls, and both are what this
  slice turns round.
- `spec/fill.test.ts` and `spec/browser.test.ts` read the window's foot
  and the room's bottom corners point by point as the backdrop's own.
  They hold whatever the backdrop draws, so they stand as they are.
- `client/test/render.test.ts`:
  - "the bottom corners are what's under the balcony" compares with the
    backdrop, and stands;
  - "leaves every pixel the terrace and the balcony add uncovered by the
    floor's layer" holds the returns too, once they're drawn.

## Decisions made in this plan

1. **The ends are the walls' lines, fixed.** `reach` gives way to the
   floor's own corners: the left arm from y = 1 (the street wall's line)
   to the deck's outer corner, the front arm from the outer corner to
   x = width (the plain wall's line). It no longer takes a span, so every
   span draws the balcony to the same ends, and `REACH_STEP` and the
   span-corner sums go.
2. **The building ends with the deck**, at the same two lines, with a
   dark edge down each end in the wall's outline colour, as it has down
   its corner now. Its windows are kept whole inside its faces: a window
   whose tile would cross an end is trimmed, as one at the corner is now.
   Nothing past the ends: the street shows there (2A), drawn first, as
   now.
3. **The deck's slab and its edge line end at the walls too.** The deck's
   end, where its open side would face the wall, is closed by the glass's
   return (3A). The slab's two ends face away from the camera (−y on the
   left, +x at the front), so nothing of the slab is drawn there.
4. **The glass returns** run along y = 1 from the deck's outer edge back
   to x = 0 on the left, and along x = width from the front's outer edge
   back to y = height. They are drawn before the terrace's things, since
   those stand in front of them on screen. They tint what's behind them
   pixel by pixel as the front glass does, with the same handrail (metal,
   and a darker line over it) and a post at each wall. They stand the
   same 0.08 tiles in from the deck's outer edge as the front glass, so
   they meet it at its corner posts.
5. **No content changes.** `street.toml`'s `[deck]` keeps its values.
   Where the balcony ends is the café's walls, not a number to tune, so
   neither reader changes.
6. **The browser check is turned, not dropped.** At each end it now
   holds three things. Past the end, the street's canvas shows the
   street: every point sampled is the backdrop's own pixel and among the
   street's colours, found from the walls' lines through `tileAt`, not
   from the backdrop. Inside the end, the balcony shows. The seam between
   the two canvases still agrees. A balcony that ran on would fail the
   first, and one cut short of the wall would fail the second.
7. **No ADR.** This changes how far scenery inside slice 18's decision
   runs. It's no new stack, data, scope or workflow, and design.md's
   entry is edited in the same commit as the change.

## Tasks

1. **The ends, in the unit tests.** Tests first in `backdrop.test.ts`:
   - with the rail off, the deck's stone is just inside each end
     (y = 1.2 on the left arm, x = width − 0.2 at the front) and the
     street just past it (y = 0.6, x = width + 0.4);
   - the building's face just inside each end at a storey's height, and
     the street's own pixel just past it;
   - `onFace` bounded by the walls' lines, so a building pixel past
     either end fails "only on its two faces";
   - the one-pixel test's three far points (now past the left end)
     equal to the street's own slot there.

   Seen failing, then `reach` replaced by the walls' lines through the
   building, the deck and the glass.
2. **The building's end edges.** Tests first: a dark edge in the wall's
   outline colour down each end, from the slab to the span's foot, by day
   and by night. Then drawn.
3. **The glass returns.** Tests first, by day and by night:
   - along each return, half way up, each pixel is what's behind it
     tinted;
   - a post at each wall in the rail's metal, and the handrail along each
     return's top;
   - the crisp test with the returns in it;
   - the terrace's things over the returns where they overlap on screen.

   Then drawn.
4. **The browser check turned.** `spec/balcony.test.ts`'s first check
   turned to the ends at 2560×1080, 2560×540 and 1920×1080, by day and by
   night, seen failing against a café built from `main` and passing
   against the branch. Its click check takes the returns' points too. The
   whole `spec/` against a local café built from the branch.
5. **Cost.** A light turn at 1920×1080 and a ten-step drag-resize, the CPU
   slowed 4×, measured with slice 18's script against this branch and
   against `main`, written in the slice's notes.
6. **Screens and docs.** Screens for the judged line in
   `docs/notes/screens/slice-19/`: 2560×1080, 1920×1080 and the phone's
   two layouts, by day and by night, and both ends close. Also design.md's
   balcony entry, `street.toml`'s comment and the backdrop's header
   comment, and the spec marked built.

## Execution log

Where the build departed from this plan, task by task.
