//! A demo account lays out a furniture set (slice 17, part 2): at once, for
//! everyone, without the rate limit, by the usual placement rules.
use super::cat_life::Plan;
use super::demo_tests::join_demo;
use super::people::tests::{join, world};
use super::*;
use crate::protocol::{ClientMsg, ErrorCode, FurnitureView, Pose, Reaction, ServerMsg, Tile};
use crate::room::{Saved, Walker};
use crate::test_logs::LogSink;

const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };

fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
    w.handle(now, Input::Msg { id, msg })
}

fn lay_out(w: &mut World, id: u32, now: u64, set: &str) -> Vec<Out> {
    send(w, id, now, ClientMsg::LayOut { set: set.into() })
}

fn refused(outs: &[Out], id: u32) -> Vec<ErrorCode> {
    outs.iter()
        .filter_map(|o| match (&o.to, &o.msg) {
            (To::One(to), ServerMsg::Error { code, .. }) if *to == id => Some(*code),
            _ => None,
        })
        .collect()
}

fn laid_out(outs: &[Out]) -> Vec<(To, u32, String, Vec<FurnitureView>)> {
    outs.iter()
        .filter_map(|o| match &o.msg {
            ServerMsg::LaidOut { by, name, furniture, .. } => Some((o.to, *by, name.clone(), furniture.clone())),
            _ => None,
        })
        .collect()
}

/// The set's movable pieces, by kind and place, sorted.
fn set_pieces(w: &World, id: &str) -> Vec<Saved> {
    let mut pieces = w.layouts.iter().find(|l| l.id == id).expect("the set").pieces.clone();
    pieces.sort();
    pieces
}

/// The room's movable pieces now, by kind and place, sorted.
fn room_pieces(w: &World) -> Vec<Saved> {
    let mut pieces = w.room.arrangement();
    pieces.sort();
    pieces
}

/// Stands a person, still, at `at`.
fn stand(w: &mut World, id: u32, at: Tile) {
    let p = w.people.iter_mut().find(|p| p.id == id).unwrap();
    p.walk = None;
    p.pending = None;
    p.sitting = None;
    p.at = at;
}

fn piece_of(w: &World, kind: &str) -> u32 {
    w.room.pieces.iter().find(|p| p.kind == kind).expect("a piece of that kind").id
}

#[test]
fn only_a_demo_account_inside_lays_out_a_set() {
    let sink = LogSink::default();
    let _logging = sink.capture();
    let mut w = world();
    join(&mut w, 1, 0);
    let before = room_pieces(&w);
    assert_eq!(refused(&lay_out(&mut w, 1, 1_000, "lap_time"), 1), vec![ErrorCode::NotDemo]);
    join_demo(&mut w, 2, 0);
    assert_eq!(refused(&lay_out(&mut w, 2, 1_000, "piano_bar"), 2), vec![ErrorCode::CantPlace]);
    // A demo account at the window can only talk, as anyone there.
    for id in 3..=7 {
        join(&mut w, id, 0);
    }
    join_demo(&mut w, 8, 0);
    assert_eq!(w.person(8).unwrap().place, Place::Window);
    assert_eq!(refused(&lay_out(&mut w, 8, 1_000, "lap_time"), 8), vec![ErrorCode::NotFromWindow]);
    assert_eq!(room_pieces(&w), before, "nothing moved");
    let lines = sink.lines();
    let said: Vec<(&str, &str)> = lines
        .iter()
        .filter(|l| l["what"] == "lay_out")
        .map(|l| (l["outcome"].as_str().unwrap(), l["code"].as_str().unwrap_or("")))
        .collect();
    assert_eq!(
        said,
        [("refused", "notDemo"), ("refused", "cantPlace"), ("refused", "notFromWindow")]
    );
}

