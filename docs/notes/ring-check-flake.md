# The flaky ring check

The browser check "in the bigger room, keeps a keyboard-opened ring round a
cat well away from you" (`spec/browser.test.ts`) failed now and then in CI. It
turned `main` red and skipped the deploy, twice on pushes that changed only
docs. Investigated and fixed on 14 October 2026, in session `c232fad1`.

**Status:** fixed in the client by
[`4e54ca4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4e54ca4),
with a check that failed every time before it.

## What failed

| Run | Commit | Measured | Limit |
|---|---|---|---|
| 38237784333, 12 Oct | "Mark each crit in the prompt log, in place of each week" | 130.99 px | 72 px (1.5 tiles at 3×) |
| 38396585523, 13 Oct | "reflection & readme" | 116.99 px | 72 px |

The check tabs to a still cat at least 4 tiles from you, opens its ring with
Enter, and measures how far the ring's buttons' centre is from the cat's tile
on screen.

## What was ruled out

- **A stale tile.** The ring is anchored to a tile, not to the cat: `act()`
  in `client/src/main.ts` stores the pointer's tile as `ringTile`. When the
  check runs, that tile is the cat's `at` from the frames, the same tile the
  check measures against. If the cat walks off afterwards, the ring and the
  check both stay on the old tile.
- **The view snapping back to you.** `stage.holdStill` is set in the same key
  handler that opens the ring, before the next frame, so the room doesn't pan.
  If the room does pan, `moveRing` follows the tile.

## The cause

In layout B the view stops at the room's edges (`panOffset`), so a tile in the
room's outer column or bottom row sits near the screen's edge or the talk bar.
`ringPositions` keeps every button on screen and clear of the bars by sliding
the ring's centre inwards, up to its radius plus half a button (116 px for 2
to 4 buttons, 140 px for 6, 155 px for 7). The ring then sits off its tile,
with its buttons over the thing it is for.

The check fails whenever the cat it picks is lying against a wall. Four of
the six places cats nap are there: the cat tower at (0,1), the sofa at (0,5),
the cat bed at (0,7) and the box at (1,9). Both failing runs came after 21:00
in Canberra, the café's night, and the app's logs show the cats napping by
the walls:

- **13 Oct.** Tora was on the cat bed. A cat at (0,7) with 6 actions is
  116.99 px off, and a local probe reproduced that exact figure with Mochi
  napping there.
- **12 Oct.** Mochi was on the sofa. A cat at (0,5) with 7 actions (the
  cat's, plus "Sit on the sofa") gives 155 − 24 = 131. The new check, opening
  a ring on the sofa's end, failed with 130.9933038757166, the CI figure to
  every digit.

So the check was right and the client was wrong: design.md promises a ring
"around what you tapped", and finding 33 of phase 3's review asked for the
ring to circle its tile. Neither held by the walls. Touch rings had the same
fault, since they go through the same `act()`.

## The fix

While a ring is open in layout B, the room moves over, past its edge if it
must, by however far the ring would have slid. `ringCentre` (in `layout.ts`)
is the clamp, factored out of `ringPositions`. `ringSlide` (in `menu.ts`) is
how far the open ring had to move. `Stage.shiftBy` moves the room by that
much, in whole pixels so it stays crisp, and calls the pan hooks so the ring
re-centres on its tile. When the ring closes, the room pans back to following
you as before. A screenshot at the sofa's end showed the room 92 px to the
right, with the page's background in the strip, as above and below the room.

## Checks

- **New browser check,** "moves the room over so a ring fits round something
  by its edge". It opens a ring by keyboard on the sofa's end against the left
  wall, then asserts that the ring is within 1.5 tiles of the tile and that
  every button is on screen and clear of the bars. Before the fix, three runs
  failed with 296, 131 and 131 px. The 296 was Enter landing before the pan
  caught up with the pointer, which left the tile off screen; that is the same
  clamp. After the fix it passed on every run.
- **New unit test** for `ringCentre` in `client/test/layout.test.ts`. It
  failed first, with `ringCentre` not yet defined.
- **The original check** is unchanged apart from sharing the measuring
  helper. The 1.5-tile tolerance stays, and nothing waits on a cat's consent.
- **Locally, against a release build** on a fresh database:
  - the whole spec passes, 48 checks;
  - the browser file passed five times in a row;
  - the client's 77 tests pass;
  - `cargo test` passes all 250.

  A first full run against a debug build timed out on "lets a whole room on
  one network sign up at once", because ten argon2 hashes are slow unoptimised
  while `cargo test` compiles alongside. It passed against the release build,
  which matches CI's image.

## CI

The fix's own run (38516818790) was cancelled while queued, replaced by a
newer push from the slice 01 session sharing this checkout. The next run
(38517226967, on
[`1c1a1f3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1c1a1f3),
which contains the fix) passed all three jobs, including the deploy. All ten
browser checks passed, and the live page's script has `shiftBy`.

## Not done

- Rings near the top bar or the talk bar also move the room vertically now.
  That was checked in the probe at row 9, but no check holds it.
