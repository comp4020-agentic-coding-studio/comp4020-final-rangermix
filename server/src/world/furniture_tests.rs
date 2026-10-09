//! Rearranging and sitting (design.md, "People"; plan-phase-2.md Tasks 5 and 6).
use super::people::tests::{join, world};
use super::*;
use crate::protocol::{ClientMsg, ErrorCode, Reaction, ServerMsg, Tile};
use crate::room::Walker;

const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };

fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
    w.handle(now, Input::Msg { id, msg })
}

fn piece_of(w: &World, kind: &str) -> u32 {
    w.room.pieces.iter().find(|p| p.kind == kind).expect("a piece of that kind").id
}

/// Stands a person, still, at `at`.
fn stand(w: &mut World, id: u32, at: Tile) {
    let p = w.people.iter_mut().find(|p| p.id == id).unwrap();
    p.walk = None;
    p.pending = None;
    p.at = at;
}

fn walk_of(outs: &[Out], id: u32) -> Option<Walk> {
    outs.iter().find_map(|o| match &o.msg {
        ServerMsg::PersonMoved { id: who, walk } if *who == id => Some(walk.clone()),
        _ => None,
    })
}

/// Lets every walk in progress finish.
fn arrive(w: &mut World, outs: &[Out], id: u32) -> Vec<Out> {
    let walk = walk_of(outs, id).expect("a walk");
    w.tick(walk_end(&walk) + 1)
}

fn errors(outs: &[Out]) -> Vec<(To, ErrorCode)> {
    outs.iter()
        .filter_map(|o| match &o.msg {
            ServerMsg::Error { code, .. } => Some((o.to, *code)),
            _ => None,
        })
        .collect()
}

fn held(outs: &[Out]) -> Vec<(To, u32, u32)> {
    outs.iter()
        .filter_map(|o| match &o.msg {
            ServerMsg::FurnitureHeld { piece, by } => Some((o.to, piece.id, *by)),
            _ => None,
        })
        .collect()
}

fn placed(outs: &[Out]) -> Vec<(u32, Tile)> {
    outs.iter()
        .filter_map(|o| match &o.msg {
            ServerMsg::FurniturePlaced { piece, .. } => Some((piece.id, T(piece.x, piece.y))),
            _ => None,
        })
        .collect()
}

fn on_floor(w: &World, id: u32) -> Option<Tile> {
    w.room.pieces.iter().find(|p| p.id == id).map(|p| T(p.x, p.y))
}

/// Person 1 inside, standing at the cushion's side, holding it.
fn holding_cushion() -> (World, u32) {
    let mut w = world();
    join(&mut w, 1, 0);
    let id = piece_of(&w, "cushion");
    let at = on_floor(&w, id).unwrap();
    stand(&mut w, 1, T(at.x - 1, at.y));
    let outs = send(&mut w, 1, 1_000, ClientMsg::Grab { id });
    assert_eq!(held(&outs), vec![(To::All, id, 1)]);
    (w, id)
}

#[test]
fn a_grab_from_across_the_room_walks_over_then_lifts_it_for_everyone() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(7, 1));
    let id = piece_of(&w, "cushion");
    let outs = send(&mut w, 1, 1_000, ClientMsg::Grab { id });
    assert!(held(&outs).is_empty(), "not yet: walking over");
    let later = arrive(&mut w, &outs, 1);
    assert_eq!(held(&later), vec![(To::All, id, 1)]);
    assert_eq!(on_floor(&w, id), None);
    let snap = w.snapshot_for(2, 50_000);
    assert!(snap.room.furniture.iter().all(|f| f.id != id));
    assert_eq!(snap.held.iter().map(|h| (h.by, h.piece.id)).collect::<Vec<_>>(), vec![(1, id)]);
}

#[test]
fn the_first_grab_wins() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(7, 1));
    stand(&mut w, 2, T(6, 1));
    let id = piece_of(&w, "cushion");
    let first = send(&mut w, 1, 1_000, ClientMsg::Grab { id });
    let second = send(&mut w, 2, 1_001, ClientMsg::Grab { id });
    assert!(errors(&first).is_empty());
    assert_eq!(errors(&second), vec![(To::One(2), ErrorCode::Taken)]);
    let later = arrive(&mut w, &first, 1);
    assert_eq!(held(&later), vec![(To::All, id, 1)]);
    let third = send(&mut w, 2, 60_000, ClientMsg::Grab { id });
    assert_eq!(errors(&third), vec![(To::One(2), ErrorCode::Taken)]);
}

