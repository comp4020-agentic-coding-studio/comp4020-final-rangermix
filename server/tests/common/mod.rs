//! What the built binary's tests share: starting and stopping the café as
//! Fly would, on the wall clock or one started at a chosen instant (slice
//! 08), and talking to it over plain HTTP and a hand-made WebSocket.
#![allow(dead_code)]
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const HOUR: u64 = 3_600_000;
pub const DAY: u64 = 24 * HOUR;

/// The repo's root, where `content/` and `README.md` are.
pub fn repo() -> &'static Path {
    Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap()
}

/// A copy of the repo's content in `data`, with `tuning.toml`'s lines
/// replaced as given, each of which must be there.
pub fn content_with(data: &Path, replace: &[(&str, &str)]) -> PathBuf {
    let dir = data.join("content");
    copy_dir(&repo().join("content"), &dir);
    let mut tuning = std::fs::read_to_string(dir.join("tuning.toml")).unwrap();
    for (from, to) in replace {
        assert!(tuning.contains(from), "tuning.toml has no {from:?}");
        tuning = tuning.replace(from, to);
    }
    std::fs::write(dir.join("tuning.toml"), tuning).unwrap();
    dir
}

fn copy_dir(from: &Path, to: &Path) {
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

pub struct Cafe {
    child: Child,
    pub port: u16,
    pub lines: Arc<Mutex<Vec<String>>>,
}

impl Cafe {
    /// Starts the café on `data` with `content`, its clock at `clock` (an
    /// RFC 3339 time) or the wall's, and waits until it's listening. The OS
    /// picks its port as it binds (`PORT=0`), so cafés started side by side
    /// can't take each other's, and the port is read from its `listening`.
    pub fn start(data: &Path, content: &Path, clock: Option<&str>) -> Cafe {
        let mut cmd = Command::new(env!("CARGO_BIN_EXE_cafe"));
        cmd.env("DATA_DIR", data)
            .env("CONTENT_DIR", content)
            .env("CLIENT_DIR", data.join("no-client"))
            .env("README_PATH", repo().join("README.md"))
            .env("PORT", "0")
            .env_remove("FLY_APP_NAME")
            .env_remove("CAFE_CLOCK_START")
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        if let Some(at) = clock {
            cmd.env("CAFE_CLOCK_START", at);
        }
        let mut child = cmd.spawn().unwrap();
        let lines = Arc::new(Mutex::new(Vec::new()));
        let out = child.stdout.take().unwrap();
        let sink = lines.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(out).lines().map_while(Result::ok) {
                sink.lock().unwrap().push(line);
            }
        });
        let mut cafe = Cafe { child, port: 0, lines };
        cafe.wait_for(r#""message":"listening""#, Duration::from_secs(30));
        cafe.port = cafe.line(r#""message":"listening""#)["port"].as_u64().unwrap() as u16;
        cafe
    }

    pub fn logged(&self, what: &str) -> bool {
        self.lines.lock().unwrap().iter().any(|l| l.contains(what))
    }

    pub fn wait_for(&self, what: &str, within: Duration) {
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

    /// The first line holding `what`, as JSON.
    pub fn line(&self, what: &str) -> serde_json::Value {
        let lines = self.lines.lock().unwrap();
        let l = lines
            .iter()
            .find(|l| l.contains(what))
            .unwrap_or_else(|| panic!("no {what}: {lines:?}"));
        serde_json::from_str(l).unwrap()
    }

    /// Sends SIGINT, as Fly's stop does, and waits up to `within` for the exit.
    pub fn stop(mut self, within: Duration) -> (Duration, std::process::ExitStatus) {
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
    pub fn http(&self, request: &str) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", self.port)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
        s.write_all(request.as_bytes()).unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        out
    }
}

/// A `world` value as the store holds it.
pub fn world_value(data: &Path, key: &str) -> String {
    let c = rusqlite::Connection::open(data.join("cafe.db")).unwrap();
    c.query_row("SELECT value FROM world WHERE key = ?1", [key], |r| r.get(0)).unwrap()
}

/// Writes a `world` value into a stopped café's store: a test's setup of
/// what was saved, never a stand-in for time passing.
pub fn set_world_value(data: &Path, key: &str, value: &str) {
    let c = rusqlite::Connection::open(data.join("cafe.db")).unwrap();
    let n = c.execute("UPDATE world SET value = ?2 WHERE key = ?1", [key, value]).unwrap();
    assert_eq!(n, 1, "the store has a {key}");
}

/// The café's saved clock, as the store holds it.
pub fn saved_at(data: &Path) -> String {
    world_value(data, "saved_at")
}

/// Signs up `name`; the response, and the session cookie it set.
pub fn signup(cafe: &Cafe, name: &str) -> (String, String) {
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
pub struct Socket(TcpStream);

impl Socket {
    pub fn open(cafe: &Cafe, cookie: &str) -> Socket {
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
    pub fn send_text(&mut self, text: &str) {
        let mask = [0x12u8, 0x34, 0x56, 0x78];
        let bytes = text.as_bytes();
        assert!(bytes.len() < 126);
        let mut frame = vec![0x81, 0x80 | bytes.len() as u8];
        frame.extend_from_slice(&mask);
        frame.extend(bytes.iter().enumerate().map(|(i, b)| b ^ mask[i % 4]));
        self.0.write_all(&frame).unwrap();
    }

    pub fn next_text(&mut self) -> String {
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

    /// The next frame, as JSON, that `pick` accepts, within `within`.
    pub fn next_where(&mut self, within: Duration, pick: impl Fn(&serde_json::Value) -> bool) -> serde_json::Value {
        let began = Instant::now();
        loop {
            assert!(began.elapsed() < within, "nothing wanted within {within:?}");
            let frame: serde_json::Value = serde_json::from_str(&self.next_text()).unwrap();
            if pick(&frame) {
                return frame;
            }
        }
    }

    /// The welcome, skipping `waking` and anything before it.
    pub fn welcome(&mut self) -> serde_json::Value {
        self.next_where(Duration::from_secs(120), |m| m["type"] == "welcome")
    }

    /// Takes a cushion from the catalogue and puts it down on a free tile, as
    /// `spec/restart.test.ts`'s `placeACushion` does: a layout only the store
    /// could keep. Its place, `cushion@x,y`.
    pub fn place_a_cushion(&mut self, welcome: &serde_json::Value) -> String {
        let you = welcome["you"].clone();
        for (x, y) in free_tiles(welcome).into_iter().take(5) {
            self.send_text(r#"{"type":"take","kind":"cushion"}"#);
            self.next_where(Duration::from_secs(5), |m| m["type"] == "furnitureHeld" && m["by"] == you);
            self.send_text(&format!(r#"{{"type":"place","to":{{"x":{x},"y":{y}}}}}"#));
            let m = self.next_where(Duration::from_secs(15), |m| {
                (m["type"] == "furniturePlaced" && m["by"] == you) || m["type"] == "error"
            });
            if m["type"] == "furniturePlaced" {
                return format!("cushion@{},{}", m["piece"]["x"], m["piece"]["y"]);
            }
            self.send_text(r#"{"type":"putAway"}"#);
        }
        panic!("nowhere to put a cushion down");
    }
}

/// Floor tiles nothing stands on, off the walkway and clear of the cats,
/// from the back of the room.
fn free_tiles(welcome: &serde_json::Value) -> Vec<(u64, u64)> {
    let room = &welcome["snapshot"]["room"];
    let n = |v: &serde_json::Value| v.as_u64().unwrap();
    let covered = |x: u64, y: u64| {
        room["furniture"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| (n(&f["x"])..n(&f["x"]) + n(&f["w"])).contains(&x) && (n(&f["y"])..n(&f["y"]) + n(&f["h"])).contains(&y))
            || room["walkway"]
                .as_array()
                .unwrap()
                .iter()
                .any(|w| n(&w["x"]) == x && n(&w["y"]) == y)
            || welcome["snapshot"]["cats"]
                .as_array()
                .unwrap()
                .iter()
                .any(|c| n(&c["at"]["x"]) == x && n(&c["at"]["y"]) == y)
    };
    let tiles: Vec<&str> = room["tiles"].as_array().unwrap().iter().map(|t| t.as_str().unwrap()).collect();
    let (w, h) = (n(&room["width"]), n(&room["height"]));
    let mut out = Vec::new();
    for y in (2..h - 1).rev() {
        for x in 1..w - 1 {
            if tiles[y as usize].as_bytes()[x as usize] == b'.' && !covered(x, y) {
                out.push((x, y));
            }
        }
    }
    out
}
