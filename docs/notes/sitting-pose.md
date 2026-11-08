# Sitting, drawn sitting

The user's ask, 2026-11-08: "add sitting look for users. currently they look
like standing on things."

## What was wrong

The café already knew who was seated: `PersonView.sitting`, set by
`personSat` and cleared by any walk. The client didn't draw it. A seated
person got the standing frame, raised by `personLift` to the seat's top less
4 px, so they stood upright on the sofa, a chair or the window seat, with
their shoes on the cushion. On the floor cushion, 4 px tall and too low for
`standingOn`, they stood on the floor beside it. They also kept whatever
side they last walked with, so someone who came at a sofa up the screen sat
with their back to the room.

## What changed

Client only: no protocol or server change, and the server still decides who
sits where.

- **Two new frames** in `scripts/people.mjs`, written to
  `content/sprites/png/person/` and turned into `avatar.txt` by
  `scripts/sprites.ts`. Both keep the standing frame's head and shirt row
  for row (rows 0 to 16), so the face reads the same.
  - `sit`: hands on the knees, the lap a band below the shirt (row 19, the
    thighs coming toward the viewer), the knees apart, and the shins and
    shoes hanging, with a gap between them. 29 rows tall, against 32.
  - `sit_floor`: cross-legged, the knees out past the shirt, the shoes
    crossed in front. 23 rows tall.
- **`render.ts`**:
  - `seatOf` finds a seated person's seat: the café says they're sitting,
    they aren't walking, and a piece that seats people (any height, so the
    cushion counts) is under them. Its top comes from the piece's model, as
    before (`topAt`: the sofa's seat, not its back).
  - `personFrame` picks `sit`, or `sit_floor` on a seat lower than 6 px
    (the cushion's 4; a sitter's shins are 9).
  - A sitter faces front, unmirrored: every seat's model has its back at
    its far side, and no piece turns.
  - `personLift`, seated, puts the frame's lap row on the seat's top:
    `top - (30 - 19)`. That draws them 2 px lower than standing on the
    floor on the sofa, 3 on a chair, 1 higher on the window seat, and 7
    lower on the cushion. Speech bubbles take their height from
    `personLift`, so they follow the seated head.
  - A cat asleep on a lap (`lapOf`) was drawn at the seat's top, which put
    it over a seated face. It now takes `lapLift`: curled on the sitter's
    lap and hanging 3 rows over the knees, so its ears reach their chin.
  - Clicks find a sitter by the seated frame, where it's drawn.
- Someone up on a piece who isn't seated (none can be today) is drawn as
  before.

## Checked

- **Tests written first and seen failing.** In `client/test/render.test.ts`:
  "draws someone on the sofa, a chair or the window seat sitting" failed on
  `expected 'stand' to be 'sit'`; the cushion on `'stand'` for
  `'sit_floor'`; facing on `expected 'back' to be 'sit'` (they kept their
  back to the room); the lap on "lap drawn at 144, the seat's top at 151".
  The lap-cat test, added once sitters were lowered, failed on the cat's
  top level with the sitter's eyes (137), before `lapLift`. In
  `client/test/sheets.test.ts` the sheet had no `sit`. Three more passed
  before and after, as they should: someone standing in front of a seat
  stays standing; a sitter is picked by their face and legs; a seated
  speaker's bubble anchor is within 2 px of the head as drawn.
- **Two older tests changed what they said.** "says how high someone is
  drawn" and "sits someone on the sofa's seat" expected a seated person 5 px
  up, but their sofa didn't seat anyone (`seats: false` in the test's piece
  helper), so they passed by the standing path. They now seat on a sofa
  that seats, and expect -2. The standing case (5) is kept beside it. The
  lap draw-order test uses seats that seat too. `sprites.test.ts`'s list of
  frames gains the two seated ones.
- **The art:** the six existing frames' PNGs and grids are byte for byte
  unchanged; `cat.txt` is unchanged. The judging sheet
  `screens/slice-11/people-sheet.png` gains the two columns, for all four
  looks by day and by night.
- **Suites:** the client's 394 tests and both typechecks; `cargo fmt
  --check`, `cargo clippy --all-targets -D warnings`, and `cargo test` (359
  unit tests and every binary test; the content test now wants `sit` and
  `sit_floor` at 32 by 32).
- **In a browser,** against two local cafés from one server build on fresh
  databases: one serving `main`'s client (`8482519`), one this change's.
  [`screens/sitting-pose/shoot.mjs`](screens/sitting-pose/shoot.mjs) seats
  four visitors over the WebSocket, on the sofa, a chair, the window seat
  and the cushion, then shoots the room by day at 1920×1080 by mouse and at
  390×844 by touch. [`close.png`](screens/sitting-pose/close.png) has each
  sitter before (above) and after (below). Before, all four stand on their
  seats. After, they sit: shins over the sofa's and window seat's fronts,
  the chair's front leg showing between the shins, cross-legged on the
  cushion. A throwaway script, not kept, had a seated visitor speak: at
  both sizes the bubble sat just over their head, and a click (1920×1080)
  or a tap (390×844) on their face opened their menu ("Talk to …", "Give …
  a treat"), with the chair's actions after it, as before.
- **Not checked live yet:** it reaches the live café when merged to `main`
  and deployed.