#[test]
fn a_set_is_laid_out_at_once_for_everyone() {
    let sink = LogSink::default();
    let _logging = sink.capture();
    let mut w = world();
    join(&mut w, 1, 0);
    join_demo(&mut w, 2, 0);
    let outs = lay_out(&mut w, 2, 1_000, "lap_time");
    let sent = laid_out(&outs);
    assert_eq!(sent.len(), 1, "one message for the whole room");
    let (to, by, name, furniture) = &sent[0];
    assert_eq!((*to, *by, name.as_str()), (To::All, 2, "Lap time"));
    assert_eq!(room_pieces(&w), set_pieces(&w, "lap_time"));
    // The message carries every piece in the room, the bowls too.
    let mut told: Vec<(String, u8, u8)> = furniture.iter().map(|f| (f.kind.clone(), f.x, f.y)).collect();
    let mut room: Vec<(String, u8, u8)> = w.room.pieces.iter().map(|p| (p.kind.clone(), p.x, p.y)).collect();
    told.sort();
    room.sort();
    assert_eq!(told, room);
    assert!(told.iter().any(|(k, ..)| k == "bowls"), "the bowls stay where the café fills them");
    // And back to the starting room.
    let every = w.tuning.layout_every_secs * 1000;
    lay_out(&mut w, 2, 1_000 + every, "opening_day");
    assert_eq!(room_pieces(&w), set_pieces(&w, "opening_day"));
    let lines = sink.lines();
    let ok: Vec<(&str, &str)> = lines
        .iter()
        .filter(|l| l["what"] == "lay_out" && l["outcome"] == "ok")
        .map(|l| (l["who"].as_str().unwrap(), l["set"].as_str().unwrap()))
        .collect();
    assert_eq!(ok, [("demo2", "Lap time"), ("demo2", "Opening day")]);
    assert!(lines.iter().filter(|l| l["what"] == "lay_out").all(|l| l["uid"] == 2));
}

#[test]
fn it_spends_no_ones_furniture_allowance() {
    let mut w = world();
    join_demo(&mut w, 2, 0);
    // More lay-outs than the furniture burst allows changes, each after the
    // café's own wait between sets (`layout_every_secs`).
    let burst = w.tuning.furniture_burst as usize;
    let every = w.tuning.layout_every_secs * 1000;
    for n in 0..burst + 3 {
        let set = ["lap_time", "play_room", "opening_day"][n % 3];
        let outs = lay_out(&mut w, 2, 1_000 + n as u64 * every, set);
        assert_eq!(laid_out(&outs).len(), 1, "lay-out {n} done");
    }
    // And the burst is all still there for moving a piece by hand.
    let at = 1_000 + (burst as u64 + 2) * every;
    for _ in 0..burst {
        let p = w.people.iter_mut().find(|p| p.id == 2).unwrap();
        assert!(p.furniture.take(at));
    }
}

/// The demo password is public: a set rebuilds the whole room and stops
/// everyone's walks and errands, so the café lays out at most one every
/// `layout_every_secs`, whoever asks (slice 17 part 2's review, finding 2).
#[test]
fn a_set_waits_for_the_last_one_whoever_asks() {
    let sink = LogSink::default();
    let _logging = sink.capture();
    let mut w = world();
    join_demo(&mut w, 2, 0);
    join_demo(&mut w, 3, 0);
    let every = w.tuning.layout_every_secs * 1000;
    assert!(every >= 5_000, "long enough that a script can't freeze the café");
    assert_eq!(laid_out(&lay_out(&mut w, 2, 1_000, "lap_time")).len(), 1);
    let soon = lay_out(&mut w, 3, 1_000 + every - 1, "play_room");
    assert_eq!(refused(&soon, 3), vec![ErrorCode::TooSoon]);
    assert!(laid_out(&soon).is_empty());
    assert_eq!(room_pieces(&w), set_pieces(&w, "lap_time"));
    assert_eq!(laid_out(&lay_out(&mut w, 3, 1_000 + every, "play_room")).len(), 1);
    // The welcome says when the next set can be laid out, for the bar.
    let outs = join(&mut w, 9, 2_000 + every);
    let ServerMsg::Welcome { next_layout, .. } = &outs[0].msg else {
        panic!()
    };
    assert_eq!(*next_layout, 1_000 + 2 * every);
    // And everyone's page is told when it can next, with the set.
    let ServerMsg::LaidOut { next, .. } = &laid_out_msgs(&lay_out(&mut w, 2, 1_000 + 2 * every, "opening_day"))[0] else {
        panic!()
    };
    assert_eq!(*next, 1_000 + 3 * every);
    let refusals = sink
        .lines()
        .into_iter()
        .filter(|l| l["what"] == "lay_out" && l["code"] == "tooSoon")
        .count();
    assert_eq!(refusals, 1);
}