#[test]
fn putting_down_walks_beside_the_spot_and_shows_everyone() {
    let (mut w, id) = holding_cushion();
    stand(&mut w, 1, T(7, 1));
    let outs = send(&mut w, 1, 2_000, ClientMsg::Place { to: T(3, 8) });
    assert!(placed(&outs).is_empty(), "walking there first");
    let later = arrive(&mut w, &outs, 1);
    assert_eq!(placed(&later), vec![(id, T(3, 8))]);
    assert_eq!(on_floor(&w, id), Some(T(3, 8)));
    assert!(w.held.is_empty());
}

#[test]
fn a_spot_the_room_refuses_keeps_it_in_hand() {
    let (mut w, id) = holding_cushion();
    let outs = send(&mut w, 1, 2_000, ClientMsg::Place { to: T(7, 2) });
    assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::CantPlace)]);
    assert_eq!(w.held.iter().map(|h| h.piece.id).collect::<Vec<_>>(), vec![id]);
}

#[test]
fn leaving_puts_it_back_too() {
    let (mut w, id) = holding_cushion();
    let start = on_floor(&world(), id).unwrap();
    let outs = send(&mut w, 1, 2_000, ClientMsg::Leave {});
    assert_eq!(placed(&outs), vec![(id, start)]);
}

#[test]
fn putting_it_back_by_choice_returns_it() {
    let (mut w, id) = holding_cushion();
    let start = on_floor(&world(), id).unwrap();
    let outs = send(&mut w, 1, 2_000, ClientMsg::PutBack {});
    assert_eq!(placed(&outs), vec![(id, start)]);
}

#[test]
fn a_new_piece_comes_from_the_catalogue_and_can_be_put_away() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(3, 7));
    let outs = send(&mut w, 1, 1_000, ClientMsg::Take { kind: "lamp".into() });
    let [(to, id, by)] = held(&outs)[..] else {
        panic!("one held: {outs:?}")
    };
    assert_eq!((to, by), (To::All, 1));
    let outs = send(&mut w, 1, 2_000, ClientMsg::Place { to: T(3, 8) });
    assert_eq!(placed(&outs), vec![(id, T(3, 8))], "already beside it");
    let outs = send(&mut w, 1, 3_000, ClientMsg::Grab { id });
    assert_eq!(held(&outs).len(), 1);
    let outs = send(&mut w, 1, 4_000, ClientMsg::PutAway {});
    assert!(
        outs.iter()
            .any(|o| matches!(o.msg, ServerMsg::FurnitureRemoved { id: gone, by: 1 } if gone == id))
    );
    assert_eq!(on_floor(&w, id), None);
    assert!(w.held.is_empty());
    let outs = send(&mut w, 1, 30_000, ClientMsg::Take { kind: "bowls".into() });
    assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::CantPlace)], "the bowls stay");
}

#[test]
fn taking_from_the_catalogue_on_the_way_to_a_grab_calls_the_grab_off() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(7, 1));
    let cushion = piece_of(&w, "cushion");
    let outs = send(&mut w, 1, 1_000, ClientMsg::Grab { id: cushion });
    send(&mut w, 1, 1_100, ClientMsg::Take { kind: "lamp".into() });
    arrive(&mut w, &outs, 1);
    assert_eq!(w.held.iter().filter(|h| h.by == 1).count(), 1, "one piece in hand");
    assert!(on_floor(&w, cushion).is_some());
}

#[test]
fn putting_back_with_empty_hands_calls_the_grab_off_and_the_next_grab_wins() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(7, 1));
    stand(&mut w, 2, T(6, 1));
    let cushion = piece_of(&w, "cushion");
    let a = send(&mut w, 1, 1_000, ClientMsg::Grab { id: cushion });
    send(&mut w, 1, 1_100, ClientMsg::PutBack {});
    let b = send(&mut w, 2, 1_200, ClientMsg::Grab { id: cushion });
    assert!(errors(&b).is_empty());
    let later = arrive(&mut w, &a, 1);
    assert!(held(&later).iter().all(|&(_, _, by)| by != 1));
    let later = arrive(&mut w, &b, 2);
    assert_eq!(held(&later), vec![(To::All, cushion, 2)]);
}

#[test]
fn a_dropped_connection_lets_go_at_once() {
    let (mut w, id) = holding_cushion();
    let start = on_floor(&world(), id).unwrap();
    let outs = w.handle(2_000, Input::Drop { id: 1 });
    assert_eq!(placed(&outs), vec![(id, start)]);
    // And a grab on the way is called off, so nothing is lifted for someone who's gone.
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(7, 1));
    let plant = piece_of(&w, "plant");
    let outs = send(&mut w, 1, 1_000, ClientMsg::Grab { id: plant });
    w.handle(1_100, Input::Drop { id: 1 });
    let later = arrive(&mut w, &outs, 1);
    assert!(held(&later).is_empty());
    assert!(on_floor(&w, plant).is_some());
}

