//! Phase 3 in the world: grudges and bans, bowls and treats, offering,
//! playing, carrying and passing a cat, knocking over and tidying, laps.
use super::people::tests::{capture_logs, join, world};
use super::*;
use crate::protocol::{ClientMsg, ErrorCode, Pose, Reaction, ServerMsg, Tile};
use crate::room::chebyshev;
use crate::store::BanRow;

const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };
const MIN: u64 = 60_000;

fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
    w.handle(now, Input::Msg { id, msg })
}

fn stand(w: &mut World, id: u32, at: Tile) {
    let p = w.people.iter_mut().find(|p| p.id == id).unwrap();
    p.walk = None;
    p.pending = None;
    p.at = at;
}

/// Holds a cat still at `at`, in `pose`, so a test decides what happens.
fn hold(w: &mut World, cat: &str, at: Tile, pose: Pose) -> usize {
    let i = w.cats.iter().position(|c| c.def.id == cat).unwrap();
    let c = &mut w.cats[i];
    (c.walk, c.at, c.pose, c.until, c.plan) = (None, at, pose, u64::MAX, cat_life::Plan::Idle);
    i
}

fn errors(outs: &[Out]) -> Vec<(To, ErrorCode, String)> {
    outs.iter()
        .filter_map(|o| match &o.msg {
            ServerMsg::Error { code, detail } => Some((o.to, *code, detail.clone())),
            _ => None,
        })
        .collect()
}

fn reactions(outs: &[Out]) -> Vec<Reaction> {
    outs.iter()
        .filter_map(|o| match &o.msg {
            ServerMsg::CatReacted { reaction, .. } => Some(*reaction),
            _ => None,
        })
        .collect()
}

fn treats_left(outs: &[Out], id: u32) -> Option<u32> {
    outs.iter().rev().find_map(|o| match (&o.to, &o.msg) {
        (To::One(to), ServerMsg::YourTreats { left }) if *to == id => Some(*left),
        _ => None,
    })
}

/// Someone Mochi knows, beside her, with her asleep: every pet is refused.
fn quarrel() -> (World, usize) {
    let mut w = world();
    join(&mut w, 1, 0);
    w.trust.apply("mochi", 1.0, 1, 5.0, "1970-01-01");
    let i = hold(&mut w, "mochi", T(5, 7), Pose::Nap);
    stand(&mut w, 1, T(5, 8));
    (w, i)
}

#[test]
fn pushing_a_cat_angers_it_into_scratching_and_then_a_ban_that_says_how_long() {
    let (mut w, _) = quarrel();
    let mut seen = Vec::new();
    for n in 0..4u64 {
        let outs = send(&mut w, 1, 1_000 + n * 2_000, ClientMsg::Pet { cat: "mochi".into() });
        seen.extend(reactions(&outs));
        if errors(&outs).iter().any(|(_, c, _)| *c == ErrorCode::Banned) {
            break;
        }
    }
    assert!(seen.contains(&Reaction::Scratch { by: 1 }), "{seen:?}");
    let outs = send(&mut w, 1, 20_000, ClientMsg::Pet { cat: "mochi".into() });
    let (to, code, detail) = errors(&outs).pop().expect("refused");
    assert_eq!((to, code), (To::One(1), ErrorCode::Banned));
    assert_eq!(detail, "Mochi won't be petted by you for another 2 h.");
    // The ban is for that action only: Mochi still takes a treat.
    let i = hold(&mut w, "mochi", T(5, 7), Pose::Idle);
    w.cats[i].hunger = 1.0;
    let outs = send(&mut w, 1, 21_000, ClientMsg::OfferTreat { cat: "mochi".into() });
    assert!(reactions(&outs).contains(&Reaction::Eat { from: 1 }));
    // And it lifts when the grudge is over.
    let i = hold(&mut w, "mochi", T(5, 7), Pose::Nap);
    w.cats[i].refused.clear();
    let outs = send(&mut w, 1, 3 * 60 * MIN, ClientMsg::Pet { cat: "mochi".into() });
    assert!(errors(&outs).iter().all(|(_, c, _)| *c != ErrorCode::Banned));
}

