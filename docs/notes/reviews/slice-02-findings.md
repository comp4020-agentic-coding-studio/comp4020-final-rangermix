# Findings: review of slice 02

Brief: [slice-02-brief.md](slice-02-brief.md). Reviewed at `5166167`: the
slice's commits `11dbf30`, `857d7c8`, `8a893ed`, `53fa6af` and `b8a4800`,
and the docs in `33e742d`. One reviewer, who didn't build the slice, read it
cold. Every reproduction ran in a throwaway copy made with
`git archive 5166167`, never in this checkout. The experiments named below
were temporary tests or edits in that copy, or Playwright scripts outside
the repo, and none of them is in the repo.

Baseline in the copy: `cargo test -p cafe` passed (289 unit tests, 1
ignored, and the binary test), and `pnpm -C client test` passed (87 tests).
The TypeScript that `cargo test` regenerates was byte-for-byte what's
committed in `client/src/protocol/`. The browser checks were made against
the copy's server (`cargo run -p cafe`, its own port and data directory,
client built with `pnpm -C client build`), driven by Playwright from the
copy's `node_modules`.

1 major, 8 minor.

## Findings

### 1. Major: The board dialog isn't modal. A click or tap behind it opens a menu or ring underneath it, with the focus on a button nobody can see, and Escape stops closing it

- Where: client/index.html:109 (`role="dialog" aria-modal="true"`, with no
  backdrop and nothing made inert); client/src/main.ts:135-164
  (`showBoard`, the board's own `keydown`, and `act`, which doesn't check
  whether the board is open); client/src/input.ts:114-120 (`onPointer`
  still acts on the room); client/src/style.css:98 (the board at z-index 6)
  against :108 (`.menu` at z-index 2).
- Scenario, at 1920×1080 by mouse: open the board from its tile, then click
  the window seat's right-hand tile (3,1), which the board doesn't cover.
  The seat's menu opens, but entirely underneath the board:
  `elementFromPoint` at the middle of both "Move the window seat" and "Sit on
  the window seat" returns the board. The keyboard focus is on the hidden
  "Move the window seat", so Enter or Space picks the seat up without the
  visitor ever seeing the choice. Escape then closes the menu and gives the
  focus to the room, and the board stays open. A second Escape does nothing,
  because the board's Escape handler only listens on the board itself. From
  then on, only its Close button shuts it. A click on bare floor walks there
  with the board still open and the focus back on the room.
- Scenario, at 390×844 by touch in layout B: with the board open, a tap on
  the plant at (11,1) opens its ring ("Stand the plant up") underneath the
  board.
- Reproduced in the copy with Playwright (two scripts: the desktop menu and
  the layout B ring, plus Escape and focus after each). Screenshot of the
  desktop case: the board is on screen and the menu isn't.
- Test: Not caught. No browser check touches the room while the board is
  open. A check that opens the board, clicks a piece beside it, and expects
  the board to have closed first (or nothing to open) would catch it.
- Either fix answers it. Close the board on any pointer or key in the room,
  as `showBoard` already closes an open menu. Or make it modal for real: a
  backdrop that takes the click, and the rest of the page made `inert`
  while it's open.

### 2. Minor: The "still there?" nudge opens underneath an open board, so a visitor reading the board can lose their seat without seeing it

- Where: client/src/style.css:111 (`.still-there` at z-index 5) against :98
  (`.board` at z-index 6); client/src/main.ts:54-58 (`onStillThere` shows the
  nudge and focuses "I'm here", but leaves the board open).
- Scenario: someone has had the board open for ten minutes without touching
  anything (reading it, or watching the room beside it), and someone is
  waiting at the window. The nudge arrives. At 1920×1080 the board (416 px
  wide, from 108 px down) covers the nudge (352 px wide, from 216 px down)
  completely. A sighted mouse user sees only the board, and 60 seconds later
  they're walked out. The focus does move to the hidden "I'm here", and the
  text is announced, so keyboard and screen-reader users can still answer.
