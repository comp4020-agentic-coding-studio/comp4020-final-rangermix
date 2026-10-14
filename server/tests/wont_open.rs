//! Slice 01: a database that won't open stops the server, loudly, instead of
//! letting it serve an empty café. Runs the built binary, as Fly would.
use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
}

#[test]
fn a_database_that_wont_open_stops_the_server_instead_of_serving_an_empty_cafe() {
    let data = tempfile::tempdir().unwrap();
    std::fs::write(data.path().join("cafe.db"), "this is not a database, and never was. ".repeat(100)).unwrap();
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_cafe"))
        .env("DATA_DIR", data.path())
        .env("CONTENT_DIR", repo.join("content"))
        .env("CLIENT_DIR", data.path().join("no-client"))
        .env("README_PATH", repo.join("README.md"))
        .env("PORT", free_port().to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break status;
        }
        if started.elapsed() > Duration::from_secs(10) {
            let _ = child.kill();
            panic!("still running after 10 seconds: it would be serving an empty café");
        }
        std::thread::sleep(Duration::from_millis(50));
    };
    let mut out = String::new();
    child.stdout.take().unwrap().read_to_string(&mut out).unwrap();
    let mut err = String::new();
    child.stderr.take().unwrap().read_to_string(&mut err).unwrap();
    assert!(!status.success(), "it stopped, but said all was well");
    let lines: Vec<serde_json::Value> = out
        .lines()
        .chain(err.lines())
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(l).unwrap_or_else(|_| panic!("not one of the café's JSON lines: {l}")))
        .collect();
    assert!(
        lines
            .iter()
            .any(|l| l["level"] == "ERROR" && l["error"].as_str().is_some_and(|e| e.contains("database"))),
        "no error line names the database: {out}{err}"
    );
    assert!(lines.iter().all(|l| l["message"] != "listening"), "it opened its doors: {out}");
}