#[test]
fn a_scratch_costs_trust() {
    let (mut w, _) = quarrel();
    let before = w.trust.value("mochi", 1);
    for n in 0..3u64 {
        send(&mut w, 1, 1_000 + n * 2_000, ClientMsg::Pet { cat: "mochi".into() });
    }
    assert!(w.trust.value("mochi", 1) < before);
}

#[test]
fn a_ban_survives_a_restart_but_anger_does_not() {
    let mut w = world();
    join(&mut w, 1, 0);
    w.restore_bans(vec![BanRow {
        cat_id: "burakku".into(),
        user_id: 1,
        action: "pick_up".into(),
        until: 48 * 60 * MIN,
    }]);
    hold(&mut w, "burakku", T(5, 7), Pose::Idle);
    stand(&mut w, 1, T(5, 8));
    let outs = send(&mut w, 1, MIN, ClientMsg::PickUp { cat: "burakku".into() });
    let (_, code, detail) = errors(&outs).pop().expect("refused");
    assert_eq!(code, ErrorCode::Banned);
    assert!(detail.contains("won't be picked up by you for another 47 h 59 min"), "{detail}");
    assert!(w.anger.is_empty());
}

#[test]
fn three_treats_a_day_to_put_down_or_give_away() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    let outs = send(&mut w, 1, 1_000, ClientMsg::PutTreat {});
    assert!(
        outs.iter()
            .any(|o| o.to == To::All && matches!(o.msg, ServerMsg::TreatPlaced { by: 1, .. }))
    );
    assert_eq!(treats_left(&outs, 1), Some(2));
    let outs = send(&mut w, 1, 2_000, ClientMsg::GiveTreat { to: 2 });
    assert_eq!((treats_left(&outs, 1), treats_left(&outs, 2)), (Some(1), Some(4)));
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::TreatGiven { from: 1, to: 2 })));
    send(&mut w, 1, 3_000, ClientMsg::PutTreat {});
    let outs = send(&mut w, 1, 4_000, ClientMsg::PutTreat {});
    assert_eq!(errors(&outs)[0].1, ErrorCode::NoTreats);
    // A new Canberra day brings a new allowance.
    let outs = send(&mut w, 1, 24 * 60 * MIN, ClientMsg::PutTreat {});
    assert_eq!(treats_left(&outs, 1), Some(2));
}

#[test]
fn a_treat_put_down_in_the_doorway_lands_on_the_floor() {
    let mut w = world();
    let outs = join(&mut w, 1, 0);
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonJoined { .. })));
    // Still in the doorway, walking in.
    let outs = send(&mut w, 1, 10, ClientMsg::PutTreat {});
    let at = outs
        .iter()
        .find_map(|o| match &o.msg {
            ServerMsg::TreatPlaced { treat, .. } => Some(treat.at),
            _ => None,
        })
        .expect("put down");
    assert_ne!(at, w.room.door);
    assert_eq!(w.room.ground(at), crate::room::Ground::Floor);
}

#[test]
fn a_hungry_cat_finds_a_treat_and_its_giver_gains_a_little_trust() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(3, 8));
    for c in &mut w.cats {
        c.hunger = 0.0;
    }
    let i = w.cats.iter().position(|c| c.def.id == "mochi").unwrap();
    w.cats[i].hunger = 1.0;
    w.cats[i].until = 0;
    w.bowls = 0;
    w.bowls_key = super::treats::refill_key(1_000, &w.tuning.bowl_refills);
    send(&mut w, 1, 1_000, ClientMsg::PutTreat {});
    let mut eaten = false;
    for step in 1..=600u64 {
        if w.tick(1_000 + step * 100)
            .iter()
            .any(|o| matches!(&o.msg, ServerMsg::TreatEaten { cat, .. } if cat == "mochi"))
        {
            eaten = true;
            break;
        }
    }
    assert!(eaten, "Mochi never found the treat");
    assert!(w.trust.value("mochi", 1) > 0.0);
    assert!(w.floor_treats.is_empty());
}

#[test]
fn the_bowls_fill_on_the_cafes_schedule() {
    // 1970-01-01 00:00 UTC is 10:00 in Canberra: the 7:00 refill has passed.
    let mut w = world();
    let outs = w.tick(100);
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::Bowls { portions: 3 })));
    assert!(
        !w.tick(200).iter().any(|o| matches!(o.msg, ServerMsg::Bowls { .. })),
        "once a refill"
    );
    w.bowls = 1;
    // 12:00 in Canberra.
    let noon = 2 * 60 * MIN;
    let outs = w.tick(noon);
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::Bowls { portions: 3 })));
    let json = w.bowls_json();
    let mut again = world();
    again.restore_treats(Some(json), Vec::new());
    assert!(
        !again.tick(noon + 100).iter().any(|o| matches!(o.msg, ServerMsg::Bowls { .. })),
        "not refilled twice"
    );
}