- Reproduced in the copy by unhiding `#still-there` with the board open:
  `elementFromPoint` at the nudge's middle and at "I'm here" both return the
  board. Screenshot taken.
- Test: Not caught. No check raises the nudge with the board open.
- Fix: close the board in `onStillThere`, or put the nudge above it.

### 3. Minor: A lap that ends because the person leaves writes no line, however long the nap

- Where: server/src/world/cat_life.rs:356-366 (`laps_tick` looks up the
  person's name, `self.person(person)`, only when the lap ends, and writes
  the line only if that finds them); server/src/world/people.rs:107-117
  (`remove` takes the person out at once). These go against the plan's
  decision 1 (a lap of 5 minutes or more is a line "every time") and
  design.md's "sleeps five minutes or more on a lap".
- Scenario: Mochi has slept on sam's lap for 10 minutes. Sam presses Leave,
  or closes the tab and the 30-second grace period runs out (both go through
  `remove`). On the next tick the lap ends with `with = None`, so "Mochi
  slept on sam's lap for 10 minutes" is never written. Leaving with a cat on
  your lap is one of the commonest ways a lap ends. A walk-out after an
  unanswered nudge isn't affected, since it walks the person out and
  `laps_tick` still finds them. Being picked up off a lap isn't affected
  either, because a napping cat refuses (cats.rs:340).
- Reproduced in the copy: a temporary test (`review_a_lap_ended_by_leaving_is_a_line`)
  built with the existing `lap` helper sends `Leave` at 10 minutes, then
  ticks. No line was written.
- Test: Not caught. `a_long_lap_is_a_line_with_its_minutes_and_a_short_one_is_not`
  only ends a lap by its timer.
- Fix: keep the person's name on the cat when the lap begins (beside
  `lap_since`), or write the line from `remove` before the person goes.

### 4. Minor: A chalkboard row of the wrong SQLite type stops the café from starting, though the plan says an unreadable row is skipped

- Where: server/src/store.rs:393-397 (`all_chalk` reads each row with
  `r.get`, and `collect` fails the whole query on one bad row);
  server/src/wake.rs:101 (`?` passes that failure up, so `wake` fails and the
  server exits). The plan's review focus 4 says "A store row that can't be
  read (a hand edit, a future kind) is skipped with a warning, and the café
  still wakes".
- Scenario: a hand edit leaves a row the column types don't allow. For
  example, `INSERT INTO chalkboard (at, line) VALUES (1, X'7B7D')` (a BLOB),
  or `UPDATE chalkboard SET at = ''`. The INTEGER column keeps `''` as TEXT.
  The next start fails with "Invalid column type Blob at index: 1, name:
  line", and the café doesn't open. `restore_chalk` skips only rows that are
  TEXT but not a line.
- Reproduced in the copy: a temporary wake test inserts the BLOB row beside
  a good one. `wake` returned that error.
- Test: Not caught. `an_unreadable_chalk_row_is_skipped_and_said` (wake.rs)
  stores only unparseable TEXT.
- Fix: read each row on its own (a `ValueRef` for each column) and skip, with
  a warning, any row whose `at` isn't an integer or whose `line` isn't text.

### 5. Minor: Arrow keys can't put the pointer on the chalkboard

- Where: client/src/input.ts:133 (the pointer is kept at `y >= 1`). Before
  this slice, row 0 was all wall. Now it holds the board at (8,0), and the
  clamp stayed.
- Scenario, at both sizes: move the pointer under the board to (8,1) and
  press ArrowUp. Nothing happens. Enter then sends `walkTo (8,1)`. Tab or
  Shift+Tab does reach the board, so there's a way in by keyboard. But the
  point-then-act model (design.md, "People"), where you move the pointer
  onto a thing and press Enter, fails for this one target.
- Reproduced in the copy with Playwright at 1920×1080 and at 390×844: the
  board didn't open, and the page sent `walkTo@8,1`.
