# Findings: review of slice 08, "Long gaps held by mocked time"

Brief: [slice-08-brief.md](slice-08-brief.md). Read cold at `2d51fa3`, built
and run only in a throwaway copy (`git archive 2d51fa3`), never in the repo.
Nothing live was touched.

**Count:** 0 critical, 2 major, 8 minor.

## What was run

- `cargo test` on the copy: all green. 299 unit tests (1 ignored), `clock.rs`
  5, `long_gaps.rs` 3 (14.4 s), `waking.rs` 3 (13.5 s), `wont_open.rs` 1.
- The night test three times in all (in the suite, with `--nocapture`, and
  once with extra `eprintln!`s in the copy's `long_gaps.rs`, since
  restored). All passed. The `--nocapture` run: `gap_secs` 30,586, `steps`
  30,586, `refills` 1, `took_ms` 646, walks Burakku 1,623, Mochi 172,
  Tora 1,058. Its board: met, plant, plant, played (all "Fri 11:00pm"),
  toys at 11:05pm.
- The instrumented run: the evening's stop saved at 23:00:12.934. The last
  look before the stop had **nothing toppled**. The morning had the plant at
  (11,1), the toys and the plant at (6,9) down. The night's lines were at
  23:00:43, 23:04:50 and 23:05:37, all from the replay. The first meeting
  (23:00:00.9) fell outside the window. Trust was 0.3 before and after.
  Saved bowls were `0|2026-10-17@420`.
- `measure_replay_times`: 8 hours took 39 ms in release and 555 ms in debug.
  3 days took 321 ms in release and 4,733 ms in debug.
- The built binary, run directly with each `CAFE_CLOCK_START` value below:

  | Value | Result |
  | --- | --- |
  | `tomorrow`, `""`, `2026-10-16T23:00:00` (no offset) | exit 1, one JSON `ERROR` line naming `CAFE_CLOCK_START`, no database |
  | `1969-12-31T23:59:59Z` | exit 1, "CAFE_CLOCK_START is before 1970", no database |
  | `1970-01-01T00:00:00Z` | runs; `saved_at` 106 |
  | `2026-10-16t12:00:00z` (lower case) | runs; `listening` echoes it as typed; `saved_at` 1792152000109 |
  | `9999-12-31T23:59:59Z` | runs; `saved_at` 253402300799106; bowls key `+10000-01-01@420` |
  | any valid value with `FLY_APP_NAME=x`, or `FLY_APP_NAME=` (empty) | exit 1, one JSON `ERROR` line ("for tests: the café on Fly keeps the wall clock"), no database |

I was asked to stop before running two mutations I had prepared: no
`restore_treats` rows, and a no-op `restore_arrangement`. The findings that
rest on them are argued from the code and say so.

## Findings

### 1. Major: the treats test passes on a café that forgets treats on every restart

`server/tests/long_gaps.rs:176-197` (the assertion at `:195`), with
`server/src/wake.rs:137` and `server/src/world/treats.rs:25-31`.

**Scenario:** change `wake.rs:137` to `world.restore_treats(self.bowls, Vec::new())`.
Every restart then forgets what each visitor used. `treats_left` with no row
returns `treats_per_day` (3), so the morning welcome still says 3 and the
test passes. Argued from the code, not run. The test can't tell "reset at
midnight" from "never remembered". The same café would also let a visitor
refill their treats by waiting for an idle stop.

**Would a test catch it?** No. The store test
(`a_visitors_treats_are_kept_for_their_latest_day`) holds the table. The
replay test holds the midnight reset inside one process. Nothing I found
holds that a restart loads treat rows. Fix test first: add a control start
before midnight. Stop at 23:00:xx, start at 23:30 the same night, and expect
`yourTreats` 0. Then start at 07:30 and expect 3.

### 2. Major: "traces still down and the furniture where it stood" hold vacuously in the night test

`server/tests/long_gaps.rs:160-164`. The claim is repeated in
`docs/slices/08-long-gaps-held-by-mocked-time.md:84` and
`docs/design.md:458-470`.

**Scenario:** the visitor is inside for most of the evening, and cats don't
knock anything over with people about (`server/src/cats.rs:262`). The only
alone window before `last_look` is the 6 s in `leave`. In the instrumented
run, `toppled(&last_look)` was empty, so the loop at `:161-163` asserted
nothing. Nobody moves any furniture in the evening either, so
`places(&last_look)` is just `room.toml`'s layout. A café whose
`restore_arrangement` (`server/src/world/furniture.rs:490-494`) did nothing
would come back in the same places and pass `:164`. Line `:160`
(`!toppled(&after).is_empty()`) is met by the replay's own knock-overs after
the restart, not by anything kept across it. Argued from the code; the
mutation wasn't run.