#[test]
fn a_hungry_cat_takes_a_treat_from_your_hand_and_an_asleep_one_leaves_it_with_you() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(5, 8));
    let i = hold(&mut w, "mochi", T(5, 7), Pose::Idle);
    w.cats[i].hunger = 1.0;
    let outs = send(&mut w, 1, 1_000, ClientMsg::OfferTreat { cat: "mochi".into() });
    assert!(reactions(&outs).contains(&Reaction::Eat { from: 1 }));
    assert_eq!(treats_left(&outs, 1), Some(2));
    assert_eq!(w.cats[i].hunger, 0.0);
    hold(&mut w, "mochi", T(5, 7), Pose::Nap);
    let outs = send(&mut w, 1, 2_000, ClientMsg::OfferTreat { cat: "mochi".into() });
    assert_eq!(reactions(&outs), vec![Reaction::Refuse { by: 1 }]);
    assert_eq!(treats_left(&outs, 1), None, "the treat stays yours");
    assert!(w.anger.is_empty(), "no quarrel over a treat");
}

#[test]
fn tora_plays_with_someone_she_trusts() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(5, 8));
    for d in 1..=9 {
        w.trust.apply("tora", 1.0, 1, 10.0, &format!("1970-01-0{d}"));
    }
    let i = hold(&mut w, "tora", T(5, 7), Pose::Idle);
    w.cats[i].play = 1.0;
    let outs = send(&mut w, 1, 1_000, ClientMsg::Play { cat: "tora".into() });
    assert!(reactions(&outs).contains(&Reaction::Play { with: 1 }), "{:?}", reactions(&outs));
    assert_eq!(w.cats[i].pose, Pose::Play);
}

/// Picks Mochi up for person 1, retrying until she agrees.
fn carrying_mochi(w: &mut World, now: u64) -> usize {
    for d in 1..=9 {
        w.trust.apply("mochi", 1.0, 1, 10.0, &format!("1970-01-0{d}"));
    }
    for n in 0..30 {
        let i = hold(w, "mochi", T(5, 7), Pose::Idle);
        w.cats[i].refused.clear();
        w.anger.clear();
        stand(w, 1, T(5, 8));
        send(w, 1, now + n, ClientMsg::PickUp { cat: "mochi".into() });
        if w.cats[i].held_by == Some(1) {
            return i;
        }
    }
    panic!("Mochi never let herself be picked up");
}

#[test]
fn a_held_cat_goes_where_you_go_and_gets_down_when_put_down() {
    let mut w = world();
    join(&mut w, 1, 0);
    let i = carrying_mochi(&mut w, 1_000);
    assert_eq!(
        w.snapshot_for(1, 1_100).cats.iter().find(|c| c.id == "mochi").unwrap().held_by,
        Some(1)
    );
    // Arms full: no furniture.
    let plant = w.room.pieces.iter().find(|p| p.kind == "plant").unwrap().id;
    let outs = send(&mut w, 1, 1_200, ClientMsg::Grab { id: plant });
    assert_eq!(errors(&outs)[0].1, ErrorCode::HandsFull);
    let walk = send(&mut w, 1, 1_300, ClientMsg::WalkTo { tile: T(3, 8) });
    let end = walk
        .iter()
        .find_map(|o| match &o.msg {
            ServerMsg::PersonMoved { walk, .. } => Some(walk_end(walk)),
            _ => None,
        })
        .unwrap();
    w.tick(end + 1);
    assert_eq!(w.cats[i].at, T(3, 8), "carried along");
    let outs = send(&mut w, 1, end + 200, ClientMsg::PutDown {});
    assert!(outs.iter().any(|o| matches!(&o.msg, ServerMsg::CatHeld { by: None, .. })));
    assert_eq!(w.cats[i].held_by, None);
    assert!(chebyshev(w.cats[i].at, T(3, 8)) <= 1);
}

