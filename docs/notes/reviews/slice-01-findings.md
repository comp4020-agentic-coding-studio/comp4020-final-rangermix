# Findings: review of slice 01

Brief: [slice-01-brief.md](slice-01-brief.md). Reviewed at `b63ea6b`: the
slice's commits `a36c0b5` to `1125f0d`, leaving out `4e54ca4` and `f5b42f7`.
One reviewer, who didn't build the slice, read it cold. Every reproduction
ran in a throwaway copy made with `git archive b63ea6b`, never in this
checkout. The experiments named below were ignored tests or temporary edits
in that copy, and none of them is in the repo. Baseline in the copy:
`cargo test -p cafe` passed (265 unit tests, 1 ignored, and the binary
test). CI run 38518276747 on `b63ea6b` ran `spec/restart.test.ts` (not
skipped, 30.9 s) and the log check, and both passed.

1 major, 8 minor.

## Findings

### 1. Major: Waking gets every cat up, so a redeploy of a few seconds shows: a napping cat stops napping and walks off

- Where: server/src/world/cat_life.rs:123-155 (`place_cat`: pose Idle, plan
  Idle, no walk, `until` 3 to 8 s away), server/src/cats.rs:137-145 (`Saved`
  keeps only the tile and four needs), cat_life.rs:98-106 (`saved`). They
  contradict docs/slices/01-the-cafe-keeps-living-while-it-sleeps.md:15-17
  ("Nothing gives away that the café was switched off. A redeploy is the
  same thing over a few seconds"). They also contradict docs/design.md:285-288,
  which lists "each cat's state (where it is, what it's doing, how hungry
  and tired it is)" as kept across restarts.
- Scenario: Mochi settles into a nap at 15:00 with nine minutes of it left,
  and a visitor is watching. A deploy stops the machine for ten seconds. The
  new process puts Mochi back on her tile but not in her pose, plan or nap
  timer. She is Idle, with `until` 3 to 8 s away, so within the replay's ten
  steps she chooses again, usually something else. The visitor's tab
  reconnects to a snapshot in which Mochi is awake or already walking off.
  Had the café stayed up, she'd have slept on for nine minutes. A cat that
  was mid-walk stops on the tile it had reached. Measured in the copy
  (ignored test `review_a_redeploy_wakes_a_napping_cat`: seeds 1 to 100, at
  15:00, the first cat seen napping with at least two minutes left): after a
  10-second stop and its replay, that cat was no longer napping in 71 of 100
  runs, and off its spot in 92. Without the stop it would have been in
  neither case. The reset dates from phase 2. This slice's story and its
  checks rely on a restart being invisible, though: the execution log
  (plan-slice-01-fast-forward.md:726-727) compares the cats "by tile only,
  since waking resets their poses". So the 30-second spec check sees cats
  move partly because every cat chooses again within 8 s of waking.
- Test: Not caught. The Rust stop-and-start test (wake.rs:122) and
  spec/restart.test.ts:68 compare tiles only, and no test saves a pose. A
  wake test would catch it: save a world with a cat mid-nap (`until`
  minutes away), wake it 10 s later, and assert the same pose on the same
  tile.
- Either fix answers it. Save the pose, plan and `until` (and the walk) with
  each cat, and restore them in `place_cat`, drawing a fresh `until` only for
  an older save that has none. Or say in the spec and design.md that waking
  gets the cats up, and take "what it's doing" off the kept list.

### 2. Minor: The daylight-saving refill check can't fail for a refill schedule that ignores daylight saving

- Where: server/src/world/replay_tests.rs:102-128
  (`bowls_refill_and_treats_reset_during_a_replay_across_daylight_saving`).
  It is meant to hold the spec's line "Bowls refill and treats reset during a
  replay, including across a daylight-saving change".
- Scenario: Each case replays to 19:00 local time on the day the clocks
  change, then asserts 3 refills and the key `@1080`. 19:00 is an hour after
  the 18:00 refill, and daylight saving moves the clock by exactly an hour.
  So a schedule that's an hour off still has all three refills inside the
  window. Reproduced in the copy: `refill_key` (treats.rs:212) was rewritten
  to run the schedule on a fixed UTC+10 clock, which puts the summer refills
  at 8:00, 13:00 and 19:00 AEDT. All 265 tests and the binary test still
  passed. time.rs's own test catches a fixed offset in `canberra_day` and
  `canberra_minute_of_day`, but not in the refill schedule. The April case
  can't catch a fixed UTC+10 schedule at all, since AEST is UTC+10.
