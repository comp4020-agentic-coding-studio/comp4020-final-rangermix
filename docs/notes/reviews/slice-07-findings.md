# Findings: review of slice 07

Brief: [slice-07-brief.md](slice-07-brief.md). Reviewed at `4e8b1b4`: the
slice's commits `3e83d1d` (server), `bc72005` (log check), `af4e548`
(client and browser checks), `fc086c6` (the 3-day cap), and the notes in
`4e8b1b4`. One reviewer, who didn't build the slice, read it cold. Every
reproduction ran in a throwaway copy made with `git archive 4e8b1b4`, never
in this checkout. The experiments named below were temporary edits in that
copy (two instrumented builds of `ws.rs` and one that panics the world
task, all reverted), Node and Playwright scripts outside the repo, and an
image built from the copy and run under `docker run --cpus=0.0625`. None of
them is in the repo. Servers ran on ports 18555 to 18561, each with its own
data directory. One slip: running `spec/check-logs.test.ts` once without
`APP_URL` let vitest's global setup send a single `GET /` to
localhost:8080. Nothing else touched that port. A long replay was made by stopping the server, setting
`saved_at` back with Python's sqlite3, and starting it again. The debug
binary, with a copy of `content/` whose `replay_max_days` was raised to 7,
replays a week in about 10.5 s. The image at baseline CPU replays three
days in 11 to 20 s.

Baseline in the copy: `cargo fmt --check` and `cargo clippy --all-targets
-- -D warnings` are clean. `cargo test` passed (296 unit tests, 1 ignored,
`tests/waking.rs` 2, `tests/wont_open.rs` 1). `pnpm typecheck` and
`pnpm -C client check` passed (89 client tests). `spec/check-logs.test.ts`
passed. The two new browser checks passed against the copy's release
server.

1 major, 10 minor.

## Findings

### 1. Major: a Leave sent while the café wakes is thrown away, and the seat is held for 30 seconds after it wakes

- Where: server/src/ws.rs:60-67 (the Join puts the connection in `conns`
  and delivers the welcome); :114-137 (`route`: a welcome that can't be
  delivered removes the connection and the world hears `Drop`, which starts
  the grace period); :75-76 (a `Msg` from a connection that isn't in
  `conns` is ignored); :248 (the closed connection's `Leave` comes after
  that). On the client: client/src/main.ts:324-328 and
  client/src/cafe.ts:94-99 (Leave sends `leave`, then closes the socket
  after 100 ms).
- Scenario: a visitor opens the café during a replay and sees "Dusting off
  the café…". They give up and press Leave, which sends `leave` and closes
  the socket. Both wait in the world's inbox behind the Join, as the spec
  says they should. When the café wakes, the Join goes first. By then the
  connection task has ended, so delivering the welcome fails. `route`
  removes the connection and calls `Drop`, which keeps the seat for
  `grace_secs`. The queued `leave` then finds no connection in `conns` and
  is ignored. The visitor's page says "You've left the café". Everyone else
  sees them walk in and stand there, and they hold a seat for 30 seconds,
  which can send a real visitor to the window. Every other message a closing
  page sent while waking is lost the same way. This breaks the spec's rule
  that "a client message sent while waking waits its turn behind the join".
  It also contradicts the plan's review focus 1, that "its `Leave` queues
  behind its `Join`, so the seat isn't held after waking".
- Reproduced in the copy (debug binary, a week asleep, Node probes): the
  leaver sent `leave` at +312 ms and closed at +413 ms. After `woke`, the
  log has `arrive` for the leaver, and a watcher's welcome lists the leaver
  inside. `personLeft` for the leaver came 30 s later, logged as
  `"what":"leave","why":"timed out"`.
- Test: not caught. `tests/waking.rs` sends nothing during the replay. A
  test that opens a socket mid-replay, sends `leave`, closes it, then
  connects a second account after `woke` and expects the leaver absent from
  its welcome would catch it.
- One way to fix it: when the Join's own welcome can't be delivered, still
  apply the messages queued behind it from that connection, or at least a
  `leave`. Another: have the connection task send a `Leave` that frees the
  seat at once when it closes before it was ever welcomed.

