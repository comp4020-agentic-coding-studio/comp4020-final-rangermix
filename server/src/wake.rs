//! Waking up (ADR 0006): load the café from the store, replay the time it
//! was asleep by the rules it runs awake, log what that took, and only then
//! hand the world over to open the doors.
use crate::content::Content;
use crate::store::{self, Store};
use crate::trust::TrustBook;
use crate::world::{SavedArrangement, World, replay_start};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

/// Loads everything the store keeps, builds the world at the saved clock
/// (or a week before `now` if it slept longer), replays up to `now`, and
/// logs the wake-up's summary. A café never saved wakes at `now`, on a
/// generator seeded with `fresh_seed`, as does one whose saved random state
/// can't be read (with a warning: the replay is still the live rules, only
/// not the same night it would have been). A replay that panics is logged,
/// and the café wakes at `now` from the save without it, so one bad night
/// can't keep it shut start after start (slice 01's review, finding 6).
pub async fn wake(store: &Store, content: Content, build: String, now: u64, fresh_seed: u64) -> anyhow::Result<World> {
    let kept = Kept::load(store, now, fresh_seed).await?;
    let (first, saved_at) = (kept.first, kept.saved_at);
    let start = replay_start(saved_at, now);
    let mut world = kept.into_world(content.clone(), build.clone(), store, start);
    let began = std::time::Instant::now();
    let replayed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| world.replay(now)));
    let (replay, failed) = match replayed {
        Ok(replay) => (replay, false),
        Err(panic) => {
            let what = panic
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| panic.downcast_ref::<&str>().map(|s| s.to_string()))
                .unwrap_or_default();
            tracing::error!(target: "sys", error = %what, "the replay failed; waking at now without it");
            // The replay wrote nothing, so the save is as it was: build again, at now.
            world = Kept::load(store, now, fresh_seed).await?.into_world(content, build, store, now);
            (world.replay(now), true)
        }
    };
    let took_ms = began.elapsed().as_millis() as u64;
    let gap_secs = now.saturating_sub(saved_at.unwrap_or(now)) / 1000;
    let capped = saved_at.is_some_and(|at| start > at);
    // What the replay changed is on disk before the doors open.
    store.flush().await?;
    tracing::info!(target: "cafe", what = "woke", first, gap_secs, steps = replay.steps,
        capped, failed, took_ms, refills = replay.refills, walks = %replay.walks_text());
    Ok(world)
}

/// Everything the store keeps, read for a wake-up.
struct Kept {
    trust: Vec<store::TrustRow>,
    cats: Vec<(String, String)>,
    arrangement: SavedArrangement,
    /// Nothing was ever saved.
    first: bool,
    saved_at: Option<u64>,
    rng: ChaCha8Rng,
    bans: Vec<store::BanRow>,
    treats: Vec<store::TreatRow>,
    bowls: Option<String>,
    chalk: Vec<(u64, String)>,
}

impl Kept {
    async fn load(store: &Store, now: u64, fresh_seed: u64) -> anyhow::Result<Kept> {
        let trust = store.call(|c| store::all_trust(c)).await?;
        let cats = store.call(|c| store::all_cat_states(c)).await?;
        let arrangement = match store.call(|c| store::get_world(c, "arrangement")).await? {
            Some(json) => SavedArrangement::Current(json),
            None => match store.call(|c| store::get_world(c, "furniture")).await? {
                Some(json) => SavedArrangement::Legacy(json),
                None => SavedArrangement::Fresh,
            },
        };
        let clock = store.call(|c| store::get_world(c, "saved_at")).await?;
        // A café that has saved before isn't opening for the first time, even if
        // its clock can't be read (slice 01's review, finding 7).
        let first = clock.is_none();
        let saved_at = match clock {
            Some(text) => match text.parse::<u64>() {
                Ok(at) => Some(at),
                Err(e) => {
                    tracing::warn!(target: "sys", error = %e, "the saved clock is unreadable; waking without a replay");
                    None
                }
            },
            None => None,
        };
        let rng = match store.call(|c| store::get_world(c, "rng")).await? {
            Some(json) => serde_json::from_str(&json).unwrap_or_else(|e| {
                tracing::warn!(target: "sys", error = %e, "the saved random state is unreadable; replaying on a fresh one");
                ChaCha8Rng::seed_from_u64(fresh_seed)
            }),
            None => ChaCha8Rng::seed_from_u64(fresh_seed),
        };
        // Bans are kept against the wall clock: nobody is inside during a replay.
        let bans = store.call(move |c| store::live_bans(c, now)).await?;
        let treats = store.call(|c| store::all_treats(c)).await?;
        let bowls = store.call(|c| store::get_world(c, "bowls")).await?;
        let chalk = store.call(|c| store::all_chalk(c)).await?;
        let rows: i64 = store
            .call(|c| c.query_row("SELECT COUNT(*) FROM chalkboard", [], |r| r.get(0)))
            .await?;
        if rows as usize > chalk.len() {
            let skipped = rows as usize - chalk.len();
            tracing::warn!(target: "sys", skipped, "chalkboard rows of the wrong type; skipping them");
        }
        Ok(Kept {
            trust,
            cats,
            arrangement,
            first,
            saved_at,
            rng,
            bans,
            treats,
            bowls,
            chalk,
        })
    }