fn laid_out_msgs(outs: &[Out]) -> Vec<ServerMsg> {
    outs.iter()
        .filter(|o| matches!(o.msg, ServerMsg::LaidOut { .. }))
        .map(|o| o.msg.clone())
        .collect()
}

/// Each person's walk's end (or tile) and whether they sit, as pages hold it.
fn seen_people(w: &World) -> std::collections::HashMap<u32, (Tile, bool)> {
    w.people
        .iter()
        .map(|p| {
            (
                p.id,
                (p.walk.as_ref().map_or(p.at, |w| *w.path.last().unwrap()), p.sitting.is_some()),
            )
        })
        .collect()
}

/// What every page holds for each person after `outs`, from what it held
/// before: the last walk's end, or seat, it was told of.
fn told_people(mut seen: std::collections::HashMap<u32, (Tile, bool)>, outs: &[Out]) -> std::collections::HashMap<u32, (Tile, bool)> {
    for o in outs {
        match &o.msg {
            ServerMsg::PersonMoved { id, walk } => {
                seen.insert(*id, (*walk.path.last().unwrap(), false));
            }
            ServerMsg::PersonSat { id, at } => {
                seen.insert(*id, (*at, true));
            }
            _ => {}
        }
    }
    seen
}

/// Every page is told what the set did to the people in it: someone stood
/// up, or a walk cut short, gets a message leaving each page's copy as the
/// server's, bots too (slice 17 part 2's review, finding 1).
#[test]
fn every_page_is_told_who_stood_and_whose_walk_ended() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 3, 0);
    join_demo(&mut w, 2, 0);
    let mut adding = Vec::new();
    w.add_bot(0, 2, &mut adding);
    let bot = w.people.iter().find(|p| p.bot.is_some()).unwrap().id;
    // 1 sits on the sofa at (0, 5); 3 and the bot are walking across the room.
    stand(&mut w, 1, T(1, 6));
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa" && p.x == 0).unwrap().id;
    send(&mut w, 1, 1_000, ClientMsg::Sit { id: sofa });
    assert!(w.person(1).unwrap().sitting.is_some());
    stand(&mut w, 3, T(12, 11));
    send(&mut w, 3, 1_000, ClientMsg::WalkTo { tile: T(1, 11) });
    stand(&mut w, bot, T(12, 2));
    send(&mut w, bot, 1_000, ClientMsg::WalkTo { tile: T(12, 10) });
    let before = seen_people(&w);
    let outs = lay_out(&mut w, 2, 1_400, "lap_time");
    let told = told_people(before, &outs);
    for p in w.people.iter().filter(|p| p.place == Place::Inside) {
        let end = p.walk.as_ref().map_or(p.at, |walk| *walk.path.last().unwrap());
        assert_eq!(
            told[&p.id],
            (end, p.sitting.is_some()),
            "{}: every page holds what the server does",
            p.name
        );
        assert!(w.room.walkable(end, Walker::Person), "{} ends on a blocking piece", p.name);
    }
    // Each told after the room, so it's drawn in the new one.
    let laid = outs.iter().position(|o| matches!(o.msg, ServerMsg::LaidOut { .. })).unwrap();
    for id in [1, 3, bot] {
        let moved = outs
            .iter()
            .rposition(|o| matches!(o.msg, ServerMsg::PersonMoved { id: who, .. } if who == id))
            .unwrap_or_else(|| panic!("{id} told"));
        assert!(moved > laid, "{id} told after the room");
    }
}

/// Two people under one new piece step off to different tiles (finding 10).
#[test]
fn two_people_stepping_off_go_to_different_tiles() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 3, 0);
    join_demo(&mut w, 2, 0);
    // Lap time's lower sofa covers (3..6, 8).
    stand(&mut w, 1, T(4, 8));
    stand(&mut w, 3, T(5, 8));
    lay_out(&mut w, 2, 1_000, "lap_time");
    let end = |id: u32| {
        let p = w.person(id).unwrap();
        p.walk.as_ref().map_or(p.at, |walk| *walk.path.last().unwrap())
    };
    assert_ne!(end(1), end(3));
}