- Test: Not caught. A unit test in client/test/input.test.ts could hold it
  (ArrowUp from (8,1) reaches (8,0)), or the clamp could let the pointer
  onto `C` tiles only.

### 6. Minor: On every first meeting, the board's line overwrites the cat's own answer in the announcer

- Where: client/src/state.ts:299-302 (every `chalked` is announced);
  client/src/announce.ts:2-9 (each call clears the polite region and sets it
  30 ms later, so of two calls in one tick only the last text stays). This
  slice added the second announcement.
- Scenario: a newcomer pets Burakku. The server sends `catReacted` (sniff)
  and `chalked` from the same `answer` call. The region held "Burakku sniffs
  your hand." for 1 ms (at 5603 ms) before "On the chalkboard: 9:30pm,
  Burakku met rymv7yxpfs for the first time" replaced it (at 5604 ms). A
  screen reader will most likely speak only the second, which names the
  visitor in the third person, by username. The same happens whenever any
  line lands within 30 ms of an announcement about your own action.
- Reproduced in the copy with Playwright and a MutationObserver on
  `#announcer`, timing each text.
- Test: Not caught. state.test.ts applies each message on its own.
- Fix: don't announce a `met` line whose `with` is you (the reaction already
  said it), or queue announcements rather than replacing them.

### 7. Minor: The browser checks can pass with the board dialog empty, and leave out keyboard on the phone, layout B and a resize mid-dialog

- Where: spec/browser.test.ts:439 (`#board-lines li` count above 0) in
  "opens the board from its tile in the room, by mouse and by keyboard"
  (:432), and :459-472.
- Scenario: the plan's check was "a click on the chalkboard tile opens the
  board dialog with the same lines". As written, one `li` passes, and an
  empty board renders one: "Nothing on the board yet." So a dialog that
  rendered from the wrong state, or never rendered the lines at all, still
  passes. The keyboard path is checked only at 1920×1080, touch only in
  layout A, and nothing resizes with the dialog open, though AGENTS.md's
  rule asks for both sizes and a resize mid-use. Finding 1 would have shown
  up in any check that touched the room with the board open.
- Checked by hand in the copy: all three of those work today. Shift+Tab and
  Enter at 390×844 open the board, and Escape gives the focus back. In layout
  B the tile is on screen and a tap opens the board. Resizing from 1920×1080
  to 390×844 and back keeps the dialog on screen with the focus on Close and
  no sideways scroll. So this is a gap in what's held, not a fault today.
