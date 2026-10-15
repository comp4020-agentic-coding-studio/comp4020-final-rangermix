//! Fast-forward (ADR 0006; slice 01): a gap replayed in one-second steps by
//! the rules the café runs awake, seeded so every run is the same.
use super::*;
use chrono::TimeZone;
use rand::SeedableRng;

/// Canberra wall-clock time as milliseconds since the epoch.
fn canberra(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> u64 {
    chrono_tz::Australia::Sydney
        .with_ymd_and_hms(y, mo, d, h, mi, 0)
        .single()
        .unwrap()
        .timestamp_millis() as u64
}

fn world_at(seed: u64, now: u64) -> World {
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    World::new(
        content,
        trust,
        Vec::new(),
        SavedArrangement::Fresh,
        ChaCha8Rng::seed_from_u64(seed),
        None,
        "test".into(),
        now,
    )
}

/// Everything a visitor could see, as JSON, for comparing two cafés.
fn seen(w: &World, now: u64) -> String {
    serde_json::to_string(&w.snapshot_for(0, now)).unwrap()
}

const HOUR: u64 = 3_600_000;

#[test]
fn the_same_saved_state_and_gap_replay_to_the_same_cafe() {
    // An hour of live café, then what a save would hold.
    let start = canberra(2026, 10, 14, 21, 0);
    let mut live = world_at(3, start);
    for step in 1..=36_000u64 {
        live.tick(start + step * 100);
    }
    let at = start + HOUR;
    let cats: Vec<(String, String)> = live
        .cats
        .iter()
        .map(|c| (c.def.id.clone(), serde_json::to_string(&c.saved(at)).unwrap()))
        .collect();
    let (arrangement, bowls, rng) = (live.arrangement_json(), live.bowls_json(), live.rng.clone());
    let load = || {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        let mut w = World::new(
            content,
            trust,
            cats.clone(),
            SavedArrangement::Current(arrangement.clone()),
            rng.clone(),
            None,
            "test".into(),
            at,
        );
        w.restore_treats(Some(bowls.clone()), Vec::new());
        w
    };
    let (mut a, mut b) = (load(), load());
    let end = at + 8 * HOUR;
    let night = a.replay(end);
    assert_eq!(night, b.replay(end));
    assert!(night.walks.iter().any(|(_, n)| *n > 0), "the night moved somebody: {night:?}");
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

/// The cap, as tuning.toml sets it: three days since 2026-10-15.
const CAP: u64 = 3 * 24 * HOUR;

#[test]
fn a_gap_longer_than_the_cap_replays_only_its_last_three_days() {
    let tuning = crate::content::repo_content().tuning;
    assert_eq!(tuning.replay_max_days * 24 * HOUR, CAP);
    let now = canberra(2026, 10, 14, 9, 0);
    assert_eq!(replay_start(Some(now - 9 * 24 * HOUR), now, CAP), now - CAP);
    assert_eq!(replay_start(Some(now - 8 * HOUR), now, CAP), now - 8 * HOUR);
    assert_eq!(replay_start(None, now, CAP), now);
    assert_eq!(
        replay_start(Some(now + HOUR), now, CAP),
        now,
        "a clock ahead of now replays nothing"
    );
    let mut w = world_at(1, replay_start(Some(now - 9 * 24 * HOUR), now, CAP));
    assert_eq!(w.replay(now).steps, CAP / 1000);
}

#[test]
fn bowls_refill_and_treats_reset_during_a_replay_across_daylight_saving() {
    // Clocks go forward at 2:00 on Sunday 4 October 2026 and back at 3:00 on
    // Sunday 4 April 2027; the refills stay at 7:00, 12:00 and 18:00 local
    // time. Checked a minute either side of 7:00 and after 18:00, so a
    // schedule an hour out either way fails (slice 01's review, finding 2).
    for (y, mo, d) in [(2026, 10, 4), (2027, 4, 4)] {
        let eve = canberra(y, mo, d - 1, 22, 0);
        let day = format!("{y}-{mo:02}-{d:02}");
        let mut w = world_at(1, eve);
        let yesterday = crate::time::canberra_day(eve);
        w.restore_treats(
            Some(format!("0|{yesterday}@1080")),
            vec![crate::store::TreatRow {
                user_id: 5,
                day: yesterday.clone(),
                used: 3,
                received: 0,
            }],
        );
        assert_eq!(w.treats_left(5, eve), 0);
        assert_eq!(w.replay(canberra(y, mo, d, 6, 59)).refills, 0, "{day}: nothing before 7:00");
        assert_eq!(w.treat_day, day, "{day}: the treats reset at midnight");
        assert_eq!(w.treats_left(5, canberra(y, mo, d, 6, 59)), 3, "{day}: a new day's treats");
        assert_eq!(w.replay(canberra(y, mo, d, 7, 1)).refills, 1, "{day}: the 7:00 refill");
        assert_eq!(w.bowls_key, format!("{day}@420"));
        assert_eq!(
            w.replay(canberra(y, mo, d, 17, 59)).refills,
            1,
            "{day}: then 12:00's, and not yet 18:00's"
        );
        assert_eq!(w.replay(canberra(y, mo, d, 18, 1)).refills, 1, "{day}: then 18:00's");
        assert_eq!(w.bowls_key, format!("{day}@1080"));
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
    assert_eq!(before.len(), 3);
    w.replay(start + 8 * HOUR);
    assert_eq!(w.trust.rows(), before);
}

#[test]
fn a_replay_logs_nothing_of_its_own() {
    let start = canberra(2026, 10, 14, 22, 0);
    let mut w = world_at(4, start);
    let sink = crate::test_logs::LogSink::default();
    let _guard = sink.capture();
    let night = w.replay(start + 8 * HOUR);
    assert!(night.walks.iter().any(|(_, n)| *n > 0));
    assert_eq!(sink.text(), "", "the wake-up's summary is the only line");
}

#[tokio::test]
async fn a_replay_saves_what_it_changed_before_anyone_is_let_in() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("cafe.db")).unwrap();
    let start = canberra(2026, 10, 14, 22, 0);
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    // A seed whose night knocks something over, so the save has it to keep.
    let mut w = World::new(
        content,
        trust,
        Vec::new(),
        SavedArrangement::Fresh,
        ChaCha8Rng::seed_from_u64(6),
        Some(store.clone()),
        "test".into(),
        start,
    );
    w.replay(start + 8 * HOUR);
    assert!(w.room.pieces.iter().any(|p| p.toppled), "the night knocked something over");
    store.flush().await.unwrap();
    let saved_at = store.call(|c| crate::store::get_world(c, "saved_at")).await.unwrap();
    assert_eq!(saved_at, Some(w.last_tick.to_string()));
    let arrangement = store.call(|c| crate::store::get_world(c, "arrangement")).await.unwrap();
    assert_eq!(arrangement, Some(w.arrangement_json()));
    let rng = store.call(|c| crate::store::get_world(c, "rng")).await.unwrap().unwrap();
    assert_eq!(serde_json::from_str::<ChaCha8Rng>(&rng).unwrap(), w.rng);
}

/// Not a check: how long a replay holds the doors, for docs/notes/slice-01-wake.md.
/// `cargo test --release -p cafe measure_replay_times -- --ignored --nocapture`
#[test]
#[ignore]
fn measure_replay_times() {
    for (label, gap) in [("8 hours", 8 * HOUR), ("3 days, the cap", CAP)] {
        let now = canberra(2026, 10, 14, 7, 0);
        let mut w = world_at(1, now - gap);
        let began = std::time::Instant::now();
        let r = w.replay(now);
        println!("{label}: {} steps in {} ms ({:?})", r.steps, began.elapsed().as_millis(), r.walks);
    }
}
