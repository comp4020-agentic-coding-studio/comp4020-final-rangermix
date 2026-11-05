//! A demo account moves the café's clock on (slice 17, ADR 0022).
use super::demo_tests::join_demo;
use super::people::tests::join;
use super::*;
use crate::protocol::{ClientMsg, ErrorCode, Place, ServerMsg, Tile};
use crate::test_logs::LogSink;
use chrono::TimeZone;

const HOUR: u64 = 3_600_000;
const NIGHT: u32 = 23 * 60 + 30;

pub(crate) fn canberra(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> u64 {
    chrono_tz::Australia::Sydney
        .with_ymd_and_hms(y, mo, d, h, mi, 0)
        .single()
        .unwrap()
        .timestamp_millis() as u64
}

pub(crate) fn world_at(now: u64) -> World {
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    World::new(
        content,
        trust,
        Vec::new(),
        SavedArrangement::Fresh,
        ChaCha8Rng::seed_from_u64(7),
        None,
        "test".into(),
        now,
    )
}

fn ask(w: &mut World, id: u32, now: u64, minute: Option<u32>) -> Vec<Out> {
    w.handle(
        now,
        Input::Msg {
            id,
            msg: ClientMsg::SetClock { minute },
        },
    )
}

fn refused(outs: &[Out], id: u32) -> Vec<ErrorCode> {
    outs.iter()
        .filter_map(|o| match (&o.to, &o.msg) {
            (To::One(to), ServerMsg::Error { code, .. }) if *to == id => Some(*code),
            _ => None,
        })
        .collect()
}

fn jumping(outs: &[Out]) -> Option<(String, u64)> {
    outs.iter().find_map(|o| match (&o.to, &o.msg) {
        (To::All, ServerMsg::Jumping { by, to }) => Some((by.clone(), *to)),
        _ => None,
    })
}

/// Asks for `minute` and runs the jump a moment later, as the world task does.
fn jump(w: &mut World, id: u32, now: u64, minute: Option<u32>) -> (u64, Vec<Out>) {
    let asked = ask(w, id, now, minute);
    let (_, to) = jumping(&asked).expect("a jump");
    let jump = w.take_jump().expect("held for the world task");
    w.run_jump(now + 100, jump);
    (to, w.welcomes(to))
}

fn welcomes(outs: &[Out]) -> Vec<(u32, u64, u64)> {
    outs.iter()
        .filter_map(|o| match (&o.to, &o.msg) {
            (To::One(id), ServerMsg::Welcome { now, ahead, .. }) => Some((*id, *now, *ahead)),
            _ => None,
        })
        .collect()
}

#[test]
fn a_jump_goes_to_the_next_time_of_day() {
    let sink = LogSink::default();
    let _logging = sink.capture();
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join(&mut w, 1, t0);
    join_demo(&mut w, 2, t0);
    let asked = ask(&mut w, 2, t0, Some(NIGHT));
    assert_eq!(jumping(&asked), Some(("demo2".to_string(), t0 + 9 * HOUR + HOUR / 2)));
    let jump = w.take_jump().expect("held for the world task");
    assert!(w.take_jump().is_none(), "once");
    let to = t0 + 9 * HOUR + HOUR / 2;
    w.run_jump(t0 + 100, jump);
    let outs = w.welcomes(to);
    // The lead grows by exactly the gap asked for (finding 8).
    let ahead = to - t0;
    assert_eq!(welcomes(&outs), vec![(1, to, ahead), (2, to, ahead)]);
    assert_eq!(w.ahead(), ahead);
    let line = sink.lines().into_iter().find(|l| l["what"] == "jumped").expect("a jumped line");
    assert_eq!(
        (line["who"].as_str(), line["gap_secs"].as_u64()),
        (Some("demo2"), Some((to - (t0 + 100)) / 1000))
    );
    assert!(line["steps"].as_u64().unwrap() >= 34_000, "{line}");
}

#[test]
fn a_jump_is_one_a_minute() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 2, t0);
    let (to, _) = jump(&mut w, 2, t0, Some(15 * 60));
    assert_eq!(refused(&ask(&mut w, 2, to + 30_000, Some(NIGHT)), 2), vec![ErrorCode::TooSoon]);
    let welcome = match &w.welcome(2, to + 30_000) {
        ServerMsg::Welcome { next_jump, .. } => *next_jump,
        _ => unreachable!(),
    };
    assert_eq!(welcome, to + 60_000);
    assert!(jumping(&ask(&mut w, 2, to + 61_000, Some(NIGHT))).is_some());
    // A second ask while one waits for the world task is too soon as well.
    assert_eq!(refused(&ask(&mut w, 2, to + 62_000, Some(NIGHT)), 2), vec![ErrorCode::TooSoon]);
}

