//! Slice 07: the café opens its doors at once and replays its sleep in the
//! background. Runs the built binary, as Fly would, over plain HTTP and a
//! hand-made WebSocket, woken from days asleep on the mocked clock (slice
//! 08): the second start is days after the first, with the save the first
//! wrote itself.
mod common;

use common::{Cafe, DAY, Socket, content_with, saved_at, signup};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// The test's café replays up to a week, longer than the live cap, so that
/// what it checks during the replay has time to happen on a slow machine.
const ASLEEP_DAYS: u64 = 7;
/// A first start at 23:00 on Friday 16 October, Canberra time…
const FIRST: &str = "2026-10-16T23:00:00+11:00";
/// …and the next a week later, to the minute.
const A_WEEK_ON: &str = "2026-10-23T23:00:00+11:00";

/// The repo's content, with the replay's cap raised to the test's week.
fn content(data: &std::path::Path) -> std::path::PathBuf {
    content_with(data, &[("replay_max_days = 3", &format!("replay_max_days = {ASLEEP_DAYS}"))])
}

#[test]
fn the_doors_open_at_once_and_the_cafe_follows_its_replay() {
    let data = tempfile::tempdir().unwrap();
    let content = content(data.path());
    // A first start makes the database, and an account to come back with.
    let first = Cafe::start(data.path(), &content, Some(FIRST));
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.wait_for("listening", Duration::from_secs(30));
    let (_, cookie) = signup(&first, "regular");
    assert!(cookie.starts_with("session="), "signed up");
    first.stop(Duration::from_secs(10));

    // Days asleep: the next start replays them in the background.
    let cafe = Cafe::start(data.path(), &content, Some(A_WEEK_ON));
    cafe.wait_for("listening", Duration::from_secs(30));
    assert!(!cafe.logged(r#""what":"woke""#), "listening comes before the replay ends");
    let page = cafe.http(&format!(
        "GET / HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        cafe.port
    ));
    assert!(page.starts_with("HTTP/1.1 200"), "{page}");
    let (res, newcomer) = signup(&cafe, "newcomer");
    assert!(newcomer.starts_with("session="), "{res}");
    // The week-old session still lets its visitor in: 30 days, on the café's clock.
    let mut socket = Socket::open(&cafe, &cookie);
    assert_eq!(socket.next_text(), r#"{"type":"waking"}"#);
    assert!(
        !cafe.logged(r#""what":"woke""#),
        "all that while it was still replaying: make the test's gap longer if not"
    );
    let welcome = socket.next_text();
    assert!(
        welcome.starts_with(r#"{"type":"welcome""#),
        "{}",
        &welcome[..welcome.len().min(200)]
    );
    assert!(cafe.logged(r#""what":"woke""#), "the welcome comes once the café is awake");
    let woke = cafe.line(r#""what":"woke""#);
    // The first start lived a few seconds past 23:00 before it stopped.
    let steps = woke["steps"].as_u64().unwrap();
    assert!(
        (ASLEEP_DAYS * DAY / 1000 - 60..=ASLEEP_DAYS * DAY / 1000).contains(&steps),
        "{woke}"
    );
    assert_eq!(woke["capped"], false, "{woke}");
    cafe.stop(Duration::from_secs(10));
}

#[test]
fn a_leave_sent_while_waking_frees_the_seat_when_it_wakes() {
    // Slice 07's review, finding 1: a visitor who gives up on "Dusting off the
    // café…" and leaves mustn't hold a seat for the grace period after it wakes.
    let data = tempfile::tempdir().unwrap();
    let content = content(data.path());
    let first = Cafe::start(data.path(), &content, Some(FIRST));
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.wait_for("listening", Duration::from_secs(30));
    let (_, leaver) = signup(&first, "leaver");
    let (_, watcher) = signup(&first, "watcher");
    first.stop(Duration::from_secs(10));
    let cafe = Cafe::start(data.path(), &content, Some(A_WEEK_ON));
    cafe.wait_for("listening", Duration::from_secs(30));
    let mut socket = Socket::open(&cafe, &leaver);
    assert_eq!(socket.next_text(), r#"{"type":"waking"}"#);
    socket.send_text(r#"{"type":"leave"}"#);
    std::thread::sleep(Duration::from_millis(100));
    drop(socket);
    assert!(!cafe.logged(r#""what":"woke""#), "the leave was sent while it woke");
    cafe.wait_for(r#""what":"woke""#, Duration::from_secs(120));
    let welcome = Socket::open(&cafe, &watcher).welcome();
    let inside: Vec<&str> = welcome["snapshot"]["people"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|p| p["name"].as_str())
        .collect();
    assert_eq!(inside, ["watcher"], "the leaver walked out when the café woke");
    cafe.stop(Duration::from_secs(10));
}

#[test]
fn a_stop_during_the_replay_leaves_the_save_as_it_was() {
    let data = tempfile::tempdir().unwrap();
    let content = content(data.path());
    let first = Cafe::start(data.path(), &content, Some(FIRST));
    first.wait_for("listening", Duration::from_secs(30));
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.stop(Duration::from_secs(10));
    let asleep = saved_at(data.path());
    let cafe = Cafe::start(data.path(), &content, Some(A_WEEK_ON));
    cafe.wait_for("listening", Duration::from_secs(30));
    assert!(!cafe.logged(r#""what":"woke""#));
    // A sign-up in flight doesn't hold the stop past Fly's five seconds
    // (slice 07's review, finding 2).
    let port = cafe.port;
    std::thread::spawn(move || {
        let body = r#"{"name":"latecomer","password":"correct horse","look":{"avatar":1,"colour":2}}"#;
        if let Ok(mut s) = TcpStream::connect(("127.0.0.1", port)) {
            let _ = write!(
                s,
                "POST /api/signup HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = s.read_to_end(&mut Vec::new());
        }
    });
    std::thread::sleep(Duration::from_millis(50));
    let (took, status) = cafe.stop(Duration::from_secs(5));
    assert!(took < Duration::from_secs(5), "{took:?}");
    assert!(status.success(), "a stop is a clean exit: {status:?}");
    assert_eq!(saved_at(data.path()), asleep, "the next start replays the same gap");
}
