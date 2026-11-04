# Slice 11, "Cats you can tell apart": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why:
> [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)
> (the agent draws PNGs at 24-px cats and 32 to 36-px people) and
> [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
> (32-px tiles kept; every sprite has a back view, from slice 12).

**Goal:** Mochi, Burakku and Tora each recognisably themselves at a
glance, by shape and markings as well as coat, in every pose they have;
people that look like people; furniture that reads as what it is,
standing and knocked over.

**The spec's settled order:** one cat first, judged by the user, then the
rest in its style, so a miss costs one cat's drawing. This plan's first
part ends at that judgement: Mochi in every pose, front and back, with the
sheet to judge from. Nothing else is drawn until the user has seen her.

**Spec:** [`docs/slices/11-cats-you-can-tell-apart.md`](../slices/11-cats-you-can-tell-apart.md).
Written 2026-11-05 as a draft while slice 14 is under review; it is
finished from the code as it stands when slice 14 is merged, and the
branch starts from `main` then.

## What the code does now

- `content/sprites/cat.txt`: one 16×16 sheet of palette slots for all
  three cats, `sit`, `walk_a`, `walk_b`, `nap` and the back views from
  slice 12. A cat differs from the others only by its coat's six colours
  (`coats.json`, through `palettes.json`).
- `client/src/sprites.ts` parses the text sheets and colours them per
  coat and light; `render.ts` picks a frame by pose (`nap`, walking or
  playing, else `sit`; eating, grooming and held sit).
- `server/src/content.rs` holds every frame at 16×16.
- The study's 24-px cats (`docs/notes/screens/art-style/scripts/study.html`,
  `catSit`, `catNap`, `catWalk`, `TWEAK`) are drawn from shapes per cat:
  Mochi rounder with a big white chest, Burakku slim with tall ears and a
  long tail, Tora striped.

## Decisions to settle in this plan

1. **PNGs as the source, text sheets as what's read.** As
   `palettes.json` is written by `scripts/palettes.ts` and a test holds it
   equal to the script's output, the PNGs in `content/sprites/png/` are
   the art anyone edits, and `scripts/sprites.ts` turns each into a grid
   of palette slots in the text format the client and `cargo test`
   already read. A test holds that each sheet is what the script makes of
   its PNGs, and that every pixel of a PNG is one of its palette's
   colours. No new decoder in the client or the server.
2. **A cat's look is data.** Each cat's file in `content/cats/` names its
   coat and its build (`round`, `slim`, `striped`): which variant of each
   frame it uses. The frames are drawn per build, once, and coloured per
   coat, so a new cat of an existing build is a data file, and a new build
   is a new set of PNGs, still data.
3. **Frames, at 24×24:** `sit`, `walk_a`, `walk_b`, `nap`, `eat`,
   `play_a`, `play_b`, `perch`, `held`, `lap`, `scratch`, `knock`, and back
   views of `sit` and the walk. Each pose the server sends, and each
   reaction that has its own pose (scratch, knock), picks its frame; a
   client test holds the frame for each.
4. **Placing the bigger sprites:** feet on the tile's centre as now; a
   sprite 24 wide stands 4 px further out each side, and its hit box grows
   with it. The browser checks that click a cat where it's drawn read its
   height from the sheet, not a constant.

## Part 1, to the user's judgement

- Task 1: the pipeline (`scripts/sprites.ts`, the test that the sheets
  are its output, `cargo test` reading 24-px cat frames).
- Task 2: Mochi, every frame, front and back, as PNGs; the client drawing
  24-px cats and choosing each pose's frame.
- Task 3: the sheet to judge from: every frame of Mochi at the desktop's
  and the phone's scales, by day and by night, in
  `docs/notes/screens/slice-11/`; asked of the user.

## Part 2, after the judgement

Burakku and Tora in Mochi's style; people at 32 to 36 px with their back
views; every piece of furniture standing and knocked over; the crit 8 and
phase 3 notes (the window seat, the cushion, a napping cat peeking out
from behind a person); then the review, merge, deploy and live check.

## Execution log

Where the build departed from this plan, as it happened.

- **Built in Mochi's style after the user approved her** (2026-11-05,
  03:53 AEDT). The draft's plan held: PNGs as the source of the text
  sheets (`scripts/sprites.ts`, a test that the sheets are its output),
  and a cat's build as data. Departures:
  - The cats and people are drawn by scripts from shapes, as the study's
    were (`scripts/cats.mjs`, `scripts/people.mjs`), not by hand; the PNGs
    they write are the art anyone may redraw.
  - **A coat is six slots, not about eight:** an outline, a base, a
    shade, a light, eyes and pink. White is the light, on Mochi.
  - **Furniture is boxes, not PNGs:** each kind's parts in
    `content/sprites/furniture-models.json`, so its shadows, picking and
    sorting stay exact (the plan's decision 4 had sprites; an isometric
    picture of a 2×2 tower can't cast or sort by its parts).
  - The study's sitting and sleeping cats faced left; turned to face
    right, as every frame must.
  - Knocking over shows its pose because the server now names the cat (a
    `knock` reaction), and a treat taken from a hand shows eating.
- **The review** (21 findings) is answered in
  [`reviews/slice-11-findings.md`](reviews/slice-11-findings.md).