#[test]
fn a_jump_never_goes_past_a_day() {
    // 02:30 doesn't happen on 4 October 2026: the next is 24.5 hours on.
    let t0 = canberra(2026, 10, 4, 1, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 2, t0);
    assert_eq!(refused(&ask(&mut w, 2, t0, Some(2 * 60 + 30)), 2), vec![ErrorCode::BadTime]);
    assert_eq!(refused(&ask(&mut w, 2, t0, Some(24 * 60)), 2), vec![ErrorCode::BadTime]);
    assert!(w.take_jump().is_none());
}

#[test]
fn canberra_time_puts_the_hour_back_by_moving_on() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 2, t0);
    assert_eq!(refused(&ask(&mut w, 2, t0, None), 2), vec![ErrorCode::BadTime], "already on it");
    w.restore_ahead(3 * HOUR);
    assert_eq!(jumping(&ask(&mut w, 2, t0, None)), Some(("demo2".into(), t0 + 21 * HOUR)));
}

#[test]
fn a_jump_lives_the_hours_between() {
    let sink = LogSink::default();
    let _logging = sink.capture();
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join(&mut w, 1, t0);
    join_demo(&mut w, 2, t0);
    // A café already open: its bowls had the 12:00 refill.
    w.tick(t0);
    w.handle(
        t0,
        Input::Msg {
            id: 1,
            msg: ClientMsg::PutTreat {},
        },
    );
    assert_eq!(w.treats_left(1, t0), 2);
    // On to 07:30 tomorrow: the 18:00 and 07:00 refills, and midnight's treats.
    let (to, outs) = jump(&mut w, 2, t0, Some(7 * 60 + 30));
    let line = sink.lines().into_iter().find(|l| l["what"] == "jumped").unwrap();
    assert_eq!(line["refills"].as_u64(), Some(2), "{line}");
    let treats = outs
        .iter()
        .find_map(|o| match (&o.to, &o.msg) {
            (To::One(1), ServerMsg::Welcome { snapshot, .. }) => Some(snapshot.your_treats),
            _ => None,
        })
        .unwrap();
    assert_eq!(treats, 3, "a new day's treats");
    assert_eq!(crate::time::canberra_day(to), "2026-11-07");
}

#[test]
fn the_same_save_and_jump_make_the_same_cafe() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let run = || {
        let mut w = world_at(t0);
        join_demo(&mut w, 2, t0);
        let (to, _) = jump(&mut w, 2, t0, Some(NIGHT));
        serde_json::to_string(&w.snapshot_for(2, to)).unwrap()
    };
    assert_eq!(run(), run());
}

#[test]
fn a_jump_settles_people_and_walks_nobody_out() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    for id in 2..=7 {
        join(&mut w, id, t0);
    }
    assert_eq!(w.person(7).unwrap().place, Place::Window, "someone waits");
    let settled = t0 + 10_000;
    w.tick(settled);
    // 2's tab is hidden, 3 walks across the room, 4 carries a new lamp, and
    // 5's connection drops.
    w.handle(
        settled,
        Input::Msg {
            id: 2,
            msg: ClientMsg::Presence { hidden: true },
        },
    );
    w.handle(
        settled,
        Input::Msg {
            id: 3,
            msg: ClientMsg::WalkTo { tile: Tile { x: 1, y: 8 } },
        },
    );
    w.handle(
        settled,
        Input::Msg {
            id: 4,
            msg: ClientMsg::Take { kind: "lamp".into() },
        },
    );
    assert!(w.held.iter().any(|h| h.by == 4));
    w.handle(settled, Input::Drop { id: 5 });
    let asked = ask(&mut w, 1, settled, Some(NIGHT));
    let (_, to) = jumping(&asked).unwrap();
    let jump = w.take_jump().unwrap();
    w.run_jump(settled + 100, jump);
    assert!(w.held.is_empty(), "the lamp went");
    assert!(w.person(3).unwrap().walk.is_none(), "the walk ended where it was");
    let after = w.tick(to + 1_000);
    for id in 1..=7 {
        assert!(w.person(id).is_some(), "{id} is still here");
    }
    assert!(
        !after
            .iter()
            .any(|o| matches!(o.msg, ServerMsg::StillThere { .. } | ServerMsg::PersonLeft { .. })),
        "{after:?}"
    );
    // 5's grace period starts again after the jump, as if it had just dropped.
    assert!(w.person(5).unwrap().away_since.is_some());
    w.tick(to + 31_000);
    assert!(w.person(5).is_none(), "gone after its grace period");
}