**Would a test catch it?** Not this one. The behaviour is held elsewhere:
`wake.rs`'s `a_stop_and_a_start_bring_the_cats_back_…` (a moved cushion) and
`spec/restart.test.ts`, which only warns if no trace comes within a minute.
But slice 08's done-when line names the built binary on mocked time. Fix
test first:
1. Move a piece in the evening, as `restart.test.ts`'s `placeACushion` does.
2. Have a trace down at the stop. For example, stay out until a knock-over
   is chalked, then take the last look. Or read the saved `arrangement`
   before the stop and require a toppled piece in it.
3. Compare the morning against that.

### 3. Minor: the night line can depend on what the live evening left standing (a flake)

`server/tests/long_gaps.rs:154-159`.

**Scenario:** before the stop, the café runs live at real speed, and the
café's seed is different every run (it comes from `now` at a mocked instant,
plus milliseconds). Cats are alone while the sign-up's two argon2 hashes run
(slower in a debug build on a shared runner) and for the 6 s in `leave`. If
the evening knocks over the two plants and the toys before the stop, the
night has nothing left to write. "Played" needs toys standing, perching
needs someone at the window, and lines about people need people. Then
`night` is empty and the test fails. It's unlikely (two of my three local
runs knocked over the first two pieces within about a minute of 23:00), but
nothing rules it out.

The plan's 300-seed check (review focus 4) was a throwaway unit replay of
nights that started with every piece standing. It doesn't model the
binary's live evening, and it wasn't kept, so it can't be re-run.

**Would a test catch it?** Only as a red CI run. Fix: keep a second visitor
inside until the stop, so everything knockable stands at the stop. Or
assert the night's lines only for pieces that stood at the stop.

### 4. Minor: the `took_ms` bound is roughly 30 times the measured time

