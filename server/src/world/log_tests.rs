//! Crit 10, "fly by instruments": every action a person takes leaves one
//! structured line, accepted or refused, and nothing said is ever in one.
use super::people::tests::{capture_logs, join, world};
use super::*;
use crate::protocol::{ClientMsg, Emote, Tile};
use serde_json::Value;

const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };

fn stand(w: &mut World, id: u32, at: Tile) {
    let p = w.people.iter_mut().find(|p| p.id == id).unwrap();
    p.walk = None;
    p.pending = None;
    p.at = at;
}

/// The `action` lines logged while `id` sends `msg`.
fn lines(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Value> {
    let log = capture_logs(|| {
        w.handle(now, Input::Msg { id, msg });
    });
    log.lines()
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .filter(|v| v["target"] == "action")
        .collect()
}

fn piece_of(w: &World, kind: &str) -> u32 {
    w.room.pieces.iter().find(|p| p.kind == kind).unwrap().id
}

#[test]
fn every_action_leaves_a_line_with_who_what_and_how_it_went() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    stand(&mut w, 1, T(3, 7));
    let plant = piece_of(&w, "plant");
    let sofa = piece_of(&w, "sofa");
    let steps: Vec<(ClientMsg, &str)> = vec![
        (ClientMsg::WalkTo { tile: T(3, 8) }, "walk"),
        (
            ClientMsg::Say {
                text: "hello".into(),
                to: Some(2),
            },
            "say",
        ),
        (ClientMsg::Call { cat: "tora".into() }, "call"),
        (ClientMsg::Pet { cat: "mochi".into() }, "pet"),
        (ClientMsg::Emote { emote: Emote::Wave }, "emote"),
        (ClientMsg::Grab { id: plant }, "grab"),
        (ClientMsg::Take { kind: "lamp".into() }, "take"),
        (ClientMsg::Place { to: T(2, 8) }, "place"),
        (ClientMsg::PutAway {}, "put_away"),
        (ClientMsg::PutBack {}, "put_back"),
        (ClientMsg::Sit { id: sofa }, "sit"),
        (ClientMsg::Leave {}, "leave"),
    ];
    for (n, (msg, what)) in steps.into_iter().enumerate() {
        let now = 1_000 + n as u64 * 30_000;
        if what == "place" {
            stand(&mut w, 1, T(3, 7));
        }
        let got = lines(&mut w, 1, now, msg);
        let mine: Vec<&Value> = got.iter().filter(|v| v["uid"] == 1 && v["what"] == what).collect();
        assert!(!mine.is_empty(), "no `{what}` line: {got:?}");
        for v in &mine {
            assert_eq!(v["who"], "p1", "{v}");
            assert!(v["timestamp"].is_string(), "{v}");
            assert!(
                v["outcome"].is_string() || v["len"].is_number() || v["what"] == "emote",
                "how it went: {v}"
            );
        }
    }
}

#[test]
fn a_refused_action_is_logged_with_why() {
    let mut w = world();
    for id in 1..=7 {
        join(&mut w, id, 0);
    }
    let got = lines(&mut w, 7, 1_000, ClientMsg::WalkTo { tile: T(3, 8) });
    let line = got.iter().find(|v| v["uid"] == 7).expect("a line");
    assert_eq!((line["what"].as_str(), line["outcome"].as_str()), (Some("walk"), Some("refused")));
    assert_eq!(line["code"], "notFromWindow");
}

#[test]
fn a_walk_over_to_do_something_is_logged_when_it_starts() {
    let mut w = world();
    join(&mut w, 1, 0);
    stand(&mut w, 1, T(7, 1));
    let mochi = w.cats.iter_mut().find(|c| c.def.id == "mochi").unwrap();
    (mochi.at, mochi.walk, mochi.until) = (T(1, 8), None, u64::MAX);
    let got = lines(&mut w, 1, 1_000, ClientMsg::Pet { cat: "mochi".into() });
    assert!(got.iter().any(|v| v["what"] == "pet" && v["outcome"] == "walking"), "{got:?}");
}

#[test]
fn the_cats_story_is_logged_but_not_their_steps() {
    let mut w = world();
    let log = capture_logs(|| {
        for step in 1..=6_000u64 {
            w.tick(step * 100);
        }
    });
    let cat_lines: Vec<Value> = log
        .lines()
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .filter(|v| v["target"] == "cat")
        .collect();
    assert!(!cat_lines.is_empty(), "ten minutes and nothing worth telling");
    assert!(cat_lines.iter().all(|v| v["cat"].is_string() && v["what"].is_string()));
    assert!(cat_lines.iter().all(|v| v["what"] != "wander" && v["what"] != "idle"));
    assert!(
        cat_lines.len() < 200,
        "{} lines in ten minutes is steps, not a story",
        cat_lines.len()
    );
}

#[test]
fn a_line_for_talk_names_who_it_was_to_but_never_what_was_said() {
    let mut w = world();
    join(&mut w, 1, 0);
    join(&mut w, 2, 0);
    let got = lines(
        &mut w,
        1,
        1_000,
        ClientMsg::Say {
            text: "the secret phrase".into(),
            to: Some(2),
        },
    );
    let line = got.iter().find(|v| v["what"] == "say").unwrap();
    assert_eq!((line["len"].as_u64(), line["to"].as_str()), (Some(17), Some("p2")));
    assert!(!line.to_string().contains("secret"));
    let got = lines(&mut w, 1, 2_000, ClientMsg::Call { cat: "mochi".into() });
    assert!(got.iter().all(|v| v["what"] != "say"), "a call is a call: {got:?}");
}
