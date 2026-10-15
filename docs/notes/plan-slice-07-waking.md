# Slice 07, "Getting in while the café wakes": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed and checked live (now with
> agent accounts, [ADR 0015](../adr/0015-let-agents-test-on-the-live-cafe-and-its-fly-app.md)).

**Goal:** the port opens at once. The page and the accounts API work while
the replay runs. A café page opened meanwhile shows "Dusting off the café…"
until its welcome.

**Architecture:** `main` opens the store, loads the content, makes the world
task's channel and an `awake` flag, and binds and serves straight away. A
background task runs `wake` on a blocking thread (the replay is CPU work),
sets `awake`, and runs the world task on the channel. A WebSocket that
connects while `awake` is false sends `ServerMsg::Waking {}` first. Its
`Join` waits in the channel, and the welcome comes when the world task
starts. `main` watches the background task, and if it ends with an error or
a panic it logs one JSON error line and exits 1. The client's `Cafe` notes
`waking`, and `main.ts` shows a waking overlay until the welcome.

**Spec:** [`docs/slices/07-getting-in-while-the-cafe-wakes.md`](../slices/07-getting-in-while-the-cafe-wakes.md).
Written 2026-10-15 from the code at `fc086c6`.

## Global constraints

- AGENTS.md's rules hold: the server decides, nothing said is logged,
  every action by keyboard, touch and mouse at both sizes through a resize,
  and generated TypeScript is never edited by hand.
- Slice 01's guarantees hold: the replay writes nothing until it ends,
  logs nothing, and catches its own panic. The store is flushed before
  `awake` turns true.
- Fly's stop gives about 5 seconds. A stop during the replay doesn't wait
  for it.
- fmt, clippy, `cargo test`, `pnpm typecheck`, `pnpm -C client check` and
  the spec pass before each push.

## Review focus

1. **A connection that drops during the replay**: its `Leave` queues behind
   its `Join`, so the seat isn't held after waking. (Task 1.)
2. **Messages a page sends while waking** (presence, "still here") wait
   behind the join and are handled in order after it. (Task 1.)
