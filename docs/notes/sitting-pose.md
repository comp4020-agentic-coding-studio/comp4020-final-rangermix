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
  - `seatUnder` (in `state.ts`) finds a seated person's seat: the café
    says they're sitting, they aren't walking, and a piece that seats
    people, standing (any height, so the cushion counts), is under them.
    `seatTop` takes its top from the piece's model, as before (`topAt`:
    the sofa's seat, not its back).
  - `personFrame` picks `sit`, or `sit_floor` on a seat lower than 6 px
    (the cushion's 4; a sitter's shins are 9).
  - A sitter faces front, unmirrored: every seat's model has its back at
    its far side, and no piece turns. The café's state keeps that as their
    side, so stood up where they sat they still face it (the review's
    finding 1, below).
  - `liftOn`, seated, puts the frame's lap row (read from the art, 19 in
    both) on the seat's top: `top - (FIGURE - 19)`, `FIGURE` being 30. That draws them 2 px lower than standing on the
    floor on the sofa, 3 on a chair, 1 higher on the window seat, and 7
    lower on the cushion. Speech bubbles take their height from
    `personLift`, which uses `liftOn`, so they follow the seated head.
  - A cat asleep on a lap (`lapOf`) was drawn at the seat's top, which put
    it over a seated face. It's now curled on the sitter's lap and hanging
    3 rows over the knees (the seat's top less `LAP_DRAPE`), so its ears
    reach their chin.
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
  top level with the sitter's eyes (137), before the lap cat was lowered. In
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

## Reviews, and what they changed

Two reviews, before the change was committed, and every finding fixed test
first, each new test seen failing before its fix.

The first, by `/code-review` on the staged diff, found seven:
[reviews/sitting-pose-findings.md](reviews/sitting-pose-findings.md), each
with its answer. In short:

1. **A sitter stood up where they sat turned their back to the room.**
   Taking a piece from the catalogue stands a sitter up with a walk of no
   steps (furniture.rs's `stand_up`), which gives no way to face, so they
   showed the side they walked up with. `state.ts`'s `faceOutIfSeated` now
   keeps "front" as the side of anyone seated on a seat, from `personSat`
   and from every welcome. The render test failed on
   `expected 'back' to be 'stand'`.
2. **A lap cat could float over a standing figure,** when `lapOf` named a
   sitter not drawn seated. It now takes the seat's top less its drape, or
   with no seat the piece's top, as any cat does. Failed on
   `expected 13 to be 9`.
3. to 6. **Tidied, no pixel moved:** each person's seat worked out once a
   frame (`seatTop`, `liftOn`); `LAP_ROW` read from the art; one `FIGURE`,
   from `PERSON` and `feetAt`'s `FEET`, that `stage.ts` imports; `seatOf`
   became `seatTop`, its top alone, and `lapLift` went. The existing lift,
   lap-cat, click and bubble tests pass unchanged.
7. **`shoot.mjs` signed up `sit…` accounts with a password written in
   it.** They are now `agent_s…`, with a random password made for each
   run.

The second, a fresh agent reading the fixes cold
([brief](reviews/sitting-pose-fixes-brief.md),
[findings](reviews/sitting-pose-fixes-findings.md)), drew 34 states with
the old and new code side by side and found only finding 2's intended
change. It found four more, each answered:

1. **Fix 1 missed a reconnect:** set only when the stand-up was seen, a
   viewer who missed it came back to the sitter's back. Hence
   `faceOutIfSeated` at the sit and at each welcome, held by two more
   state tests, both seen failing.
2. **No test held `seatUnder`'s toppled check:** the toppled case also
   didn't seat. It now seats and topples, and fails with the check deleted.
3. **`shoot.mjs` couldn't get past slice 20's door.** It now signs its
   viewer up through the API and walks in by the door, and its sitters
   leave and the browser closes whatever fails (a run that timed out
   showed it: all its visitors left).
4. **The first review's findings weren't in the repo,** and the notes
   numbered them 1 to 4. They are now, as numbered above.

Its nits: `lapRow` now looks only below the shirt, as it says; these notes
no longer name `seatOf` or `lapLift`.

**Checked after both:** the client's 437 tests and both typechecks;
`cargo fmt --check`, `cargo clippy --all-targets -D warnings` and
`cargo test` (362 unit tests and every binary test); and the whole `spec/`
(123 passed, `restart` skipped without `APP_RESTART`) against this tree's
build on a fresh local café on port 8093. Against the café already on 8080,
an old build from before slice 20, the browser specs timed out, as they
would for any change.

**The shots, retaken** on this tree's build, on a fresh local café, with
the fixed script: `after-*.png` and [`close.png`](screens/sitting-pose/close.png)
now show today's client, slice 20's door behind it; the four sitters sit as
before. The `before-*.png` shots are still `8482519`'s.