#[test]
fn a_held_cat_jumps_down_when_it_has_had_enough_and_when_its_holder_leaves() {
    let mut w = world();
    join(&mut w, 1, 0);
    let i = carrying_mochi(&mut w, 1_000);
    let until = w.cats[i].held_until;
    assert!(
        w.tick(until - 1)
            .iter()
            .all(|o| !matches!(o.msg, ServerMsg::CatHeld { by: None, .. }))
    );
    assert!(w.tick(until).iter().any(|o| matches!(o.msg, ServerMsg::CatHeld { by: None, .. })));
    let i = carrying_mochi(&mut w, until + 1_000);
    let outs = send(&mut w, 1, until + 2_000, ClientMsg::Leave {});
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::CatHeld { by: None, .. })));
    assert_eq!(w.cats[i].held_by, None);
}

#[test]
fn a_cat_passed_to_someone_it_knows_goes_to_them_and_from_a_stranger_jumps_down() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    join(&mut w, 3, 0);
    w.trust.apply("mochi", 1.0, 2, 10.0, "1970-01-01");
    w.trust.apply("mochi", 1.0, 2, 10.0, "1970-01-02");
    let i = carrying_mochi(&mut w, 1_000);
    stand(&mut w, 2, T(4, 8));
    let outs = send(&mut w, 1, 2_000, ClientMsg::PassCat { to: 2 });
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::CatHeld { by: Some(2), .. })));
    assert_eq!(w.cats[i].held_by, Some(2));
    // Too far, then a stranger.
    stand(&mut w, 3, T(10, 2));
    let outs = send(&mut w, 2, 2_100, ClientMsg::PassCat { to: 3 });
    assert_eq!(errors(&outs)[0].1, ErrorCode::BadTile);
    stand(&mut w, 3, T(4, 7));
    let outs = send(&mut w, 2, 2_200, ClientMsg::PassCat { to: 3 });
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::CatHeld { by: None, .. })));
    assert_eq!(w.cats[i].held_by, None);
}

