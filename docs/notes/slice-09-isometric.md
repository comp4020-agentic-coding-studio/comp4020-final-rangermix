# Slice 09: the room at an angle, live

[Slice 09](../slices/09-the-room-seen-at-an-angle.md),
[plan](plan-slice-09-isometric.md),
[findings](reviews/slice-09-findings.md).

## Merged and deployed (2026-10-21)

- **The merge's first CI run failed** (39584782567, `cc82175`): two
  browser checks, so the deploy was skipped and the live café stayed on
  the old build. Both reproduced on a fresh local café, as CI runs one:
  - "opens the board by tapping the chalkboard on a phone" timed out. A
    tap on the chalkboard opened the board as the finger lifted, then the
    click a phone sends after a tap landed on the backdrop now under the
    finger and closed it (the events: board shown, click on
    `#board-backdrop`, board hidden). Before the slice, the board's tile
    sat under the dialog itself, which hid it. The backdrop now closes the
    board only for a press that began on it.
  - "asks a cat by touch" found no still cat, having skipped cats on
    furniture, where a fresh café's cats nap. It now taps any still cat's
    sprite as high as the piece it's on.
  Fixed in
  [`0b0fddd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0b0fddd).
- **CI run 39586448040 passed** (rust, check, deploy), and the live café
  serves the slice's client (`index-CDEtGQ3O.js`).

## Checked live (2026-10-21, about 21:50 AEDT)

One short visit by `agent_58ab87`, a fresh password never written down
(ADR 0015):

- At 1920×1080 it went straight inside (1 of 6). The room is the 336×232
  canvas at 3× (1008 px), drawn at an angle
  ([screenshot](screens/slice-09/live-desktop-1920x1080.png)). The live
  café's furniture is where visitors left it: the cat tower front right,
  a box on the rug, the toys scattered. Tora napped up on the cushion,
  Burakku stood on the rug, Mochi sat near the front, each drawn on
  what they're on and in the right order.
- A click on the chalkboard, up the street wall, opened the board.
- On a 390×844 phone the same account opened in the bigger room (layout
  B, 1008 px), with no sideways scroll
  ([screenshot](screens/slice-09/live-phone-390x844.png)).
- No errors in the page.

Left: the judged line, "the room reads as a room you look into, with the
street wall at the back right, and nothing hidden that shouldn't be", is
the user's, from these screenshots and the ones beside them.