    fn into_world(self, content: Content, build: String, store: &Store, start: u64) -> World {
        let mut trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        trust.load(self.trust);
        let mut world = World::new(
            content,
            trust,
            self.cats,
            self.arrangement,
            self.rng,
            Some(store.clone()),
            build,
            start,
        );
        world.restore_bans(self.bans);
        world.restore_treats(self.bowls, self.treats);
        world.restore_chalk(self.chalk);
        world
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Snapshot;
    use crate::test_logs::LogSink;
    use chrono::TimeZone;

    const HOUR: u64 = 3_600_000;

    fn canberra(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> u64 {
        chrono_tz::Australia::Sydney
            .with_ymd_and_hms(y, mo, d, h, mi, 0)
            .single()
            .unwrap()
            .timestamp_millis() as u64
    }

    fn store() -> (tempfile::TempDir, Store) {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("cafe.db")).unwrap();
        (dir, store)
    }

    fn content() -> Content {
        crate::content::repo_content()
    }

    async fn put(store: &Store, key: &'static str, value: String) {
        store.call(move |c| store::put_world(c, key, &value)).await.unwrap();
    }

    async fn get(store: &Store, key: &'static str) -> Option<String> {
        store.flush().await.unwrap();
        store.call(move |c| store::get_world(c, key)).await.unwrap()
    }

    /// The wake-up's summary line, from what was logged.
    fn woke(logs: &LogSink) -> serde_json::Value {
        logs.lines().into_iter().find(|l| l["what"] == "woke").expect("a summary line")
    }

    fn cats_at(s: &Snapshot) -> Vec<(String, u8, u8)> {
        s.cats.iter().map(|c| (c.id.clone(), c.at.x, c.at.y)).collect()
    }

    /// Where each movable piece stands, toppled or not: a night may knock
    /// things over, but it moves nothing.
    fn places(arrangement: &str) -> Vec<(String, u8, u8)> {
        let saved: Vec<crate::room::Saved> = serde_json::from_str(arrangement).unwrap();
        let mut places: Vec<(String, u8, u8)> = saved.into_iter().map(|s| (s.kind, s.x, s.y)).collect();
        places.sort();
        places
    }

    fn seen(w: &World, now: u64) -> String {
        serde_json::to_string(&w.snapshot_for(0, now)).unwrap()
    }

    #[tokio::test]
    async fn a_stop_and_a_start_bring_the_cats_back_moved_by_the_gap_with_furniture_and_trust_as_they_were() {
        let (_dir, store) = store();
        let t0 = canberra(2026, 10, 14, 21, 0);
        // Someone made friends with Mochi, and the cushion was moved.
        let row = store::TrustRow {
            cat_id: "mochi".into(),
            user_id: 7,
            value: 23.5,
            day: "2026-10-14".into(),
            gained_today: 2.0,
        };
        store
            .call(move |c| {
                let id = store::insert_user(c, "sam", "p", "r", 0, 0, 1)?.expect("a new name");
                assert_eq!(id, 1);
                c.execute("UPDATE users SET id = 7 WHERE id = 1", [])?;
                store::put_trust(c, &row)
            })
            .await
            .unwrap();
        let first = wake(&store, content(), "test".into(), t0, 1).await.unwrap();
        let moved = first
            .arrangement_json()
            .replace(r#"{"kind":"cushion","x":9,"y":7}"#, r#"{"kind":"cushion","x":3,"y":8}"#);
        assert_ne!(moved, first.arrangement_json(), "the cushion is where room.toml puts it");
        put(&store, "arrangement", moved.clone()).await;
        let mut world = wake(&store, content(), "test".into(), t0, 1).await.unwrap();
        for step in 1..=600u64 {
            world.tick(t0 + step * 100);
        }
        let stopped = t0 + 60_000;
        world.save(stopped);
        store.flush().await.unwrap();
        let before = world.snapshot_for(7, stopped);
        let arrangement = world.arrangement_json();
        assert_eq!(places(&arrangement), places(&moved));

        let logs = LogSink::default();
        let woken = {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), stopped + 8 * HOUR, 2).await.unwrap()
        };
        let after = woken.snapshot_for(7, stopped + 8 * HOUR);
        assert_ne!(cats_at(&before), cats_at(&after), "the night moved the cats");
        assert_eq!(after.your_trust, before.your_trust);
        assert!(after.your_trust.iter().any(|t| t.cat == "mochi" && t.value == 23.5));
        assert_eq!(places(&woken.arrangement_json()), places(&arrangement));
        let line = woke(&logs);
        assert_eq!(line["target"], "cafe");
        assert_eq!(line["first"], false);
        assert_eq!(line["steps"], 8 * 3_600);
        assert_eq!(line["gap_secs"], 8 * 3_600);
        assert_eq!(line["capped"], false);
        assert!(line["took_ms"].is_u64());
        assert!(line["refills"].is_u64());
        // Each cat's walks, as JSON, so a name with a space in it stays whole.
        let walks: Vec<(String, u32)> = serde_json::from_str(line["walks"].as_str().unwrap()).unwrap();
        assert_eq!(
            walks.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>(),
            ["Burakku", "Mochi", "Tora"]
        );
        assert!(walks.iter().any(|(_, n)| *n > 0), "{line}");
    }