/// A cat on a piece that stays where it is keeps its place: only a piece
/// that moves makes a cat jump off (finding 3).
#[test]
fn a_cat_on_a_piece_that_stays_is_left_alone() {
    let mut w = world();
    join_demo(&mut w, 2, 0);
    // The window seat at (2, 1) is in the same place in Lap time.
    let i = w.cats.iter().position(|c| c.def.id == "tora").unwrap();
    let c = &mut w.cats[i];
    (c.walk, c.pose, c.plan, c.at, c.until) = (None, Pose::Nap, Plan::Nap, T(2, 1), u64::MAX);
    let outs = lay_out(&mut w, 2, 1_000, "lap_time");
    assert!(
        !outs
            .iter()
            .any(|o| matches!(&o.msg, ServerMsg::CatReacted { cat, .. } if cat == "tora")),
        "Tora stays put: {outs:?}"
    );
    assert_eq!((w.cats[i].at, w.cats[i].pose), (T(2, 1), Pose::Nap));
    // And laying out the room that's already there disturbs nobody.
    let bed = w.room.pieces.iter().find(|p| p.kind == "cat_bed").map(|p| T(p.x, p.y)).unwrap();
    let m = w.cats.iter().position(|c| c.def.id == "mochi").unwrap();
    let c = &mut w.cats[m];
    (c.walk, c.pose, c.plan, c.at, c.until) = (None, Pose::Nap, Plan::Nap, bed, u64::MAX);
    let every = w.tuning.layout_every_secs * 1000;
    let outs = lay_out(&mut w, 2, 1_000 + every, "lap_time");
    assert!(!outs.iter().any(|o| matches!(o.msg, ServerMsg::CatReacted { .. })), "{outs:?}");
}

#[test]
fn whats_carried_goes_and_errands_are_called_off() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 3, 0);
    join(&mut w, 4, 0);
    join_demo(&mut w, 2, 0);
    // 1 carries the cushion.
    let cushion = piece_of(&w, "cushion");
    let at = w.room.pieces.iter().find(|p| p.id == cushion).map(|p| T(p.x - 1, p.y)).unwrap();
    stand(&mut w, 1, at);
    send(&mut w, 1, 1_000, ClientMsg::Grab { id: cushion });
    assert!(w.held.iter().any(|h| h.by == 1));
    // 3 is on the way to grab a chair, 4 on the way to sit on the sofa.
    stand(&mut w, 3, T(12, 11));
    let chair = piece_of(&w, "chair");
    send(&mut w, 3, 1_000, ClientMsg::Grab { id: chair });
    assert!(w.reserved.contains_key(&chair));
    stand(&mut w, 4, T(12, 10));
    let sofa = piece_of(&w, "sofa");
    send(&mut w, 4, 1_000, ClientMsg::Sit { id: sofa });
    assert!(w.person(4).unwrap().pending.is_some());
    lay_out(&mut w, 2, 1_100, "play_room");
    assert!(w.held.is_empty(), "nothing carried");
    assert!(w.reserved.is_empty(), "nothing reserved");
    for id in [1, 3, 4] {
        assert_eq!(w.person(id).unwrap().pending, None, "{id}: no errand left");
    }
    assert_eq!(room_pieces(&w), set_pieces(&w, "play_room"));
    // Nothing a walk's end does later touches the new room.
    let later = w.tick(60_000);
    assert!(
        later.iter().all(|o| !matches!(
            o.msg,
            ServerMsg::FurnitureHeld { .. } | ServerMsg::PersonSat { .. } | ServerMsg::FurniturePlaced { .. }
        )),
        "{later:?}"
    );
    assert_eq!(room_pieces(&w), set_pieces(&w, "play_room"));
}

