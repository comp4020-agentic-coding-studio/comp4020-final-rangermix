# A new destination mid-step

The user's ask, 2026-11-07: "currently changing the move destination will
cause the walking animation to reset from the last cell the user is in. the
reset shouldn't occur; the current move to the next immediate cell should keep
going then continue to the new destination, which should fix this issue."

## What was wrong

A walk is sent once, as a path, a start time and a speed, and every client
draws it from those (design.md, "Real-time"). The client was doing what it was
told. The server was the cause.

Every new walk was routed from `walk_tile`, the tile last *reached* (the
walk's progress rounded down), and started at `now`. Partway through a step,
say halfway from (3, 10) to (4, 10), a new destination gave a walk that began
on (3, 10) at that moment. Every screen drew the walker back half a tile, then
walked that half again. People hit it through every walk they start mid-walk:
a click or tap somewhere new, walking to a cat or a piece to pet, grab, place
or sit, a bot's wander, and walking out after an unanswered "still there?".
Cats hit it the same way in `walk_cat`, when one on the move was called, went
to hide from a noisy room, or went to greet a friend at the door.

## What changed

- **`SetOff` in `server/src/world/mod.rs`** says where a new walk sets off. For
  someone standing, it is their tile. Partway through a step, it is the tile
  that step arrives at: the route to the new destination starts there. Its
  `walk` builds the walk sent to everyone. It is led by the step under way
  (the tile it left, then the tile it arrives at) and started earlier by the
  part of that step already walked, at the new walk's speed. So at `now` every
  client draws it exactly where the old walk had them, and it finishes the
  step before it turns. On a tile boundary nothing is under way, and the walk
  starts there at `now`, as before.
- **People:** `start_walk` takes a `SetOff`, through `person_set_off`. So
  `walk_to`, `approach` (pet, grab, place, sit), `bot_wander`, `walk_out` and
  `stand_up` all set off past the end of a step under way.
- **Cats:** `walk_cat` does the same. A cat with nowhere new to go finishes
  the step it is on and settles there; before, it snapped back and settled
  on the tile the step left.
- **`occupied` in `furniture.rs`** (where a piece can't go, because someone
  is standing or walking there) now finds a walker's place in their path by
  step count, through `walk_steps`. It used to search for their tile, and a
  walk that turns back crosses its first tile twice, (3, 10) → (4, 10) →
  (3, 10).
- **No protocol or client change:** `Walk` is as it was. The client's walk
  cycle runs off the wall clock, not `walk.start`, so a start set back by a
  fraction of a step doesn't change the frame anyone shows. The server
  decides where everyone is, as before; nothing a client says is trusted
  more than it was.

## Checked

- **`cargo test`, written first, seen failing:** five new tests in
  `server/src/world/people.rs` and one in `cat_life.rs` failed against the
  old code, each on the bug itself. For example, "drawn at (3.0, 10.0), not
  (3.5, 10.0)", and for Tora the cat, "(3.0, 8.0) vs (3.5, 8.0)". The sixth,
  on a tile boundary, passed before and after, as it should. They cover: a
  new destination mid-step; turning back mid-step; a new destination exactly
  on a tile; one that is the tile the step arrives at; heading for a piece
  mid-step (a grab); and a cat sent elsewhere mid-step. Each checks the new
  walk is drawn where the old one had the walker, and that it finishes the
  step first.
- **The whole Rust suite:** 355 unit tests and every binary test pass, and
  `cargo fmt --check` and `cargo clippy --all-targets -D warnings` are clean.
- **`spec/realtime.test.ts`,** "a new destination mid-step carries the walk on
  from where it is, not from the tile last reached", runs over the WebSocket
  against a running café. It walks along a clear run of floor, sends a new
  destination halfway through the second step, and checks three things: the
  new walk finishes that step; it puts you where the old walk did at a tenth,
  half and nine tenths of it; and it starts when that step did. Against a
  café built from unfixed `main` (`a78b32a`) it failed: the new walk started
  at (1, 12), not on the step's way to (2, 12). Against the fixed café it
  passed three runs in a row, and the whole `spec/` passed with it (105, plus
  this one; restart skipped, as it is without Docker). A first version
  wanted its start no earlier than the step's to the millisecond. A start is
  sent in whole milliseconds and a step is 333.3 ms, so it now allows 1 ms.
- **In a browser, by mouse at 1920×1080 and by touch at 390×844,** on a local
  café built from the fix. A throwaway Playwright script, not kept, did three
  things. It walked a fresh `agent_` visitor along clear floor by clicks or
  taps. It clicked or tapped a new destination halfway through the second
  step. And it rebuilt what the page drew, every 16 ms from 300 ms before the
  new walk came to 600 ms after, from the frames the page received, through
  the client's own `positionAt` on the welcome's clock. The largest move
  between two frames was 0.049 of a tile at both sizes; walking at 3 tiles a
  second covers 0.048 a frame. A snap back would have been about half a tile.
  When the new walk arrived, the old one had the walker at 10.350 and the new
  one at 10.349 (desktop), and at 6.380 and 6.379 (phone). Screens are
  [before and after](screens/walk-turns-mid-step/), 150 ms apart, at both
  sizes: the walker carries on the way they were going.
  - The script first chose tiles drawn under a tall piece's sprite (the
    sofa's back), or under another visitor. A tap there opens that sofa's or
    visitor's menu, as it should, so the script was changed to pick clear
    tiles; the café was right.
- **Not yet checked on the live café:** that waits on `main`'s deploy (CI
  deploys `main` once its checks pass).
