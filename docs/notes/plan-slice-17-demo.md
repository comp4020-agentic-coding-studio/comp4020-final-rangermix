# Slice 17, part 1: markers see weeks of the café in ten minutes, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> (this repo builds natively, AGENTS.md "How the work is built"). Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** demo accounts (`demo1`, `demo2`) that markers log into from the
README, which move the café's clock forward through a replay, add and
remove bots, from a floating bar at the top of the room; the page keeps the
server's clock; trust seeded by `cafe demo seed`. Part 2 (the furniture
sets) is not in this plan.

**Architecture:** the café's clock becomes wall + a start offset (tests) +
an `ahead` that only grows, saved in the `world` table. A jump is two steps
in the world task: the world answers the ask with `jumping` to everyone and
holds the jump; the task then runs the jump off the runtime
(`spawn_blocking`): people are settled and set aside, the gap is replayed by
`World::replay` exactly as a sleep, people come back with their timers moved
on by the gap, `ahead` grows by the gap, and everyone gets a fresh welcome.
Bots are `Person`s with a `bot` field, ids from `BOT_IDS` up, never stored,
never met by the cats. The demo flag is a `users` column, set only by the
seed.

**Tech Stack:** Rust (tokio, axum, rusqlite, chrono-tz, ts-rs), TypeScript
(Vite, vitest), Playwright, Docker in CI.

**Spec:** [docs/slices/17-markers-see-weeks-in-ten-minutes.md](../slices/17-markers-see-weeks-in-ten-minutes.md),
[ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md).

Written 2026-11-06 from the code at `5efb730` (main at `5a3a1df`).

## Global Constraints

- Demo accounts: `demo1`, `demo2`; password `catppuccino`, given to the seed
  as `CAFE_DEMO_PASSWORD`; seed trust Mochi 85, Tora 55, Burakku 25.
- Sign-up refuses `demo` followed only by digits, and names starting `bot_`,
  ignoring case.
- A jump goes to the next time it's HH:MM in Canberra, at most
  `jump_max_hours = 24` on, never back; at most one per
  `jump_every_secs = 60` in the café.
- "Canberra time" jumps forward by `DAY - ahead % DAY` (refused when
  `ahead % DAY == 0`).
- Bots: `bots_max = 6`, `bot_stay_mins = 15`; named `bot_1` to `bot_6`
  (smallest free number); they walk and emote, never talk, sit, handle a
  cat or touch furniture.
- The bar's times: Morning 07:00, Afternoon 13:30, Evening 18:30, Night 23:30.
- Never log what anyone says, or the demo password.
- Every instant still comes from `time::now_ms`; nothing else reads the wall
  clock (`only_this_file_reads_the_wall_clock`).
- Generated TypeScript is regenerated, never edited:
  `cargo test -p cafe export_bindings`.

## Review Focus

1. **A jump while someone is mid-walk, carrying a piece, holding a cat, on a
   lap, or dropped within the grace period.** Expect: walks end where they
   are, the piece goes back, the cat is put down, the lap ends, and nobody
   is walked out or timed out by the jump itself. Pinned in task 5
   (`a_jump_settles_people_and_walks_nobody_out`).
2. **An action that was in flight when the jump began** (a walk sent a
   moment before `jumping` reached the page). Expect: refused with
   `movedOn`, not applied to the new hour. Pinned in task 6
   (`actions_queued_during_a_jump_are_refused`).
3. **A restart after a jump.** Expect: the café's clock is still ahead, never
   behind the last save, so no cat's timers sit in the future. Pinned in
   task 6 (binary test `the_clock_stays_ahead_across_a_restart`).
4. **Bots when their demo account drops or leaves, or fills the café.**
   Expect: they leave with it; the line works as for people; a bot never
   gets a trust row or a board line. Pinned in task 7.
5. **The seed run against a name a visitor already holds.** Expect: refused
   loudly, nothing changed. Pinned in task 3
   (`the_seed_never_takes_over_a_visitors_account`).

---

### Task 1: The café's clock only moves forward, and is saved

**Files:**
- Modify: `server/src/time.rs` (an `AHEAD: AtomicU64`; `now_ms`; helpers)
- Modify: `server/src/store.rs` (`PRAGMA busy_timeout = 5000` in `open`)
- Modify: `server/src/world/mod.rs` (`ahead` field, saved as world key `ahead`)
- Modify: `server/src/wake.rs` (`Kept` loads `ahead`)
- Modify: `server/src/main.rs` (load `ahead` into the clock before `now`)