#[test]
fn nobody_is_left_seated_or_on_a_blocking_piece() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 3, 0);
    join_demo(&mut w, 2, 0);
    // 1 sits on the sofa at (0, 5); 3 stands where Lap time puts a sofa.
    stand(&mut w, 1, T(1, 6));
    let sofa = w.room.pieces.iter().find(|p| p.kind == "sofa" && p.x == 0).unwrap().id;
    let outs = send(&mut w, 1, 1_000, ClientMsg::Sit { id: sofa });
    assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonSat { id: 1, .. })));
    stand(&mut w, 3, T(4, 8));
    let outs = lay_out(&mut w, 2, 2_000, "lap_time");
    assert_eq!(w.person(1).unwrap().sitting, None, "stood up");
    for p in w.people.iter().filter(|p| p.place == Place::Inside) {
        let end = p.walk.as_ref().map_or(p.at, |walk| *walk.path.last().unwrap());
        assert!(
            w.room.walkable(end, Walker::Person),
            "{} ends on {:?}, a blocking piece",
            p.name,
            end
        );
    }
    // 3 was told to step off, after the room was laid out.
    let laid = outs.iter().position(|o| matches!(o.msg, ServerMsg::LaidOut { .. })).unwrap();
    let moved = outs
        .iter()
        .position(|o| matches!(o.msg, ServerMsg::PersonMoved { id: 3, .. }))
        .expect("3 steps off the new sofa");
    assert!(moved > laid);
}

#[test]
fn cats_on_the_old_pieces_jump_off() {
    let mut w = world();
    join_demo(&mut w, 2, 0);
    let bed = w.room.pieces.iter().find(|p| p.kind == "cat_bed").map(|p| T(p.x, p.y)).unwrap();
    let i = w.cats.iter().position(|c| c.def.id == "mochi").unwrap();
    let c = &mut w.cats[i];
    (c.walk, c.pose, c.plan, c.at, c.until) = (None, Pose::Nap, Plan::Nap, bed, u64::MAX);
    let outs = lay_out(&mut w, 2, 1_000, "play_room");
    assert!(
        outs.iter()
            .any(|o| matches!(&o.msg, ServerMsg::CatReacted { cat, reaction: Reaction::Annoyed { by: 2 } } if cat == "mochi")),
        "Mochi jumps off, annoyed"
    );
    assert_ne!(w.cats[i].pose, Pose::Nap);
}

#[test]
fn knocked_over_pieces_stand_and_the_cats_notice_the_new_ones() {
    let mut w = world();
    join_demo(&mut w, 2, 0);
    let toys = w
        .room
        .pieces
        .iter()
        .find(|p| p.kind == "toys")
        .map(|p| (p.id, T(p.x, p.y)))
        .unwrap();
    assert!(w.knock_over(toys.0, toys.1, &mut Vec::new()));
    lay_out(&mut w, 2, 1_000, "opening_day");
    assert!(w.room.pieces.iter().all(|p| !p.toppled), "a fresh room");
    let movable: Vec<u32> = w.room.pieces.iter().filter(|p| p.spec.movable).map(|p| p.id).collect();
    let noticed: Vec<u32> = w.new_pieces.iter().map(|n| n.0).collect();
    assert_eq!(noticed.len(), movable.len());
    assert!(movable.iter().all(|id| noticed.contains(id)), "every new piece is new to the cats");
}

#[test]
fn the_set_is_saved_as_the_arrangement() {
    let mut w = world();
    join_demo(&mut w, 2, 0);
    lay_out(&mut w, 2, 1_000, "lap_time");
    let (_, saved) = crate::room::read_arrangement(&w.arrangement_json()).unwrap();
    let mut saved = saved;
    saved.sort();
    assert_eq!(saved, set_pieces(&w, "lap_time"));
    // A café woken on that save is laid out as the set.
    let mut woken = world();
    woken.restore_arrangement(&w.arrangement_json());
    assert_eq!(room_pieces(&woken), set_pieces(&w, "lap_time"));
}

#[test]
fn the_welcome_names_the_sets() {
    let mut w = world();
    let outs = join(&mut w, 1, 0);
    let ServerMsg::Welcome { layouts, .. } = &outs[0].msg else {
        panic!("{:?}", outs[0].msg)
    };
    let names: Vec<(&str, &str)> = layouts.iter().map(|l| (l.id.as_str(), l.name.as_str())).collect();
    assert_eq!(
        names,
        [("opening_day", "Opening day"), ("lap_time", "Lap time"), ("play_room", "Play room")]
    );
}
