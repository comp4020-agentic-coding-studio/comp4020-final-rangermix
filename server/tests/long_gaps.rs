//! Slice 08: long gaps on the built café, on mocked time (ADR 0016). Each
//! test starts the binary at an instant, lets a visitor in, stops it as
//! Fly's idle stop does, and starts it again hours or days later, with the
//! save the café wrote itself: a night, a midnight, nine days asleep. What
//! the next morning's first visitor would find is checked here, not on the
//! live café after a real night.
mod common;

use common::{Cafe, DAY, Socket, content_with, saved_at, signup};
use serde_json::Value;
use std::time::Duration;

/// 23:00 on Friday 16 October 2026, Canberra time (AEDT).
const FRIDAY_NIGHT: &str = "2026-10-16T23:00:00+11:00";
/// Half an hour later, before midnight.
const FRIDAY_HALF_ELEVEN: &str = "2026-10-16T23:30:00+11:00";
/// 07:30 the next morning, after the bowls' 7:00 refill.
const SATURDAY_MORNING: &str = "2026-10-17T07:30:00+11:00";
/// The same as ms since the epoch.
const SATURDAY_MORNING_MS: u64 = 1_792_182_600_000;
/// Nine days after Friday night.
const NINE_DAYS_ON: &str = "2026-10-25T23:00:00+11:00";
/// A night's 8½ hours, in seconds.
const NIGHT_SECS: u64 = 30_600;
/// How long a replay of the night may take in a debug build: 0.6 s here,
/// with about eight times that for CI's shared runners. A replay that slow
/// would be about 0.4 s in a release build here (slice 08's review,
/// finding 4).
const BOUND_MS: u64 = 5_000;

fn repo_content(data: &std::path::Path) -> std::path::PathBuf {
    content_with(data, &[])
}