    #[tokio::test]
    async fn a_ten_second_stop_doesnt_get_a_napping_cat_up() {
        // Slice 01's review, finding 1: a redeploy is the same thing as the
        // café staying up, over a few seconds.
        for seed in 1..=10 {
            let (_dir, store) = store();
            let t0 = canberra(2026, 10, 14, 15, 0);
            put(&store, "saved_at", t0.to_string()).await;
            put(&store, "rng", serde_json::to_string(&ChaCha8Rng::seed_from_u64(seed)).unwrap()).await;
            let mut world = wake(&store, content(), "test".into(), t0, seed).await.unwrap();
            // Live until a cat lies down for a nap, which lasts two minutes at least.
            let mut napping = None;
            let mut now = t0;
            while napping.is_none() && now < t0 + 2 * HOUR {
                now += 100;
                napping = world.tick(now).into_iter().find_map(|o| match o.msg {
                    crate::protocol::ServerMsg::CatPosed {
                        cat,
                        pose: crate::protocol::Pose::Nap,
                        at,
                    } => Some((cat, at)),
                    _ => None,
                });
            }
            let (cat, at) = napping.expect("someone naps within two hours");
            world.save(now + 1_000);
            store.flush().await.unwrap();
            let woken = wake(&store, content(), "test".into(), now + 11_000, seed).await.unwrap();
            let after = woken.snapshot_for(0, now + 11_000);
            let c = after.cats.iter().find(|c| c.id == cat).unwrap();
            assert_eq!((c.pose, c.at), (crate::protocol::Pose::Nap, at), "seed {seed}: {cat} slept on");
        }
    }

    /// What a save holds, written into `store`: the cats, the arrangement,
    /// the bowls and the clock at `at`, and the random state if `rng`.
    async fn saved(store: &Store, at: u64, rng: bool) {
        let mut world = World::new(
            content(),
            TrustBook::new([20.0, 50.0, 80.0], 10.0),
            Vec::new(),
            SavedArrangement::Fresh,
            ChaCha8Rng::seed_from_u64(9),
            Some(store.clone()),
            "test".into(),
            at - HOUR,
        );
        for step in 1..=36_000u64 {
            world.tick(at - HOUR + step * 100);
        }
        world.save(at);
        if !rng {
            store.flush().await.unwrap();
            store.call(|c| c.execute("DELETE FROM world WHERE key = 'rng'", [])).await.unwrap();
        }
        store.flush().await.unwrap();
    }