3. **A second tab during the replay**: both get `waking`, then the second
   replaces the first as usual. (Task 1, by the world's existing rule.)
4. **The overlay and a reconnect**: a tab that loses its socket during the
   replay reconnects to `waking` again, not to a stale café. (Task 2.)
5. **Stopping during the replay**: the process exits within the stop's grace,
   and the next start replays from the old save. (Task 1.)

## Decisions made in this plan

1. **Waking is a message, not a status code.** The socket opens as usual
   and says `waking`, so the client needs no new retry path. The welcome
   simply comes later.
2. **The replay runs on a blocking thread** (`spawn_blocking`, with
   `Handle::block_on(wake(..))`), so the runtime keeps serving pages and
   sign-ups on its workers meanwhile.
3. **The world task is supervised from `main`.** One `select!` over the
   server and the background task's handle: an error or a panic there is
   fatal. A world that stopped on the stop signal is not.
4. **A stop during waking doesn't wait for the world.** The save in the
   store is the one the replay started from, so the next start replays the
   same gap. `main` exits as soon as the server has shut down, without
   waiting for the replay's thread.
5. **The overlay** is HTML over the stage, with a CSS animation (a broom
   sweeping, dust rising), `role="status"`, and no animation under
   `prefers-reduced-motion`. The status line reads "Dusting off the café…".

## Tasks

### Task 1: Serve while the café wakes, and supervise the world

**Files:** `server/src/main.rs`, `server/src/ws.rs` (`spawn_world` gives way
to a channel made in `main`; `connection` sends `Waking`), `server/src/http.rs`
(`AppState.awake: Arc<AtomicBool>`), `server/src/protocol.rs`
(`ServerMsg::Waking {}`), `server/tests/waking.rs` (new), regenerated
`client/src/protocol/ServerMsg.ts`.

- [ ] Tests first. In `server/tests/waking.rs`, run the built binary once to
  create the database, stop it, set `saved_at` back three days with
  rusqlite, and start it again. While its log has no `woke` line:
  - `GET /` answers 200;
  - `POST /api/signup` makes an account and sets its session;
  - a raw WebSocket handshake with that cookie gets `{"type":"waking"}` as
    its first frame;
  - after `woke` is logged, the same socket gets the welcome.

  Then SIGINT a third start mid-replay: it exits within 5 s and `saved_at`
  is unchanged. In `main.rs`, `supervise` returns an error when the world
  task panics, and nothing when it stops after the server.
- [ ] Implement, then fmt, clippy, test, commit and push.

### Task 2: "Dusting off the café…"

**Files:** `client/src/cafe.ts` (`waking`, `onWaking`), `client/src/main.ts`,
`client/index.html` (`#waking` in the stage), `client/src/style.css`,
`spec/browser.test.ts`.

- [ ] Browser checks first, with Playwright's `routeWebSocket` sending
  `waking` and holding back the real welcome for two seconds:
  - the overlay shows "Dusting off the café…", the status line says so,
    no café state is drawn (no cats in the panel, nothing in who's here),
    and then it goes and the café comes;
  - the same at 390×844 by touch, through a resize, with no sideways
    scroll;
  - under `reducedMotion: "reduce"` the animation has no running
    animations.
- [ ] Implement, then `pnpm -C client check`, commit and push.

### Task 3: The log check's order

**Files:** `scripts/check-logs.ts`, `spec/check-logs.test.ts`.

- [ ] Tests first: `listening` then `woke` passes; a `listening` with no
  `woke` after it before the next `listening` (or the end) fails; a `woke`
  with no `listening` before it fails.
- [ ] Implement, commit and push.

### Task 4: Record it

design.md's "Waking", "Failures are loud" and "Logging"; slice 01's spec,
which notes it's superseded in part; the root plan.

### Task 5: Judged, on the image

On the image under `--cpus=0.0625` with `saved_at` set back three days, in
the in-app browser: the page answers at once, sign up, see the overlay,
then the café. Time it, take a screenshot, and record it in
`docs/notes/slice-07-waking.md`.

### Task 6: Fresh review, then deployed and checked live

A brief and findings files. Then on the live café with an agent account
(ADR 0015): a normal wake opens straight into the café, and a restart with
the machine stopped shows the page at once.

## Execution log

Where carrying out this plan departed from it, task by task, and why.

- **Task 1 (2026-10-15)** ([`3e83d1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3e83d1d)). The integration test
  wakes the binary from a week, with `replay_max_days` raised to 7 in a copy
  of `content/`, so a sign-up and a socket fit inside the replay on a slow
  machine. The panic line is held by unit tests on `supervise`, not on the
  binary. That `run` wires the world task through it is checked by
  reading, and by the reviewer's patched build.
- **Task 2** ([`af4e548`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/af4e548)). As planned. Playwright's
  `routeWebSocket` stands in for a slow replay in the browser checks.
- **Task 3** ([`bc72005`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bc72005)). As planned. It shipped in the same
  push as Task 1, since the new order would otherwise fail the log check.
- **Task 5** ([`4e8b1b4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4e8b1b4)). The first try missed the overlay:
  sign-up took longer than the 14.8-second replay. A reload during the
  second try's replay showed it.
- **Task 6, the review** ([findings](reviews/slice-07-findings.md)): 1 major
  finding (a Leave sent while waking was lost) and 10 minor. Answered in
  [`0f416e9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0f416e9), [`30bd6e9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/30bd6e9) and
  [`a4e986c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a4e986c).
  - The reconnect check first failed on a local artifact: the server had
    read its build id before the client was rebuilt, so the page reloaded
    once by design. With the server restarted it failed on the real fault
    against the old client, and passes with the fix.
- **Also, from the user's prompt:** the board's within-a-second check got a
  minute for the walk ([`bed8d9e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bed8d9e)).