/// Pets each cat in turn until one sniffs a first hello, as
/// `spec/helpers.ts`'s `meetACat` does: that cat, and its trust in you.
fn meet_a_cat(socket: &mut Socket, welcome: &Value) -> (String, Value) {
    let you = welcome["you"].as_u64().unwrap();
    for _round in 0..3 {
        for cat in welcome["snapshot"]["cats"].as_array().unwrap() {
            let id = cat["id"].as_str().unwrap();
            socket.send_text(&format!(r#"{{"type":"pet","cat":"{id}"}}"#));
            // A pet ends in the cat's answer to you (a first hello is a sniff)
            // or an error, if it's out of reach or hiding.
            let answer = socket.next_where(Duration::from_secs(15), |m| {
                (m["type"] == "catReacted" && m["cat"] == id && m["reaction"]["by"] == you) || m["type"] == "error"
            });
            if answer["reaction"]["kind"] != "sniff" {
                continue;
            }
            let trust = socket.next_where(Duration::from_secs(5), |m| m["type"] == "yourTrust" && m["trust"]["cat"] == id);
            return (id.to_string(), trust["trust"].clone());
        }
    }
    panic!("no cat let itself be met");
}

/// Leaves through the door, and waits for the café's next save (every
/// 5 seconds), so the stop that follows has nothing of the visit unsaved.
fn leave(mut socket: Socket) {
    socket.send_text(r#"{"type":"leave"}"#);
    drop(socket);
    std::thread::sleep(Duration::from_secs(6));
}

/// Every piece by kind and place, toppled or not: ids are handed out afresh
/// on each start.
fn places(welcome: &Value) -> Vec<String> {
    let mut out: Vec<String> = welcome["snapshot"]["room"]["furniture"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| format!("{}@{},{}", f["kind"].as_str().unwrap(), f["x"], f["y"]))
        .collect();
    out.sort();
    out
}

fn toppled(welcome: &Value) -> Vec<String> {
    welcome["snapshot"]["room"]["furniture"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|f| f["toppled"] == true)
        .map(|f| format!("{}@{},{}", f["kind"].as_str().unwrap(), f["x"], f["y"]))
        .collect()
}

/// The furniture kinds a cat can knock over, from `content/furniture.toml`.
fn knockable_kinds(content: &std::path::Path) -> Vec<String> {
    let kinds: toml::Table = std::fs::read_to_string(content.join("furniture.toml")).unwrap().parse().unwrap();
    kinds["kinds"]
        .as_table()
        .unwrap()
        .iter()
        .filter(|(_, k)| k.get("knocks").and_then(|v| v.as_bool()) == Some(true))
        .map(|(name, _)| name.clone())
        .collect()
}

/// Every cat's name, from `content/cats/`, sorted: a new cat is a data file.
fn cat_names(content: &std::path::Path) -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(content.join("cats"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|x| x == "toml"))
        .map(|p| {
            let cat: toml::Table = std::fs::read_to_string(p).unwrap().parse().unwrap();
            cat["name"].as_str().unwrap().to_string()
        })
        .collect();
    names.sort();
    names
}

/// A board line as a visitor reads it, for the judged line: the time in
/// Canberra and the words `client/src/chalk.ts` puts on the board (slice
/// 08's review, finding 9).
fn told(line: &Value) -> String {
    let at = chrono::DateTime::from_timestamp_millis(line["at"].as_i64().unwrap())
        .unwrap()
        .with_timezone(&chrono_tz::Australia::Sydney);
    let (cat, w) = (line["cat"].as_str().unwrap(), &line["what"]);
    let s = |k: &str| w[k].as_str().unwrap_or_default().replace('_', " ");
    let words = match w["kind"].as_str().unwrap() {
        "knockedOver" if s("piece") == "toys" => format!("{cat} scattered the toys"),
        "knockedOver" => format!("{cat} knocked over the {}", s("piece")),
        "met" => format!("{cat} met {} for the first time", s("with")),
        "greeted" => format!("{cat} greeted {} at the door", s("with")),
        "lap" => format!("{cat} slept on {}'s lap for {} minutes", s("with"), w["minutes"]),
        "playedWith" => format!("{cat} played with {}", s("with")),
        "played" => format!("{cat} played with the toys"),
        "investigated" => format!("{cat} looked over the new {}", s("piece")),
        "perched" => format!("{cat} watched the street from the window seat"),
        other => format!("{cat} {other}"),
    };
    format!("{}  {words}", at.format("%a %-I:%M%P"))
}

#[test]
fn a_night_from_eleven_to_half_past_seven() {
    let data = tempfile::tempdir().unwrap();
    let content = repo_content(data.path());

    // Friday, 23:00: a regular comes in, says goodnight to a cat, moves a
    // cushion, and goes. A night owl stays in until the machine stops, so the
    // cats, who knock things over only when alone, leave everything standing
    // for the night (slice 08's review, finding 3).
    let evening = Cafe::start(data.path(), &content, Some(FRIDAY_NIGHT));
    evening.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    let (_, owl) = signup(&evening, "night_owl");
    let mut owl = Socket::open(&evening, &owl);
    owl.welcome();
    let (_, cookie) = signup(&evening, "regular");
    let mut socket = Socket::open(&evening, &cookie);
    let before = socket.welcome();
    let (cat, trust) = meet_a_cat(&mut socket, &before);
    let cushion = socket.place_a_cushion(&before);
    leave(socket);
    // The café as the night begins: what the regular left, owl inside.
    let last_look = Socket::open(&evening, &cookie).welcome();
    assert!(places(&last_look).contains(&cushion), "{cushion} is down");
    assert!(
        toppled(&last_look).is_empty(),
        "nothing fell with the owl in: {:?}",
        places(&last_look)
    );
    std::thread::sleep(Duration::from_secs(6));
    evening.stop(Duration::from_secs(10));
    drop(owl);
    let stopped: u64 = saved_at(data.path()).parse().unwrap();

    // Saturday, 07:30: the machine starts for the morning's first visitor.
    let morning = Cafe::start(data.path(), &content, Some(SATURDAY_MORNING));
    morning.wait_for(r#""what":"woke""#, Duration::from_secs(60));
    let woke = morning.line(r#""what":"woke""#);
    let gap = woke["gap_secs"].as_u64().unwrap();
    assert!(
        (NIGHT_SECS - 60..=NIGHT_SECS).contains(&gap),
        "8½ hours, less the evening's minute: {woke}"
    );
    assert!(woke["steps"].as_u64().unwrap().abs_diff(gap) <= 1, "{woke}");
    assert_eq!(woke["first"], false, "{woke}");
    assert_eq!(woke["refills"], 1, "the bowls' 7:00 refill, and no other: {woke}");
    assert_eq!(woke["capped"], false, "{woke}");
    assert_eq!(woke["failed"], false, "{woke}");
    assert!(woke["took_ms"].as_u64().unwrap() < BOUND_MS, "{woke}");
    let walks: Vec<(String, u32)> = serde_json::from_str(woke["walks"].as_str().unwrap()).unwrap();
    // Every cat in content/, whichever cats those are (slice 08's review, finding 7).
    let mut walked: Vec<String> = walks.iter().map(|(n, _)| n.clone()).collect();
    walked.sort();
    assert_eq!(walked, cat_names(&content), "{woke}");
    assert!(walks.iter().any(|(_, n)| *n > 0), "the night moved somebody: {woke}");

    // What the regular finds when they come back.
    let mut socket = Socket::open(&morning, &cookie);
    let after = socket.welcome();
    let snap = &after["snapshot"];
    let kept = snap["yourTrust"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["cat"] == cat.as_str())
        .unwrap();
    assert_eq!(kept, &trust, "trust never fades with absence");
    // The bowls are on Saturday's 7:00 refill. Three cats hungry since 18:00
    // eat its three portions within minutes, so what's left by 07:30 is the
    // night's business, not the schedule's.
    let bowls = common::world_value(data.path(), "bowls");
    assert!(bowls.ends_with("|2026-10-17@420"), "on the 7:00 refill: {bowls}");
    let (portions, _) = bowls.split_once('|').unwrap();
    assert_eq!(snap["bowls"].to_string(), portions, "the welcome shows the bowls the replay saved");
    let board = snap["chalkboard"].as_array().unwrap();
    let night: Vec<&Value> = board
        .iter()
        .filter(|l| (stopped..SATURDAY_MORNING_MS).contains(&l["at"].as_u64().unwrap()))
        .collect();
    assert!(!night.is_empty(), "the night left lines on the board: {board:?}");
    assert!(!toppled(&after).is_empty(), "the night left a trace: {:?}", places(&after));
    // The cushion is where the regular put it, which only the store knows,
    // and everything else stands where it stood (slice 08's review, finding 2).
    assert!(places(&after).contains(&cushion), "{cushion} came back: {:?}", places(&after));
    assert_eq!(places(&after), places(&last_look), "a night knocks things over, but moves nothing");

    // For the judged line: the board as the morning's first visitor reads it.
    println!("The wake-up at 07:30 on Saturday: {woke}");
    println!("The board at 07:30 on Saturday, after a night alone (latest {}):", board.len());
    for line in board {
        println!("  {}", told(line));
    }
    socket.send_text(r#"{"type":"leave"}"#);
    morning.stop(Duration::from_secs(10));
}

#[test]
fn a_trace_left_at_the_stop_is_down_after_the_restart() {
    // Slice 08's review, finding 2: a trace the evening left, kept across the
    // stop by the store. The next start is at the very instant the stop
    // saved, so its replay has no steps: nothing the café does after waking
    // can knock the piece over again, and only the store can have kept it.
    let data = tempfile::tempdir().unwrap();
    let content = repo_content(data.path());
    let evening = Cafe::start(data.path(), &content, Some(FRIDAY_NIGHT));
    evening.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    let (_, cookie) = signup(&evening, "night_owl");
    std::thread::sleep(Duration::from_secs(6));
    evening.stop(Duration::from_secs(10));
    // A trace in the save the café wrote: the first piece a cat could knock
    // over, put down here. How it came to be down isn't what's checked, and
    // waiting for a cat to do it took minutes on a seed whose cats all
    // napped (slice 08's review, finding 2).
    let mut saved: Vec<Value> = serde_json::from_str(&common::world_value(data.path(), "arrangement")).unwrap();
    let knockable = knockable_kinds(&content);
    let piece = saved
        .iter_mut()
        .find(|p| knockable.contains(&p["kind"].as_str().unwrap().to_string()) && p["toppled"] != true)
        .expect("a piece a cat could knock over");
    piece["toppled"] = Value::Bool(true);
    let down = vec![format!("{}@{},{}", piece["kind"].as_str().unwrap(), piece["x"], piece["y"])];
    common::set_world_value(data.path(), "arrangement", &serde_json::to_string(&saved).unwrap());

    let stopped: i64 = saved_at(data.path()).parse().unwrap();
    let at = chrono::DateTime::from_timestamp_millis(stopped).unwrap().to_rfc3339();
    let again = Cafe::start(data.path(), &content, Some(&at));
    again.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    assert_eq!(again.line(r#""what":"woke""#)["steps"], 0, "no replay to knock anything over");
    let after = Socket::open(&again, &cookie).welcome();
    for piece in &down {
        assert!(
            toppled(&after).contains(piece),
            "{piece} was down at the stop, and nobody stood it up"
        );
    }
    again.stop(Duration::from_secs(10));
}

#[test]
fn treats_used_before_midnight_come_back_in_the_morning() {
    let data = tempfile::tempdir().unwrap();
    let content = repo_content(data.path());
    let evening = Cafe::start(data.path(), &content, Some(FRIDAY_NIGHT));
    evening.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    let (_, cookie) = signup(&evening, "generous");
    let mut socket = Socket::open(&evening, &cookie);
    let welcome = socket.welcome();
    assert_eq!(welcome["snapshot"]["yourTreats"], 3);
    for left in (0..3).rev() {
        socket.send_text(r#"{"type":"putTreat"}"#);
        socket.next_where(Duration::from_secs(10), |m| m["type"] == "yourTreats" && m["left"] == left);
    }
    leave(socket);
    evening.stop(Duration::from_secs(10));

    // Before midnight a restart remembers what was used: without this, a café
    // that forgot every visitor's treats on each start would pass the morning
    // (slice 08's review, finding 1).
    let later = Cafe::start(data.path(), &content, Some(FRIDAY_HALF_ELEVEN));
    let welcome = Socket::open(&later, &cookie).welcome();
    assert_eq!(welcome["snapshot"]["yourTreats"], 0, "the same Canberra day, still used up");
    later.stop(Duration::from_secs(10));

    let morning = Cafe::start(data.path(), &content, Some(SATURDAY_MORNING));
    let welcome = Socket::open(&morning, &cookie).welcome();
    assert_eq!(welcome["snapshot"]["yourTreats"], 3, "a new Canberra day's treats");
    morning.stop(Duration::from_secs(10));
}

#[test]
fn nine_days_asleep_replay_the_last_three() {
    let data = tempfile::tempdir().unwrap();
    let content = repo_content(data.path());
    let first = Cafe::start(data.path(), &content, Some(FRIDAY_NIGHT));
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.stop(Duration::from_secs(10));
    let later = Cafe::start(data.path(), &content, Some(NINE_DAYS_ON));
    later.wait_for(r#""what":"woke""#, Duration::from_secs(120));
    let woke = later.line(r#""what":"woke""#);
    let gap = woke["gap_secs"].as_u64().unwrap();
    assert!((9 * DAY / 1000 - 60..=9 * DAY / 1000).contains(&gap), "{woke}");
    assert_eq!(woke["steps"], 3 * DAY / 1000, "tuning.toml's replay_max_days: {woke}");
    assert_eq!(woke["capped"], true, "{woke}");
    assert_eq!(woke["failed"], false, "{woke}");
    later.stop(Duration::from_secs(10));
}
