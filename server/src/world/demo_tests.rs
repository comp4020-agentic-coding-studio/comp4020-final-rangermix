//! Demo accounts in the world (slice 17, ADR 0022): only they move the
//! clock or add bots, and their welcome says so.
use super::people::tests::{join, world};
use super::*;
use crate::protocol::{ClientMsg, ErrorCode, Look, ServerMsg};
use crate::test_logs::LogSink;

pub(crate) fn join_demo(w: &mut World, id: u32, now: u64) -> Vec<Out> {
    w.handle(
        now,
        Input::Join {
            id,
            name: format!("demo{id}"),
            look: Look { avatar: 1, colour: 3 },
            demo: true,
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

#[test]
fn only_a_demo_account_moves_the_clock_or_adds_bots() {
    let sink = LogSink::default();
    let _logging = sink.capture();
    let mut w = world();
    join(&mut w, 1, 0);
    for msg in [
        ClientMsg::SetClock {
            minute: Some(23 * 60 + 30),
        },
        ClientMsg::SetClock { minute: None },
        ClientMsg::AddBot {},
        ClientMsg::RemoveBot {},
    ] {
        let outs = w.handle(1_000, Input::Msg { id: 1, msg });
        assert_eq!(refused(&outs, 1), vec![ErrorCode::NotDemo]);
    }
    let lines = sink.lines();
    let said: Vec<(&str, &str)> = lines
        .iter()
        .filter(|l| l["outcome"] == "refused")
        .map(|l| (l["what"].as_str().unwrap(), l["code"].as_str().unwrap()))
        .collect();
    assert_eq!(
        said,
        [
            ("set_clock", "notDemo"),
            ("set_clock", "notDemo"),
            ("add_bot", "notDemo"),
            ("remove_bot", "notDemo")
        ]
    );
}

#[test]
fn a_demo_accounts_welcome_says_so() {
    let mut w = world();
    w.restore_ahead(3_600_000);
    let visitor = join(&mut w, 1, 0);
    let demo = join_demo(&mut w, 2, 0);
    let welcome = |outs: &[Out]| match &outs[0].msg {
        ServerMsg::Welcome { demo, ahead, .. } => (*demo, *ahead),
        other => panic!("{other:?}"),
    };
    assert_eq!(welcome(&visitor), (false, 3_600_000));
    assert_eq!(welcome(&demo), (true, 3_600_000));
}