**Interfaces:**
- Produces: `time::DAY_MS: u64 = 86_400_000`; `time::ahead_ms() -> u64`;
  `time::set_ahead(ms: u64)` (keeps the larger, so never back);
  `time::next_time_of_day(now: u64, minute: u32) -> Option<u64>` (the first
  instant after `now` whose Canberra time is `minute` past midnight, `:00`
  seconds, within 25 hours; None in a daylight-saving gap);
  `time::realign_gap(ahead: u64) -> Option<u64>` (`DAY_MS - ahead % DAY_MS`,
  None when it's already whole days); `World::ahead() -> u64`;
  `World::restore_ahead(ms)`; store key `ahead` in `world`.

- [ ] Tests first, in `time.rs` (pure, no global state):
  `the_next_time_of_day_is_later_today_or_tomorrow` (14:00 → 23:30 is 9.5 h;
  23:45 → 07:00 is 7.25 h; 14:00 → 14:00 is 24 h);
  `a_time_in_the_spring_gap_doesnt_happen` (2026-10-04 02:30 AEDT gap → None
  when asked at 01:00 that night);
  `canberra_time_realigns_by_whole_days` (`realign_gap(0) == None`,
  `realign_gap(DAY) == None`, `realign_gap(3h) == Some(21h)`);
  `the_clock_is_wall_plus_offset_plus_ahead` (`clock_at(offset, ahead, wall)`).
  In `wake.rs`: `a_saved_lead_wakes_with_the_world` (put `ahead` 3 h, wake,
  `world.ahead() == 3h`). In `store.rs`: none (pragma).
- [ ] Run `cargo test -p cafe time:: wake::` → fail; implement; pass.
- [ ] `main.rs`: after `Store::open`, read `world.ahead`, `time::set_ahead`,
  then `let now = time::now_ms()`; the `listening` line gains `ahead_ms`.
- [ ] `cargo test -p cafe` passes; commit and push.

### Task 2: Demo accounts in the store; sign-up keeps the café's names

**Files:**
- Modify: `server/src/store.rs` (migration 4; `UserRow.demo`; `set_demo`,
  `delete_bans_for`)
- Modify: `server/src/auth.rs` (`reserved_username`)
- Modify: `server/src/api.rs` (sign-up refuses reserved names: 409
  `nameTaken`, "That name is the café's own.")
- Test: `spec/accounts.test.ts`

**Interfaces:**
- Produces: `ALTER TABLE users ADD COLUMN demo INTEGER NOT NULL DEFAULT 0`;
  `UserRow { .., demo: bool }`; `store::set_demo(conn, id, bool)`;
  `store::delete_bans_for(conn, user_id)`;
  `auth::reserved_username(&str) -> bool`.

- [ ] Tests: `auth::tests::the_cafes_own_names_are_reserved` (`demo1`,
  `DEMO42`, `bot_1`, `Bot_x` reserved; `demo`, `demox`, `demo_1`, `robot_1`,
  `demolish` not); `store::tests::a_user_is_a_demo_account_only_when_set`;
  `spec/accounts.test.ts` "the café's own names can't be signed up"
  (`demo7`, `bot_7` → 409).
- [ ] Implement; `cargo test -p cafe` passes; commit and push.

### Task 3: `cafe demo seed`

**Files:**
- Create: `content/demo.toml`, `server/src/demo.rs`
- Modify: `server/src/main.rs` (`cafe demo seed` before the server starts)

**Interfaces:**
- Consumes: task 2's store functions; `content::load`'s cats.
- Produces: `demo::Seed { accounts: Vec<SeedAccount { name, avatar, colour }>, trust: BTreeMap<String, f32> }`;
  `demo::read(content_dir: &Path, cats: &[CatDef]) -> anyhow::Result<Seed>`
  (every name reserved and valid, every cat known, trust 0 to 100, looks in
  range); `demo::seed(store: &Store, seed: &Seed, password: &str, now: u64) -> anyhow::Result<()>`.
  Per account: missing → insert with a random recovery code (never shown)
  and `demo = 1`; a demo account → new password and code; anyone else's →
  error naming it, before anything is written. Then each cat's trust row
  (`day = canberra_day(now)`, `gained_today = 0`) and `delete_bans_for`.
  One `operator` line per account and per cat; never the password.

- [ ] Tests in `demo.rs` on a temp store:
  `the_seed_makes_demo_accounts_that_cats_already_know`;
  `seeding_again_puts_the_trust_back_and_lifts_bans`;
  `the_seed_never_takes_over_a_visitors_account`;
  `the_repos_seed_names_real_cats` (reads `content/`);
  `the_seed_never_logs_the_password` (`test_logs::LogSink`).
- [ ] `main.rs`: `args[1..] == ["demo", "seed"]` → open the store, load
  `ahead`, read content and seed, `CAFE_DEMO_PASSWORD` required (a valid
  password), exit 0, or one JSON `error` line and exit 1.
- [ ] Commit and push.

### Task 4: Demo people, the protocol, and refusals

**Files:**
- Modify: `server/src/protocol.rs`, `server/src/ws.rs` (`Command::Join` and
  `Input::Join` carry `demo`), `server/src/world/mod.rs`,
  `server/src/world/people.rs` (welcome built by one function)
- Regenerate: `client/src/protocol/`

**Interfaces:**
- Produces: `ClientMsg::SetClock { minute: Option<u32> }` (None: Canberra
  time), `ClientMsg::AddBot {}`, `ClientMsg::RemoveBot {}`;
  `ServerMsg::Jumping { by: String, to: u64 }`;
  `Welcome { .., demo: bool, ahead: u64, next_jump: u64 }`;
  `PersonView { .., bot: bool }`; `ErrorCode::{NotDemo, TooSoon, BadTime,
  BotsFull, NoBots, MovedOn}`; `Person { .., demo: bool, bot: Option<Bot> }`;
  `World::welcome(&self, id, now) -> ServerMsg`; action names `set_clock`,
  `add_bot`, `remove_bot`.

- [ ] Tests (world): `only_a_demo_account_moves_the_clock_or_adds_bots`
  (each of the three from a visitor → `notDemo`, logged refused);
  `a_demo_accounts_welcome_says_so` (`demo`, `ahead`, `next_jump`).
- [ ] Implement; regenerate the TypeScript; the client typechecks
  (`pnpm -C client check`); commit and push.

### Task 5: A jump in the world

**Files:**
- Create: `server/src/world/jump.rs`, `server/src/world/jump_tests.rs`
- Modify: `server/src/world/mod.rs`, `server/src/tuning.rs`,
  `content/tuning.toml` (`jump_max_hours`, `jump_every_secs`)

**Interfaces:**
- Produces: `World::ask_jump(now, id, minute: Option<u32>, out)`;
  `World::take_jump() -> Option<Jump>`; `pub struct Jump { by: u32, to: u64 }`;
  `World::run_jump(now: u64, jump: Jump) -> Vec<Out>` (welcomes to each
  person; `self.ahead += to - now`; `last_jump = to`; one `cafe` line
  `what = "jumped"` with who, gap_secs, steps, took_ms, refills, walks).

- [ ] Tests in `jump_tests.rs` (worlds at fixed Canberra times):
  `a_jump_goes_to_the_next_time_of_day` (14:00 → 23:30: `ahead` +9.5 h,
  everyone's welcome `now` is the target);
  `a_jump_is_one_a_minute` (`tooSoon` within 60 s of the last);
  `a_jump_never_goes_past_a_day` (DST-gap time → `badTime`);
  `canberra_time_is_refused_when_already_on_it`;
  `a_jump_lives_the_hours_between` (14:00 → 19:00: the 18:00 refill counted;
  across midnight: treats back and a new trust day);
  `the_same_save_and_jump_make_the_same_cafe` (two worlds, same seed);
  `a_jump_settles_people_and_walks_nobody_out` (mid-walk, carrying, holding
  a cat, on a lap, hidden tab with someone waiting, dropped in its grace:
  all still there after, nothing held, timers moved on by the gap);
  `no_cat_is_left_on_a_persons_tile`.
- [ ] Implement; commit and push.

### Task 6: The world task runs the jump; the clock moves

**Files:**
- Modify: `server/src/ws.rs`; Test: `server/tests/clock.rs`, a new
  `spec/demo.test.ts`

- [ ] `world_task`: after delivering a message's outs, `take_jump()` → move
  the world into `spawn_blocking(run_jump)` and back; `time::set_ahead`;
  deliver the welcomes; then drain what queued meanwhile: actions get
  `movedOn` (presence, here and leave go through).
- [ ] Tests: `ws::tests::actions_queued_during_a_jump_are_refused` (the drain
  function on a list of commands); binary
  `the_clock_stays_ahead_across_a_restart` (seed demo1 with the subcommand,
  start on `CAFE_CLOCK_START`, jump to +2 h, stop, start: the welcome's
  `now` ≥ the target, the `listening` line's `ahead_ms` ≥ 2 h);
  `spec/demo.test.ts` (skipped without `APP_DEMO_PASSWORD`): two visitors
  both get `jumping` then a welcome within a second of each other, the
  target two minutes on; a visitor's `setClock` → `notDemo`.
- [ ] CI: seed the volume before the app starts
  (`docker run --rm -v app-data:/data -e CAFE_DEMO_PASSWORD=catppuccino app /app/cafe demo seed`),
  `APP_DEMO_PASSWORD: catppuccino` for the spec, `catppuccino` added to
  `check-logs.ts`'s never-logged list. Commit and push.

### Task 7: Bots

**Files:**
- Create: `server/src/world/bots.rs` (with tests)
- Modify: `server/src/world/{mod,people,quiet,cat_life}.rs`, tuning

**Interfaces:**
- Produces: `struct Bot { by: u32, until: u64, next: u64 }`;
  `BOT_IDS: u32 = 4_000_000_000`; `World::add_bot(now, by, out)`,
  `World::remove_bot(now, by, out)` (newest first), `World::bots_tick(now, out)`
  (expired → out; every 20 to 40 s a walk to a random free tile, or an
  emote); `remove` takes a demo's bots with it.
- [ ] Tests: `bots_fill_the_cafe_and_the_next_waits_at_the_window`;
  `a_bot_leaves_when_removed_with_its_demo_or_after_fifteen_minutes`;
  `bots_are_never_met_trusted_or_written_on_the_board`;
  `bots_never_go_quiet`; `bots_come_through_a_jump`;
  `spec/demo.test.ts`: four bots, then a new visitor lands at the window;
  one removed, they walk in.
- [ ] Commit and push.

### Task 8: The page keeps the café's clock, and waits through a jump

**Files:**
- Modify: `client/src/canberra.ts` (`cafeHour(state, localNow)`),
  `client/src/stage.ts`, `client/src/music.ts` or `musicPanel.ts`'s hour,
  `client/src/state.ts` (`demo`, `ahead`, `nextJump`), `client/src/cafe.ts`
  (`jumping` → the waking cover with "demo1 moved the café on to 23:30.
  Time passes…"), `client/src/main.ts`, `client/index.html` (the cover's text
  by id)
- [ ] Tests (vitest): `the café's hour comes from the server, not the device`;
  `a jump covers the café until its welcome, saying who and when`;
  `a welcome keeps whether you're a demo account and how far ahead`.
- [ ] Commit and push.

### Task 9: The demo bar

**Files:**
- Create: `client/src/demoBar.ts` (view model and wiring), tests
  `client/test/demoBar.test.ts`
- Modify: `client/index.html`, `client/src/style.css` (or the stylesheet the
  panels use), `client/src/main.ts`, `spec/browser.test.ts`

**Interfaces:**
- Produces: `PRESETS: { label, minute }[]`; `aheadText(ms) -> string`
  ("on Canberra time", "3 h ahead", "a day ahead", "2 days ahead");
  `minuteOf("HH:MM") -> number | null`; `hourOn(cafeMinute) -> number`;
  `waitText(nextJump, now) -> string | null` ("next jump in 40 s").
- [ ] Tests: the view model's functions; `contrast` for the bar's text over
  the room; browser checks at 1920×1080 and 390×844: a visitor sees no bar;
  demo1 sees it, opens Time by keyboard (Enter), jumps by a typed time two
  minutes on, the cover shows and goes; Escape closes; on the phone a tap on
  Bots, then Add, adds a bot; the bar survives a resize mid-use.
- [ ] Commit and push.

### Task 10: Logs told as sentences; the docs

- [ ] `scripts/narrate.ts`: `set_clock`, `jumped`, `add_bot`, `remove_bot`,
  `demo_seed`; `spec/narrate.test.ts` cases first.
- [ ] `docs/design.md` "Showing it to markers" marked built (part 1), its
  numbers in "Numbers to tune"; `docs/notes/slice-17-demo.md` (what was
  checked, and how to seed the live café); root plan's status.
- [ ] Commit and push. Then the fresh review (brief and findings in
  `docs/notes/reviews/slice-17-*.md`), every finding fixed test first or
  answered, a pull request, and, once merged and deployed, the seed on Fly,
  a restart, and the marker's path walked live.

## Execution log

Where the build departed from this plan, task by task.
