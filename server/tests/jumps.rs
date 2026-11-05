//! A demo account moves the built café's clock on (slice 17, ADR 0022): the
//! binary on a mocked clock, seeded by its own subcommand.
mod common;

use common::{Cafe, HOUR, Socket, login, repo, seed_demo, signup};
use std::time::Duration;

#[test]
fn a_jump_cuts_nobody_off() {
    // Slice 17's review, finding 1: a connection's silence was measured by
    // the café's clock, which a jump moves on, so every page was dropped at
    // its next ping, 25 s after any jump.
    let data = tempfile::tempdir().unwrap();
    let content = repo().join("content");
    assert!(seed_demo(data.path(), &content, "catppuccino"));
    let cafe = Cafe::start(data.path(), &content, Some("2026-11-06T14:00:00+11:00"));
    let (_, cookie) = signup(&cafe, "sam");
    let mut sam = Socket::open(&cafe, &cookie);
    sam.welcome();
    let mut demo = Socket::open(&cafe, &login(&cafe, "demo1", "catppuccino"));
    demo.welcome();
    demo.send_text(r#"{"type":"setClock","minute":900}"#);
    sam.next_where(Duration::from_secs(10), |m| m["type"] == "jumping");
    sam.next_where(Duration::from_secs(30), |m| m["type"] == "welcome");
    // Past the next ping, with nothing sent: still there, still heard.
    std::thread::sleep(Duration::from_secs(31));
    sam.send_text(r#"{"type":"emote","emote":"wave"}"#);
    let waved = sam.next_where(Duration::from_secs(5), |m| m["type"] == "emoted");
    assert_eq!(waved["emote"], "wave");
    cafe.stop(Duration::from_secs(10));
}

#[test]
fn the_clock_stays_ahead_across_a_restart() {
    let data = tempfile::tempdir().unwrap();
    let content = repo().join("content");
    assert!(seed_demo(data.path(), &content, "catppuccino"));
    let cafe = Cafe::start(data.path(), &content, Some("2026-11-06T14:00:00+11:00"));
    let cookie = login(&cafe, "demo1", "catppuccino");
    let mut socket = Socket::open(&cafe, &cookie);
    let welcome = socket.welcome();
    assert_eq!(welcome["demo"], true);
    assert_eq!(welcome["ahead"], 0);
    // On to 16:00, two hours on.
    socket.send_text(r#"{"type":"setClock","minute":960}"#);
    let jumping = socket.next_where(Duration::from_secs(10), |m| m["type"] == "jumping");
    assert_eq!(jumping["by"], "demo1");
    let to = jumping["to"].as_u64().unwrap();
    let after = socket.next_where(Duration::from_secs(30), |m| m["type"] == "welcome");
    assert!(after["now"].as_u64().unwrap() >= to);
    let ahead = after["ahead"].as_u64().unwrap();
    assert!((2 * HOUR - 10_000..=2 * HOUR).contains(&ahead), "{ahead}");
    assert!(cafe.line(r#""what":"jumped""#)["who"] == "demo1");
    drop(socket);
    cafe.stop(Duration::from_secs(10));
    // Five minutes later by the wall: the café's clock is still ahead, and
    // never behind where it stopped.
    let again = Cafe::start(data.path(), &content, Some("2026-11-06T14:05:00+11:00"));
    let listening = again.line(r#""message":"listening""#);
    assert_eq!(listening["ahead_ms"].as_u64(), Some(ahead));
    let cookie = login(&again, "demo1", "catppuccino");
    let welcome = Socket::open(&again, &cookie).welcome();
    assert!(welcome["now"].as_u64().unwrap() >= to + 5 * 60_000 - 10_000);
    assert_eq!(welcome["ahead"].as_u64(), Some(ahead));
    again.stop(Duration::from_secs(10));
}
