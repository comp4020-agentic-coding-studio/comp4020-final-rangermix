//! The chalkboard (design.md, "The room"; slice 02): lines written by the
//! server from what the cats do, over a rolling day, seeded so every run is
//! the same.
use super::cat_life::Plan;
use super::people::tests::join;
use super::*;
use crate::protocol::{ChalkLine, ChalkWhat, Pose};
use chrono::TimeZone;
use rand::SeedableRng;

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

const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };
const HOUR: u64 = 3_600_000;
const MINUTE: u64 = 60_000;

fn cat_index(w: &World, id: &str) -> usize {
    w.cats.iter().position(|c| c.def.id == id).unwrap()
}

/// Holds a cat still and awake at `at`, so a test decides what happens.
fn hold(w: &mut World, cat: &str, at: Tile) -> usize {
    let i = cat_index(w, cat);
    let c = &mut w.cats[i];
    c.walk = None;
    c.pose = Pose::Idle;
    c.until = u64::MAX;
    c.plan = Plan::Idle;
    c.at = at;
    i
}

fn stand(w: &mut World, person: u32, at: Tile) {
    let p = w.people.iter_mut().find(|p| p.id == person).unwrap();
    p.walk = None;
    p.at = at;
}

/// The lines in what the world sent everyone.
fn chalked(outs: &[Out]) -> Vec<ChalkLine> {
    outs.iter()
        .filter_map(|o| match (&o.to, &o.msg) {
            (To::All, ServerMsg::Chalked { line }) => Some(line.clone()),
            _ => None,
        })
        .collect()
}

fn pet(w: &mut World, now: u64, id: u32, cat: &str) -> Vec<Out> {
    w.handle(
        now,
        Input::Msg {
            id,
            msg: ClientMsg::Pet { cat: cat.into() },
        },
    )
}

#[test]
fn an_empty_night_leaves_chalkboard_lines_and_traces_and_the_same_seed_the_same_night() {
    for seed in 1..=5 {
        let start = canberra(2026, 10, 14, 22, 0);
        let end = canberra(2026, 10, 15, 6, 0);
        let (mut a, mut b) = (world_at(seed, start), world_at(seed, start));
        a.replay(end);
        b.replay(end);
        assert!(!a.chalk_view().is_empty(), "seed {seed}: the night left lines");
        assert!(a.room.pieces.iter().any(|p| p.toppled), "seed {seed}: the night left traces");
        assert_eq!(a.chalk_view(), b.chalk_view(), "seed {seed}");
        assert_eq!(a.arrangement_json(), b.arrangement_json(), "seed {seed}");
    }
}

#[test]
fn a_first_meeting_is_a_line_naming_the_person() {
    let mut w = world_at(7, 0);
    join(&mut w, 1, 0);
    hold(&mut w, "mochi", T(5, 7));
    stand(&mut w, 1, T(5, 8));
    let lines = chalked(&pet(&mut w, 10, 1, "mochi"));
    assert_eq!(
        lines,
        vec![ChalkLine {
            at: 10,
            cat: "Mochi".into(),
            what: ChalkWhat::Met { with: "p1".into() },
        }]
    );
    let i = cat_index(&w, "mochi");
    w.cats[i].refused.clear();
    assert!(chalked(&pet(&mut w, 30_000, 1, "mochi")).is_empty(), "they've met");
}

/// Sam sits on the sofa with Mochi asleep on their lap since `since`, until `until`.
fn lap(w: &mut World, since: u64, until: u64) -> usize {
    join(w, 1, 0);
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa").unwrap().id;
    let p = w.people.iter_mut().find(|p| p.id == 1).unwrap();
    (p.walk, p.at, p.sitting) = (None, T(0, 5), Some(sofa));
    let i = hold(w, "mochi", T(0, 5));
    let c = &mut w.cats[i];
    (c.lap, c.pose, c.lap_since, c.until) = (Some(1), Pose::Nap, since, until);
    c.lap_with = Some("p1".into());
    i
}

#[test]
fn a_long_lap_is_a_line_with_its_minutes_and_a_short_one_is_not() {
    let start = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, start);
    lap(&mut w, start, start + 12 * MINUTE + 30_000);
    w.last_tick = start + 12 * MINUTE;
    let lines = chalked(&w.tick(start + 12 * MINUTE + 30_000));
    assert_eq!(
        lines.iter().map(|l| &l.what).collect::<Vec<_>>(),
        vec![&ChalkWhat::Lap {
            with: "p1".into(),
            minutes: 12
        }]
    );
    let mut w = world_at(1, start);
    lap(&mut w, start, start + 3 * MINUTE);
    w.last_tick = start + 3 * MINUTE - 100;
    assert!(
        chalked(&w.tick(start + 3 * MINUTE)).is_empty(),
        "three minutes isn't a nap worth telling"
    );
}

