//! Slice 07: the café opens its doors at once and replays its sleep in the
//! background. Runs the built binary, as Fly would, woken from days asleep,
//! over plain HTTP and a hand-made WebSocket.
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const DAY: u64 = 24 * 3_600_000;
/// The test's café replays up to a week, longer than the live cap, so that
/// what it checks during the replay has time to happen on a slow machine.
const ASLEEP_DAYS: u64 = 7;

/// The repo's content, with the replay's cap raised to the test's week.
fn content(data: &std::path::Path) -> std::path::PathBuf {
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let dir = data.join("content");
    copy_dir(&repo.join("content"), &dir);
    let tuning = std::fs::read_to_string(dir.join("tuning.toml")).unwrap();
    let raised = tuning.replace("replay_max_days = 3", &format!("replay_max_days = {ASLEEP_DAYS}"));
    assert_ne!(raised, tuning, "tuning.toml's replay_max_days");
    std::fs::write(dir.join("tuning.toml"), raised).unwrap();
    dir
}

fn copy_dir(from: &std::path::Path, to: &std::path::Path) {
    std::fs::create_dir_all(to).unwrap();
    for entry in std::fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let target = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &target);
        } else {
            std::fs::copy(entry.path(), target).unwrap();
        }
    }
}

struct Cafe {
    child: Child,
    port: u16,
    lines: Arc<Mutex<Vec<String>>>,
}