### 2. Minor: a stop during the replay doesn't stop the replay. With requests in flight at baseline CPU it overruns Fly's 5 seconds, and the café can wake behind it

- Where: server/src/main.rs:78-90 (`save_on_stop` checks `awake` once, when
  the signal comes, and then the graceful shutdown waits for in-flight
  requests); :67-77 (nothing tells the replay or the world task to stop).
- Scenario: Fly stops the machine during a replay while a visitor is
  signing up or logging in. The graceful shutdown waits for the argon2 hash.
  Meanwhile the replay thread keeps taking the CPU share, so the hash takes
  about twice as long as it would on an awake café. If the replay ends
  first, the café wakes behind the shutdown. Its save replaces the one the
  log line said "stands", it logs `woke`, and it welcomes waiting sockets
  into a café that exits a moment later.
- Reproduced on the image under `--cpus=0.0625`, three days asleep, stop
  sent with `docker kill -s INT`:
  - One sign-up in flight: exit 3.3 s after the signal. The sign-up took
    5.2 s.
  - Four sign-ups in flight: exit 17.3 s after the signal. The sign-ups
    took 9.8 to 17.7 s. The same four on the awake café took 5.8 to 7.8 s,
    so part of this is older than the slice, and the replay roughly doubles
    it.
  - Three sign-ups sent 6 s into the replay, stop at 8 s: exit after
    12.5 s. The log runs `stopping while the café wakes: its last save
    stands`, then `woke` (`took_ms` 19798), then the waiting visitor's
    `arrive`, and the socket got its welcome 0.7 s before the process
    exited. `saved_at` afterwards was the replay's new save, not the old
    one.

  On Fly the kill at about 5 s cuts all of this short. Each store job is
  one transaction, so what's on disk stays consistent either way.
- Test: not caught. The stop test in `tests/waking.rs:248-263` has nothing
  in flight and runs unthrottled. It also doesn't check the exit code.
- One way to fix it: when a stop comes while waking, exit as soon as the
  store is flushed, rather than drain the requests in flight. Or bound the
  graceful drain to well under 5 s.

### 3. Minor: the exit on a dead world skips the store flush, so a trust gain written just before it can be lost

- Where: server/src/main.rs:42-45 (`exit(1)` straight after `supervise`
  returns an error); :110-112 (`supervise` returns as soon as the world's
  handle ends).
- Scenario: a tick or a message panics the world task right after `fire`
  queued a write, such as a pet's trust gain in the same `handle`, or a
  piece placed a moment before. `main` logs and calls `exit(1)` while the
  store thread is still running that job, or before it starts it. SQLite
  rolls the transaction back, and the gain is gone. Design.md promises "A
  crash loses at most seconds of cat wandering, never a trust gain or a
  moved sofa". This exit is controlled, and the store is still alive, so a
  `store.flush().await` before `exit(1)` would keep that promise. The race
  in finding 2 ends with `exit(0)` after a world that ran unflushed, the
  same way.
- Found by reading. The window is about a millisecond, so not reproduced.
  End to end, a patched copy whose world task panics after 3 s exits 1 with
  two JSON error lines (`panicked`, then `stopping: the café can't go on`).
  That is right, apart from the missing flush.
- Test: not caught. The unit tests drive `supervise` with synthetic tasks
  only.

### 4. Minor: after a reconnect through waking, the carrying bar from before stays up, and "Add furniture" stays disabled

- Where: client/src/main.ts:218-236. While waking, `state` is null, so
  `inArms` becomes null and `wasCarrying` is set to null. `showArms` is
  skipped because `state` is null. After the welcome, `inArms` is still
  null, so nothing changes and `showArms` never runs again.