#[test]
fn burakku_knocks_something_over_in_an_empty_cafe_and_anyone_can_stand_it_up() {
    let mut w = world();
    for c in &mut w.cats {
        c.tiredness = 0.0;
        c.hunger = 0.0;
        c.play = 0.0;
    }
    let mut toppled = None;
    for step in 1..=36_000u64 {
        for o in w.tick(step * 100) {
            if let ServerMsg::FurnitureToppled { id, toppled: true, .. } = o.msg {
                toppled = Some(id);
            }
        }
        if toppled.is_some() {
            break;
        }
    }
    let piece = toppled.expect("an hour alone and nothing knocked over");
    assert!(w.room.pieces.iter().any(|p| p.id == piece && p.toppled));
    assert!(w.arrangement_json().contains(r#""toppled":true"#), "saved on its side");
    join(&mut w, 1, 4_000_000);
    let at = w.room.pieces.iter().find(|p| p.id == piece).map(|p| T(p.x, p.y)).unwrap();
    let beside = w.room.around(at, crate::room::Walker::Person)[0];
    stand(&mut w, 1, beside);
    let log = capture_logs(|| {
        let outs = send(&mut w, 1, 4_000_100, ClientMsg::Tidy { id: piece });
        assert!(outs.iter().any(|o| matches!(
            o.msg,
            ServerMsg::FurnitureToppled {
                toppled: false,
                by: Some(1),
                ..
            }
        )));
    });
    assert!(log.contains(r#""what":"tidy""#));
    assert!(!w.room.pieces.iter().any(|p| p.id == piece && p.toppled));
}

#[test]
fn a_devoted_cat_naps_on_a_lap() {
    let mut w = world();
    join(&mut w, 1, 0);
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa").unwrap().id;
    stand(&mut w, 1, T(1, 6));
    send(&mut w, 1, 1_000, ClientMsg::Sit { id: sofa });
    for d in 1..=9 {
        w.trust.apply("mochi", 1.0, 1, 10.0, &format!("1970-01-0{d}"));
    }
    for c in &mut w.cats {
        c.hunger = 0.0;
        c.tiredness = 0.8;
    }
    let mut on_lap = false;
    let log = capture_logs(|| {
        for step in 1..=12_000u64 {
            w.tick(1_000 + step * 100);
            if w.cats.iter().any(|c| c.def.id == "mochi" && c.lap == Some(1)) {
                on_lap = true;
                break;
            }
        }
    });
    assert!(on_lap, "twenty minutes and no lap");
    assert!(log.contains(r#""what":"lap""#));
    // Standing up tips her off, and that's in her story (finding 15 (c)).
    let log = capture_logs(|| {
        send(&mut w, 1, 2_000_000, ClientMsg::WalkTo { tile: T(4, 8) });
        w.tick(2_000_100);
    });
    assert!(!w.cats.iter().any(|c| c.lap.is_some()));
    let line = lines(&log)
        .into_iter()
        .find(|v| v["what"] == "jump_down")
        .expect("a jump_down line");
    assert_eq!(line["why"], "got_up", "{line}");
}

// Phase 3's review (docs/notes/reviews/phase-3-findings.md), handling.

fn lines(log: &str) -> Vec<serde_json::Value> {
    log.lines().filter_map(|l| serde_json::from_str(l).ok()).collect()
}

/// Sits `id` on the sofa from (1, 6); returns their seat.
fn sit_on_sofa(w: &mut World, id: u32, now: u64) -> Tile {
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa").unwrap().id;
    stand(w, id, T(1, 6));
    send(w, id, now, ClientMsg::Sit { id: sofa });
    let p = w.person(id).unwrap();
    assert!(p.sitting.is_some(), "seated");
    p.at
}

#[test]
fn a_held_cat_that_scratches_its_holder_jumps_down_and_one_that_purrs_stays_held() {
    // Finding 1.
    let mut w = world();
    join(&mut w, 1, 0);
    let i = carrying_mochi(&mut w, 1_000);
    w.cats[i].refused = vec![(1, 1_500)];
    w.anger.insert(("mochi".into(), 1), crate::anger::Anger { level: 0.9, at: 2_000 });
    let outs = send(&mut w, 1, 2_000, ClientMsg::Pet { cat: "mochi".into() });
    assert!(reactions(&outs).contains(&Reaction::Scratch { by: 1 }), "{:?}", reactions(&outs));
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::CatHeld { by: None, .. })));
    assert_eq!(w.cats[i].held_by, None);
    assert_ne!(w.cats[i].pose, Pose::Walk, "she jumps down, she doesn't walk off in your arms");
    for n in 0..30u64 {
        let now = 10_000 + n * 1_000;
        w.cats[i].held_by = None;
        let i = carrying_mochi(&mut w, now);
        let outs = send(&mut w, 1, now + 500, ClientMsg::Pet { cat: "mochi".into() });
        if reactions(&outs).contains(&Reaction::Purr { by: 1 }) {
            assert_eq!(
                (w.cats[i].held_by, w.cats[i].pose),
                (Some(1), Pose::Held),
                "a purr keeps her in your arms"
            );
            return;
        }
    }
    panic!("Mochi never purred in your arms");
}

#[test]
fn a_lap_cat_that_scratches_its_person_gets_off_the_lap() {
    // Finding 1, on a lap.
    let mut w = world();
    join(&mut w, 1, 0);
    let seat = sit_on_sofa(&mut w, 1, 1_000);
    w.trust.apply("mochi", 1.0, 1, 5.0, "1970-01-01");
    let i = hold(&mut w, "mochi", seat, Pose::Nap);
    w.cats[i].lap = Some(1);
    w.cats[i].refused = vec![(1, 1_500)];
    w.anger.insert(("mochi".into(), 1), crate::anger::Anger { level: 0.9, at: 2_000 });
    let outs = send(&mut w, 1, 2_000, ClientMsg::Pet { cat: "mochi".into() });
    assert!(reactions(&outs).contains(&Reaction::Scratch { by: 1 }));
    assert_eq!(w.cats[i].lap, None);
}

#[test]
fn a_cat_isnt_passed_to_someone_it_has_banned_or_is_angry_at() {
    // Finding 5.
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    for d in 1..=3 {
        w.trust.apply("mochi", 1.0, 2, 10.0, &format!("1970-01-0{d}"));
    }
    w.restore_bans(vec![BanRow {
        cat_id: "mochi".into(),
        user_id: 2,
        action: "pick_up".into(),
        until: 60 * MIN,
    }]);
    let i = carrying_mochi(&mut w, 1_000);
    stand(&mut w, 2, T(4, 8));
    send(&mut w, 1, 2_000, ClientMsg::PassCat { to: 2 });
    assert_ne!(
        w.cats[i].held_by,
        Some(2),
        "she won't be picked up by 2, so she won't be passed to 2"
    );
    w.restore_bans(Vec::new());
    let i = carrying_mochi(&mut w, 3_000);
    stand(&mut w, 2, T(4, 8));
    w.anger.insert(("mochi".into(), 2), crate::anger::Anger { level: 0.7, at: 4_000 });
    send(&mut w, 1, 4_000, ClientMsg::PassCat { to: 2 });
    assert_ne!(w.cats[i].held_by, Some(2), "she's angry at 2");
    w.anger.clear();
    let i = carrying_mochi(&mut w, 5_000);
    stand(&mut w, 2, T(4, 8));
    send(&mut w, 1, 6_000, ClientMsg::PassCat { to: 2 });
    assert_eq!(w.cats[i].held_by, Some(2), "and with neither, she goes");
}

#[test]
fn a_pet_that_ends_in_a_ban_logs_one_pet_line_and_one_ban_line_in_that_order() {
    // Finding 9.
    let (mut w, _) = quarrel();
    let mut tries = 0;
    let log = capture_logs(|| {
        for n in 0..6u64 {
            tries += 1;
            let outs = send(&mut w, 1, 1_000 + n * 2_000, ClientMsg::Pet { cat: "mochi".into() });
            if errors(&outs).iter().any(|(_, c, _)| *c == ErrorCode::Banned) {
                break;
            }
        }
    });
    let got = lines(&log);
    let pets: Vec<&serde_json::Value> = got.iter().filter(|v| v["what"] == "pet").collect();
    assert_eq!(pets.len(), tries, "one line a try: {pets:?}");
    assert!(pets.iter().all(|v| v["outcome"] != "refused"), "every try was answered: {pets:?}");
    let ban = got.iter().position(|v| v["what"] == "banned").expect("a ban line");
    assert_eq!(
        (got[ban]["cat"].as_str(), got[ban]["action"].as_str()),
        (Some("Mochi"), Some("pet"))
    );
    let last_pet = got.iter().rposition(|v| v["what"] == "pet").unwrap();
    assert!(last_pet < ban, "the pet, then the ban it ended in");
}

#[test]
fn a_cat_scratches_before_it_bans_and_stays_angry_after() {
    // Findings 17 and 18.
    let (mut w, _) = quarrel();
    let mut scratched_alone = false;
    let mut banned_at = None;
    for n in 0..6u64 {
        let now = 1_000 + n * 2_000;
        let outs = send(&mut w, 1, now, ClientMsg::Pet { cat: "mochi".into() });
        let banned = errors(&outs).iter().any(|(_, c, _)| *c == ErrorCode::Banned);
        if reactions(&outs).contains(&Reaction::Scratch { by: 1 }) && !banned {
            scratched_alone = true;
        }
        if banned {
            banned_at = Some(now);
            break;
        }
    }
    assert!(scratched_alone, "a scratch, before the ban");
    let now = banned_at.expect("banned in the end");
    let anger = w.anger.get(&("mochi".to_string(), 1)).copied().unwrap_or_default();
    assert!(anger.at(now, 2.0) >= crate::anger::SCRATCH, "a ban doesn't calm her: {anger:?}");
}

#[test]
fn nobody_ends_up_seated_with_a_cat_in_their_arms() {
    // Finding 19.
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    for d in 1..=9 {
        w.trust.apply("mochi", 1.0, 1, 10.0, &format!("1970-01-0{d}"));
        w.trust.apply("mochi", 1.0, 2, 10.0, &format!("1970-01-0{d}"));
    }
    // Picking up from a seat gets you up first.
    let seat = sit_on_sofa(&mut w, 1, 1_000);
    hold(&mut w, "mochi", T(seat.x, seat.y + 1), Pose::Idle);
    send(&mut w, 1, 1_100, ClientMsg::PickUp { cat: "mochi".into() });
    assert!(w.person(1).unwrap().sitting.is_none(), "up off the sofa to pick her up");
    for step in 1..=50u64 {
        w.tick(1_100 + step * 100);
        let p = w.person(1).unwrap();
        assert!(!(p.sitting.is_some() && w.holding_cat(1).is_some()));
    }
    // Nobody seated is passed a cat.
    w.handle(
        7_000,
        Input::Msg {
            id: 1,
            msg: ClientMsg::PutDown {},
        },
    );
    let i = carrying_mochi(&mut w, 8_000);
    let seat = sit_on_sofa(&mut w, 2, 9_000);
    stand(&mut w, 1, T(seat.x, seat.y + 1));
    let outs = send(&mut w, 1, 9_100, ClientMsg::PassCat { to: 2 });
    assert!(!errors(&outs).is_empty(), "refused: {outs:?}");
    assert_eq!(w.cats[i].held_by, Some(1));
    // Nor sits down holding one.
    send(&mut w, 2, 9_200, ClientMsg::WalkTo { tile: T(5, 8) });
    w.tick(20_000);
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa").unwrap().id;
    send(&mut w, 2, 20_100, ClientMsg::Sit { id: sofa });
    w.cats[i].held_by = Some(2);
    w.cats[i].held_until = u64::MAX;
    for step in 1..=100u64 {
        w.tick(20_100 + step * 100);
    }
    let p = w.person(2).unwrap();
    assert!(
        !(p.sitting.is_some() && w.holding_cat(2).is_some()),
        "seated with Mochi in their arms"
    );
}

#[test]
fn nothing_is_passed_or_given_to_someone_walking_out_or_gone_quiet() {
    // Finding 20.
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    for d in 1..=3 {
        w.trust.apply("mochi", 1.0, 2, 10.0, &format!("1970-01-0{d}"));
    }
    let i = carrying_mochi(&mut w, 1_000);
    stand(&mut w, 2, T(4, 8));
    w.handle(1_500, Input::Drop { id: 2 });
    let outs = send(&mut w, 1, 2_000, ClientMsg::PassCat { to: 2 });
    assert_eq!(errors(&outs).first().map(|e| e.1), Some(ErrorCode::UnknownPerson));
    assert_eq!(w.cats[i].held_by, Some(1));
    let outs = send(&mut w, 1, 2_100, ClientMsg::GiveTreat { to: 2 });
    assert_eq!(errors(&outs).first().map(|e| e.1), Some(ErrorCode::UnknownPerson));
    join(&mut w, 2, 2_200);
    stand(&mut w, 2, T(4, 8));
    w.people.iter_mut().find(|p| p.id == 2).unwrap().leaving = true;
    let outs = send(&mut w, 1, 2_300, ClientMsg::PassCat { to: 2 });
    assert_eq!(errors(&outs).first().map(|e| e.1), Some(ErrorCode::UnknownPerson));
    assert_eq!(w.cats[i].held_by, Some(1));
}

/// The try, in a run of refusals two seconds apart, at which `cat` first scratches.
fn first_scratch(cat: &str) -> u64 {
    let mut w = world();
    join(&mut w, 1, 0);
    w.trust.apply(cat, 1.0, 1, 5.0, "1970-01-01");
    hold(&mut w, cat, T(5, 7), Pose::Nap);
    stand(&mut w, 1, T(5, 8));
    for n in 0..6u64 {
        let outs = send(&mut w, 1, 1_000 + n * 2_000, ClientMsg::Pet { cat: cat.into() });
        if reactions(&outs).contains(&Reaction::Scratch { by: 1 }) {
            return n + 1;
        }
    }
    panic!("{cat} never scratched");
}

#[test]
fn tora_is_quick_to_swat() {
    // Finding 18: design.md's character table.
    let tora = first_scratch("tora");
    assert!(
        tora < first_scratch("mochi") && tora < first_scratch("burakku"),
        "Tora first scratches at try {tora}"
    );
}

#[test]
fn a_cat_carried_to_the_door_jumps_down_because_of_the_door() {
    // Finding 15 (b).
    let mut w = world();
    join(&mut w, 1, 0);
    let i = carrying_mochi(&mut w, 1_000);
    let door = w.room.door;
    stand(&mut w, 1, door);
    let log = capture_logs(|| {
        w.tick(1_100);
    });
    assert_eq!(w.cats[i].held_by, None);
    let line = lines(&log)
        .into_iter()
        .find(|v| v["what"] == "jump_down")
        .expect("a jump_down line");
    assert_eq!(line["why"], "door", "{line}");
}