- Fix: compare the dialog's lines with the panel's (or the welcome's), and
  add the 390×844 keyboard pass, a layout B tap and a resize with the dialog
  open.

### 8. Minor: Two "done when" checks pass without what they claim: traces surviving a restart, and a tidied trace surviving one

- Where: spec/restart.test.ts:100
  (`expect(toppled(after)).toEqual(expect.arrayContaining(toppled(welcome)))`);
  server/src/world/chalk_tests.rs:384-426 (`a_tidied_trace_stays_tidied`).
- Scenario, restart: when nothing is down before the restart,
  `toppled(welcome)` is `[]`, and `arrayContaining([])` passes whatever comes
  back. So the "Lines and traces survive a restart" line is held for traces
  only when something happens to be down. In practice the toys and plants
  usually are. In the copy, Tora scattered the toys 14 s after an empty start
  and Burakku knocked over both plants within 40 s. Still, nothing in the
  check makes sure of it.
- Scenario, tidied trace: the test's world has no store, and its "restored
  after a restart" leg rebuilds from `arrangement_json()` in memory. With
  `self.save_arrangement()` deleted from `stand_up_piece`
  (server/src/world/furniture.rs:296) in the copy, this test and the whole
  `cargo test -p cafe` still passed. Without that save, a crash within 5 s
  of someone gathering up the toys (before the periodic save) would bring
  them back scattered. That's what design.md's "A crash loses at most
  seconds of cat wandering, never … a moved sofa" rules out.
- Fix: in the restart check, assert that something is down before the stop
  (waiting for it if need be). In the Rust test, give the world a temporary
  store and wake a second world from it, as
  `a_line_is_stored_as_it_is_written_and_dropped_when_a_day_old` does.

### 9. Minor (lowest confidence): Both board lists are rebuilt on every message, whether or not a line changed

- Where: client/src/main.ts:283-284 call `renderChalkboard`
  (client/src/panels.ts:57) on every `cafe.onChange`, which fires for every
  message received (cafe.ts `notify`), and it replaces all the `li`s each
  time.
- Scenario: with one visitor inside and the board unchanged,
  MutationObservers saw `#chalk-lines` and `#board-lines` each rebuilt 5
  times in 10 s, and a busy room sends far more messages. The spec says the
  board is "read by the screen reader". A screen reader's browse cursor in
  the panel or the open dialog is on nodes that are thrown away every
  couple of seconds, which in some screen readers moves the cursor or makes
  it lose its place. This follows the pattern the older panels use, so it
  may be slice 06's to settle. It's cheap here: re-render only when
  `boardLines` gives different lines.
- Measured in the copy with Playwright.
- Test: Not caught.

## Checked and found sound

- **Nothing said reaches a line.** `ChalkLine`/`ChalkWhat` carry only a time,
  a cat's name from content, a username and a furniture kind. A username is
  `[A-Za-z0-9_-]{3,20}` (auth.rs:15), so one that looks like markup can't
  exist. A kind is checked against the catalogue (`take`) or comes from
  content. `ClientMsg` has no way to write on the board. The client renders
  through `textContent` (panels.test.ts holds `<b>jo</b>` as text).
  `no_line_carries_what_anyone_said` asserts lines exist before it checks
  their JSON.
- **The hourly rule** (chalk.rs:32-40): its key is the kind plus the person
  or piece. Meetings, knock-overs and laps are told every time. The scan
  stops at the first line over an hour old, which is right because lines
  are appended in time order. A replay uses the same rule, and lines
  restored from the store take part, because `restore_chalk` runs before the
  replay.
- **The 24-hour edge:** the server drops at `now - at >= day` (chalk.rs:60).
  The store deletes `at <= now - day`, the same set. The client keeps
  `now - at < DAY_MS`, with `now` read on the server's clock through the
  welcome's offset, so a client clock an hour fast doesn't drop a younger
  line (chalk.test.ts).
- **The 500 cap:** memory never holds more. Rows the cap drops stay in the
  store until the oldest line in memory turns a day old, and then the age
  drop deletes them. A restart re-caps on load, so the board is unaffected.
- **Replays and the store:** a replay takes the store away, so it writes
  nothing, and its end rewrites the table in the same job as the rest of the
  save (`save_with`, `replace_chalk`). The panic path reloads from the store
  and rewrites what it read. The wake test holds the 25-hour-old line being
  dropped from both memory and the store.
- **Scattered toys:** they're scattered only with nobody inside (people at
  the window don't count), on the seeded generator, so a replay is
  repeatable. `upright()` keeps cats off scattered toys. A pick-up stands
  them up and saves (furniture.rs:161-178). A tidy saves. A second knock-over
  writes a new line. The toys are drawn strewn about, and the menu and
  announcer say "Gather up" and "gathered up". The narrator's words are held
  by spec/narrate.test.ts.
- **The board dialog on its own:** it opens by click at 1920×1080, by
  Shift+Tab and Enter at both sizes, and by tap at 390×844 in layouts A and
  B. Tab stays on Close. Escape and Close give the focus back to the room.
  Opening the board closes an open menu. It fits at 390 wide with no
  sideways scroll, and survives a resize both ways with the focus kept. The
  first Shift+Tab of a fresh cycle now lands on the last target, the board.
- **The checks:** spec/chalkboard.test.ts times the other visitor's
  `chalked` from the sniff, and finds it among messages already received,
  so a slow line fails it. The desktop panel check waits on the rendered
  `li`. Both checks can fail where they should.
- **Generated TypeScript:** it's regenerated by `cargo test` in the copy,
  and identical to what's committed.

## Noted, out of scope

- **For the judged line ("worth reading on arrival").** Two plants mean two
  "9:22pm, Burakku knocked over the plant" lines a few seconds apart, which
  read as a repeat. Times carry no day, so yesterday afternoon's "4:00pm"
  sits among this morning's lines. First meetings are told every time, so
  a morning's newcomers push the night off the eight within two or three
  visits. The spec's "latest 8" allows all of that, but the user may want
  to see it when judging.
- **For slice 06.** At 700 px and below, the panel's copy is `display: none`
  and the board opens only from a spot on the canvas. A phone screen reader
  can't target that spot, so on a phone it can't open the board. A visually
  hidden copy of the panel there would fix it.
- **For slice 05.** render.ts draws the strewn balls at fixed pixel offsets
  without the plan's "skipping a wall or a blocking piece". Toys against an
  edge draw balls off the canvas, and toys beside a sofa draw them over it.
- **Two copies of the numbers.** chalk.ts:9-10 copies `chalk_hours` and
  `chalk_shown` as constants, as talk.ts does for bubble length. Change
  either in tuning.toml and the change only half applies. With
  `chalk_shown = 12` the snapshot sends 12 and the client shows 8. With
  `chalk_hours = 12` an open tab keeps a line the server has dropped.

## Answers

By the builder, 2026-10-14. Each fix was test first, and each new or
strengthened check was seen failing before its fix or under the mutation
the finding describes.

1. **Fixed** in [`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01). The board is modal: a backdrop
   takes a click beside it and closes it without acting on the room, and
   the café is `inert` while it's open. A browser check clicks the window
   seat beside the open board and finds the board closed, no menu, and the
   focus on the room, and Escape still closes it when opened again.
2. **Fixed** in [`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01). The nudge closes the board, and
   sits above it (z-index 7). A browser check finds "I'm here" on top of an
   open board.
3. **Fixed** in [`20c1810`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/20c1810). A cat keeps its lap-person's name
   from the lap's start. Test: sam leaves at ten minutes, and the line is
   written.
4. **Fixed** in [`20c1810`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/20c1810). `all_chalk` skips a row whose time
   isn't a whole number or whose line isn't text, and `wake` warns with
   how many. Test: a BLOB row and a text time beside a good row; the café
   wakes with the good one.
5. **Fixed** in [`09ca527`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/09ca527). `stepPointer` lets the arrows onto
   the `C` tile and nowhere else on the street wall. A unit test holds it.
6. **Fixed** in [`09ca527`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/09ca527). Your own first meeting's line
   isn't read out, since the sniff sent with it has already told you. The
   rest still are.
7. **Fixed** in [`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01). The dialog's lines are compared
   with the panel's. New checks cover the keyboard at 390×844, a tap in
   layout B, and a resize with the dialog open. In layout B the check now
   waits for the room to stop panning before it taps.
8. **Fixed.** The tidied-trace test wakes a second world from a store
   ([`20c1810`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/20c1810)), and failed with the save taken out of
   `stand_up_piece`. The restart check waits up to a minute for a trace
   before the stop, and says so if none comes. A Rust test holds a toppled
   piece and its line through a stop and a wake every time
   ([`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01)). In the local run of the whole spec a trace
   was there.
9. **Fixed** in [`09ca527`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/09ca527). The lists are rebuilt only when a
   line comes or goes. A unit test holds the nodes' identity.

On the notes:

- **Two copies of the numbers:** fixed in [`09ca527`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/09ca527). The
  welcome carries `chalkHours` and `chalkShown`.
- **For slice 06:** fixed in [`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01). The phone's panel
  copy is visually hidden, not removed.
- **For slice 05:** the strewn balls' placement is left to the art pass.
- **For the judged line:** the repeated plants, times with no day, and
  meetings crowding out the night are for the user to weigh when they read
  the live board.