#[test]
fn the_same_doing_is_written_once_an_hour() {
    let start = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, start);
    let tora = cat_index(&w, "tora");
    let mut out = Vec::new();
    w.chalk(start, tora, ChalkWhat::Perched {}, &mut out);
    w.chalk(start + 10 * MINUTE, tora, ChalkWhat::Perched {}, &mut out);
    assert_eq!(chalked(&out).len(), 1);
    w.chalk(start + 61 * MINUTE, tora, ChalkWhat::Perched {}, &mut out);
    assert_eq!(chalked(&out).len(), 2);
    let mochi = cat_index(&w, "mochi");
    w.chalk(start + 62 * MINUTE, mochi, ChalkWhat::Perched {}, &mut out);
    assert_eq!(chalked(&out).len(), 3, "another cat's perch is its own");
    for (n, with) in ["sam", "jo"].into_iter().enumerate() {
        let what = ChalkWhat::Greeted { with: with.into() };
        w.chalk(start + 63 * MINUTE + n as u64, tora, what, &mut out);
    }
    assert_eq!(chalked(&out).len(), 5, "greeting two people is two lines");
    for n in 0..2 {
        let what = ChalkWhat::Met { with: format!("new{n}") };
        w.chalk(start + 64 * MINUTE + n, tora, what, &mut out);
    }
    w.chalk(
        start + 65 * MINUTE,
        tora,
        ChalkWhat::KnockedOver { piece: "plant".into() },
        &mut out,
    );
    w.chalk(
        start + 66 * MINUTE,
        tora,
        ChalkWhat::KnockedOver { piece: "plant".into() },
        &mut out,
    );
    assert_eq!(chalked(&out).len(), 9, "meetings and knock-overs are told every time");
}

#[test]
fn lines_drop_off_after_24_hours_live_and_in_a_replay() {
    let t = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, t);
    let mochi = cat_index(&w, "mochi");
    w.chalk(t, mochi, ChalkWhat::Played {}, &mut Vec::new());
    w.chalk_tick(t + 24 * HOUR - 1);
    assert_eq!(w.chalk_view().len(), 1, "a millisecond short of a day");
    w.chalk_tick(t + 24 * HOUR);
    assert!(w.chalk_view().is_empty(), "a day old");

    let mut w = world_at(1, t);
    let line = |at: u64| ChalkLine {
        at,
        cat: "Mochi".into(),
        what: ChalkWhat::Met { with: format!("at{at}") },
    };
    w.chalk.push_back(line(t - 23 * HOUR));
    w.chalk.push_back(line(t - HOUR));
    w.replay(t + 2 * HOUR);
    let kept: Vec<u64> = w.chalk.iter().map(|l| l.at).filter(|&at| at < t).collect();
    assert_eq!(kept, vec![t - HOUR], "the replay dropped the line that turned a day old");
}

#[test]
fn the_board_shows_the_latest_eight_oldest_first() {
    let t = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, t);
    let mochi = cat_index(&w, "mochi");
    for n in 0..10u64 {
        let what = ChalkWhat::Met { with: format!("p{n}") };
        w.chalk(t + n * MINUTE, mochi, what, &mut Vec::new());
    }
    let shown: Vec<u64> = w.chalk_view().iter().map(|l| (l.at - t) / MINUTE).collect();
    assert_eq!(shown, (2..10).collect::<Vec<u64>>());
    assert_eq!(w.snapshot_for(0, t + HOUR).chalkboard, w.chalk_view());
}

