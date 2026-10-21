# Slice 08, "Long gaps held by mocked time": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why mocked time and not
> a real night: [ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md).

**Goal:** every check on a long gap runs before a deploy, on mocked time,
in seconds. The built binary can be started at a chosen instant, so a test
can live through a night (23:00 to 07:30), a midnight and nine days asleep
on the real server, with saves the café wrote itself.

**Architecture:** `time::now_ms()` stays the one way the server reads the
time, and becomes wall time plus an offset. The offset is fixed once at
start by `time::start_at(at)`, from `CAFE_CLOCK_START`, in a process-wide
`OnceLock`, so no caller changes and nothing can move the clock afterwards.
`Config` reads the variable. `run()` refuses it on Fly, or unparseable,
before it opens the store, and logs the clock on `listening`. The world
task's 100 ms ticker, the 5-second saves, session expiry, rate-limit
windows and "gone quiet" all read `now_ms()`, and all measure intervals or
compare with times written on the same clock, so a clock that starts
elsewhere and runs at real speed behaves like the live one.

**Spec:** [`docs/slices/08-long-gaps-held-by-mocked-time.md`](../slices/08-long-gaps-held-by-mocked-time.md).
Written 2026-10-17 from the code at `a45eec4`.

## What the code does now

- `server/src/time.rs`: `now_ms()` reads `SystemTime::now()`. It is the only
  place the server reads the wall clock. `Instant::now()` in `wake.rs` times
  the replay, which is a duration, not an instant in the café.
- Callers of `now_ms()`: `main.rs` (the wake's `now`), `ws.rs` (the world
  task's ticks and commands, a connection's buckets and silence), `api.rs`
  (rate limits, sessions, sign-up time).
- `server/tests/waking.rs` makes a long sleep by rewriting `saved_at` with
  rusqlite, with the cap raised to 7 days in a copy of `content/`, so the
  replay outlasts a sign-up and a socket on a slow machine.
- A debug build replays 8 hours in 0.55 s, 3 days in 4.5 s and 7 days in
  10.4 s here (Apple M4, 2026-10-17). Across 300 seeds with start times
  jittered within a minute of 23:00, every night to 07:30 left at least
  3 board lines, at least one toppled piece and exactly one refill (a
  throwaway test, not kept).

## Global constraints

- AGENTS.md's rules hold. Nothing said is logged: the tests' visitors say
  nothing. The server decides every outcome, on its own clock. No client
  can set or see the offset.
- The live café runs on the wall clock: `CAFE_CLOCK_START` with
  `FLY_APP_NAME` set stops the server before it opens the store.
- Unit tests keep passing `now` explicitly. Nothing in `cargo test`'s unit
  tests depends on the offset, since `start_at` is never called there.
- fmt, clippy, `cargo test`, `pnpm typecheck`, `pnpm test` (the spec's unit
  checks on scripts) pass before each push.

## Review focus

1. **Every instant comes from `now_ms()`.** No other `SystemTime::now`,
   `Utc::now` or `chrono::Local::now` in `server/src` outside `time.rs`.
   (Task 1.)
2. **The clock can't be moved once set,** and can't be set on Fly. (Task 1.)
3. **The night test checks a night, not just a gap:** the 7:00 refill, the
   board's lines dated between the stop and the start, traces, trust, the
   furniture. (Task 2.)
4. **Flakiness:** every number the binary tests assert is exact (steps,
   refills, the cap) or a generous bound (`took_ms`). Outcomes left to the
   random generator (a night line, a trace) were seen to hold for every one
   of 300 seeds, and the café's seed is fixed by its first start. (Task 2.)
5. **`waking.rs` still checks what slice 07 promised** with the rewrite of
   `saved_at` gone. (Task 3.)

## Decisions made in this plan

1. **An offset, not an injected clock object.** `now_ms()` has nine callers
   across four files, all happy with "now". A `Clock` passed through
   `AppState`, the world task and `wake` would change every signature for
   the same behaviour. An offset fixed once in a `OnceLock` keeps
   `now_ms()`'s contract and can't drift mid-run.
2. **Real speed, not accelerated.** The binary's own loop runs at 10 ticks
   a second as it does live. Long spans are the replay's job, already in
   one-second steps.