`server/tests/long_gaps.rs:25` and `:127`, against
`docs/slices/01-the-cafe-keeps-living-while-it-sleeps.md:60` ("takes a few
seconds at most").

**Scenario:** the debug build is about 14 times slower than release here
(555 ms against 39 ms for 8 hours). Fly's baseline CPU took 1,301 ms in
release where this machine took 39 ms, about 33 times slower
(`slice-01-wake.md`). So 20 s in debug is about 1.4 s in release here, and
about 47 s at Fly's baseline. A replay that got 20 to 30 times slower would
still pass, and at the baseline it would take far more than "a few
seconds". The spec states the CI headroom openly, but slice 01's line now
reads as if it held the live claim.

**Would a test catch it?** No. Either tighten the bound (5 s still leaves
about 8 times the room here), or check steps per second against a
calibration replay timed in the same run.

### 5. Minor: "the bowls are full" is in the approved spec, isn't true, and the weaker check could pass without a fill

Spec `docs/slices/08-long-gaps-held-by-mocked-time.md:44-45` and `:84`; the
test at `server/tests/long_gaps.rs:147-153`; the refill at
`server/src/world/treats.rs:177-189`.

**Scenario:** the execution log explains why the bowls are empty by 07:30
(the cats eat them), and it changed the test. The approved spec still says
"the bowls full from 7:00" and "the bowls are full". The new check is that
the refill key ends `@420`, plus `refills: 1`, and both count the key
moving, not the portions. A `bowls_tick` that moved the key without setting
`self.bowls` (`treats.rs:183`) would pass. That fault is contrived. The
real issue is that the spec's text and the test disagree.

**Would a test catch it?** I didn't confirm whether a unit test asserts the
portions after a refill. The replay test I read asserts `refills` and
`bowls_key`. Fix: amend the spec's wording with the user, and add a morning
start in a copy of the data directory at 07:00:05 that expects 3.

### 6. Minor: a mocked future clock leaves rows that misbehave on the wall clock

`server/src/time.rs:38-42` and `server/src/main.rs:128-137`.

**Scenario:** `CAFE_CLOCK_START=9999-12-31T23:59:59Z` is accepted. A data
directory used that way and then run on the wall clock keeps:
- chalkboard lines dated 9999, which `chalk_tick` never drops and which sort
  last, so they stay on the board indefinitely;
- sessions and bans with `expires_at` or `until` in 9999 or later, which
  never run out;
- `saved_at` ahead of now, which wakes with no replay until the first save.

Fly can't reach this, because the guard holds. But
`CAFE_CLOCK_START=… cargo run` writes to the developer's own `.data/`. A
past start is mostly harmless: sessions and bans just end early.

**Would a test catch it?** No. Possible fixes:
- refuse `CAFE_CLOCK_START` with the default `DATA_DIR`;
- refuse a start more than a short span ahead of the wall clock;
- or have `wake` warn when `saved_at` is ahead of `now`.

### 7. Minor: the night test names the cats, so a new cat breaks it

`server/tests/long_gaps.rs:129-133`.

**Scenario:** add `content/cats/kuro.toml`. `walks` then has four names,
and the assertion against `["Burakku", "Mochi", "Tora"]` fails. AGENTS.md
says a new cat is a data file, and code never names an individual cat. The
assertion can't fail any other way, because `walks` always lists every cat
(`replay.rs:56`).

**Would a test catch it?** It's the test that breaks. Read the names from
`content/cats/`, or assert one entry per cat definition.

### 8. Minor: "only `time.rs` reads the wall clock" is held by a one-off grep, not a test

Spec `:79`, against `server/src`.

**Scenario:** a later change adds `SystemTime::now()` to, say, `api.rs`. On
a mocked clock, sessions or rate limits then mix two clocks, and nothing
fails. The grep I ran found no such read today (see below).

**Would a test catch it?** No. Add a `cargo test` that scans `server/src`
for `SystemTime::now`, `UNIX_EPOCH`, `Utc::now` and `Local::now` outside
`time.rs`, and for SQLite's own clock functions in the store.

### 9. Minor: the board printed for slice 02's judgement isn't the board a visitor reads

`server/tests/long_gaps.rs:87-92`.

**Scenario:** `told` prints `line["what"]` as JSON:
`{"kind":"knockedOver","piece":"toys"}`. A visitor reads "Burakku scattered
the toys" (`client/src/chalk.ts:16-17`). The user judges "reads like the
café's own story" on text that the café never shows. It follows the plan
("their fields"), but it weakens the judgement.

**Would a test catch it?** No; this is a judgement. Print the client's
words, or record them beside the board in `slice-02-board.md`.

### 10. Minor: the log check accepts any clock

`scripts/check-logs.ts:41`.

**Scenario:** CI runs the image as Fly does. If the image ever started on a
mocked clock, its `listening` would carry a time string and the check would
pass, although "the live café is always on the wall clock" is exactly what
CI could hold before a deploy. Plan Task 6 checks `"wall"` only after the
deploy, by hand.

**Would a test catch it?** No. Give the check a flag, used in CI's step,
that requires `clock: "wall"`.

## Checked and found sound

- **Every instant comes from `now_ms`.** I grepped `server/src` outside
  `time.rs` for `SystemTime`, `UNIX_EPOCH`, `Utc::now`, `Local::now`,
  `Instant::now`, `chrono::` and SQLite's `datetime(`, `'now'`,
  `CURRENT_TIMESTAMP`, `strftime`, `julianday` and `unixepoch`. The hits:
  - `Instant::now` in `wake.rs:24`, which times `took_ms` (a duration);
  - test code (`replay_tests.rs`, `cats_tests.rs`, `chalk_tests.rs`);
  - tokio intervals, which are durations.

  Every other instant is `now_ms()`, in `api.rs`, `ws.rs` and `main.rs:60`.
  Tracing's `timestamp` is wall time, which is log metadata and documented
  in the plan.
- **`start_at`.**
  - It has one caller (`main.rs:135`), which runs first in `run()`, before
    the store opens and before `main.rs:60` reads `now`.
  - Nothing reads the time before it.
  - A second call panics into a JSON line through the panic hook.
  - The unit tests never call it.
  - The offset can be negative.
  - `now_with` saturates and clamps at 0, and a start before 1970 is
    refused, so the café's clock can't go below the epoch.
- **The guard on Fly.** Fly sets `FLY_APP_NAME` on every machine at runtime,
  and it's already the café's `behind_fly` signal, so the two can't
  disagree. An empty value is refused too. The refusal comes before the
  database exists (asserted in `clock.rs:163`). A mis-set variable on Fly
  would stop the café loudly rather than run it on a mocked clock, which is
  the intended failure.
- **The port change.** Nothing reads the old value.
  - `check-logs.ts` and `narrate.ts` don't read `port`.
  - CI runs with `-e PORT=8080 -p 8080:8080`.
  - `spec/` uses `APP_URL`.
  - On Fly, `PORT=8080` binds 8080, so the logged value is unchanged.

  `wont_open.rs` still uses a bind-and-release `free_port`, but that café
  fails before it binds, so it can't race.
- **`waking.rs` still holds slice 07's three lines.** It checks:
  - listening before the replay ends, the page and a sign-up during it;
  - `waking` first, then the welcome;
  - a Leave sent while waking frees the seat;
  - a stop during the replay exits cleanly within 5 s with `saved_at`
    unchanged. That comparison is now between distinct real values: a
    Friday 23:00 save, against the one a week later that a faulty stop
    would write.

  The 7-day cap in a copy of `content/` still keeps the replay (about 11 s
  in debug) longer than what's checked during it. It also newly checks that
  a session survives a mocked week.
- **The night is a night, in schedule terms.** `refills == 1` pins the 7:00
  crossing: the 18:00 refill was before the start, and 12:00 is after the
  end. The `steps` and `gap_secs` window is tight. The constants check out:
  `1_792_152_000_000` is Friday 23:00 AEDT and `1_792_182_600_000` is
  Saturday 07:30 AEDT. Trust is a real check: a café that lost it would
  show 0, not 0.3.
- **Nine days asleep.** `steps` is exactly 259,200, with `capped` true; a
  broken cap fails it.
- **A frozen clock.** `clock.rs` alone wouldn't catch a clock that never
  advances (`saved_at` would still be in range). `long_gaps.rs` would: the
  visitor's walk to a cat never arrives, and `meet_a_cat` times out.
- **The kept rules.**
  - The live café is on the wall clock. Fly refuses the variable, and the
    image and `fly.toml` don't set it.
  - The server still decides every outcome: a client can't reach the
    clock.
  - Nothing said is logged: the only new field is `listening`'s `clock`,
    and the tests' visitors say nothing.
- **No check in slices 01, 02, 07 or 08 waits on a real night or the live
  logs.** Slice 07's judged baseline-CPU line was made once, with a
  rewritten saved clock, and stays as a record. It doesn't wait on anything.
- **The refusal tests.** `clock.rs`'s refusal tests check for "an error line
  naming `CAFE_CLOCK_START`" rather than exactly one line, but every refusal
  I ran printed exactly one.

## Answers

By the builder, 2026-10-17. All fixed in
[`b955ba9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b955ba9).
Each strengthened check was seen failing under the fault it holds.

1. **Fixed.** The treats test restarts at 23:30 the same night and expects
   `yourTreats` 0, then 3 at 07:30. With `wake.rs` passing no treat rows to
   `restore_treats`, it failed at 23:30 with 3.
2. **Fixed, in two tests.**
   - **The night test.** A night owl stays in until the stop, so nothing
     falls before it. The regular moves a cushion, and the morning must have
     it where it was put. With `restore_arrangement` doing nothing, it failed
     with the cushion back at `room.toml`'s (9,7).
   - **A new test for a kept trace,**
     `a_trace_left_at_the_stop_is_down_after_the_restart`. It puts a trace
     in the save the café wrote: the first piece of a kind `furniture.toml`
     says a cat can knock over. It restarts at the instant the stop saved,
     so the replay has 0 steps (asserted) and only the store can keep the
     piece down. Under the same fault it failed with `plant@11,1` standing.

   A first version waited for an empty café's cats to knock something over
   live, and restarted at 07:30. It passed under the fault, because the
   night re-knocked the same pieces. The concurrent stress run also found
   it flaky: one seed's cats all napped, and nothing fell in 300 s. The
   plan's execution log has the detail.
3. **Fixed** by the night owl. Every knockable piece stands at the stop
   (asserted), so the night has them all to knock over.
4. **Fixed.** The bound is now 5 s, about eight times the 0.6 s measured
   here. CI ran `cargo test`'s unit tests about 1.6 times slower than this
   machine. Slice 01's line now says that the bound holds the replay's
   speed on every push, not on Fly's CPU, with the baseline measurement
   alongside it.
5. **Fixed.** Slice 08's spec says "on the 7:00 refill". Its status records
   the change, so the user can see it. The test also requires the welcome's
   bowls to equal the portions the replay saved. A portion check at 07:00:05
   wasn't added: cats eat within the first minute on some seeds, so it would
   flake, and `bowls_tick`'s fill is held by the replay unit tests.
6. **Fixed, bounded.** A start more than a year from the wall clock is
   refused (`time.rs`'s `check_near`, with a unit test). `9999` and `1970`
   are refused, and every test's October 2026 night is accepted. **Known
   limit:** from October 2027 those fixed dates are over a year past, and
   the binary tests would need dates relative to the current year. The repo
   ships on 9 November 2026.
7. **Fixed.** The night test reads the cats' names from `content/cats/`.
8. **Fixed.** `time.rs`'s `only_this_file_reads_the_wall_clock` scans
   `server/src` for `SystemTime`, `UNIX_EPOCH`, `Utc::now`, `Local::now`
   and SQLite's `'now'`, `CURRENT_TIMESTAMP` and `unixepoch(`. A
   `SystemTime::now()` planted in `limits.rs` failed it.
9. **Fixed.** The night test prints each line in the words
   `client/src/chalk.ts` puts on the board ("Burakku scattered the toys").
10. **Fixed.** `scripts/check-logs.ts --wall` requires `clock: "wall"` on
    every start. CI's log check step uses it, so the image is held to the
    wall clock before every deploy. Its test sees a mocked clock fail under
    `--wall`.