#[test]
fn no_line_carries_what_anyone_said() {
    let start = canberra(2026, 10, 14, 20, 0);
    let mut w = world_at(3, start);
    join(&mut w, 1, start);
    join(&mut w, 2, start);
    let said = [
        "hello there",
        "the lamp looks lovely by the window",
        "🐱 purr purr",
        "Mochi, come here!",
        "sam's lap is the comfiest",
        "Tora played with the toys",
    ];
    let mut now = start;
    for (n, text) in said.iter().enumerate() {
        now += 1_000;
        let id = 1 + (n as u32 % 2);
        w.handle(
            now,
            Input::Msg {
                id,
                msg: ClientMsg::Say {
                    text: text.to_string(),
                    to: None,
                },
            },
        );
        w.tick(now + 100);
    }
    for cat in ["mochi", "tora", "burakku"] {
        let at = if cat == "mochi" {
            T(5, 7)
        } else if cat == "tora" {
            T(9, 6)
        } else {
            T(3, 8)
        };
        hold(&mut w, cat, at);
        stand(&mut w, 1, Tile { x: at.x, y: at.y + 1 });
        now += 1_000;
        pet(&mut w, now, 1, cat);
        w.handle(
            now + 10,
            Input::Msg {
                id: 1,
                msg: ClientMsg::Play { cat: cat.into() },
            },
        );
    }
    for id in [1, 2] {
        w.handle(
            now + 500,
            Input::Msg {
                id,
                msg: ClientMsg::Leave {},
            },
        );
    }
    w.replay(now + 8 * HOUR);
    assert!(w.chalk.len() >= 3, "the meetings and the night wrote lines: {:?}", w.chalk);
    for line in &w.chalk {
        let json = serde_json::to_string(line).unwrap();
        for text in said {
            assert!(!json.contains(text), "{json} carries {text:?}");
        }
    }
}

#[test]
fn a_cat_playing_alone_may_scatter_the_toys_and_they_stay_scattered() {
    let start = canberra(2026, 10, 14, 23, 0);
    let mut scattered = 0;
    for seed in 1..=10 {
        let mut w = world_at(seed, start);
        let i = hold(&mut w, "tora", T(6, 8));
        w.cats[i].plan = Plan::Play;
        let mut out = Vec::new();
        w.settle(i, start, &mut out);
        let toys = w.room.pieces.iter().find(|p| p.kind == "toys").unwrap();
        let lines = chalked(&out);
        if toys.toppled {
            scattered += 1;
            assert!(
                out.iter()
                    .any(|o| matches!(o.msg, ServerMsg::FurnitureToppled { toppled: true, .. }))
            );
            assert_eq!(lines[0].what, ChalkWhat::KnockedOver { piece: "toys".into() });
        } else {
            assert_eq!(lines[0].what, ChalkWhat::Played {});
        }
    }
    assert!((1..10).contains(&scattered), "some nights she scatters them, some not: {scattered}");

    for seed in 1..=10 {
        let mut w = world_at(seed, start);
        join(&mut w, 1, start);
        let i = hold(&mut w, "tora", T(6, 8));
        w.cats[i].plan = Plan::Play;
        w.settle(i, start, &mut Vec::new());
        assert!(
            !w.room.pieces.iter().find(|p| p.kind == "toys").unwrap().toppled,
            "seed {seed}: not with someone in"
        );
    }
}

#[test]
fn the_cats_doings_with_people_and_new_furniture_are_lines() {
    let start = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, start);
    join(&mut w, 1, start);
    let tora = hold(&mut w, "tora", T(2, 2));
    let mut out = Vec::new();
    for plan in [Plan::Greet(1), Plan::PlayWith(1)] {
        w.cats[tora].plan = plan;
        w.settle(tora, start, &mut out);
    }
    let seat = w.room.pieces.iter().find(|p| p.kind == "window_seat").unwrap();
    let seat_at = T(seat.x, seat.y);
    let tora = hold(&mut w, "tora", seat_at);
    w.cats[tora].plan = Plan::Perch;
    w.settle(tora, start, &mut out);
    let cushion = w.room.pieces.iter().find(|p| p.kind == "cushion").unwrap();
    let (cushion, cushion_at) = (cushion.id, T(cushion.x, cushion.y));
    w.new_pieces.push((cushion, cushion_at, start));
    let tora = hold(&mut w, "tora", T(cushion_at.x - 1, cushion_at.y));
    w.cats[tora].plan = Plan::Investigate(cushion);
    w.settle(tora, start, &mut out);
    let whats: Vec<ChalkWhat> = chalked(&out).into_iter().map(|l| l.what).collect();
    assert_eq!(
        whats,
        vec![
            ChalkWhat::Greeted { with: "p1".into() },
            ChalkWhat::PlayedWith { with: "p1".into() },
            ChalkWhat::Perched {},
            ChalkWhat::Investigated { piece: "cushion".into() },
        ]
    );
}

