# Slice 01, "The café keeps living while it sleeps": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively in one session, test first (each test seen failing before
> its code), committed and pushed per task (a push to `main` deploys
> through CI), then a fresh review whose brief and findings are files, then
> deployed and checked live.

**Goal:** when the machine has been stopped (idle, deploy or crash), the
server loads the café, replays the gap in one-second steps by the same
rules it runs live, at most the last 7 days, logs one summary line, and
only then opens the doors.

**Architecture:** the world's random generator and clock are saved with the
cats every 5 seconds and on the stop signal. A new `server/src/wake.rs`
loads everything, builds the world at the saved clock, and calls
`World::replay(now)` (new, `server/src/world/replay.rs`), which ticks the
world in 1,000 ms steps with the store detached and logging silenced, then
saves once. `main.rs` binds the port only after `wake` returns.

**Tech stack:** Rust (tokio, axum, rusqlite, rand 0.10 with `rand_chacha`
0.10's `serde` feature, tracing), the TypeScript narrator and log check in
`scripts/`, vitest in `spec/`, GitHub Actions.

**Spec:** [`docs/slices/01-the-cafe-keeps-living-while-it-sleeps.md`](../slices/01-the-cafe-keeps-living-while-it-sleeps.md),
approved 2026-10-14 with its proposed default for the open question (the
page's usual "Connecting…" until the doors open). Design:
[`docs/design.md`](../design.md) "The world never stops", "Persistence and
fast-forward", "Logging"; [ADR 0005](../adr/0005-keep-all-state-in-sqlite-on-the-volume.md),
[ADR 0006](../adr/0006-fast-forward-the-world-when-the-server-wakes.md).
Written 2026-10-14 from the code at `9cf5846`.

## Global constraints

- Simulation: 10 steps a second live; 1-second steps in fast-forward, at
  most 7 days.
- Cat state, the world clock and the random state saved every 5 seconds,
  and on stop, in one store job (one transaction).
- Bowl refills at 7:00, 12:00 and 18:00 Canberra time, 3 portions; 3
  treats per visitor per Canberra day. Canberra time is `Australia/Sydney`,
  daylight saving included.
- AGENTS.md: never store or log what anyone says; the server decides every
  outcome; trust never fades with absence (a replay is absence by
  definition, so it changes no one's trust).
- Every log line is one JSON object with a `timestamp` and a `target`,
  including a failure to start.
- One 256 MB machine; `/` and `/readme/` keep working; `pnpm check` runs
  against the running image; `cargo fmt --check`, `cargo clippy
  --all-targets -- -D warnings` and `cargo test` pass before each push.
- No protocol change in this slice: `client/src/protocol/` stays as it is.

## Review focus

The five conditions the spec implies but no "done when" line tests, most
likely first. Each has its test in the task that owns the code.

1. **The saved clock is ahead of the wall clock** (a clock that stepped
   back): no replay, no panic, a summary line with zero steps. (Task 3.)
2. **The saved random state or clock is unreadable** (hand-edited, or a
   format change): the café still wakes, on a fresh generator, and a
   warning line says so; a clock without a random state (every save made
   before this slice) still replays its gap. (Task 3.)
3. **A replay knocks something over**: the toppled piece is saved before
   the doors open, so a crash right after waking doesn't undo the night.
   (Task 2.)
4. **A first boot, with nothing saved**: no replay, and the summary says
   the café opened for the first time. (Task 3.)
5. **A long replay holds the doors**: the 7-day worst case is measured in
   a release build and recorded, so the cap's cost is known. (Task 6.)

## Decisions made in this plan

1. **The replay is quiet.** Inside `World::replay`, logging is silenced
   (`tracing::subscriber::with_default(NoSubscriber)`), so a wake-up
   writes no backlog of hundreds of `cat` lines stamped with the wrong
   time. It writes one `cafe` line, `what = "woke"`, with `first`,
   `gap_secs`, `steps`, `capped`, `took_ms`, `refills` and each cat's
   `walks` ("Burakku:40 Mochi:3 Tora:12").
2. **The store is detached during a replay**, then the world saves once:
   cats, bowls, clock, random state and arrangement. A replay is an
   in-memory simulation; what it changed is durable before anyone is let in.
3. **The random state is saved as JSON** with `rand_chacha`'s `serde`
   feature (seed, stream and word position), under `world` key `rng`,
   beside the existing `saved_at` clock and `bowls`, in the same job.
4. **`World::new` takes the generator** (`rng: ChaCha8Rng`) instead of a
   seed. The caller decides: the saved one, or a fresh one seeded from the
   clock.
5. **The world is built at the replay's start**, not at the wall clock: the
   saved clock, or a week before now if it slept longer. Bans are loaded
   against the wall clock, since a replay involves no people.
6. **Every start logs its summary**, a first boot included (`first: true`,
   zero steps). `scripts/check-logs.ts` holds that every `listening` line
   follows its own `woke` line, with numbers.
7. **Any startup failure is one JSON `error` line and exit code 1.**
   `main` becomes `run()` plus a wrapper, so a database that won't open
   (or content that won't load) is logged as the café's own line rather
   than a bare `Error:`.
8. **CI keeps `/data` on a named Docker volume** instead of a `tmpfs`, so
   `docker stop` then `docker start` keeps the database, and the spec's
   stop-and-start check runs there through `APP_RESTART`. Locally that
   check is skipped unless `APP_RESTART` is set.

## Not in this plan

- Chalkboard lines and night traces are slice 02's. Once it adds them, the
  replay writes them like any other step, and the end-of-replay save
  includes them.
- What a visitor sees while the café wakes is unchanged (the decision on
  the spec's open question): the page's "Connecting…" or "Reconnecting…".

## Tasks

### Task 1: Save the clock and the random generator with the cats

**Files:**
- Modify: `server/Cargo.toml` (`rand_chacha = { version = "0.10", features = ["serde"] }`)
- Modify: `server/src/world/mod.rs` (`World::new(.., rng: ChaCha8Rng, ..)`, `save`)
- Modify: `server/src/world/cat_life.rs`, `server/src/world/cats_tests.rs`,
  `server/src/world/people.rs` (test callers of `World::new`), `server/src/main.rs`
- Test: `server/src/world/cat_life.rs` (`saving_writes_each_cat_the_clock_and_the_random_state`)

**Interfaces:**
- Produces: `World::new(content, trust, saved_cats, arrangement, rng: ChaCha8Rng, store, build, now)`;
  the store's `world` table holds `rng` (JSON of `ChaCha8Rng`) and
  `saved_at` (the tick time, as text) after every `World::save`.

- [ ] **Step 1: Write the failing test.** Extend
  `saving_writes_each_cat_and_the_clock` into:

```rust
#[tokio::test]
async fn saving_writes_each_cat_the_clock_and_the_random_state() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("cafe.db")).unwrap();
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    let mut w = World::new(content, trust, Vec::new(), SavedArrangement::Fresh,
        ChaCha8Rng::seed_from_u64(13), Some(store.clone()), "test".into(), 0);
    for step in 1..=50u64 {
        w.tick(step * 100);
    }
    w.save(5_000);
    let states = store.call(|c| crate::store::all_cat_states(c)).await.unwrap();
    assert_eq!(states.len(), 3);
    let saved_at = store.call(|c| crate::store::get_world(c, "saved_at")).await.unwrap();
    assert_eq!(saved_at.as_deref(), Some("5000"));
    let rng = store.call(|c| crate::store::get_world(c, "rng")).await.unwrap().expect("the random state is saved");
    let back: ChaCha8Rng = serde_json::from_str(&rng).unwrap();
    assert_eq!(back, w.rng, "it carries on where the world's generator is");
}
```

- [ ] **Step 2: Run it and see it fail** (`cargo test -p cafe saving_writes`):
  it doesn't compile, since `World::new` takes a seed.
- [ ] **Step 3: Implement.** Enable the feature; change `World::new`'s
  `seed: u64` to `rng: ChaCha8Rng` (`rng,` in the struct literal); in
  `save`, serialise `self.rng` before the closure and write
  `put_world(conn, "rng", &rng)?` beside `bowls` and `saved_at`. Update the
  five test callers to `ChaCha8Rng::seed_from_u64(n)` with their old seeds,
  and `main.rs` to `ChaCha8Rng::seed_from_u64(now)` for now (Task 3
  replaces it).
- [ ] **Step 4: Run `cargo test -p cafe`**: everything passes, the
  existing seeded tests unchanged.
- [ ] **Step 5: fmt, clippy, commit and push** ("Save the café's clock and
  random state with the cats").

### Task 2: Replay a gap by the live rules

**Files:**
- Create: `server/src/world/replay.rs` (`replay_start`, `MAX_REPLAY_MS`, `Replay`, `World::replay`)
- Create: `server/src/world/replay_tests.rs`
- Modify: `server/src/world/mod.rs` (`mod replay; pub use replay::{Replay, replay_start};`, `#[cfg(test)] mod replay_tests;`)
- Modify: `server/src/world/furniture.rs` (`save_arrangement` becomes `pub(super)`)
- Modify: `server/src/trust.rs` (`pub fn rows(&self) -> Vec<TrustRow>`, sorted by cat and person)

**Interfaces:**
- Consumes: Task 1's `World::new(.., rng, ..)`.
- Produces:
  - `pub const MAX_REPLAY_MS: u64 = 7 * 24 * 3_600_000;`
  - `pub fn replay_start(saved_at: Option<u64>, now: u64) -> u64`: `now` when
    there's no clock or it isn't behind `now`; else
    `max(saved_at, now - MAX_REPLAY_MS)`.
  - `pub struct Replay { pub from: u64, pub to: u64, pub steps: u64, pub refills: u32, pub walks: Vec<(String, u32)> }`
    (`walks` by cat name, in content order) with `pub fn walks_text(&self) -> String`
    ("Burakku:40 Mochi:3 Tora:12").
  - `pub fn replay(&mut self, to: u64) -> Replay`: ticks at
    `from + 1000, from + 2000, ..` while `<= to`, where `from` is the
    world's clock; counts refills (the bowls' refill key changing) and each
    cat's `CatMoved`; logs nothing; writes nothing until it ends, then
    `save(last_tick)` and `save_arrangement()`.

- [ ] **Step 1: Write the failing tests** in `replay_tests.rs`. Helpers:

```rust
use super::*;
use crate::protocol::ServerMsg;
use chrono::TimeZone;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

/// Canberra wall-clock time as milliseconds since the epoch.
fn canberra(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> u64 {
    chrono_tz::Australia::Sydney.with_ymd_and_hms(y, mo, d, h, mi, 0).single().unwrap().timestamp_millis() as u64
}

fn world_at(seed: u64, now: u64) -> World {
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    World::new(content, trust, Vec::new(), SavedArrangement::Fresh, ChaCha8Rng::seed_from_u64(seed), None, "test".into(), now)
}

/// Everything a visitor could see, as JSON, for comparing two cafés.
fn seen(w: &World, now: u64) -> String {
    serde_json::to_string(&w.snapshot_for(0, now)).unwrap()
}

const HOUR: u64 = 3_600_000;
```

  Tests (each must fail first: `replay` doesn't exist):

```rust
#[test]
fn the_same_saved_state_and_gap_replay_to_the_same_cafe() {
    // An hour of live café, then what a save would hold.
    let start = canberra(2026, 10, 14, 21, 0);
    let mut live = world_at(3, start);
    for step in 1..=36_000u64 {
        live.tick(start + step * 100);
    }
    let at = start + HOUR;
    let cats: Vec<(String, String)> = live.cats.iter()
        .map(|c| (c.def.id.clone(), serde_json::to_string(&c.saved(at)).unwrap())).collect();
    let (arrangement, bowls, rng) = (live.arrangement_json(), live.bowls_json(), live.rng.clone());
    let load = || {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        let mut w = World::new(content, trust, cats.clone(), SavedArrangement::Current(arrangement.clone()),
            rng.clone(), None, "test".into(), at);
        w.restore_treats(Some(bowls.clone()), Vec::new());
        w
    };
    let (mut a, mut b) = (load(), load());
    let end = at + 8 * HOUR;
    assert_eq!(a.replay(end), b.replay(end));
    assert_eq!(seen(&a, end), seen(&b, end));
    assert_eq!(a.rng, b.rng);
}

#[test]
fn an_empty_night_moves_the_cats_in_character() {
    for seed in 1..=5 {
        let start = canberra(2026, 10, 14, 22, 0);
        let mut w = world_at(seed, start);
        let night = w.replay(canberra(2026, 10, 15, 6, 0));
        let walks = |name: &str| night.walks.iter().find(|(n, _)| n == name).unwrap().1;
        assert!(walks("Burakku") > walks("Mochi"), "seed {seed}: {:?}", night.walks);
        assert_eq!(night.steps, 8 * 3_600);
    }
}

#[test]
fn a_gap_longer_than_a_week_replays_only_the_last_seven_days() {
    let now = canberra(2026, 10, 14, 9, 0);
    assert_eq!(replay_start(Some(now - 9 * 24 * HOUR), now), now - MAX_REPLAY_MS);
    assert_eq!(replay_start(Some(now - 8 * HOUR), now), now - 8 * HOUR);
    assert_eq!(replay_start(None, now), now);
    assert_eq!(replay_start(Some(now + HOUR), now), now, "a clock ahead of now replays nothing");
    let mut w = world_at(1, replay_start(Some(now - 9 * 24 * HOUR), now));
    assert_eq!(w.replay(now).steps, MAX_REPLAY_MS / 1000);
}

#[test]
fn bowls_refill_and_treats_reset_during_a_replay_across_daylight_saving() {
    // Clocks go forward at 2:00 on Sunday 4 October 2026 and back at 3:00 on
    // Sunday 4 April 2027; refills stay at 7:00, 12:00 and 18:00 local time.
    for (eve, morning, day) in [
        (canberra(2026, 10, 3, 22, 0), canberra(2026, 10, 4, 19, 0), "2026-10-04"),
        (canberra(2027, 4, 3, 22, 0), canberra(2027, 4, 4, 19, 0), "2027-04-04"),
    ] {
        let mut w = world_at(1, eve);
        let yesterday = crate::time::canberra_day(eve);
        w.restore_treats(Some(format!("0|{yesterday}@1080")),
            vec![crate::store::TreatRow { user_id: 5, day: yesterday.clone(), used: 3, received: 0 }]);
        assert_eq!(w.treats_left(5, eve), 0);
        let r = w.replay(morning);
        assert_eq!(r.refills, 3, "{day}: 7:00, 12:00 and 18:00");
        assert_eq!(w.bowls_key, format!("{day}@1080"));
        assert_eq!(w.treat_day, day);
        assert_eq!(w.treats_left(5, morning), 3, "{day}: a new day's treats");
    }
}

#[test]
fn a_replay_changes_no_ones_trust() {
    let start = canberra(2026, 10, 14, 22, 0);
    let mut w = world_at(2, start);
    for (cat, person, value) in [("mochi", 1, 30.0), ("burakku", 1, 85.0), ("tora", 2, 4.0)] {
        for day in 0..10 {
            w.trust.apply(cat, 1.0, person, value / 10.0, &format!("2026-09-{:02}", day + 1));
        }
    }
    let before = w.trust.rows();
    w.replay(start + 8 * HOUR);
    assert_eq!(w.trust.rows(), before);
}

#[test]
fn a_replay_logs_nothing_of_its_own() {
    let start = canberra(2026, 10, 14, 22, 0);
    let mut w = world_at(4, start);
    let sink = crate::test_logs::LogSink::default();
    let _guard = sink.capture();
    w.replay(start + 8 * HOUR);
    assert_eq!(sink.text(), "", "the wake-up's summary is the only line");
}

#[tokio::test]
async fn a_replay_saves_what_it_changed_before_anyone_is_let_in() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("cafe.db")).unwrap();
    let start = canberra(2026, 10, 14, 22, 0);
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    // Seed 6 is one where something gets knocked over in the night (checked when written).
    let mut w = World::new(content, trust, Vec::new(), SavedArrangement::Fresh,
        ChaCha8Rng::seed_from_u64(6), Some(store.clone()), "test".into(), start);
    let end = start + 8 * HOUR;
    w.replay(end);
    assert!(w.room.pieces.iter().any(|p| p.toppled), "the night knocked something over");
    store.flush().await.unwrap();
    let saved_at = store.call(|c| crate::store::get_world(c, "saved_at")).await.unwrap();
    assert_eq!(saved_at, Some(w.last_tick.to_string()));
    let arrangement = store.call(|c| crate::store::get_world(c, "arrangement")).await.unwrap();
    assert_eq!(arrangement, Some(w.arrangement_json()));
    let rng = store.call(|c| crate::store::get_world(c, "rng")).await.unwrap().unwrap();
    assert_eq!(serde_json::from_str::<ChaCha8Rng>(&rng).unwrap(), w.rng);
}
```

  (If seed 6 knocks nothing over in the night, pick the first seed that
  does and say so in the test's comment. The check that something toppled
  stops the test from passing without testing anything.)

- [ ] **Step 2: Run `cargo test -p cafe replay`**: it fails to compile
  (`replay`, `replay_start`, `rows` don't exist).
- [ ] **Step 3: Implement** `replay.rs`:

```rust
//! Fast-forward (ADR 0006): the time the café was asleep, replayed in
//! one-second steps by the rules it runs live, with nobody inside.
use super::World;
use crate::protocol::ServerMsg;

/// At most this much of a gap is replayed: by then the cats' needs have settled.
pub const MAX_REPLAY_MS: u64 = 7 * 24 * 3_600_000;
const STEP_MS: u64 = 1_000;

/// What a wake-up's replay did, for its log line.
#[derive(Debug, Clone, PartialEq)]
pub struct Replay {
    pub from: u64,
    pub to: u64,
    pub steps: u64,
    pub refills: u32,
    /// Each cat's walks, by name, in content order.
    pub walks: Vec<(String, u32)>,
}

impl Replay {
    /// "Burakku:40 Mochi:3 Tora:12", for the log line.
    pub fn walks_text(&self) -> String {
        self.walks.iter().map(|(n, w)| format!("{n}:{w}")).collect::<Vec<_>>().join(" ")
    }
}

/// Where a replay starts: the saved clock, or a week before `now` if the
/// café slept longer; `now` itself with no clock, or one that isn't behind.
pub fn replay_start(saved_at: Option<u64>, now: u64) -> u64 {
    match saved_at {
        Some(at) if at < now => at.max(now.saturating_sub(MAX_REPLAY_MS)),
        _ => now,
    }
}

impl World {
    /// Replays from the world's clock up to `to`. Nothing is written on the
    /// way and nothing is logged: what changed is saved once at the end,
    /// and the wake-up logs one summary.
    pub fn replay(&mut self, to: u64) -> Replay {
        let from = self.last_tick;
        let ids: Vec<String> = self.cats.iter().map(|c| c.def.id.clone()).collect();
        let mut replay = Replay {
            from,
            to,
            steps: 0,
            refills: 0,
            walks: self.cats.iter().map(|c| (c.def.name.clone(), 0)).collect(),
        };
        let store = self.store.take();
        tracing::subscriber::with_default(tracing::subscriber::NoSubscriber::default(), || {
            let mut at = from + STEP_MS;
            while at <= to {
                let key = self.bowls_key.clone();
                for out in self.tick(at) {
                    if let ServerMsg::CatMoved { cat, .. } = &out.msg
                        && let Some(i) = ids.iter().position(|id| id == cat)
                    {
                        replay.walks[i].1 += 1;
                    }
                }
                if self.bowls_key != key {
                    replay.refills += 1;
                }
                replay.steps += 1;
                at += STEP_MS;
            }
        });
        self.store = store;
        self.save(self.last_tick);
        self.save_arrangement();
        replay
    }
}
```

  `TrustBook::rows` returns every record as a `TrustRow`, sorted by
  `(cat_id, user_id)`.
- [ ] **Step 4: Run `cargo test -p cafe`**: the new tests pass and so does
  everything else. Time the debug run of the 7-day test, and note it in
  the execution log if it's over 20 seconds.
- [ ] **Step 5: fmt, clippy, commit and push** ("Replay the café's sleep
  by the rules it runs awake").

### Task 3: Wake on boot, and fail loudly

**Files:**
- Create: `server/src/wake.rs` (`wake`), with its tests
- Create: `server/tests/wont_open.rs` (runs the built binary)
- Modify: `server/src/main.rs` (`run()` and the error wrapper; uses `wake`)
- Modify: `server/src/store.rs` (test: a file that isn't a database won't open)

**Interfaces:**
- Consumes: Task 1 (`World::new` with `rng`, `rng` and `saved_at` in the
  store), Task 2 (`replay_start`, `World::replay`, `Replay::walks_text`).
- Produces: `pub async fn wake(store: &Store, content: Content, build: String, now: u64, fresh_seed: u64) -> anyhow::Result<World>`.
  It loads trust, cat states, arrangement, `saved_at`, `rng`, live bans
  (against `now`), treats and bowls; builds the world at
  `replay_start(saved_at, now)` with the saved generator, or
  `ChaCha8Rng::seed_from_u64(fresh_seed)` if there's none (or it's
  unreadable, with a `warn` line); replays to `now`; logs the summary:

```rust
tracing::info!(target: "cafe", what = "woke", first = saved_at.is_none(), gap_secs,
    steps = replay.steps, capped, took_ms, refills = replay.refills, walks = %replay.walks_text());
```

  where `gap_secs = now.saturating_sub(saved_at.unwrap_or(now)) / 1000` and
  `capped = start > saved_at.unwrap_or(start)`.

- [ ] **Step 1: Write the failing tests.** In `wake.rs` (tokio tests on a
  temp store; `fn store() -> (TempDir, Store)` and
  `fn content() -> Content` helpers):

```rust
#[tokio::test]
async fn a_stop_and_a_start_bring_the_cats_back_moved_by_the_gap_with_furniture_and_trust_as_they_were() {
    let (_dir, store) = store();
    let t0 = canberra(2026, 10, 14, 21, 0);
    let mut world = wake(&store, content(), "test".into(), t0, 1).await.unwrap();
    // Someone came in and made friends; the room was rearranged.
    world.handle(t0, Input::Join { id: 7, name: "sam".into(), look: Look { avatar: 0, colour: 0 } });
    ...pet Mochi until trust > 0, move the cushion, leave...
    for step in 1..=600u64 { world.tick(t0 + step * 100); }
    let stopped = t0 + 60_000;
    world.save(stopped);
    store.flush().await.unwrap();
    let before = world.snapshot_for(7, stopped);
    let arrangement = world.arrangement_json();
    let logs = LogSink::default();
    let woken = { let _g = logs.capture(); wake(&store, content(), "test".into(), stopped + 8 * HOUR, 2).await.unwrap() };
    let after = woken.snapshot_for(7, stopped + 8 * HOUR);
    assert_ne!(cats_at(&before), cats_at(&after), "the night moved the cats");
    assert_eq!(after.your_trust, before.your_trust);
    assert_eq!(same_places(&woken.arrangement_json()), same_places(&arrangement), "furniture where it was, toppled or not");
    let woke = logs.lines().into_iter().find(|l| l["what"] == "woke").expect("a summary line");
    assert_eq!(woke["first"], false);
    assert_eq!(woke["steps"], 8 * 3_600);
    assert_eq!(woke["gap_secs"], 8 * 3_600);
}
```

  (`same_places` reads the arrangement JSON into `(kind, x, y)` triples,
  sorted, leaving out `toppled`, since a night may knock things over;
  `cats_at` is each cat's `(id, at)` from a snapshot.) Also:

  - `the_same_store_wakes_to_the_same_cafe_whatever_the_fresh_seed`: two
    temp stores given the same saved rows (cats, arrangement, bowls,
    `saved_at`, and an `rng` from `ChaCha8Rng::seed_from_u64(9)`), woken
    at the same `now` with fresh seeds 1 and 2: equal snapshots. And,
    so the test can tell the difference, the same without an `rng` row
    gives different snapshots.
  - `a_first_wake_says_the_cafe_opened_for_the_first_time`: an empty store
    logs `first: true`, `steps: 0`, `gap_secs: 0`.
  - `a_clock_ahead_of_now_replays_nothing`: `saved_at` an hour ahead logs
    `steps: 0`, and the world's clock is `now`.
  - `an_unreadable_random_state_wakes_afresh_and_says_so`: `rng` is
    `"not json"`: `wake` succeeds, a `warn` line names the random state,
    and the gap is still replayed.
  - `a_clock_without_a_random_state_still_replays_its_gap`: a save made
    before this slice (`saved_at`, no `rng`) replays the gap.

  In `store.rs`: `a_file_that_isnt_a_database_wont_open` writes
  `"this is not a database"` to `cafe.db` and asserts `Store::open` is an
  error. In `server/tests/wont_open.rs`, run
  `env!("CARGO_BIN_EXE_cafe")` with `DATA_DIR` holding that file,
  `CONTENT_DIR` pointing at the repo's `content/`, and a free `PORT`. It
  must exit within 10 seconds with a non-zero status, having printed one
  JSON line at level `ERROR`. If it's still running at 10 seconds, the
  test kills it and fails: it would be serving an empty café.
- [ ] **Step 2: Run them and see them fail**: `wake` doesn't exist. The
  binary test fails because the current `main` prints a bare `Error:`
  line rather than a JSON line.
- [ ] **Step 3: Implement** `wake.rs` as specified. `main` becomes:

```rust
#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().json().flatten_event(true).init();
    if let Err(e) = run().await {
        tracing::error!(target: "sys", error = %format!("{e:#}"), "stopping: the café can't start");
        std::process::exit(1);
    }
}
```

  `run()` holds the old body, with the world from
  `wake::wake(&store, content, build.clone(), now, now).await?`, and the
  `restore_*` calls moved into `wake`. Store opening wraps the error with
  context: "can't open the database at {path}".
- [ ] **Step 4: Run `cargo test -p cafe`**: all pass.
- [ ] **Step 5: fmt, clippy, commit and push** ("Wake the café by replaying
  its sleep before the doors open").

### Task 4: The narrator's words and the log check

**Files:**
- Modify: `scripts/narrate.ts` (`woke`), `spec/narrate.test.ts`
- Modify: `scripts/check-logs.ts` (every `listening` follows a `woke`), `spec/check-logs.test.ts`

**Interfaces:**
- Consumes: Task 3's summary line fields.

- [ ] **Step 1: Write the failing tests.** In `spec/narrate.test.ts`:

```ts
it("says how the café woke", () => {
  const woke = (f: Record<string, unknown>) => narrate(line({ target: "cafe", what: "woke", first: false, capped: false, refills: 0, walks: "", took_ms: 0, ...f }));
  expect(woke({ first: true, gap_secs: 0, steps: 0 })).toBe("19:42:07  The café opened for the first time");
  expect(woke({ gap_secs: 3, steps: 3, took_ms: 2 })).toBe("19:42:07  The café woke after 3s asleep and caught up in 0.0s");
  expect(woke({ gap_secs: 28_920, steps: 28_920, took_ms: 412, refills: 1, walks: "Burakku:40 Mochi:3 Tora:12" })).toBe(
    "19:42:07  The café woke after 8h 2m asleep and caught up in 0.4s; meanwhile Burakku walked 40 times, Mochi 3 and Tora 12, and the bowls were filled once",
  );
  expect(woke({ gap_secs: 9 * 86_400, steps: 604_800, took_ms: 2_500, capped: true })).toBe(
    "19:42:07  The café woke after 9 days asleep and caught up in 2.5s (the last week of it)",
  );
});
```

  In `spec/check-logs.test.ts`: the `good` lines gain a `woke` line before
  `listening`; new cases fail a `listening` with no `woke` before it, and
  a `woke` line without numeric `gap_secs`, `steps` or `took_ms`.
- [ ] **Step 2: Run `pnpm vitest run spec/narrate.test.ts spec/check-logs.test.ts`**
  and see the new cases fail.
- [ ] **Step 3: Implement.** In `narrate.ts`, `cafe()` hands `what ===
  "woke"` to a `woke(l)` that writes the sentences above. A
  `duration(secs)` helper gives "45s", "8h 2m", "3h", "2 days 4h" and
  "9 days". In `check-logs.ts`, a `woke` line must have numeric `gap_secs`,
  `steps` and `took_ms`, and each `sys` `listening` line must have an
  unmatched `woke` line before it.
- [ ] **Step 4: Run them**: pass.
- [ ] **Step 5: Commit and push** ("Narrate the café's wake-ups, and check
  every start logs one").

### Task 5: A stop and a start of the running image

**Files:**
- Create: `spec/restart.test.ts`
- Modify: `.github/workflows/checks.yml` (named volume; `APP_RESTART`)
- Modify: `spec/README.md` (how to run it locally)

**Interfaces:**
- Consumes: the app's `/ws` welcome (`snapshot.cats`, `snapshot.room.furniture`, `snapshot.yourTrust`).

- [ ] **Step 1: Write the check.**

```ts
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { baseUrl, signUp, Visitor, type Msg } from "./helpers";

// A stop and a start of the running image (slice 01): the cats come back
// moved by the gap, the furniture and your trust as they were. It needs a
// way to stop and start the app, which CI gives as APP_RESTART; without
// one it's skipped.
const restart = process.env.APP_RESTART;

const places = (w: Msg) => w.snapshot.room.furniture.map((f: Msg) => `${f.kind}@${f.x},${f.y}`).sort();
const cats = (w: Msg) => w.snapshot.cats.map((c: Msg) => `${c.id}@${c.at.x},${c.at.y}`).sort();

async function answering(): Promise<void> {
  for (let i = 0; i < 300; i++) {
    try { await fetch(baseUrl); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("the app didn't come back");
}

describe.skipIf(!restart)("a stop and a start", () => {
  it("bring the cats back moved by the gap, with furniture and trust as they were", async () => {
    const account = await signUp();
    const v = await Visitor.connect(account.cookie);
    // A first meeting leaves trust: pet cats until one sniffs your hand.
    ...for each cat not hiding: send pet, wait up to 8s for yourTrust with value > 0...
    const trust = (await v.next((m) => m.type === "yourTrust" && m.trust.value > 0, 10_000)).trust;
    await v.leave();
    const before = (await Visitor.connect(account.cookie));
    const [furniture, catsBefore] = [places(before.welcome), cats(before.welcome)];
    await before.leave();
    execSync(restart!, { stdio: "inherit", shell: "/bin/bash" });
    await answering();
    const after = await Visitor.connect(account.cookie);
    expect(places(after.welcome)).toEqual(furniture);
    expect(after.welcome.snapshot.yourTrust.find((t: Msg) => t.cat === trust.cat)).toEqual(trust);
    expect(cats(after.welcome)).not.toEqual(catsBefore);
    await after.leave();
  }, 120_000);
});
```

- [ ] **Step 2: Run it against a local image** started with a volume and
  `APP_RESTART="docker stop app && sleep 20 && docker start app"`.
  Against the current `main` (before Tasks 1 to 3, or with `--tmpfs`) it
  fails: the trust or the arrangement is gone, or nothing moved. With this
  slice it passes.
- [ ] **Step 3: CI.** Start the image with `-v app-data:/data` in place of
  `--tmpfs /data`, and give "Run the spec" the env
  `APP_RESTART: docker stop app && sleep 20 && docker start app`.
  `docker logs app` then holds both runs, so the log check sees both
  wake-ups.
- [ ] **Step 4: Commit and push**, and watch the CI run: the restart check
  runs (not skipped) and passes, and the log check passes with two `woke`
  lines.

### Task 6: Record it

**Files:**
- Modify: `docs/design.md` ("Persistence and fast-forward": the replay is quiet
  and saves once before the doors open, the random state's key; "Logging":
  the summary's fields; "Checks": the stop-and-start check and the CI volume)
- Modify: `docs/adr/0006-fast-forward-the-world-when-the-server-wakes.md`
  (commit links under Consequences; substance unchanged)
- Modify: `docs/slices/01-the-cafe-keeps-living-while-it-sleeps.md` (status)
- Create: `docs/notes/slice-01-wake.md` (measurements: replay time for 8 hours
  and for 7 days in a release build here; the live summary line after a deploy;
  the live 8-hour measurement once a real night has passed)

- [ ] **Step 1:** Measure with a release build (an ignored test, or a
  `cargo test --release -- --ignored` timing test, `measure_replay_times`):
  8 hours and 7 days from a fresh world. Record the numbers.
- [ ] **Step 2:** Write the docs; commit and push.

### Task 7: Fresh review

- [ ] Write `docs/notes/reviews/slice-01-brief.md` (what to read, what's out
  of scope, what to look for: the kept rules, determinism, the 7-day cap,
  daylight saving, store writes, startup failures, the CI change).
- [ ] A reviewer that didn't build it reads it cold and writes
  `docs/notes/reviews/slice-01-findings.md`.
- [ ] Each finding is fixed test first, or answered in the findings file.

### Task 8: Deployed and checked live

- [ ] CI green on the last push; the deploy job ran.
- [ ] `flyctl logs` shows the deploy's `woke` line (the redeploy's gap,
  steps, time taken); record it in `docs/notes/slice-01-wake.md`.
- [ ] The judged line, "waking after eight hours takes a few seconds at
  most on the live machine": read the first `woke` line after a real night
  and record it there. Until then the note says it's pending, and why.
- [ ] Spec status `Live`; root plan updated.

## Execution log

Where carrying out this plan departed from it, task by task, and why.