#[tokio::test]
async fn trust_a_cat_gives_during_a_jump_is_stored() {
    // Slice 17's review, finding 3: a sleep's replay never meets a treat on
    // the floor, but a jump's does; a cat that ate one changed its giver's
    // trust in memory only, and a restart lost it.
    let dir = tempfile::tempdir().unwrap();
    let store = crate::store::Store::open(&dir.path().join("cafe.db")).unwrap();
    store
        .call(|c| {
            crate::store::insert_user(c, "p1", "p", "r", 0, 0, 1)?;
            crate::store::insert_user(c, "demo2", "p", "r", 0, 0, 1)?;
            Ok(())
        })
        .await
        .unwrap();
    let t0 = canberra(2026, 11, 6, 14, 0);
    let content = crate::content::repo_content();
    let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
    let mut w = World::new(
        content,
        trust,
        Vec::new(),
        SavedArrangement::Fresh,
        ChaCha8Rng::seed_from_u64(7),
        Some(store.clone()),
        "test".into(),
        t0,
    );
    join(&mut w, 1, t0);
    join_demo(&mut w, 2, t0);
    w.tick(t0);
    w.handle(
        t0 + 10_000,
        Input::Msg {
            id: 1,
            msg: ClientMsg::PutTreat {},
        },
    );
    jump(&mut w, 2, t0 + 10_000, Some(NIGHT));
    store.flush().await.unwrap();
    let rows = store.call(|c| crate::store::all_trust(c)).await.unwrap();
    let mut gained = 0;
    for cat in ["mochi", "tora", "burakku"] {
        let value = w.trust.value(cat, 1);
        if value > 0.0 {
            gained += 1;
            let row = rows.iter().find(|r| r.cat_id == cat && r.user_id == 1);
            assert_eq!(row.map(|r| r.value), Some(value), "{cat}'s trust in p1 is stored");
        }
    }
    assert!(gained > 0, "a cat ate p1's treat during the jump");
}

#[test]
fn a_jump_puts_a_held_cat_down_and_ends_a_lap() {
    // Slice 17's review, finding 11: the replay's first step lets both go,
    // with their person set aside; now a test would see if it didn't.
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    join(&mut w, 2, t0);
    let settled = t0 + 10_000;
    w.tick(settled);
    let holder = w.person(1).unwrap().at;
    w.cats[0].held_by = Some(1);
    w.cats[0].at = holder;
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa").unwrap();
    let (seat, sofa_id) = (sofa.tiles()[0], sofa.id);
    let p = w.people.iter_mut().find(|p| p.id == 2).unwrap();
    p.at = seat;
    p.sitting = Some(sofa_id);
    w.cats[1].at = seat;
    w.cats[1].walk = None;
    w.cats[1].lap = Some(2);
    w.cats[1].until = settled + 3_600_000;
    jump(&mut w, 1, settled, Some(NIGHT));
    assert_eq!(w.cats[0].held_by, None, "the held cat got down");
    assert_eq!(w.cats[1].lap, None, "the lap ended");
}

#[test]
fn no_cat_is_left_on_a_persons_tile() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    w.tick(t0 + 10_000);
    let at = w.person(1).unwrap().at;
    w.cats[0].at = at;
    w.cats[0].walk = None;
    w.cats_off_people(t0 + 10_000);
    assert_ne!(w.cats[0].at, at);
    assert!(w.free_for(0, w.cats[0].at, t0 + 10_000));
}