#[tokio::test]
async fn a_line_is_stored_as_it_is_written_and_dropped_when_a_day_old() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("cafe.db")).unwrap();
    let t = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, t);
    w.store = Some(store.clone());
    let mochi = cat_index(&w, "mochi");
    w.chalk(t, mochi, ChalkWhat::Met { with: "sam".into() }, &mut Vec::new());
    store.flush().await.unwrap();
    let rows = store.call(|c| crate::store::all_chalk(c)).await.unwrap();
    assert_eq!(rows, vec![(t, serde_json::to_string(&w.chalk[0]).unwrap())]);
    w.chalk_tick(t + 24 * HOUR);
    store.flush().await.unwrap();
    assert!(store.call(|c| crate::store::all_chalk(c)).await.unwrap().is_empty());
}

#[test]
fn a_tidied_trace_stays_tidied() {
    let start = canberra(2026, 10, 14, 8, 0);
    let mut w = world_at(1, start);
    let toys = w.room.pieces.iter().find(|p| p.kind == "toys").unwrap();
    let (toys, at) = (toys.id, T(toys.x, toys.y));
    assert!(w.knock_over(toys, at, &mut Vec::new()), "the night scattered the toys");
    join(&mut w, 1, start);
    stand(&mut w, 1, T(at.x - 1, at.y));
    w.handle(
        start + 100,
        Input::Msg {
            id: 1,
            msg: ClientMsg::Tidy { id: toys },
        },
    );
    for step in 2..=40u64 {
        w.tick(start + step * 100);
    }
    let piece = |w: &World| w.room.pieces.iter().find(|p| p.kind == "toys").unwrap().toppled;
    assert!(!piece(&w), "sam gathered them up");
    // As saved, as restored after a restart, and through a quiet replay.
    let saved = w.arrangement_json();
    assert!(!saved.contains("toppled"), "{saved}");
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    let mut restored = World::new(
        content,
        trust,
        Vec::new(),
        SavedArrangement::Current(saved),
        ChaCha8Rng::seed_from_u64(1),
        None,
        "test".into(),
        start + 4_000,
    );
    assert!(!piece(&restored));
    for cat in ["mochi", "tora", "burakku"] {
        hold(&mut restored, cat, T(2 + cat.len() as u8, 3));
    }
    restored.replay(start + 4_000 + 10 * MINUTE);
    assert!(!piece(&restored), "nothing stood it back down");
}

#[test]
fn a_lap_that_ends_because_its_person_leaves_is_a_line() {
    // Slice 02's review, finding 3: leaving with a cat on your lap is one of
    // the commonest ways a lap ends.
    let start = canberra(2026, 10, 14, 15, 0);
    let mut w = world_at(1, start);
    lap(&mut w, start, start + 15 * MINUTE);
    w.last_tick = start + 10 * MINUTE;
    let mut outs = w.handle(
        start + 10 * MINUTE,
        Input::Msg {
            id: 1,
            msg: ClientMsg::Leave {},
        },
    );
    outs.extend(w.tick(start + 10 * MINUTE + 100));
    assert_eq!(
        chalked(&outs).iter().map(|l| &l.what).collect::<Vec<_>>(),
        vec![&ChalkWhat::Lap {
            with: "p1".into(),
            minutes: 10
        }]
    );
}

#[tokio::test]
async fn a_tidied_trace_stays_tidied_through_a_crash_and_a_wake() {
    // Slice 02's review, finding 8: gathered up, saved at once, so a crash
    // before the periodic save doesn't bring the toys back scattered.
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("cafe.db")).unwrap();
    let start = canberra(2026, 10, 14, 8, 0);
    let mut w = world_at(1, start);
    w.store = Some(store.clone());
    let toys = w.room.pieces.iter().find(|p| p.kind == "toys").unwrap();
    let (toys, at) = (toys.id, T(toys.x, toys.y));
    assert!(w.knock_over(toys, at, &mut Vec::new()));
    join(&mut w, 1, start);
    stand(&mut w, 1, T(at.x - 1, at.y));
    w.handle(
        start + 100,
        Input::Msg {
            id: 1,
            msg: ClientMsg::Tidy { id: toys },
        },
    );
    for step in 2..=40u64 {
        w.tick(start + step * 100);
    }
    assert!(!w.room.pieces.iter().find(|p| p.kind == "toys").unwrap().toppled);
    // No periodic save: the process dies here, and wakes from what's on disk.
    store.flush().await.unwrap();
    let woken = crate::wake::wake(&store, crate::content::repo_content(), "test".into(), start + 4_100, 1)
        .await
        .unwrap();
    let after = woken.snapshot_for(0, start + 4_100);
    assert!(
        !after.room.furniture.iter().find(|f| f.kind == "toys").unwrap().toppled,
        "the toys stayed gathered"
    );
}