- Test: The check itself. Ending the October case at 18:30 instead of 19:00
  fails under that mutation (2 refills, not 3) and passes on the real code.
  Both were checked in the copy. For April, a replay that ends at 06:30 on
  4 April and asserts no 7:00 refill yet would catch a schedule on a fixed
  UTC+11 clock. In general, assert just before and just after a refill on
  each changeover day.

### 3. Minor: The week's cap is never tested where it runs, and taking it out of `wake` passes everything

- Where: server/src/wake.rs:49 (`replay_start`) and 57 (`capped`). The cap's
  test, replay_tests.rs:91-100, calls `replay_start` and `World::replay`
  directly, never `wake`.
- Scenario: The café sleeps through a month-long break. Suppose `wake` built
  the world at the saved clock rather than at `replay_start`'s result, an
  easy slip when slice 02 or a later slice edits `wake`. It would then replay
  2.6 million steps behind closed doors. Reproduced in the copy: wake.rs:49
  was changed to use `saved_at` whenever it's behind `now`, with no cap. All
  265 tests and the binary test still passed. No Rust test ever sees
  `capped: true`; only the narrator test has it.
- Test: Not caught. Add a wake test with `saved_at` nine days back that
  asserts `steps` 604,800, `capped` true, `gap_secs` 777,600, and the
  world's clock at `now`.

### 4. Minor: The stop-and-start spec check can pass for a café that doesn't replay, and fail for one that does

- Where: spec/restart.test.ts:55-57 (the cats are read before the stop,
  while the café is still running) and 68 (the tile comparison). Also
  plan-slice-01-fast-forward.md:726, which says APP_RESTART "sleeps 30
  seconds, not 20, so the replay is sure to move a cat".
- Scenario: (a) The "before" tiles come from a welcome snapshot. The test
  then leaves and runs `docker stop`, and the stop's save comes a few hundred
  milliseconds later. A cat walking at the snapshot, or one that sets off in
  between, is saved on another tile, so even a café frozen while asleep
  shows "moved". Simulated in the copy with the ignored test
  `review_frozen_cafe_false_pass_rate`. The café was empty, seeds 1 to 100
  at 10:00, 15:00 and 22:00. Each was saved d ms after the snapshot and
  woken 30 s later with no replay. The frozen café passed the check 15 times
  in 300 at d = 300 ms, and 49 times in 300 at d = 1 s. In CI run 38518276747
  the snapshot and `docker stop` were less than a second apart. (b) A correct
  café failed the check once in 300 (seed 44 at 22:00: the 30-step replay
  left all three cats on their tiles). So it's a flake that blocks a deploy
  about 0.3% of the time. (c) The test moves no furniture itself, so
  "furniture as it was" compares whatever earlier spec files left. If they
  left room.toml's layout, an arrangement that's never saved or restored
  passes.
- Test: The check itself. Stronger evidence of the replay is the restart's
  own `woke` line from `docker logs app`. CI could pass that command in an
  env var, as it passes `APP_RESTART`. Assert `first` false, `steps` of at
  least 30, and some cat walked. Also move a piece before the stop, so the
  furniture half compares a layout only the store could have kept.

### 5. Minor: A save is one store job but not one transaction, so a save cut short is half old and half new

- Where: server/src/store.rs:123-137 (`run` opens a transaction only when
  two or more jobs are queued), server/src/world/mod.rs:435-458
  (`World::save`: six statements in one job), server/src/world/replay.rs:76-77
  (the replay's result goes out as two jobs). Against these, the plan
  (plan-slice-01-fast-forward.md:38) says "in one store job (one
  transaction)". design.md:303-306 says the result is "saved once, and the
  port opens only after that".
