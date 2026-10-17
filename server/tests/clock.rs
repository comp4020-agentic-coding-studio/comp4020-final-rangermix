//! Slice 08: the café's clock, started at a chosen instant for a test and
//! never on Fly (ADR 0016). Runs the built binary, as Fly would.
use std::io::{BufRead, BufReader, Read};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// 23:00 on Friday 16 October 2026 in Canberra (AEDT), as ms since the epoch.
const FRIDAY_NIGHT: u64 = 1_792_152_000_000;

fn start(data: &std::path::Path, env: &[(&str, &str)]) -> Child {
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_cafe"));
    // The OS picks the port as the café binds it, so tests side by side
    // can't take each other's.
    cmd.env("DATA_DIR", data)
        .env("CONTENT_DIR", repo.join("content"))
        .env("CLIENT_DIR", data.join("no-client"))
        .env("README_PATH", repo.join("README.md"))
        .env("PORT", "0")
        .env_remove("FLY_APP_NAME")
        .env_remove("CAFE_CLOCK_START")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (k, v) in env {
        cmd.env(k, v);
    }
    cmd.spawn().unwrap()
}

/// What a start that should refuse printed, once it has exited.
fn refused(data: &std::path::Path, env: &[(&str, &str)]) -> Vec<serde_json::Value> {
    let mut child = start(data, env);
    let began = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break status;
        }
        if began.elapsed() > Duration::from_secs(10) {
            let _ = child.kill();
            panic!("still running 10 s after starting with {env:?}");
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    assert!(!status.success(), "it said all was well with {env:?}");
    let (mut out, mut err) = (String::new(), String::new());
    child.stdout.take().unwrap().read_to_string(&mut out).unwrap();
    child.stderr.take().unwrap().read_to_string(&mut err).unwrap();
    out.lines()
        .chain(err.lines())
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(l).unwrap_or_else(|_| panic!("not one of the café's JSON lines: {l}")))
        .collect()
}

/// Starts the café and collects what it prints, line by line.
fn running(data: &std::path::Path, env: &[(&str, &str)]) -> (Child, Arc<Mutex<Vec<String>>>) {
    let mut child = start(data, env);
    let lines = Arc::new(Mutex::new(Vec::new()));
    let out = child.stdout.take().unwrap();
    let sink = lines.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(out).lines().map_while(Result::ok) {
            sink.lock().unwrap().push(line);
        }
    });
    (child, lines)
}

fn wait_for(lines: &Arc<Mutex<Vec<String>>>, what: &str) -> serde_json::Value {
    let began = Instant::now();
    loop {
        if let Some(l) = lines.lock().unwrap().iter().find(|l| l.contains(what)) {
            return serde_json::from_str(l).unwrap();
        }
        assert!(began.elapsed() < Duration::from_secs(30), "no {what}: {:?}", lines.lock().unwrap());
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn stop(mut child: Child) {
    Command::new("kill").args(["-INT", &child.id().to_string()]).status().unwrap();
    let began = Instant::now();
    while child.try_wait().unwrap().is_none() {
        assert!(began.elapsed() < Duration::from_secs(10), "still running after the stop signal");
        std::thread::sleep(Duration::from_millis(20));
    }
}

#[test]
fn a_cafe_started_at_an_instant_lives_from_there() {
    let data = tempfile::tempdir().unwrap();
    let (child, lines) = running(data.path(), &[("CAFE_CLOCK_START", "2026-10-16T23:00:00+11:00")]);
    let listening = wait_for(&lines, r#""message":"listening""#);
    assert_eq!(listening["clock"], "2026-10-16T23:00:00+11:00");
    wait_for(&lines, r#""what":"woke""#);
    stop(child);
    let c = rusqlite::Connection::open(data.path().join("cafe.db")).unwrap();
    let saved: String = c
        .query_row("SELECT value FROM world WHERE key = 'saved_at'", [], |r| r.get(0))
        .unwrap();
    let saved: u64 = saved.parse().unwrap();
    assert!(
        (FRIDAY_NIGHT..FRIDAY_NIGHT + 60_000).contains(&saved),
        "saved at {saved}, not within a minute of Friday 23:00"
    );
}

#[test]
fn a_cafe_on_the_wall_clock_says_so() {
    let data = tempfile::tempdir().unwrap();
    let (child, lines) = running(data.path(), &[]);
    assert_eq!(wait_for(&lines, r#""message":"listening""#)["clock"], "wall");
    wait_for(&lines, r#""what":"woke""#);
    stop(child);
}

#[test]
fn a_cafe_given_port_zero_says_which_port_it_took() {
    // The binary tests start cafés side by side: the OS picks each one's
    // port as it binds, so none can take another's (slice 08).
    let data = tempfile::tempdir().unwrap();
    let (child, lines) = running(data.path(), &[("PORT", "0")]);
    let port = wait_for(&lines, r#""message":"listening""#)["port"].as_u64().unwrap();
    assert_ne!(port, 0, "the port it bound, not the one it was given");
    let mut s = std::net::TcpStream::connect(("127.0.0.1", port as u16)).expect("it answers there");
    std::io::Write::write_all(&mut s, b"GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n").unwrap();
    let mut answer = String::new();
    s.read_to_string(&mut answer).unwrap();
    assert!(answer.starts_with("HTTP/1.1 200"), "{answer}");
    wait_for(&lines, r#""what":"woke""#);
    stop(child);
}

#[test]
fn a_start_that_isnt_a_time_stops_the_server() {
    let data = tempfile::tempdir().unwrap();
    let lines = refused(data.path(), &[("CAFE_CLOCK_START", "tomorrow")]);
    assert!(
        lines
            .iter()
            .any(|l| l["level"] == "ERROR" && l["error"].as_str().is_some_and(|e| e.contains("CAFE_CLOCK_START"))),
        "no error line names CAFE_CLOCK_START: {lines:?}"
    );
    assert!(lines.iter().all(|l| l["message"] != "listening"), "it opened its doors: {lines:?}");
}

#[test]
fn a_mocked_clock_is_refused_on_fly() {
    let data = tempfile::tempdir().unwrap();
    let lines = refused(
        data.path(),
        &[("CAFE_CLOCK_START", "2026-10-16T23:00:00+11:00"), ("FLY_APP_NAME", "cafe")],
    );
    assert!(
        lines.iter().any(|l| l["level"] == "ERROR"
            && l["error"]
                .as_str()
                .is_some_and(|e| e.contains("CAFE_CLOCK_START") && e.contains("Fly"))),
        "no error line says why: {lines:?}"
    );
    assert!(lines.iter().all(|l| l["message"] != "listening"), "it opened its doors: {lines:?}");
    assert!(!data.path().join("cafe.db").exists(), "refused before it opened the store");
}