impl Cafe {
    fn start(data: &std::path::Path) -> Cafe {
        let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
        let content = content(data);
        let port = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let mut child = Command::new(env!("CARGO_BIN_EXE_cafe"))
            .env("DATA_DIR", data)
            .env("CONTENT_DIR", content)
            .env("CLIENT_DIR", data.join("no-client"))
            .env("README_PATH", repo.join("README.md"))
            .env("PORT", port.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let lines = Arc::new(Mutex::new(Vec::new()));
        let out = child.stdout.take().unwrap();
        let sink = lines.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                sink.lock().unwrap().push(line);
            }
        });
        Cafe { child, port, lines }
    }

    fn logged(&self, what: &str) -> bool {
        self.lines.lock().unwrap().iter().any(|l| l.contains(what))
    }

    fn wait_for(&self, what: &str, within: Duration) {
        let started = Instant::now();
        while !self.logged(what) {
            assert!(
                started.elapsed() < within,
                "no {what} within {within:?}: {:?}",
                self.lines.lock().unwrap()
            );
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    /// Sends SIGINT, as Fly's stop does, and waits up to `within` for the exit.
    fn stop(mut self, within: Duration) -> (Duration, std::process::ExitStatus) {
        let began = Instant::now();
        Command::new("kill").args(["-INT", &self.child.id().to_string()]).status().unwrap();
        loop {
            if let Some(status) = self.child.try_wait().unwrap() {
                return (began.elapsed(), status);
            }
            if began.elapsed() > within {
                let _ = self.child.kill();
                panic!("still running {within:?} after the stop signal");
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    /// One HTTP/1.1 request; the status line, the headers and the body.
    fn http(&self, request: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", self.port)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
        s.write_all(request.as_bytes()).unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        out
    }
}

fn saved_at(data: &std::path::Path) -> String {
    let c = rusqlite::Connection::open(data.join("cafe.db")).unwrap();
    c.query_row("SELECT value FROM world WHERE key = 'saved_at'", [], |r| r.get(0))
        .unwrap()
}

fn set_saved_at(data: &std::path::Path, at: u64) {
    let c = rusqlite::Connection::open(data.join("cafe.db")).unwrap();
    c.execute("UPDATE world SET value = ?1 WHERE key = 'saved_at'", [at.to_string()])
        .unwrap();
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

fn signup(cafe: &Cafe, name: &str) -> (String, String) {
    let body = format!(r#"{{"name":"{name}","password":"correct horse","look":{{"avatar":1,"colour":2}}}}"#);
    let res = cafe.http(&format!(
        "POST /api/signup HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        cafe.port,
        body.len()
    ));
    let cookie = res
        .lines()
        .find_map(|l| l.strip_prefix("set-cookie: ").or_else(|| l.strip_prefix("Set-Cookie: ")))
        .and_then(|c| c.split(';').next())
        .unwrap_or_default()
        .to_string();
    (res, cookie)
}

/// A WebSocket's text frames, read by hand: the server's frames aren't masked.
struct Socket(TcpStream);

impl Socket {
    fn open(cafe: &Cafe, cookie: &str) -> Socket {
        let mut s = TcpStream::connect(("127.0.0.1", cafe.port)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(60))).unwrap();
        write!(
            s,
            "GET /ws HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nCookie: {cookie}\r\n\r\n",
            cafe.port
        )
        .unwrap();
        let mut head = Vec::new();
        let mut byte = [0u8];
        while !head.ends_with(b"\r\n\r\n") {
            s.read_exact(&mut byte).unwrap();
            head.push(byte[0]);
        }
        let head = String::from_utf8(head).unwrap();
        assert!(head.starts_with("HTTP/1.1 101"), "{head}");
        Socket(s)
    }

    /// A text frame from the client, masked as a client's must be.
    fn send_text(&mut self, text: &str) {
        let mask = [0x12u8, 0x34, 0x56, 0x78];
        let bytes = text.as_bytes();
        assert!(bytes.len() < 126);
        let mut frame = vec![0x81, 0x80 | bytes.len() as u8];
        frame.extend_from_slice(&mask);
        frame.extend(bytes.iter().enumerate().map(|(i, b)| b ^ mask[i % 4]));
        self.0.write_all(&frame).unwrap();
    }

    fn next_text(&mut self) -> String {
        loop {
            let mut h = [0u8; 2];
            self.0.read_exact(&mut h).unwrap();
            let len = match h[1] & 0x7f {
                126 => {
                    let mut b = [0u8; 2];
                    self.0.read_exact(&mut b).unwrap();
                    u16::from_be_bytes(b) as usize
                }
                127 => {
                    let mut b = [0u8; 8];
                    self.0.read_exact(&mut b).unwrap();
                    u64::from_be_bytes(b) as usize
                }
                n => n as usize,
            };
            let mut payload = vec![0u8; len];
            self.0.read_exact(&mut payload).unwrap();
            if h[0] & 0x0f == 1 {
                return String::from_utf8(payload).unwrap();
            }
        }
    }
}

#[test]
fn the_doors_open_at_once_and_the_cafe_follows_its_replay() {
    let data = tempfile::tempdir().unwrap();
    // A first start makes the database, and an account to come back with.
    let first = Cafe::start(data.path());
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.wait_for("listening", Duration::from_secs(30));
    let (_, cookie) = signup(&first, "regular");
    assert!(cookie.starts_with("session="), "signed up");
    first.stop(Duration::from_secs(10));

    // Days asleep: the next start replays them in the background.
    set_saved_at(data.path(), now_ms() - ASLEEP_DAYS * DAY);
    let cafe = Cafe::start(data.path());
    cafe.wait_for("listening", Duration::from_secs(30));
    assert!(!cafe.logged(r#""what":"woke""#), "listening comes before the replay ends");
    let page = cafe.http(&format!(
        "GET / HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        cafe.port
    ));
    assert!(page.starts_with("HTTP/1.1 200"), "{page}");
    let (res, newcomer) = signup(&cafe, "newcomer");
    assert!(newcomer.starts_with("session="), "{res}");
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
    let woke = cafe
        .lines
        .lock()
        .unwrap()
        .iter()
        .find(|l| l.contains(r#""what":"woke""#))
        .cloned()
        .unwrap();
    assert!(woke.contains(&format!(r#""steps":{}"#, ASLEEP_DAYS * DAY / 1000)), "{woke}");
    cafe.stop(Duration::from_secs(10));
}

#[test]
fn a_leave_sent_while_waking_frees_the_seat_when_it_wakes() {
    // Slice 07's review, finding 1: a visitor who gives up on "Dusting off the
    // café…" and leaves mustn't hold a seat for the grace period after it wakes.
    let data = tempfile::tempdir().unwrap();
    let first = Cafe::start(data.path());
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.wait_for("listening", Duration::from_secs(30));
    let (_, leaver) = signup(&first, "leaver");
    let (_, watcher) = signup(&first, "watcher");
    first.stop(Duration::from_secs(10));
    set_saved_at(data.path(), now_ms() - ASLEEP_DAYS * DAY);
    let cafe = Cafe::start(data.path());
    cafe.wait_for("listening", Duration::from_secs(30));
    let mut socket = Socket::open(&cafe, &leaver);
    assert_eq!(socket.next_text(), r#"{"type":"waking"}"#);
    socket.send_text(r#"{"type":"leave"}"#);
    std::thread::sleep(Duration::from_millis(100));
    drop(socket);
    assert!(!cafe.logged(r#""what":"woke""#), "the leave was sent while it woke");
    cafe.wait_for(r#""what":"woke""#, Duration::from_secs(120));
    let mut watching = Socket::open(&cafe, &watcher);
    let welcome = loop {
        let frame = watching.next_text();
        if frame.starts_with(r#"{"type":"welcome""#) {
            break frame;
        }
    };
    let welcome: serde_json::Value = serde_json::from_str(&welcome).unwrap();
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
    let first = Cafe::start(data.path());
    first.wait_for("listening", Duration::from_secs(30));
    first.wait_for(r#""what":"woke""#, Duration::from_secs(30));
    first.stop(Duration::from_secs(10));
    let asleep = now_ms() - ASLEEP_DAYS * DAY;
    set_saved_at(data.path(), asleep);
    let cafe = Cafe::start(data.path());
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
    assert_eq!(saved_at(data.path()), asleep.to_string(), "the next start replays the same gap");
}