- Scenario: a visitor carrying a lamp loses the connection. The server puts
  the lamp back when the connection drops. The page reconnects to a waking
  café. When the café opens, the header still says "Carrying the lamp.
  Choose where it goes.", with "Put it back" and "Put it away" showing and
  "Add furniture" disabled ("Your arms are full."). "Put it back" gets
  "You aren't carrying anything." The bar stays until the visitor next
  picks something up. Before this slice, `state` never went null across a
  reconnect, so the welcome's empty hands hid the bar.
- Reproduced with Playwright at 1920×1080 against the copy's server,
  through `routeWebSocket`: the first socket passes through, the page
  takes a lamp, the socket is closed, and the reconnect is told `waking`
  with the real frames held back for 3 s. After the welcome the bar is
  visible, `#add-furniture` is disabled, and the toast says "You aren't
  carrying anything.".
- Test: not caught. Neither waking check carries anything into the
  reconnect.

### 5. Minor: the page still sends actions while the café wakes, through the talk box, the emotes, and a menu that stays open above the overlay

- Where:
  - client/src/talk.ts:57-64 (only `isOpen()` is checked).
  - client/src/main.ts:77-79 (the emote buttons).
  - client/src/cafe.ts:131-138 (on `waking`, nothing closes an open menu or
    the board).
  - client/src/main.ts:285-297 (the waking branch empties the panels and
    the board's lines but leaves the board open).
  - client/src/style.css:95 (`.waking` at z-index 1) against :136
    (`.menu` at z-index 2) and :126 (`.board` at 6).
- Scenario, the talk box: during the replay a visitor types "typed while
  dusting" and presses Enter. The box clears with no feedback, and `say`
  goes to the server, which queues it and says it the moment the café wakes,
  to whoever is inside by then, in a room the speaker never saw. An emote
  goes the same way. The spec says "there's nothing to do while waking",
  and puts "any action during the replay" out of the slice.
- Scenario, a menu: a visitor has the plant's menu open when the connection
  drops, and the reconnect lands on a waking café. "Plant / Move the plant"
  stays on screen over "Dusting off the café…", with the focus on its
  button. `elementFromPoint` there returns the menu, not the overlay.
  Clicking it sends `grab {id: 3}` during waking. That runs after the Join
  against a world that hands out furniture ids afresh on each start
  (spec/restart.test.ts:16), so it can pick up a different piece from the
  one shown. An open board stays open the same way, with its lines emptied.
- Reproduced with Playwright against the copy's server. Talk box: the box
  read `""` with the overlay up, and the page had sent `say` and `emote`
  frames. "Said this visit" showed the line after the welcome. Menu:
  screenshot of the menu over the overlay, then the click and the `grab`
  frame. On the server side (debug binary, a week asleep), a `say` sent at
  +312 ms was delivered as `said` to everyone at +10.5 s, after `woke`.
- Test: not caught. The waking checks never type, tap or open anything.
- One fix covers all of it. While `cafe.waking`, have `Cafe.send` drop
  everything but `presence` and `here`, or disable the talk form and
  emotes. On `waking`, close any menu and the board.

### 6. Minor: if the server goes away while waking, the page says "Dusting off the café…" for ever, never "Reconnecting…"

- Where: client/src/cafe.ts:121 (`waking && !state` wins over the closed
  connection); :131-138 (`waking` is only cleared by a welcome).
- Scenario: a tab is told `waking`, then the server stops (a stop mid-replay,
  or the world can't wake and the process exits), or the machine never
  comes back. The socket closes and the reconnects fail. The status line
  and the overlay keep saying "Dusting off the café…", with the broom
  sweeping, as if all were well. Before this slice it read "Reconnecting to
  the café…".
- Reproduced with Playwright: the first socket said `waking` and closed
  after 1 s, and every later socket was closed at once. After 6 s and 4
  attempts, the status read "Dusting off the café…" and the overlay was
  showing.
- Test: not caught.

### 7. Minor: a screen reader hears nothing when the café opens after waking, and "You're walking into the café" is said before it exists

- Where: client/src/main.ts:329-332 (`announce("You're walking into the
  café.")` right after `cafe.start()`); client/src/cafe.ts:135 (`waking`
  announces); :139-152 (the welcome after waking announces nothing);
  main.ts:331 (the focus goes to the canvas, which the opaque overlay
  covers).
- Scenario: logged in during a replay, a screen-reader user hears "You're
  walking into the café." That line is replaced 16 ms later by "Dusting off
  the café…", so it's likely cut off. The overlay goes up to 15 s later at
  baseline CPU, and nothing tells the user. The status text isn't a live
  region, and the announcer still holds "Dusting off the café…". All that
  time the focus sits on the canvas under the overlay, where its focus ring
  can't be seen. One more thing, which I didn't check with a screen reader:
  `#waking` is itself `role="status"` with the same words. Some screen
  readers announce a live region when it's un-hidden, so the line may be
  heard twice, not "read once".
- Reproduced with Playwright: a MutationObserver on `#announcer` recorded
  only `[103 ms, "You're walking into the café."]` and `[119 ms, "Dusting off
  the café…"]` through the welcome at 4.4 s and 2.5 s after it.
  `document.activeElement` while waking was `room`.
- Test: not caught. The check reads the status text and `role="status"`,
  but not what's announced or when.

### 8. Minor: the log check fails a start that was stopped during its replay, which the slice made a normal outcome

- Where: scripts/check-logs.ts:37-40 and :58-59 (a `listening` with no
  `woke` before the next `listening`, or before the end, is a problem).
- Scenario: a start that's stopped mid-replay logs `listening`, then
  `stopping while the café wakes: its last save stands`, then exits 0, and
  the save is untouched. That's the designed behaviour. Pipe its log, and
  the next start's, through the check, and it reports "line 1 is a start
  that never logged its wake-up" and exits 1. It can't tell this from a
  start that hung or died. The spec's own line, "Every start logs
  `listening` and then `woke`", says the same. CI happens not to stop the
  app mid-replay today.
- Reproduced in the copy: a debug start stopped 1 s into a week's replay,
  then a full start, both logs through `node scripts/check-logs.ts`, exit
  1 with that message. A start whose wake fails (`chalkboard` table
  dropped) is flagged too, which is right.
- Test: not caught. `spec/check-logs.test.ts` has no stop-while-waking
  case. Accepting `stopping while the café wakes` as closing a start (and
  only that) would answer it.

### 9. Minor: the reduced-motion check passes without reduced motion when the runner is slow

- Where: spec/browser.test.ts:605-620, in particular :617. `getAnimations()`
  is counted for the whole document, after three resizes, with nothing
  checking that the overlay is still up. Once the 4 s hold ends, `#waking`
  is `display: none`, so it has no animations, whatever the CSS says.
- Scenario: on a slow CI machine the resizes outlast the hold. The check
  reads 0 animations from a hidden overlay and passes, even with the
  `prefers-reduced-motion` rule gone.
- Reproduced in the copy. With the rule removed from the built CSS, the
  check as written fails ("expected 5 to be +0"), which is good. The same
  check with a 4.5 s wait before :617, standing in for a slow runner,
  passes. Assert `#waking` is visible right before counting, and count
  `#waking`'s own animations (`getAnimations({ subtree: true })` on the
  element). That holds the line on any runner.
- Smaller things in the same checks:
  - "By touch" (:605) does nothing by touch.
  - The phone check doesn't look at the panels.
  - :599's `getAnimations()` counts the whole document. It's fine today,
    since nothing else animates.

### 10. Minor: under a flood of sockets while waking, many replaced sockets lose their "replaced" frame to a TCP reset

- Where: server/src/ws.rs:207-208 and :248. After the world lets go, the
  connection task returns and drops the socket without a close frame, while
  frames the client sent are still unread. The kernel answers with a reset,
  and the client can lose the last frames it hadn't read yet.
- Scenario: one account opens 150 sockets during the replay, each sending
  10 `here`. That's 1,650 commands against the 1,024-slot inbox, so the
  connection tasks stall on `send` and the client's frames pile up unread.
  The café wakes and handles them all in order. The instrumented build shows
  every `try_send(Replaced)` succeeding and every task ending on
  "rx closed" after a successful `sink.send`. Even so, a dozen or more of
  the 149 replaced sockets (12 and 18 in the two runs I counted) saw
  `welcome` then close code 1006, with no `replaced`. A
  browser tab in that state would reconnect and take the seat back. The
  same flood on an awake café lost 1 of 149. With 10 ordinary tabs during
  waking all 9 got `replaced`, so this is abuse-level. The mechanism is
  older than the slice, and the waking backlog makes it likelier.
- Reproduced in six of seven runs in the copy (Node flood script, two
  instrumented builds). Not caught by any test. Closing with a close frame, or reading
  what's left before dropping, would fix it. Low priority.

### 11. Minor: two records of the build don't match it

- Where: docs/notes/plan-slice-07-waking.md, "Execution log" (empty), and
  the spec's first three "done when" lines ("the built binary woken from a
  three-day gap").
- Two departures aren't logged:
  - The test woke the binary from a week, with the cap raised to 7 in a copy
    of `content/` (server/tests/waking.rs:11-25).
  - The panic line is held by unit tests on `supervise` with synthetic
    tasks (server/src/main.rs:142-168), not on the binary. Rewiring `run`
    so `world_task` ran detached would pass them, and bring back slice 01's
    dead café.

  I checked the wiring by hand (finding 3), and it holds today.
- Not a behaviour fault. AGENTS.md asks the plan to end with where the build
  departed from it.

## Checked and found sound

- **The doors open at once.** In `tests/waking.rs`, and on the image at
  baseline CPU, the page answered 0.1 s after the start. Sign-up works
  during the replay but is slowed by it (finding 2). A WebSocket opened
  mid-replay gets exactly `{"type":"waking"}` first, then the welcome after
  `woke`. Nothing of the café goes out before the welcome: the connection
  only sends `waking`, rate-limit errors and pings until the world has
  handled its Join. No HTTP route reads the world.
- **Order in the inbox.** `here`, `presence` and `say` sent while waking are
  handled after their Join, in order. Ten tabs of one account opened during
  waking each got `waking`, a welcome, and all but the last `replaced`.
  150 sockets overflowing the inbox stalled and then drained. The café
  woke and answered within 20 ms of `woke` (but see finding 10).
- **Stops.** A stop with nothing in flight exits within the test's 5 s,
  with `saved_at` untouched. An open WebSocket doesn't hold up the graceful
  shutdown, because upgraded connections aren't tracked. A stop while awake
  sends `Shutdown`, waits for the save, and flushes. A signal before the
  handler is first polled kills the process with nothing written. Store
  jobs are each one transaction, so `exit` mid-job leaves a consistent
  file.
- **Supervision.** A wake that fails after `listening` (a dropped
  `chalkboard` table) exits 1 with one `stopping: the café can't go on`
  line. A world that panics exits 1 (patched copy). Panics in connection
  tasks and handlers still log `panicked` and leave the process up, as
  before. The replay's own panic is still caught in `wake`. `wake` flushes
  the store before `awake` turns true. `spawn_blocking` with `block_on`
  keeps the replay off the runtime's workers. `exit(0)` is there to skip
  the runtime's wait for the replay thread, and on the stop paths it skips
  nothing else that has to run (apart from finding 2's race).
- **The client's waking state.** The overlay at 390×844, at 844×390, and in
  layout B on a phone has no sideways scroll. `said this visit` comes back
  from the parked state. Input with no state does nothing, and Tab leaves
  the canvas, so there's no focus trap. Reduced motion stops both
  animations. A reconnect that lands on `waking` again doesn't re-announce.
- **CI.** The restart spec still works with the new order: `answering()`
  now returns before the replay, but a 30 s gap replays in milliseconds,
  inside `Visitor.connect`'s 3 s wait for the welcome. Nothing in `spec/`
  assumes the first frame is the welcome.
- **The kept rules.** No bubble text in any new log line: refusals while
  waking log the action name, and a queued `say` logs its length only. The
  server decides everything, and nothing is decided before the world runs.
  Generated `ServerMsg.ts` matches the Rust type.