#[test]
fn a_blocking_piece_never_lands_across_someones_way() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(3, 7));
    stand(&mut w, 2, T(1, 8));
    // 2 walks right along row 8, through (4, 8), to (6, 8).
    let walk = send(&mut w, 2, 1_000, ClientMsg::WalkTo { tile: T(6, 8) });
    assert!(walk_of(&walk, 2).unwrap().path.contains(&T(4, 8)));
    send(&mut w, 1, 1_000, ClientMsg::Take { kind: "lamp".into() });
    let outs = send(&mut w, 1, 1_050, ClientMsg::Place { to: T(4, 8) });
    assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::CantPlace)]);
}

#[test]
fn nobody_carries_and_sits_at_once() {
    let mut w = world();
    join(&mut w, 1, 0);
    let sofa = piece_of(&w, "sofa");
    stand(&mut w, 1, T(1, 6));
    send(&mut w, 1, 1_000, ClientMsg::Sit { id: sofa });
    let outs = send(&mut w, 1, 2_000, ClientMsg::Take { kind: "lamp".into() });
    assert_eq!(held(&outs).len(), 1);
    assert!(
        w.snapshot_for(1, 2_000).people.iter().any(|p| p.id == 1 && !p.sitting),
        "stood up to take it"
    );
    // Grabbing from a seat stands you up too, even beside the piece.
    let mut w = world();
    join(&mut w, 1, 0);
    let chair = piece_of(&w, "chair");
    stand(&mut w, 1, T(9, 5));
    send(&mut w, 1, 1_000, ClientMsg::Sit { id: chair });
    let table = piece_of(&w, "table");
    let outs = send(&mut w, 1, 2_000, ClientMsg::Grab { id: table });
    let later = arrive(&mut w, &outs, 1);
    assert_eq!(held(&later).len(), 1);
    assert!(w.snapshot_for(1, 60_000).people.iter().any(|p| p.id == 1 && !p.sitting));
}

#[test]
fn nobody_sits_on_a_piece_someone_is_coming_to_carry() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(7, 1));
    let sofa = piece_of(&w, "sofa");
    send(&mut w, 1, 1_000, ClientMsg::Grab { id: sofa });
    stand(&mut w, 2, T(1, 6));
    let outs = send(&mut w, 2, 1_100, ClientMsg::Sit { id: sofa });
    assert_eq!(errors(&outs), vec![(To::One(2), ErrorCode::Taken)]);
}

#[test]
fn the_floor_holds_only_so_much() {
    let mut w = world();
    join(&mut w, 1, 0);
    w.tuning.furniture_max = w.room.movable_count();
    let outs = send(&mut w, 1, 1_000, ClientMsg::Take { kind: "lamp".into() });
    assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::Full)]);
}

#[test]
fn furniture_changes_are_limited_per_person_and_only_accepted_ones_count() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(3, 7));
    // Refusals spend nothing.
    send(&mut w, 1, 1_000, ClientMsg::Take { kind: "lamp".into() });
    for _ in 0..5 {
        let outs = send(&mut w, 1, 1_000, ClientMsg::Place { to: T(7, 2) });
        assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::CantPlace)]);
    }
    // take (1), place (2), grab is free, put away (3): the burst is spent.
    assert!(errors(&send(&mut w, 1, 1_000, ClientMsg::Place { to: T(3, 8) })).is_empty());
    let id = on_floor_kind(&w, "lamp", T(3, 8));
    send(&mut w, 1, 1_000, ClientMsg::Grab { id });
    assert!(errors(&send(&mut w, 1, 1_000, ClientMsg::PutAway {})).is_empty());
    let outs = send(&mut w, 1, 1_000, ClientMsg::Take { kind: "lamp".into() });
    assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::RateLimited)]);
    assert!(errors(&send(&mut w, 1, 21_000, ClientMsg::Take { kind: "lamp".into() })).is_empty());
}

fn on_floor_kind(w: &World, kind: &str, at: Tile) -> u32 {
    w.room
        .pieces
        .iter()
        .find(|p| p.kind == kind && (p.x, p.y) == (at.x, at.y))
        .unwrap()
        .id
}

#[test]
fn a_blocking_piece_never_lands_on_someone() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(3, 7));
    stand(&mut w, 2, T(4, 8));
    send(&mut w, 1, 1_000, ClientMsg::Take { kind: "lamp".into() });
    let outs = send(&mut w, 1, 2_000, ClientMsg::Place { to: T(4, 8) });
    assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::CantPlace)]);
    let outs = send(&mut w, 1, 2_000, ClientMsg::Place { to: T(3, 8) });
    assert_eq!(placed(&outs).len(), 1);
}