    #[tokio::test]
    async fn the_same_store_wakes_to_the_same_cafe_whatever_the_fresh_seed() {
        let at = canberra(2026, 10, 14, 22, 0);
        let now = at + 8 * HOUR;
        let ((_a, a), (_b, b)) = (store(), store());
        saved(&a, at, true).await;
        saved(&b, at, true).await;
        let one = wake(&a, content(), "test".into(), now, 1).await.unwrap();
        let two = wake(&b, content(), "test".into(), now, 2).await.unwrap();
        assert_eq!(seen(&one, now), seen(&two, now), "the saved random state, not the fresh seed");
        // Without the random state, the fresh seed decides, and the cafés differ.
        let ((_c, c), (_d, d)) = (store(), store());
        saved(&c, at, false).await;
        saved(&d, at, false).await;
        let three = wake(&c, content(), "test".into(), now, 1).await.unwrap();
        let four = wake(&d, content(), "test".into(), now, 2).await.unwrap();
        assert_ne!(seen(&three, now), seen(&four, now));
    }

    #[tokio::test]
    async fn a_first_wake_says_the_cafe_opened_for_the_first_time() {
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        let line = woke(&logs);
        assert_eq!(line["first"], true);
        assert_eq!(line["steps"], 0);
        assert_eq!(line["gap_secs"], 0);
        assert_eq!(get(&store, "saved_at").await, Some(now.to_string()), "saved before the doors open");
    }

    #[tokio::test]
    async fn nine_days_asleep_replay_only_the_last_week() {
        // Slice 01's review, finding 3: the cap where it runs, not only in replay_start.
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        put(&store, "saved_at", (now - 9 * 24 * HOUR).to_string()).await;
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        let line = woke(&logs);
        assert_eq!(line["steps"], 7 * 24 * 3_600);
        assert_eq!(line["capped"], true);
        assert_eq!(line["gap_secs"], 9 * 24 * 3_600);
        assert_eq!(get(&store, "saved_at").await, Some(now.to_string()), "awake at now");
    }

