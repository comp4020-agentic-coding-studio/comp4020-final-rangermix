//! A demo account moves the built café's clock on (slice 17, ADR 0022): the
//! binary on a mocked clock, seeded by its own subcommand.
mod common;

use common::{Cafe, HOUR, Socket, content_with, login, repo, seed_demo, signup};
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

/// Whether `cookie` is still signed in.
fn signed_in(cafe: &Cafe, cookie: &str) -> bool {
    let res = cafe.http(&format!(
        "GET /api/me HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nCookie: {cookie}\r\nConnection: close\r\n\r\n",
        cafe.port
    ));
    res.starts_with("HTTP/1.1 200")
}

#[test]
fn long_jumps_age_no_session_keep_the_pages_clock_and_tell_a_page_that_opens() {
    // Slice 17's review, findings 4, 5 and 9, on a café whose sessions last a
    // day and whose clock can move again at once.
    let data = tempfile::tempdir().unwrap();
    let content = content_with(
        data.path(),
        &[
            ("session_days = 30", "session_days = 1"),
            ("jump_every_secs = 60", "jump_every_secs = 1"),
        ],
    );
    assert!(seed_demo(data.path(), &content, "catppuccino"));
    let cafe = Cafe::start(data.path(), &content, Some("2026-11-06T14:00:00+11:00"));
    let (_, sam) = signup(&cafe, "sam");
    let (_, joan) = signup(&cafe, "joan");
    let mut demo = Socket::open(&cafe, &login(&cafe, "demo1", "catppuccino"));
    let you = demo.welcome()["you"].clone();
    for _ in 0..2 {
        // On to 13:59, a minute short of a day.
        demo.send_text(r#"{"type":"setClock","minute":839}"#);
        demo.next_where(Duration::from_secs(10), |m| m["type"] == "jumping");
        // Finding 9: a page that opens while the café lives the hours is told.
        let mut opener = Socket::open(&cafe, &joan);
        let first: serde_json::Value = serde_json::from_str(&opener.next_text()).unwrap();
        assert_eq!(first["type"], "jumping", "{first}");
        let welcome = demo.next_where(Duration::from_secs(60), |m| m["type"] == "welcome");
        // Finding 5: the welcome's time is the café's own, not where the
        // replay began, so what the café starts next isn't seen late.
        demo.send_text(r#"{"type":"walkTo","tile":{"x":7,"y":2}}"#);
        let moved = demo.next_where(Duration::from_secs(5), |m| m["type"] == "personMoved" && m["id"] == you);
        let late = moved["walk"]["start"].as_u64().unwrap() as i64 - welcome["now"].as_u64().unwrap() as i64;
        assert!((0..500).contains(&late), "the page's clock would run {late} ms behind");
        drop(opener);
        std::thread::sleep(Duration::from_millis(1_100));
    }
    // Finding 4: nearly two days on by the café's clock, sam's day-long
    // session is still good: jumps don't spend anyone's session.
    assert!(signed_in(&cafe, &sam));
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