#[test]
fn a_cat_lying_on_a_piece_that_is_picked_up_jumps_off_annoyed() {
    let mut w = world();
    join(&mut w, 1, 0);
    let id = piece_of(&w, "cushion");
    let at = on_floor(&w, id).unwrap();
    let i = w.cats.iter().position(|c| c.def.id == "mochi").unwrap();
    {
        let c = &mut w.cats[i];
        c.walk = None;
        c.at = at;
        c.pose = crate::protocol::Pose::Nap;
        c.until = u64::MAX;
    }
    stand(&mut w, 1, T(at.x - 1, at.y));
    let outs = send(&mut w, 1, 1_000, ClientMsg::Grab { id });
    assert!(outs.iter().any(|o| matches!(
        o.msg,
        ServerMsg::CatReacted {
            reaction: Reaction::Annoyed { by: 1 },
            ..
        }
    )));
    assert_ne!(w.cats[i].pose, crate::protocol::Pose::Nap);
}

#[test]
fn the_arrangement_is_saved_by_kind_and_comes_back_whole() {
    let mut w = world();
    join(&mut w, 1, 0);
    let sofa = piece_of(&w, "sofa");
    let cushion = piece_of(&w, "cushion");
    w.room.place(sofa, T(4, 2)).unwrap();
    w.room.place(cushion, T(3, 8)).unwrap();
    let json = w.arrangement_json();
    let mut again = world();
    again.restore_arrangement(&json);
    let mut a = w.room.arrangement();
    let mut b = again.room.arrangement();
    a.sort();
    b.sort();
    assert_eq!(a, b);
}

#[test]
fn phase_ones_saved_cushion_still_comes_back() {
    let mut w = world();
    let cushion = piece_of(&w, "cushion");
    w.restore_legacy_arrangement(&format!(r#"[{{"id":{cushion},"kind":"cushion","x":3,"y":8}}]"#));
    assert_eq!(on_floor(&w, cushion), Some(T(3, 8)));
}

#[test]
fn sitting_walks_over_then_seats_you() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(7, 1));
    let sofa = piece_of(&w, "sofa");
    let outs = send(&mut w, 1, 1_000, ClientMsg::Sit { id: sofa });
    let later = arrive(&mut w, &outs, 1);
    let at = later
        .iter()
        .find_map(|o| match &o.msg {
            ServerMsg::PersonSat { id: 1, at } => Some(*at),
            _ => None,
        })
        .expect("sits");
    assert!(w.room.pieces.iter().find(|p| p.id == sofa).unwrap().covers(at));
    assert!(
        w.snapshot_for(1, 60_000)
            .people
            .iter()
            .any(|p| p.id == 1 && p.sitting && p.at == at)
    );
}

#[test]
fn two_people_can_share_the_sofa_but_not_a_seat() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    let sofa = piece_of(&w, "sofa");
    let mut seats = Vec::new();
    for id in [1, 2] {
        stand(&mut w, id, T(1, 6));
        let outs = send(&mut w, id, 1_000, ClientMsg::Sit { id: sofa });
        seats.extend(outs.iter().filter_map(|o| match &o.msg {
            ServerMsg::PersonSat { at, .. } => Some(*at),
            _ => None,
        }));
    }
    assert_eq!(seats.len(), 2);
    assert_ne!(seats[0], seats[1]);
    let chair = piece_of(&w, "chair");
    join(&mut w, 3, 0);
    join(&mut w, 4, 0);
    stand(&mut w, 3, T(9, 5));
    stand(&mut w, 4, T(9, 5));
    send(&mut w, 3, 2_000, ClientMsg::Sit { id: chair });
    let outs = send(&mut w, 4, 2_000, ClientMsg::Sit { id: chair });
    assert_eq!(errors(&outs), vec![(To::One(4), ErrorCode::Taken)]);
}

#[test]
fn walking_off_stands_you_up_and_a_seat_in_use_cant_be_carried() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    let sofa = piece_of(&w, "sofa");
    stand(&mut w, 1, T(1, 6));
    send(&mut w, 1, 1_000, ClientMsg::Sit { id: sofa });
    stand(&mut w, 2, T(1, 6));
    let outs = send(&mut w, 2, 1_100, ClientMsg::Grab { id: sofa });
    assert_eq!(errors(&outs), vec![(To::One(2), ErrorCode::CantPlace)]);
    let outs = send(&mut w, 1, 2_000, ClientMsg::WalkTo { tile: T(4, 8) });
    assert!(walk_of(&outs, 1).is_some());
    assert!(w.snapshot_for(1, 2_000).people.iter().any(|p| p.id == 1 && !p.sitting));
    assert!(w.room.path(T(4, 8), T(1, 6), Walker::Person).is_some());
}