    #[tokio::test]
    async fn a_replay_that_panics_still_wakes_the_cafe_and_says_so() {
        // Slice 01's review, finding 6: one bad night mustn't keep the café
        // shut, start after start at the same step.
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        put(&store, "saved_at", (now - HOUR).to_string()).await;
        crate::world::PANIC_AT_STEP.with(|p| p.set(Some(3)));
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        crate::world::PANIC_AT_STEP.with(|p| p.set(None));
        let said = logs
            .lines()
            .into_iter()
            .any(|l| l["level"] == "ERROR" && l["message"].as_str().is_some_and(|m| m.contains("replay")));
        assert!(said, "{}", logs.text());
        let line = woke(&logs);
        assert_eq!((line["steps"].as_u64(), line["failed"].as_bool()), (Some(0), Some(true)));
        assert_eq!(get(&store, "saved_at").await, Some(now.to_string()), "the next start begins at now");
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now + 10_000, 1).await.unwrap();
        }
        assert_eq!(
            (woke(&logs)["steps"].as_u64(), woke(&logs)["failed"].as_bool()),
            (Some(10), Some(false))
        );
    }

    #[tokio::test]
    async fn a_clock_ahead_of_now_replays_nothing() {
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        put(&store, "saved_at", (now + HOUR).to_string()).await;
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        let line = woke(&logs);
        assert_eq!(line["first"], false);
        assert_eq!(line["steps"], 0);
        assert_eq!(line["gap_secs"], 0);
        assert_eq!(get(&store, "saved_at").await, Some(now.to_string()), "the clock is back to now");
    }

    #[tokio::test]
    async fn an_unreadable_random_state_wakes_afresh_and_says_so() {
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        put(&store, "saved_at", (now - HOUR).to_string()).await;
        put(&store, "rng", "not json".into()).await;
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        let warned = logs
            .lines()
            .into_iter()
            .any(|l| l["level"] == "WARN" && l["message"].as_str().is_some_and(|m| m.contains("random state")));
        assert!(warned, "{}", logs.text());
        assert_eq!(woke(&logs)["steps"], 3_600);
        let rng = get(&store, "rng").await.unwrap();
        assert!(
            serde_json::from_str::<ChaCha8Rng>(&rng).is_ok(),
            "a readable one is saved in its place"
        );
    }

    #[tokio::test]
    async fn an_unreadable_clock_wakes_without_a_replay_and_says_so() {
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        put(&store, "saved_at", "yesterday".into()).await;
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        let warned = logs
            .lines()
            .into_iter()
            .any(|l| l["level"] == "WARN" && l["message"].as_str().is_some_and(|m| m.contains("clock")));
        assert!(warned, "{}", logs.text());
        assert_eq!(woke(&logs)["steps"], 0);
        assert_eq!(
            woke(&logs)["first"],
            false,
            "a café with a history isn't opening for the first time"
        );
    }

    fn met(at: u64, with: &str) -> String {
        serde_json::to_string(&crate::protocol::ChalkLine {
            at,
            cat: "Mochi".into(),
            what: crate::protocol::ChalkWhat::Met { with: with.into() },
        })
        .unwrap()
    }

    #[tokio::test]
    async fn the_board_survives_a_stop_and_a_start_and_a_replay_drops_what_turned_a_day_old() {
        let (_dir, store) = store();
        let t0 = canberra(2026, 10, 14, 9, 0);
        let (old, recent) = (met(t0, "early"), met(t0 + 20 * HOUR, "late"));
        let rows = vec![(t0, old.clone()), (t0 + 20 * HOUR, recent.clone())];
        store.call(move |c| store::replace_chalk(c, &rows)).await.unwrap();
        put(&store, "saved_at", (t0 + 20 * HOUR).to_string()).await;
        let world = wake(&store, content(), "test".into(), t0 + 25 * HOUR, 1).await.unwrap();
        store.flush().await.unwrap();
        let rows: Vec<String> = store
            .call(|c| store::all_chalk(c))
            .await
            .unwrap()
            .into_iter()
            .map(|(_, l)| l)
            .collect();
        assert!(rows.contains(&recent), "the line from 5 hours ago is kept: {rows:?}");
        assert!(!rows.contains(&old), "the line from 25 hours ago dropped off in the replay");
        let shown: Vec<String> = world
            .snapshot_for(0, t0 + 25 * HOUR)
            .chalkboard
            .iter()
            .map(|l| serde_json::to_string(l).unwrap())
            .collect();
        assert!(shown.iter().all(|l| rows.contains(l)), "the store holds what the board shows");
        assert!(!shown.contains(&old));
    }

    #[tokio::test]
    async fn a_chalk_row_of_the_wrong_type_is_skipped_and_the_cafe_still_wakes() {
        // Slice 02's review, finding 4: a hand edit leaving a BLOB, or text in
        // the time, mustn't stop the café starting.
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        let good = met(now - 1_000, "sam");
        store
            .call(move |c| {
                c.execute("INSERT INTO chalkboard (at, line) VALUES (1, X'7B7D')", [])?;
                c.execute("INSERT INTO chalkboard (at, line) VALUES ('', 'x')", [])?;
                store::put_chalk(c, now - 1_000, &good)
            })
            .await
            .unwrap();
        let logs = LogSink::default();
        let world = {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.expect("the café wakes")
        };
        let skipped = logs.lines().into_iter().find(|l| l["level"] == "WARN" && l["skipped"].is_u64());
        assert_eq!(skipped.map(|l| l["skipped"].clone()), Some(serde_json::json!(2)), "{}", logs.text());
        assert_eq!(world.snapshot_for(0, now).chalkboard.len(), 1);
    }

    #[tokio::test]
    async fn an_unreadable_chalk_row_is_skipped_and_said() {
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        let rows = vec![(now - HOUR, "not a line".to_string()), (now - 1_000, met(now - 1_000, "sam"))];
        store.call(move |c| store::replace_chalk(c, &rows)).await.unwrap();
        let logs = LogSink::default();
        let world = {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap()
        };
        let warned = logs
            .lines()
            .into_iter()
            .any(|l| l["level"] == "WARN" && l["message"].as_str().is_some_and(|m| m.contains("chalkboard")));
        assert!(warned, "{}", logs.text());
        assert_eq!(world.snapshot_for(0, now).chalkboard.len(), 1);
    }

    #[tokio::test]
    async fn a_clock_without_a_random_state_still_replays_its_gap() {
        // Every save made before slice 01 has a clock and no random state.
        let (_dir, store) = store();
        let now = canberra(2026, 10, 14, 9, 0);
        put(&store, "saved_at", (now - 2 * HOUR).to_string()).await;
        let logs = LogSink::default();
        {
            let _guard = logs.capture();
            wake(&store, content(), "test".into(), now, 1).await.unwrap();
        }
        assert_eq!(woke(&logs)["steps"], 7_200);
        assert!(logs.lines().iter().all(|l| l["level"] != "WARN"), "nothing wrong with an old save");
    }
}
