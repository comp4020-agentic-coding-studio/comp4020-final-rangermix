//! Bots (slice 17): visitors the server runs for a demo account.
use super::bots::BOT_IDS;
use super::demo_tests::join_demo;
use super::jump_tests::{canberra, world_at};
use super::people::tests::join;
use super::*;
use crate::protocol::{ClientMsg, ErrorCode, Place, ServerMsg};

const MINUTE: u64 = 60_000;

fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
    w.handle(now, Input::Msg { id, msg })
}

fn refused(outs: &[Out], id: u32) -> Vec<ErrorCode> {
    outs.iter()
        .filter_map(|o| match (&o.to, &o.msg) {
            (To::One(to), ServerMsg::Error { code, .. }) if *to == id => Some(*code),
            _ => None,
        })
        .collect()
}

fn bots(w: &World) -> Vec<(String, Place)> {
    w.people
        .iter()
        .filter(|p| p.bot.is_some())
        .map(|p| (p.name.clone(), p.place))
        .collect()
}

#[test]
fn bots_fill_the_cafe_and_the_next_waits_at_the_window() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    join(&mut w, 2, t0);
    for _ in 0..4 {
        let outs = send(&mut w, 1, t0, ClientMsg::AddBot {});
        assert!(refused(&outs, 1).is_empty());
        let joined = outs.iter().find_map(|o| match &o.msg {
            ServerMsg::PersonJoined { person } => Some(person.clone()),
            _ => None,
        });
        assert!(joined.is_some_and(|p| p.bot && p.id > BOT_IDS), "everyone sees a bot come in");
    }
    assert_eq!(w.inside(), 6);
    join(&mut w, 3, t0);
    assert_eq!(w.person(3).unwrap().place, Place::Window, "the seventh waits at the window");
    send(&mut w, 1, t0, ClientMsg::AddBot {});
    send(&mut w, 1, t0, ClientMsg::AddBot {});
    let names: Vec<String> = bots(&w).into_iter().map(|(n, _)| n).collect();
    assert_eq!(names, ["bot_1", "bot_2", "bot_3", "bot_4", "bot_5", "bot_6"]);
    assert_eq!(bots(&w)[5].1, Place::Window, "a bot joins the line too");
    assert_eq!(refused(&send(&mut w, 1, t0, ClientMsg::AddBot {}), 1), vec![ErrorCode::BotsFull]);
}

#[test]
fn a_bot_leaves_when_removed_with_its_demo_or_after_fifteen_minutes() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    assert_eq!(refused(&send(&mut w, 1, t0, ClientMsg::RemoveBot {}), 1), vec![ErrorCode::NoBots]);
    send(&mut w, 1, t0, ClientMsg::AddBot {});
    send(&mut w, 1, t0 + 1_000, ClientMsg::AddBot {});
    let outs = send(&mut w, 1, t0 + 2_000, ClientMsg::RemoveBot {});
    assert!(
        outs.iter().any(|o| o.msg == ServerMsg::PersonLeft { id: BOT_IDS + 2 }),
        "the newest first"
    );
    assert_eq!(bots(&w).len(), 1);
    send(&mut w, 1, t0 + 3_000, ClientMsg::Leave {});
    assert!(bots(&w).is_empty(), "they leave with their demo account");
    join_demo(&mut w, 1, t0 + 4_000);
    send(&mut w, 1, t0 + 4_000, ClientMsg::AddBot {});
    w.tick(t0 + 4_000 + 15 * MINUTE - 1_000);
    assert_eq!(bots(&w).len(), 1);
    w.tick(t0 + 4_000 + 15 * MINUTE);
    assert!(bots(&w).is_empty(), "fifteen minutes and it goes");
}

#[test]
fn bots_are_never_met_trusted_or_written_on_the_board() {
    let t0 = canberra(2026, 11, 6, 9, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    for _ in 0..5 {
        send(&mut w, 1, t0, ClientMsg::AddBot {});
    }
    let mut outs = Vec::new();
    for s in 1..=(14 * 60) {
        outs.extend(w.tick(t0 + s * 1_000));
    }
    let ids: Vec<u32> = (1..=5).map(|n| BOT_IDS + n).collect();
    for cat in ["mochi", "tora", "burakku"] {
        for id in &ids {
            assert!(!w.trust.has_met(cat, *id), "{cat} met bot {id}");
        }
    }
    let board = serde_json::to_string(&w.chalk_view()).unwrap();
    assert!(!board.contains("bot_"), "{board}");
    assert!(!outs.iter().any(|o| matches!(&o.msg, ServerMsg::YourTrust { .. })));
}

#[test]
fn bots_never_go_quiet() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    for _ in 0..5 {
        send(&mut w, 1, t0, ClientMsg::AddBot {});
    }
    join(&mut w, 2, t0);
    assert_eq!(w.person(2).unwrap().place, Place::Window, "someone waits");
    let mut outs = Vec::new();
    for s in 1..=(12 * 60) {
        // The demo account keeps its own seat by being here.
        if s % 30 == 0 {
            send(&mut w, 1, t0 + s * 1_000, ClientMsg::Here {});
        }
        outs.extend(w.tick(t0 + s * 1_000));
    }
    let nudged: Vec<&Out> = outs.iter().filter(|o| matches!(o.msg, ServerMsg::StillThere { .. })).collect();
    assert!(nudged.is_empty(), "{nudged:?}");
    assert_eq!(bots(&w).len(), 5);
}

#[test]
fn bots_come_through_a_jump() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    send(&mut w, 1, t0, ClientMsg::AddBot {});
    send(
        &mut w,
        1,
        t0,
        ClientMsg::SetClock {
            minute: Some(23 * 60 + 30),
        },
    );
    let jump = w.take_jump().unwrap();
    let to = jump.to;
    w.run_jump(t0 + 100, jump);
    let outs = w.welcomes(to);
    assert!(
        outs.iter().all(|o| o.to == To::One(1)),
        "a bot has no page to welcome: {:?}",
        outs.len()
    );
    w.tick(to + 10 * MINUTE);
    assert_eq!(bots(&w).len(), 1, "its fifteen minutes don't count the jump");
}

#[test]
fn bots_wander_and_wave_but_never_sit_or_talk() {
    let t0 = canberra(2026, 11, 6, 14, 0);
    let mut w = world_at(t0);
    join_demo(&mut w, 1, t0);
    for _ in 0..3 {
        send(&mut w, 1, t0, ClientMsg::AddBot {});
    }
    let mut outs = Vec::new();
    for s in 1..=(5 * 60) {
        outs.extend(w.tick(t0 + s * 1_000));
    }
    let bot = |id: &u32| *id > BOT_IDS;
    assert!(outs.iter().any(|o| matches!(&o.msg, ServerMsg::PersonMoved { id, .. } if bot(id))));
    assert!(outs.iter().any(|o| matches!(&o.msg, ServerMsg::Emoted { from, .. } if bot(from))));
    assert!(
        !outs
            .iter()
            .any(|o| matches!(&o.msg, ServerMsg::Said { from, .. } | ServerMsg::PersonSat { id: from, .. } if bot(from)))
    );
}