3. **RFC 3339 with an offset** (`2026-10-16T23:00:00+11:00`), parsed by
   chrono, so a test says exactly which Canberra instant it means across
   daylight saving.
4. **The café's random seed.** A first start seeds the generator from
   `now` (`main.rs` passes `now` as `fresh_seed`), so a café first started
   at a fixed mocked instant gets nearly the same seed every run, give or
   take the milliseconds before it reads the clock. The evening also runs
   live for a few seconds, a varying number of ticks, so the night isn't
   the same night every run. The test asserts only what held across 300
   seeds with jittered starts.
5. **`listening` carries `clock`:** `"wall"`, or the RFC 3339 start. The log
   check requires the field on every start, so a café on mocked time is
   never mistaken for the live one in a log.
6. **`waking.rs` keeps the raised cap.** A sleep of 7 days on the mocked
   clock replays 7 days, which is what gives a sign-up and a socket time to
   happen during the replay. The rewrite of `saved_at` goes. The start
   after it is set 7 days later instead.

## Tasks

### Task 1: One clock, startable at a chosen instant

**Files:** `server/src/time.rs`, `server/src/config.rs`,
`server/src/main.rs`, `server/tests/clock.rs` (new),
`scripts/check-logs.ts`, `spec/check-logs.test.ts`.

- [ ] Tests first:
  - `time.rs`: `parse_start("2026-10-16T23:00:00+11:00")` is that instant
    in ms; `parse_start("tomorrow")` and a time with no offset are errors.
    `offset_for(start, wall)` is `start - wall`, negative included.
    `now_with(offset, wall)` is `wall + offset`.
  - `config.rs`: `clock_start` is `None` without the variable, and the
    variable's text with it.
  - `server/tests/clock.rs`, the built binary: started with
    `CAFE_CLOCK_START=2026-10-16T23:00:00+11:00`, its `listening` line says
    `"clock":"2026-10-16T23:00:00+11:00"`. Log lines' own `timestamp` is
    tracing's wall time, so the café's clock is checked through what it
    saves: after a stop, `saved_at` in the database is within a minute
    after that instant. Started with `CAFE_CLOCK_START=tomorrow`, or with
    any value and `FLY_APP_NAME=x`, it exits non-zero within 10 s with one
    JSON error line naming `CAFE_CLOCK_START`, and never logs `listening`.
    Without the variable, `listening` says `"clock":"wall"`.
  - `check-logs`: a `listening` line without `clock` is a problem.
- [ ] Implement:
  - `time.rs`: `static OFFSET: OnceLock<i64>`; `pub fn start_at(at: u64)`
    sets it from the wall clock (a second call is a bug: it panics);
    `now_ms()` is `now_with(OFFSET.get().copied().unwrap_or(0), wall)`;
    `pub fn parse_start(text) -> anyhow::Result<u64>`.
  - `config.rs`: `clock_start: Option<String>` from `CAFE_CLOCK_START`.
  - `main.rs` `run()`: before anything else, if `clock_start` is set, refuse
    on Fly (`behind_fly`), else parse it and `start_at` it; errors return
    from `run`, so `main` logs them as its one error line and exits 1.
    `listening` gains `clock`.
  - `check-logs.ts` requires `clock` on `listening`; its test lines get one.
