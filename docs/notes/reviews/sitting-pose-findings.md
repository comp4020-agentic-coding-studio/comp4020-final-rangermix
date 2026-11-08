# Findings: the sitting pose

The first review of the sitting pose ([notes](../sitting-pose.md)), run
2026-11-09 on the staged change before it was committed. It used Claude
Code's `/code-review` on the staged diff. It reported seven findings and no
brief file; this records them as reported, each with its answer. A second,
cold review of the answers is
[sitting-pose-fixes-findings.md](sitting-pose-fixes-findings.md).

Ruled out by the review: the furniture-restore path only runs at startup; a
seat can't be grabbed or toppled while someone sits on it; the server
refuses to let a seated person carry or hold anything, so `drawCarried` and
`drawHug` never get a negative lift. "Picks a sitter" leaves the window seat
out of its loop, but passes with it added.

## 1. A sitter stood up in place turned their back to the room

`client/src/render.ts`, `drawOrder`. A sitter faced front only while drawn,
and `state.facing` kept the side they walked up with. Someone who walked up
the screen to the sofa, sat, then took a piece from the catalogue was stood
up by the server's `stand_up` with a walk of no steps, and showed their back.

**Fixed.** `state.ts`'s `faceOutIfSeated` keeps "front" as the side of
anyone seated on a seat, from `personSat` and from every welcome. The
second review found the first fix, in `personMoved` only, missed a viewer
who reconnects. Held by render's "stands a sitter up where they sit facing
the way they sat" and state's "a sitter stood up where they sit faces the
way they sat" (five cases).

## 2. A lap cat could float over a standing figure

`client/src/render.ts`, `lapLift`. `lapOf` checks only sitting, the tile and
no walk; being drawn seated also needs a piece that seats and stands under
them. When they disagreed, the cat was lifted over a standing figure's chest.

**Fixed.** The lap cat takes the seat's top less its drape, or with no seat
the piece's top, as any cat does. Held by "naps a lap cat on the seat's top
when its sitter isn't drawn seated", which also holds `seatUnder`'s toppled
check (the second review's finding 2).

## 3. The same seat and position worked out three times a frame

`client/src/render.ts`, `drawOrder`, `personLift`, `lapLift`.

**Fixed.** `drawOrder` works out each person's seat once (`seatTop`) and
their lift from it (`liftOn`); the lap cat uses the seat in hand.
`personLift`, for the speech bubble, does the same work once.

## 4. `LAP_ROW = 19` copied a fact about the art

`client/src/render.ts`.

**Fixed.** `LAP_ROW` reads each seated frame's lap row from `avatar.txt`:
the first row below the shirt with trousers down its middle. Both are 19
today, so nothing moved.

## 5. `FIGURE_TOP = PERSON - 2` repeated `stage.ts`'s `FIGURE` and `feetAt`'s 2

`client/src/render.ts`, `client/src/stage.ts`.

**Fixed.** `render.ts` exports `FIGURE = PERSON - FEET`, with `FEET` the
offset `feetAt` uses; `stage.ts` imports it in place of its own 30.

## 6. `seatOf` returned a `piece` nobody read

`client/src/render.ts`.

**Fixed.** `seatTop` returns the seat's top alone. The lookup itself moved
to `state.ts` as `seatUnder`, which the facing fix shares.

## 7. `shoot.mjs` broke CLAUDE.md's rule for accounts

`docs/notes/screens/sitting-pose/shoot.mjs`. It signed up `sit…` accounts
with a password written in the file, and took any `APP_URL`, the live café
included. CLAUDE.md asks for `agent_` names and a fresh password never
written down.

**Fixed.** Accounts are `agent_s…`, with a random password made for each
run. The second review found the script no longer ran against the café
since slice 20's door (its finding 3); it now signs in through the API and
the door's Walk in, and its sitters leave whatever fails.