- Scenario: The periodic save is usually alone in the queue, so its three
  cat rows, `bowls`, `rng` and `saved_at` commit one statement at a time.
  The process can die between them: an OOM kill on the 256 MB machine, Fly's
  SIGKILL after a stop that hangs, or a statement that fails. The store then
  holds the cats and the generator from time T with the clock from T minus
  5 s. The next wake replays five seconds the cats have already lived, on a
  generator from a different moment, which is not a café any one save
  describes. In the same way, a kill between the replay's two jobs keeps the
  night's clock and cats but loses its knock-overs. The next wake starts
  from the new clock and never redoes them. `wake` doesn't flush either, so
  both jobs can still be queued when the port opens. Reproduced in the copy
  with a temporary store test (`review_a_lone_save_job_is_not_one_transaction`):
  a fired job that wrote `rng` and `bowls` and then failed left both
  committed. The windows are milliseconds wide, and the cost is seconds of
  wandering or one lost knock-over.
- Test: Not caught. A store test that fires a job which writes a row and
  then fails, asserting that nothing was written.
- Fix: make each job atomic in `run` (a savepoint or transaction per job),
  write the arrangement in the cats' save job, and `store.flush()` at the
  end of `wake`.

### 6. Minor: A replay that panics stops the café at the same step on every start, and reports it in a line that isn't JSON

- Where: server/src/main.rs:27-36 (only an `Err` from `run()` becomes the
  JSON error line), wake.rs:54, replay.rs:46-79 (nothing is saved until the
  replay ends). Against these, design.md:314-317 says "a panic exits the
  process and Fly restarts it from the last save" and "Any failure to start
  is one JSON `error` line, then exit code 1".
- Scenario: Take any bug that panics inside a replayed step. None was found
  in today's rules, but slice 02 adds more replayed behaviour. The replay now
  runs in `run()` before the doors open, and a panic isn't an `Err`. So the
  process prints Rust's plain-text panic message and exits with 101. Fly
  restarts it from the last save, which hasn't changed, with the same
  generator. The replay reaches the same step and panics again. The café
  stays shut at least until the gap passes a week and the replay's start
  begins to move.
  Before this slice the same bug would have killed only the world task, and
  a restart would have begun afresh. Reproduced in the copy with a panic
  injected at Burakku's third walk: two starts against the same database
  both printed `thread 'main' ... panicked at server/src/world/replay.rs`,
  which isn't JSON, exited with 101, and left `saved_at` where it was.
- Test: Not caught. A unit test can check that a panic in the replay is
  caught, and that the café then wakes at `now` with an `error` line.
- Fix: run the replay under `std::panic::catch_unwind`. On a panic, log one
  JSON `error` line and wake at `now` without the replay, or with the part
  replayed so far, so that one bad night can't keep the café shut. A panic
  hook that logs JSON keeps the "one JSON line" promise for other panics.

### 7. Minor: A saved clock that can't be read is logged as the café opening for the first time

- Where: server/src/wake.rs:28-37 (an unreadable `saved_at` becomes `None`)
  and 58 (`first = saved_at.is_none()`), scripts/narrate.ts:245, and
  design.md:396 ("whether it's the first start").
- Scenario: `saved_at` holds "yesterday", whether hand-edited or left by a
  format change. As designed, `wake` warns, loads the cats, trust, furniture
  and bowls, and wakes without a replay. But its summary says `first: true`,
  and `pnpm logs` prints "The café opened for the first time" for a café
  with a history. Reproduced in the copy by adding
  `assert_eq!(woke(&logs)["first"], false)` to
  `an_unreadable_clock_wakes_without_a_replay_and_says_so`, which then fails
  with `true`.
- Test: Not caught; the test checks only `steps` and the warning. Fix: set
  `first` when there's no `saved_at` row at all (or nothing in `world`), not
  when the row can't be read.

### 8. Minor: How long a week-long replay takes on the live machine is unmeasured, and a new visitor waiting for it gets no page, not "Connecting…"