- [ ] fmt, clippy, test, commit and push ("Let the café start its clock at
  a chosen instant, never on Fly").

### Task 2: A night, a midnight and nine days on the built binary

**Files:** `server/tests/long_gaps.rs` (new), `server/tests/common/mod.rs`
(new: `Cafe`, `Socket`, `signup`, shared with `waking.rs`).

- [ ] Move `Cafe`, `Socket`, `signup`, `copy_dir` from `waking.rs` into
  `server/tests/common/mod.rs`, unchanged except that `Cafe::start` takes
  the clock's start (`Option<&str>`) and the content directory. `waking.rs`
  passes `None` for now and still passes.
- [ ] Tests first, in `long_gaps.rs`, each in its own data directory, with
  the repo's content:
  - **`a_night_from_eleven_to_half_past_seven`.** Start at
    `2026-10-16T23:00:00+11:00`. Sign up; open a socket; pet each cat until
    one sniffs (as `spec/helpers.ts`'s `meetACat`); note the trust; leave;
    wait for the next 5-second save; stop. Start at
    `2026-10-17T07:30:00+11:00`. Its `woke` line: `first` false,
    `gap_secs` within 10 s of 30,600 (the first start ran a few seconds),
    `steps` equal to `gap_secs` within 1, `refills` 1, `capped` false,
    `failed` false, every cat in `walks` and some walk above 0, `took_ms`
    under 20,000. The visitor's welcome: the same trust for that cat,
    `bowls` the café's portions (3), at least one board line dated after
    the stop's `saved_at` and before 07:30, at least one toppled piece, and
    every piece at the place it stood before the stop. The test prints the
    board's lines, oldest first, as Canberra times and their fields, for
    the judged line.
  - **`treats_used_before_midnight_come_back_in_the_morning`.** Start at
    `2026-10-16T23:00:00+11:00`; sign up; put down treats until
    `yourTreats` says 0; leave; stop. Start at
    `2026-10-17T07:30:00+11:00`: the welcome's `yourTreats` is 3.
  - **`nine_days_asleep_replay_the_last_three`.** Start at
    `2026-10-16T23:00:00+11:00`; stop once `woke`; start at
    `2026-10-25T23:00:00+11:00`: `gap_secs` within 10 s of 9 days,
    `steps` 259,200, `capped` true.
- [ ] Implement nothing new in the server: these pass on Task 1. If one
  fails, that's a finding about the café, fixed test first.
- [ ] fmt, clippy, test, commit and push ("Live through a night, a midnight
  and nine days on the built café, on mocked time").

### Task 3: Slice 07's tests sleep on the mocked clock

**Files:** `server/tests/waking.rs`.

- [ ] The three tests start the first café at a fixed instant
  (`2026-10-16T23:00:00+11:00`) and the second 7 days later
  (`2026-10-23T23:00:00+11:00`), with no `set_saved_at`. Remove
  `set_saved_at` and the test's own `now_ms`. The stop test's check
  becomes: `saved_at` after the stop equals `saved_at` before the second
  start. Each test is run and seen to pass. Since the assertion that
  `saved_at` is left alone has to be seen failing too, break it on purpose
  once (assert a different value) and see it fail.
- [ ] fmt, clippy, test, commit and push ("Wake slice 07's café from a
  week on the mocked clock, not a rewritten save").

### Task 4: Move the night lines off the live café

**Files:** `docs/slices/01-the-cafe-keeps-living-while-it-sleeps.md`,
`docs/slices/02-what-the-night-left-behind.md`, `docs/design.md`
(Persistence and fast-forward, Checks, Harness's ADR list),
`docs/notes/slice-01-wake.md`, `docs/notes/slice-02-board.md`,
`docs/notes/slices-01-02-status.md`, `docs/notes/plan.md`.

- [ ] Slice 01's last done-when line becomes "Waking after a night takes a
  few seconds at most", held by `cargo test`, the night test, bounded at
  20 s in a debug build. Slice 02's judged line is on the board the night
  test prints. Both statuses say what's left (the user's reading of the
  printed board for 02).
- [ ] design.md: the Checks section lists the binary tests on mocked time,
  the variable and its guard; Harness links ADR 0016.
- [ ] Notes: the live night reading is no longer pending.
- [ ] Commit and push ("Hold the night lines with mocked time, not a real
  night").

### Task 5: Review

- [ ] Brief a fresh reviewer in `docs/notes/reviews/slice-08-brief.md`,
  findings in `slice-08-findings.md`. Fix each finding test first, or
  answer it.

### Task 6: Deploy

- [ ] Push to `main` runs CI (the Rust job runs the new binary tests; the
  check job runs the log check, which now requires `clock`). Check after the
  deploy that the live `listening` line says `"clock":"wall"`.

## Execution log

Where carrying out this plan departed from it, task by task, and why.

- **Task 1** ([`5805cdf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5805cdf)).
  As planned. A grep for `SystemTime`, `Utc::now`, `Local::now` and
  `UNIX_EPOCH` in `server/src` outside `time.rs` found nothing, and the
  store uses none of SQLite's own clock functions.
- **Tasks 2 and 3 went in together** ([`b167901`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b167901)). Moving the shared helpers out of
  `waking.rs` meant rewriting its three tests' starts anyway, so they moved
  to the mocked clock in the same change, rather than once to the helpers
  and again to the clock. The stop test's "save as it was" check, which now
  compares with the save the first start wrote instead of a rewritten one,
  was broken on purpose and seen to fail (`1792152000031`, 31 ms after
  Friday 23:00, against a wrong value), then restored.
- **The bowls at 07:30 are the night's business.** The night test first
  asserted the morning welcome's bowls were full (3), and it failed with 0.
  A throwaway replay of the same night, seeds 1 to 20, found the 7:00
  refill fills them to 3 every time, and the three cats, hungry since the
  18:00 refill, empty them within 0 to 9 minutes. The café is right and the
  test was wrong. It now checks the saved bowls are on Saturday's 7:00
  refill (`…|2026-10-17@420`), with `refills: 1` in the wake-up line.
- **The treats test** first opened its socket before the morning café was
  listening (connection refused). Now `Cafe::start` waits for `listening`.
- **A port race in the binary tests.** One run of the three binary files
  failed: `waking.rs`'s leave test timed out after 30 s waiting on a first
  start's `woke`, and the message wasn't kept. It didn't come back in 12
  sequential runs or 45 concurrent ones. Reading the helpers found a race
  that fits it: each test chose a port by binding port 0 and letting it go,
  then gave the number to the café, so another process could take it in
  between, and the café's bind would fail and exit. It was there before
  this slice (the old `waking.rs` did the same), and the new test files,
  running beside it, made it likelier. Fixed at the source, test first: the
  café's `listening` line logs the port it bound rather than the one it was
  given (`a_cafe_given_port_zero_says_which_port_it_took`, seen failing with
  0), and every binary test starts the café on `PORT=0` and reads its port
  from `listening`. On Fly `PORT=8080` binds 8080, so the line is unchanged
  there.
- **Task 4** ([`2d51fa3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2d51fa3)).
  As planned. Slice 01 went to `Live`, since its last line is now held by
  a test.
- **Checked on the image before the push, as CI does** (2026-10-17, 19:01
  AEDT): the Dockerfile built here and run on a throwaway volume. Its
  `listening` said `"port":8080,"clock":"wall"`, as the live café will.
  `pnpm check` passed against it (the client's 89 checks, the spec's 63,
  the browser checks and the restart among them), and the log check passed
  over its 291 lines across both starts.
- **Task 5, the review** ([findings](reviews/slice-08-findings.md)): 2 major
  findings and 8 minor, all answered there. Both majors were checks that
  could pass without the behaviour, and each fix was seen failing under the
  fault it holds: a café that forgets treat rows, and one whose
  `restore_arrangement` does nothing.
- **A first answer to finding 2 was itself flaky**, caught by the
  concurrent stress run before it was pushed. It waited for an empty café's
  cats to knock something over live, which usually took under a minute.
  On one seed all three cats ate and lay down to nap, and nothing fell in
  300 s. It also first restarted at 07:30, and under the faulty
  `restore_arrangement` it still passed, because the night's replay knocked
  the same pieces over again. The test now puts a trace in the save the
  café wrote (the first piece of a kind `furniture.toml` says a cat can
  knock over) and restarts at the instant it stopped, so the replay has no
  steps and only the store can keep the piece down. It runs in 7 s.
- **Task 6, deployed (2026-10-21).** The user said "merge it". `main`
  fast-forwarded from `7b1a740` to `e702baf`, and CI run 39526943033 passed
  all three jobs: rust, check (the log check now with `--wall`) and deploy.
  After it, the live café's start at 12:30:52 AEDT logged build `mvhfoihc`,
  `"port":8080,"clock":"wall"`, and woke after 25 minutes asleep (1,506
  steps in 8 ms). The page answered 200. The start before the deploy (build
  `mv91rjsh`) had no `clock` field.
- **What the night test's board shows**, for slice 02's judged line: 4 lines
  from 8½ hours, the visitor's first meeting at 23:00 and three knock-overs
  by 23:05 (the toys, then both plants), and nothing after. Once everything
  knockable is down, the cats do nothing the board counts. The same was seen
  on the live board on 15 October ([slice-02-board.md](slice-02-board.md)).
  The test holds slice 02's rule (a night leaves lines and traces); whether
  it reads like the café's story is the user's to judge, and this board is
  the evidence.
