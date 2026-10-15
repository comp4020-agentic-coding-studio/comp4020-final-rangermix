# Brief: review of slice 07, "Getting in while the café wakes"

Slice 07, Task 6 ([plan-slice-07-waking.md](../plan-slice-07-waking.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 4e8b1b4 | tar -x -C <tmpdir>`), never in this
checkout. Don't use ports 8080, 18471, 18472 or 18473.

## What to read

- **The spec:** [`docs/slices/07-getting-in-while-the-cafe-wakes.md`](../../slices/07-getting-in-while-the-cafe-wakes.md),
  every "done when" line and how it's held.
- **The design:** `docs/design.md` ("Persistence and fast-forward": waking,
  failures; "Logging"; "Real-time"), ADR 0004, ADR 0006, and `AGENTS.md`'s
  "What the app must keep".
- **The plan** and its review focus; `docs/notes/slice-07-waking.md` for
  the judged check on the image.
- **The code:** commits `3e83d1d` (the server: `main.rs`'s `run` and
  `supervise`, `ws.rs`'s `connection` and `world_task`, `http.rs`'s
  `awake`, `ServerMsg::Waking`, `server/tests/waking.rs`), `bc72005` (the
  log check), `af4e548` (the client: `cafe.ts`, `main.ts`, `stage.ts`,
  `index.html`, `style.css`, and the browser checks in
  `spec/browser.test.ts`), and `fc086c6` (the cap cut to 3 days, now
  `replay_max_days`).

## Out of scope

The other slices' work, and anything earlier that this slice doesn't make
worse or lean on.

## What to look for

Whether each "done when" line is truly held, or only appears to be. Whether
the kept rules hold: the server decides (can anything be decided, or leak,
before the café is awake?), every action by keyboard, touch and mouse at
both sizes through a resize, and nothing said logged. And the conditions
most likely to break it:

- connections during the replay: many at once (the world's inbox holds
  1024), one that drops, a second tab, messages sent while waking (a
  bubble, a pet, Leave), a seat and the line at the window once it wakes;
- the stop signal at every moment: before the replay, during it, as it
  ends, after; whether the process exits in Fly's 5 seconds, and what the
  store holds after;
- the world task dying, or `wake` failing, while waking and while awake;
  whether a panic anywhere else is still loud; `exit(0)` skipping anything
  that needed to run;
- the client: the overlay over every layout and dialog, a reconnect during
  waking, the parked state and "said this visit", focus, the screen
  reader, reduced motion, the talk box and buttons while waking;
- the checks: can the integration test or the browser checks pass without
  the behaviour, or flake on a slow CI machine?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-07-findings.md`.