- Where: docs/design.md:305-307 ("the port opens only after that, so a
  visitor sees the page's usual 'Connecting…' meanwhile"),
  server/src/main.rs:48-53 (the port that serves `/` binds after `wake`),
  docs/notes/slice-01-wake.md (the 7-day replay measured only on the
  development machine), and the plan's review focus 5.
- Scenario: The café sleeps for eight days over a break. The first visitor
  opens the URL, Fly starts the machine, and the server replays 604,800
  steps before it binds the port. The page itself is served from that port.
  So a visitor who doesn't already have the café open sees the browser
  loading, or whatever Fly's proxy does if the replay outlasts its wait
  (unverified). They never see the page's "Connecting…", which only a tab
  already open shows ("Reconnecting…"). How long the wait is on a
  `shared-cpu-1x` is unknown. In the copy, a release build here took
  1,014 ms for 7 days (708 ms recorded), and a shared CPU held to its
  baseline share could be many times slower. The live judged line covers
  only eight hours. And `took_ms` counts only the replay: not the machine
  starting, the content, the database or the loads.
- Test: Judged. Measure the capped case once on the live machine, or bound
  it locally under `docker run --cpus=0.0625` with `saved_at` set back eight
  days. Record the result in slice-01-wake.md, and correct design.md's
  sentence.

### 9. Minor: The narrator splits a cat's name at a space

- Where: server/src/world/replay.rs:24-30 (`walks_text` joins "Name:N"
  pairs with spaces), scripts/narrate.ts:250-254 (splits on " " and then
  ":"), server/src/cats.rs:70-100 (`validate` doesn't check names).
- Scenario: A new cat is a data file (AGENTS.md). Add one with
  `name = "Mr Whiskers"`. The summary's walks read "Mr Whiskers:40 Mochi:3
  Tora:12", and `pnpm logs` prints "meanwhile Whiskers walked 40 times,
  Mochi 3 and Tora 12". A name with a colon in it drops out altogether.
  Reproduced by piping that line through scripts/narrate.ts in the copy.
- Test: Not caught. Fix: log the walks as a structured field (by cat id, or
  as JSON), or have `validate` refuse names with spaces or colons.

## Checked and found sound

- **The same save and the same gap give the same café.** Nothing in a tick
  or a load iterates a hash map. `TrustBook`, the angers, the treat book and
  the reservations are only looked up by key, the room's searches use hash
  maps for lookups only, and the catalogue is sorted. Cats load in
  file-name order. Ticks take their time as an argument. `Instant` is used
  only for `took_ms`, and the fresh seed only when no random state is saved.
  `the_same_saved_state_and_gap_replay_to_the_same_cafe` asserts that the
  night moved somebody, so it isn't vacuous. The wake test shows that the
  fresh seed makes no difference with a saved random state and decides the
  café without one. The random state's JSON (including its 128-bit word
  position) round-trips, and an unreadable one falls back to a fresh
  generator with a warning.
- **One-second steps are the live rules.** An 8-hour night replayed in 1 s
  steps and the same night lived in 100 ms ticks (seeds 1 to 5, ignored test
  `review_step_size_fidelity`) give walk counts within noise of each other.
  For seed 1: Burakku 1,838 lived against 1,877 replayed, Mochi 42 against
  54, Tora 627 against 586.
- **The kept rules.** A replay changes no trust: nobody is inside, a fresh
  world has no floor treats, and `TrustBook::load` keeps values as they
  are. The trust test's night crosses midnight, so it would catch a daily
  decay. The replay is silenced with a scoped `NoSubscriber`, which takes
  precedence over the global subscriber, and it runs synchronously on one
  thread. The `woke` line carries no text, and nothing said is stored. The
  replay runs only in `wake`, on the server.
- **The gaps.** Across midnight, the treat day moves on and the refill key
  stays put (`canberra_day_before`). Across several refills, each refill is
  counted once. A gap of zero gives 0 steps and "nothing to catch up on". A
  clock ahead of now gives no replay and the clock back at now; at most, the
  bowls get one extra refill, because the saved key is from the future. A
  save from before this slice (no `rng`) replays its gap on a fresh
  generator. `replay_start` caps the replay correctly; finding 3 is only
  about where that's tested. Treats left are worked out from the clock, so
  their reset holds whether or not a replay ran. The test's `treat_day`
  assertion is the part that needs the replay.
- **What a replay changes is kept.** A knock-over is saved at the end. The
  test is non-vacuous: seed 6 topples something, and the test asserts that
  it did. The bowls are saved too. Treats and bans are untouched.
- **A database that won't open.** The binary test fails if the server is
  still running at 10 s or logged `listening`, and `Store::open` refuses
  both the non-database file and a directory.
- **The log check and the narrator.** Every `listening` must follow an
  unclaimed `woke` line with numeric fields. In CI, a failed start can't
  leave a `woke` line that hides a later start's missing one, because a
  failed start leaves the app down and the spec fails. The check tests
  presence and types only; whether `steps` fits `gap_secs` is left to
  `cargo test`. The narrator's durations, counts, "once" and "twice", the
  capped phrase and the switch from ms to s all match their tests.
- **The CI change.** On a fresh runner the named volume starts empty.
  `docker stop` goes through tini to SIGTERM, and the app saves before it
  exits. Spec files run one at a time, so no other file sees the app down.
  A failing restart check blocks the deploy, which is the safe direction.
- **Cost.** A replay builds no state that grows with its length, and it
  writes two store jobs at the end. In a release build in the copy, 8 hours
  took 46 ms and 7 days took 1,014 ms, the same order as the 54 ms and
  708 ms recorded.

## Noted, out of scope

- A missing `/data` (a wrong `DATA_DIR`, or the volume not mounted)
  creates an empty database and serves an empty café. The summary at least
  says `first: true`. This comes from phase 1's `create_dir_all` and
  `Store::open`.
- A panic in the live world task, spawned with `tokio::spawn`, doesn't exit
  the process, though design.md:314-315 says it does. The server stays up
  with a dead world. This is phase 3's; finding 6 is the replay's version.

## Answers

By the builder, 2026-10-14. Each fix was test first. A test that only
strengthened a check was seen failing under the mutation the finding
describes. Commits:

1. **Fixed** in [`96a6cca`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/96a6cca).
   A cat's save keeps its pose and timer, and a walk under way with what
   it's for. Plans naming a person, a piece or a treat aren't kept, and a
   held or lap cat comes back on its own feet. Test: over ten seeds, a cat
   that lay down to nap still naps on the same tile after a ten-second stop
   and its replay. Measuring finding 8 then turned up a follow-on, guarded
   in [`a35beb1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a35beb1):
   a timer further ahead than any pose lasts, or a walk not yet begun,
   isn't kept, since it can only come from a clock that stepped back.
2. **Fixed** in [`1e84f3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1e84f3d):
   a minute either side of 7:00 and 18:00 on both changeover days. Seen
   failing under a fixed UTC+10 and a fixed UTC+11 schedule.
3. **Fixed** in [`1e84f3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1e84f3d):
   a nine-day wake test. Seen failing with the cap taken out of `wake`.
4. **Fixed** in [`b0e73ca`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b0e73ca).
   The check reads the restart's own `woke` line through `APP_LOGS`, and
   puts a new cushion down before the stop. The cats' tile comparison is
   gone. After finding 1 it failed twice in CI on a correct café whose cats
   were all napping, so whether the replay moves the cats in character is
   left to `cargo test`. It passed three times in a row against the image.
5. **Fixed** in [`afdc819`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/afdc819).
   Each fired job runs under a savepoint, the periodic save carries the
   arrangement, a replay's end is one job (the chalkboard too), and `wake`
   flushes before the doors open.
6. **Fixed** in [`8866b2b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8866b2b).
   `catch_unwind` round the replay: on a panic, one JSON error line, and
   the café wakes at now from the save, with `failed` on the woke line. A
   JSON panic hook covers other panics. The live world task's panic (noted,
   out of scope) is left as a follow-up.
7. **Fixed** in [`779fa45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/779fa45):
   `first` means nothing was ever saved.
8. **Measured and corrected.** At 1/16 of a CPU, the 8-hour wake takes
   1.9 s from start to answering and the capped one 29.5 s
   ([slice-01-wake.md](../slice-01-wake.md)). design.md now says what a
   visitor sees meanwhile. Whether Fly's proxy waits 30 s is unverified,
   and the options are set out for the user.
9. **Fixed** in [`779fa45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/779fa45):
   the walks are JSON pairs, and the narrator reads both forms.
