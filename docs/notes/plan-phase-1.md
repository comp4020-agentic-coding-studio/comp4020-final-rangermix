# Phase 1, "It's alive": Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo the method is fixed by [ADR 0012](../adr/0012-plan-in-phases-and-build-each-phase-natively.md): built natively, test first, with a whole-phase review at the end.

**Goal:** A deployed café where a stranger can sign up, walk in through the door, meet Mochi, Burakku and Tora, pet and call them, talk with whoever else is there in real time, and come back later to find that the cats remember them.

**Architecture:** One Rust binary (tokio, axum) serves the client, `/readme/`, the accounts API and a WebSocket. A single world task owns the café and decides every outcome; `World::handle` and `World::tick` are pure enough to test without sockets and return messages that a thin routing layer sends to connections. SQLite on `/data` is written by one store thread. The client is TypeScript on a plain canvas with HTML over it for text, menus and announcements; its message types are generated from the Rust ones by ts-rs.

**Tech Stack:** Rust 1.93 (edition 2024): tokio 1, axum 0.8 (ws), tower-http 0.7, rusqlite 0.40 (bundled), argon2 0.6, rand 0.10 and rand_chacha 0.10, ts-rs 12, serde, toml 1, chrono and chrono-tz, pulldown-cmark 0.13, tracing-subscriber 0.3 (json), sha2 0.11, base64 0.23. TypeScript 6, Vite 8, vitest 5 with jsdom; `ws` 8 for the spec's WebSocket client. Node 24.21 and pnpm 11.9 as pinned in `mise.toml`. Docker for the image; Fly.io for hosting.

**Spec:** [`docs/design.md`](../design.md), with ADRs 0002 to 0011 and the rules in [`AGENTS.md`](../../AGENTS.md). Roadmap: [plan.md](plan.md).

## Global Constraints

- One `shared-cpu-1x` machine with 256 MB; one volume at `/data`; HTTP on `0.0.0.0:$PORT` (8080). Leave `fly.toml` as the course set it.
- `/` answers 200, and `/readme/` carries `README.md`'s headings, in order, in the HTML the server sends.
- `pnpm check` must pass against the running app; `pnpm check:evidence` needs the user's `PROCESS.md` and reflection, which no task writes.
- Marking happens in the latest Chrome at 1920×1080 and 390×844, including a keyboard-only pass and a resize mid-use.
- AGENTS.md, "What the app must keep": never store or log what anyone says; never store email or IP addresses (per-IP limits count in memory only); the server decides every outcome; the cap is enforced on the server and someone at the window can only talk; the door's walkway is never blocked; trust never fades with absence; every action works by keyboard, touch and mouse at both sizes; cats change through `content/`, not code; generated TypeScript is never edited by hand.
- Every number in `content/tuning.toml` matches design.md's "Numbers to tune", and a change to one changes both in the same commit.
- Commit and push to `main` after each task (the user's standing rule), with the prompt-log entry before the turn's final commit.
- ts-rs maps 64-bit integers to `number` (`TS_RS_LARGE_INT`), because JSON numbers aren't `bigint`.

## Review Focus

The spec says what the café must do; these are the inputs it will meet that no single feature's tests would naturally exercise, most likely first. Each has its pinning test in the task named.

1. **A whole room on one network address.** The showcase venue, or a campus NAT, sends many people through one IP: sign-up and log-in must not lock them out. The design's 5 a minute per IP would; the limit becomes 60 a minute per IP (5 per name stays). Pinned in Task 5: ten sign-ups from one address in a few seconds all succeed.
2. **A phone that drops and comes back.** A sleeping phone or a change of network must keep the seat within the grace period and heal by snapshot, without a second avatar or a "left" message. Pinned in Task 8 (grace period, rejoin) and Task 10 (reconnect over a real socket).
3. **Two tabs on one account.** One avatar only; the older tab is told and stops reconnecting. Pinned in Task 8 (no second person) and Task 10 (`replaced` over real sockets).
4. **Odd text in a bubble.** Emoji count as one character each, not as bytes; markup like `<img onerror>` is shown as text and never becomes HTML. Pinned in Task 8 (100 emoji accepted, 101 refused) and Task 14 (a bubble with markup creates no element).
5. **A deploy mid-visit.** The cats come back where they were, trust is intact, open tabs reconnect on their own, and a tab on the old build reloads. Pinned in Task 9 (saved cats restored), Task 12 (`needsReload`) and Task 10 (reconnect after a server restart, by hand in the verification step).

## File map

```
Cargo.toml                    workspace (members: server)
.cargo/config.toml            ts-rs export folder and integer mapping
server/Cargo.toml             the one crate, "cafe"
server/src/main.rs            startup, wiring, saving on stop
server/src/config.rs          paths and port from the environment; build id
server/src/time.rs            now, Canberra day and minute
server/src/readme.rs          README.md rendered into the /readme/ page
server/src/http.rs            AppState, routes, Origin check, client IP
server/src/protocol.rs        wire types (ts-rs exports them)
server/src/tuning.rs          content/tuning.toml
server/src/room.rs            tiles, furniture, walkability, paths
server/src/content.rs         loads and validates everything in content/
server/src/store.rs           SQLite thread, migrations, typed queries
server/src/auth.rs            validation, hashing, recovery codes, sessions, cookies
server/src/limits.rs          token buckets
server/src/api.rs             /api/signup, login, logout, me, recover
server/src/trust.rs           the trust book: taper, daily cap, levels
server/src/cats.rs            cat files, scoring choices, answering a pet
server/src/world/mod.rs       World: inputs, outputs, tick, snapshot, saving
server/src/world/people.rs    arriving, the line, walking, talking, leaving
server/src/world/cat_life.rs  cats in the room: needs, choices, stimuli, pets
server/src/ws.rs              the world task, routing, the WebSocket endpoint
content/tuning.toml           every tunable number
content/room.toml             the floor plan and starting furniture
content/furniture.toml        what each kind of furniture is
content/cats/*.toml           Mochi, Burakku, Tora
content/sprites/*.txt         sprites as grids of palette slots
content/sprites/palettes.json the colours behind the slots
client/                       Vite + TypeScript package "cafe-client"
client/src/protocol/          generated by ts-rs; never edited by hand
client/src/{api,auth,net,state,sprites,scale,motion,canberra,render,input,menu,talk,bubbles,panels,announce,main}.ts
client/test/*.test.ts         client unit tests (jsdom)
spec/helpers.ts               sign-up and WebSocket helpers for the spec
spec/accounts.test.ts         accounts, black-box
spec/realtime.test.ts         real-time, the cap, bubbles, the cats' memory
spec/login-page.test.ts       the log-in card links to /readme/
scripts/check-protocol.sh     regenerate the TypeScript and fail on drift
scripts/dev.sh                build the client and run the server locally
Dockerfile, .dockerignore     three-stage image
.github/workflows/checks.yml  a Rust job beside the course's check job
```

## Tasks

1. Server skeleton: workspace, config, time, `/readme/`, static files
2. Protocol types and generated TypeScript
3. Tuning, content and the room
4. The store
5. Accounts
6. The trust book
7. Cat characters
8. The world: people, the line, walking and talking
9. The world: cats
10. The WebSocket and the world task
11. Client package and sprites
12. Pages, accounts and the live connection
13. Drawing the café
14. Acting in the café
15. Image, CI and the local loop
16. Deploy and check it live
17. Material for the README
18. Whole-phase review

---

### Task 1: Server skeleton: workspace, config, time, `/readme/`, static files

The smallest server the course's two shipped checks can run against: `/`
answers (with a holding page until the client exists) and `/readme/` serves
`README.md` rendered to HTML when the server starts.

**Files:**
- Create: `Cargo.toml`, `server/Cargo.toml`, `server/src/main.rs`, `server/src/config.rs`, `server/src/time.rs`, `server/src/readme.rs`, `server/src/http.rs`
- Modify: `.gitignore` (add `target/` and `.data/`)
- Test: inline `#[cfg(test)]` modules in `config.rs`, `time.rs`, `readme.rs`, `http.rs`; then the existing `spec/invariants.test.ts`

**Interfaces:**
- Produces: `config::Config { port, data_dir, content_dir, client_dir, readme_path, docs_dir }` with `Config::from_env()`, `Config::from_lookup(impl Fn(&str) -> Option<String>)` and `Config::build_id(&self) -> String`; `time::now_ms() -> u64`, `time::canberra_day(u64) -> String` (`YYYY-MM-DD`), `time::canberra_minute_of_day(u64) -> u32`; `readme::render_page(&str) -> String`; `http::AppState` (grows in Tasks 5 and 10) and `http::router(AppState) -> Router`.

- [ ] **Step 1: Write the workspace and crate manifests**

`Cargo.toml`:

```toml
[workspace]
members = ["server"]
resolver = "3"
```

`server/Cargo.toml` (every dependency the phase needs, so later tasks don't edit it):

```toml
[package]
name = "cafe"
version = "0.1.0"
edition = "2024"

[dependencies]
anyhow = "1"
argon2 = "0.6"
axum = { version = "0.8", features = ["ws"] }
base64 = "0.23"
chrono = "0.4"
chrono-tz = "0.10"
futures-util = "0.3"
pulldown-cmark = "0.13"
rand = "0.10"
rand_chacha = "0.10"
rusqlite = { version = "0.40", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.11"
tokio = { version = "1", features = ["full"] }
toml = "1"
tower-http = { version = "0.7", features = ["fs"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
ts-rs = "12"

[dev-dependencies]
http-body-util = "0.1"
tempfile = "3"
tower = { version = "0.5", features = ["util"] }
```

Append to `.gitignore`:

```
# Rust build output, and the database a local run writes
target/
.data/
```

- [ ] **Step 2: Write the failing tests**

`server/src/config.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn defaults_work_from_the_repo_root() {
        let c = Config::from_lookup(|_| None);
        assert_eq!(c.port, 8080);
        assert_eq!(c.data_dir, PathBuf::from(".data"));
        assert_eq!(c.content_dir, PathBuf::from("content"));
        assert_eq!(c.client_dir, PathBuf::from("client/dist"));
        assert_eq!(c.readme_path, PathBuf::from("README.md"));
    }

    #[test]
    fn the_environment_overrides_the_defaults() {
        let c = Config::from_lookup(|k| match k {
            "PORT" => Some("9000".into()),
            "DATA_DIR" => Some("/data".into()),
            _ => None,
        });
        assert_eq!(c.port, 9000);
        assert_eq!(c.data_dir, PathBuf::from("/data"));
    }

    #[test]
    fn the_build_id_is_dev_without_a_client_build() {
        let c = Config::from_lookup(|k| (k == "CLIENT_DIR").then(|| "/nowhere".into()));
        assert_eq!(c.build_id(), "dev");
    }
}
```

`server/src/time.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> u64 {
        chrono::Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap().timestamp_millis() as u64
    }

    #[test]
    fn canberra_days_follow_daylight_saving() {
        // 13:48 UTC on 6 October is 00:48 on 7 October in Canberra (AEDT, UTC+11).
        assert_eq!(canberra_day(utc(2026, 10, 6, 13, 48)), "2026-10-07");
        assert_eq!(canberra_minute_of_day(utc(2026, 10, 6, 13, 48)), 48);
        // Midnight UTC on 1 July is 10:00 in Canberra (AEST, UTC+10).
        assert_eq!(canberra_minute_of_day(utc(2026, 7, 1, 0, 0)), 600);
    }

    #[test]
    fn now_is_after_the_project_began() {
        assert!(now_ms() > utc(2026, 10, 1, 0, 0));
    }
}
```

`server/src/readme.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn headings_become_html_headings() {
        let page = render_page("# The cat café\n\n## Why\n\nBecause cats.");
        assert!(page.contains("<h1>The cat café</h1>"));
        assert!(page.contains("<h2>Why</h2>"));
        assert!(page.contains("<p>Because cats.</p>"));
    }

    #[test]
    fn the_page_links_back_to_the_cafe() {
        assert!(render_page("# x").contains("href=\"/\""));
    }
}
```

`server/src/http.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    fn app(dir: &std::path::Path) -> Router {
        let config = Config::from_lookup(|k| match k {
            "CLIENT_DIR" => Some(dir.join("no-client-yet").display().to_string()),
            "DOCS_DIR" => Some(dir.display().to_string()),
            _ => None,
        });
        router(AppState::new(config, crate::readme::render_page("# Hello\n\n## Second")))
    }

    async fn get(app: Router, path: &str) -> (StatusCode, String) {
        let res = app.oneshot(Request::get(path).body(Body::empty()).unwrap()).await.unwrap();
        let status = res.status();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, String::from_utf8_lossy(&bytes).into_owned())
    }

    #[tokio::test]
    async fn the_root_answers_before_the_client_is_built() {
        let dir = tempfile::tempdir().unwrap();
        let (status, body) = get(app(dir.path()), "/").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("href=\"/readme/\""));
    }

    #[tokio::test]
    async fn the_readme_is_served_with_its_headings() {
        let dir = tempfile::tempdir().unwrap();
        let (status, body) = get(app(dir.path()), "/readme/").await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("<h1>Hello</h1>") && body.contains("<h2>Second</h2>"));
    }

    #[tokio::test]
    async fn readme_images_are_served_but_nothing_else() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("before.png"), b"png-bytes").unwrap();
        std::fs::write(dir.path().join("notes.md"), b"# private-ish").unwrap();
        let (status, body) = get(app(dir.path()), "/readme/docs/before.png").await;
        assert_eq!((status, body.as_str()), (StatusCode::OK, "png-bytes"));
        assert_eq!(get(app(dir.path()), "/readme/docs/notes.md").await.0, StatusCode::NOT_FOUND);
        assert_eq!(get(app(dir.path()), "/readme/docs/../Cargo.toml").await.0, StatusCode::NOT_FOUND);
    }
}
```

`server/src/main.rs`:

```rust
//! The cat café server: one binary that serves the client, the README, the
//! accounts API and the WebSocket, and owns the café's world.
mod config;
mod http;
mod readme;
mod time;

fn main() {}
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cargo test -p cafe`
Expected: compile errors, `cannot find type Config` / `cannot find function canberra_day` / `render_page` / `router`.

- [ ] **Step 4: Write the implementation**

Above the tests in `server/src/config.rs`:

```rust
//! Where things are, from the environment, with defaults that work from the
//! repo root for a local run. The Dockerfile sets the container's paths.
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub data_dir: PathBuf,
    pub content_dir: PathBuf,
    pub client_dir: PathBuf,
    pub readme_path: PathBuf,
    pub docs_dir: PathBuf,
}

impl Config {
    pub fn from_env() -> Config {
        Config::from_lookup(|key| std::env::var(key).ok())
    }

    pub fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Config {
        let path = |key: &str, default: &str| PathBuf::from(get(key).unwrap_or_else(|| default.to_string()));
        Config {
            port: get("PORT").and_then(|p| p.parse().ok()).unwrap_or(8080),
            data_dir: path("DATA_DIR", ".data"),
            content_dir: path("CONTENT_DIR", "content"),
            client_dir: path("CLIENT_DIR", "client/dist"),
            readme_path: path("README_PATH", "README.md"),
            docs_dir: path("DOCS_DIR", "docs"),
        }
    }

    /// The id Vite stamps on the client build, next to index.html. A tab whose
    /// client differs from the server's reloads.
    pub fn build_id(&self) -> String {
        std::fs::read_to_string(self.client_dir.join("build-id.txt"))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "dev".to_string())
    }
}
```

Above the tests in `server/src/time.rs`:

```rust
//! Wall-clock helpers. The café keeps Canberra time, which is the
//! Australia/Sydney zone, daylight saving included.
use chrono::{DateTime, TimeZone, Timelike, Utc};
use chrono_tz::Australia::Sydney;
use chrono_tz::Tz;

/// Milliseconds since the Unix epoch.
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn canberra(ms: u64) -> DateTime<Tz> {
    Utc.timestamp_millis_opt(ms as i64).single().unwrap_or_default().with_timezone(&Sydney)
}

/// The Canberra calendar day of an instant, as `YYYY-MM-DD`.
pub fn canberra_day(ms: u64) -> String {
    canberra(ms).format("%Y-%m-%d").to_string()
}

/// Minutes since midnight, Canberra time.
pub fn canberra_minute_of_day(ms: u64) -> u32 {
    let t = canberra(ms);
    t.hour() * 60 + t.minute()
}
```

Above the tests in `server/src/readme.rs`:

```rust
//! /readme/ serves README.md rendered to HTML when the server starts, so its
//! headings are in the HTML the server sends, which the shipped check reads.
use pulldown_cmark::{Options, Parser, html};

pub fn render_page(markdown: &str) -> String {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_SMART_PUNCTUATION;
    let mut body = String::new();
    html::push_html(&mut body, Parser::new_ext(markdown, options));
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>About the cat café</title>
<style>{STYLE}</style>
</head>
<body>
<nav><a href="/">← Back to the café</a></nav>
<main>
{body}</main>
</body>
</html>
"#
    )
}

const STYLE: &str = "\
:root { color-scheme: light dark; --ink: #2b2230; --paper: #fbf6ee; --accent: #b4572d; }
@media (prefers-color-scheme: dark) { :root { --ink: #efe6dc; --paper: #1f1a22; --accent: #e8955c; } }
body { margin: 0; background: var(--paper); color: var(--ink); font: 17px/1.6 Georgia, 'Iowan Old Style', serif; }
nav, main { max-width: 42rem; margin: 0 auto; padding: 1rem; }
a { color: var(--accent); }
img { max-width: 100%; }
pre { overflow-x: auto; }";
```

Above the tests in `server/src/http.rs`:

```rust
//! Routes: the client, /readme/, and (from later tasks) the API and the
//! WebSocket.
use crate::config::Config;
use axum::Router;
use axum::extract::{Path, State};
use axum::http::{StatusCode, header};
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::routing::get;
use std::sync::Arc;
use tower_http::services::ServeDir;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub readme: Arc<str>,
}

impl AppState {
    pub fn new(config: Config, readme: String) -> AppState {
        AppState { config: Arc::new(config), readme: readme.into() }
    }
}

pub fn router(state: AppState) -> Router {
    let assets = ServeDir::new(state.config.client_dir.clone());
    Router::new()
        .route("/", get(index))
        .route("/readme", get(|| async { Redirect::permanent("/readme/") }))
        .route("/readme/", get(readme_page))
        .route("/readme/docs/{*path}", get(readme_asset))
        .fallback_service(assets)
        .with_state(state)
}

/// The client's page; until the client is built, a holding page that still
/// answers 200 and links to the README.
async fn index(State(state): State<AppState>) -> Response {
    match tokio::fs::read_to_string(state.config.client_dir.join("index.html")).await {
        Ok(html) => ([(header::CACHE_CONTROL, "no-cache")], Html(html)).into_response(),
        Err(_) => Html(HOLDING_PAGE).into_response(),
    }
}

const HOLDING_PAGE: &str = r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>The cat café</title></head>
<body><h1>The cat café</h1><p>The café is being built. <a href="/readme/">What is this place?</a></p></body></html>
"#;

async fn readme_page(State(state): State<AppState>) -> Html<String> {
    Html(state.readme.to_string())
}

/// Images the README links relatively (`docs/x.png`) resolve to
/// /readme/docs/x.png; serve those, and nothing else from docs/.
async fn readme_asset(State(state): State<AppState>, Path(path): Path<String>) -> Response {
    let rel = std::path::Path::new(&path);
    let stays_inside = rel.components().all(|c| matches!(c, std::path::Component::Normal(_)));
    let ext = rel.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase);
    let content_type = match ext.as_deref() {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        _ => return StatusCode::NOT_FOUND.into_response(),
    };
    if !stays_inside {
        return StatusCode::NOT_FOUND.into_response();
    }
    match tokio::fs::read(state.config.docs_dir.join(rel)).await {
        Ok(bytes) => ([(header::CONTENT_TYPE, content_type)], bytes).into_response(),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}
```

Replace `server/src/main.rs`:

```rust
//! The cat café server: one binary that serves the client, the README, the
//! accounts API and the WebSocket, and owns the café's world.
mod config;
mod http;
mod readme;
mod time;

use std::net::SocketAddr;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().json().flatten_event(true).init();
    let config = config::Config::from_env();
    let readme = readme::render_page(&std::fs::read_to_string(&config.readme_path).unwrap_or_default());
    let port = config.port;
    let state = http::AppState::new(config, readme);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(target: "sys", port, "listening");
    axum::serve(listener, http::router(state).into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Fly stops a machine with SIGINT; SIGTERM is the fallback.
async fn shutdown_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut s) => {
                s.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    tokio::select! {
        _ = interrupt => {}
        _ = terminate => {}
    }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cargo test -p cafe`
Expected: PASS, 10 tests (config 3, time 2, readme 2, http 3).

- [ ] **Step 6: Run the course's shipped checks against the server**

Run: `cargo run -p cafe` in one terminal, then `pnpm test` in another.
Expected: both tests in `spec/invariants.test.ts` pass (`/` answers 200, `/readme/` carries the README's headings).

- [ ] **Step 7: Commit**

```bash
git add Cargo.toml Cargo.lock server .gitignore
git commit -m "Start the server: /readme/ rendered at startup, static files"
git push origin HEAD:main
```

---

### Task 2: Protocol types and generated TypeScript

Every message the client and server exchange, defined once in Rust. ts-rs
writes the TypeScript when `cargo test` runs, and a script fails if the
committed TypeScript has drifted from the Rust.

**Files:**
- Create: `.cargo/config.toml`, `server/src/protocol.rs`, `scripts/check-protocol.sh`, `client/src/protocol/*.ts` (generated)
- Modify: `server/src/main.rs` (add `mod protocol;`)

**Interfaces:**
- Produces, all in `crate::protocol`: `Tile { x: u8, y: u8 }`; `Walk { path: Vec<Tile>, start: u64, speed: f32 }`; `Look { avatar: u8, colour: u8 }`; `Place { Inside, Window }`; `PersonView { id: u32, name, look, place, at: Tile, walk: Option<Walk> }`; `Pose { Idle, Walk, Nap, Sit, Hide }` (default `Idle`); `Reaction { LookUp { at }, Sniff { by }, Purr { by }, Tolerate { by }, Refuse { by }, Greet { to } }` (all `u32`); `CatView { id: String, name, coat, at, pose, walk }`; `TrustLevel { Stranger, Familiar, Friend, Devoted }`; `TrustView { cat: String, value: f32, level }`; `FurnitureView { id: u32, kind: String, x, y, w, h: u8 }`; `RoomView { width, height: u8, tiles: Vec<String>, door: Tile, furniture }`; `Snapshot { room, people, cats, your_trust }`; `ErrorCode { Empty, TooLong, RateLimited, NotFromWindow, UnknownCat, UnknownPerson, BadTile, MovedAway }`; `ClientMsg { WalkTo { tile }, Say { text, to: Option<u32> }, Pet { cat }, Call { cat }, Leave {} }`; `ServerMsg { Welcome { you, build, now, cap: u32, snapshot }, Replaced {}, PersonJoined { person }, PersonLeft { id }, PersonPlaced { id, place, at, walk }, PersonMoved { id, walk }, CatMoved { cat, walk }, CatPosed { cat, pose, at }, CatReacted { cat, reaction }, Said { from, text, to, ttl_ms: u32 }, YourTrust { trust }, Error { code, detail } }`; `SignUpRequest { name, password, look }`; `LogInRequest { name, password }`; `RecoverRequest { name, code, password }`; `ApiMe { id: u32, name, look, recovery_code: Option<String> }`; `ApiErrorCode { BadInput, NameTaken, BadLogin, BadRecovery, RateLimited, Forbidden, SignedOut, Server }`; `ApiError { error: ApiErrorCode, detail: String }`. On the wire: tags and field names are camelCase (`"type":"walkTo"`, `"ttlMs"`, `"yourTrust"`, `"recoveryCode"`).

- [ ] **Step 1: Point ts-rs at the client**

`.cargo/config.toml`:

```toml
# ts-rs writes the protocol's TypeScript here when `cargo test` runs. 64-bit
# integers become `number`, since JSON numbers aren't `bigint`.
[env]
TS_RS_EXPORT_DIR = { value = "client/src/protocol", relative = true }
TS_RS_LARGE_INT = "number"
```

- [ ] **Step 2: Write the failing tests**

`server/src/protocol.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_messages_read_the_json_the_client_sends() {
        let walk: ClientMsg = serde_json::from_str(r#"{"type":"walkTo","tile":{"x":3,"y":4}}"#).unwrap();
        assert_eq!(walk, ClientMsg::WalkTo { tile: Tile { x: 3, y: 4 } });
        let say: ClientMsg = serde_json::from_str(r#"{"type":"say","text":"hi","to":null}"#).unwrap();
        assert_eq!(say, ClientMsg::Say { text: "hi".into(), to: None });
        let leave: ClientMsg = serde_json::from_str(r#"{"type":"leave"}"#).unwrap();
        assert_eq!(leave, ClientMsg::Leave {});
    }

    #[test]
    fn server_messages_use_camel_case_names() {
        let said = ServerMsg::Said { from: 1, text: "hi".into(), to: None, ttl_ms: 3120 };
        assert_eq!(serde_json::to_string(&said).unwrap(), r#"{"type":"said","from":1,"text":"hi","to":null,"ttlMs":3120}"#);
        let posed = ServerMsg::CatPosed { cat: "mochi".into(), pose: Pose::Nap, at: Tile { x: 1, y: 5 } };
        assert_eq!(
            serde_json::to_string(&posed).unwrap(),
            r#"{"type":"catPosed","cat":"mochi","pose":"nap","at":{"x":1,"y":5}}"#
        );
        let reacted = ServerMsg::CatReacted { cat: "tora".into(), reaction: Reaction::Purr { by: 2 } };
        assert_eq!(
            serde_json::to_string(&reacted).unwrap(),
            r#"{"type":"catReacted","cat":"tora","reaction":{"kind":"purr","by":2}}"#
        );
    }

    #[test]
    fn the_snapshot_and_me_use_camel_case_fields() {
        let snapshot = Snapshot {
            room: RoomView { width: 1, height: 1, tiles: vec![".".into()], door: Tile { x: 0, y: 0 }, furniture: vec![] },
            people: vec![],
            cats: vec![],
            your_trust: vec![],
        };
        assert!(serde_json::to_string(&snapshot).unwrap().contains(r#""yourTrust":[]"#));
        let me = ApiMe { id: 1, name: "sam".into(), look: Look { avatar: 0, colour: 1 }, recovery_code: Some("X".into()) };
        assert!(serde_json::to_string(&me).unwrap().contains(r#""recoveryCode":"X""#));
    }

    #[test]
    fn me_leaves_out_a_recovery_code_it_does_not_have() {
        let me = ApiMe { id: 1, name: "sam".into(), look: Look { avatar: 0, colour: 1 }, recovery_code: None };
        assert_eq!(serde_json::to_string(&me).unwrap(), r#"{"id":1,"name":"sam","look":{"avatar":0,"colour":1}}"#);
    }
}
```

Add `mod protocol;` to `server/src/main.rs`.

- [ ] **Step 3: Run the tests to see them fail**

Run: `cargo test -p cafe protocol`
Expected: compile errors, `cannot find type ClientMsg in this scope` (and the other types).

- [ ] **Step 4: Write the types**

Above the tests in `server/src/protocol.rs`:

```rust
//! Wire types for the WebSocket (ADR 0004) and the accounts API (ADR 0007).
//! ts-rs writes a TypeScript file for each into client/src/protocol when
//! `cargo test` runs; those files are never edited by hand (AGENTS.md).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A tile of the café floor; (0, 0) is the top-left, on the street wall.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Tile {
    pub x: u8,
    pub y: u8,
}

/// A walk, sent once and animated by every client: the path's tiles in order,
/// when it started (server milliseconds) and tiles per second.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Walk {
    pub path: Vec<Tile>,
    pub start: u64,
    pub speed: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Look {
    pub avatar: u8,
    pub colour: u8,
}

/// Inside the café, or waiting at the window (ADR 0008).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Place {
    Inside,
    Window,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PersonView {
    pub id: u32,
    pub name: String,
    pub look: Look,
    pub place: Place,
    pub at: Tile,
    pub walk: Option<Walk>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Pose {
    #[default]
    Idle,
    Walk,
    Nap,
    Sit,
    Hide,
}

/// A moment a cat shows over its head.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Reaction {
    LookUp { at: u32 },
    Sniff { by: u32 },
    Purr { by: u32 },
    Tolerate { by: u32 },
    Refuse { by: u32 },
    Greet { to: u32 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CatView {
    pub id: String,
    pub name: String,
    pub coat: String,
    pub at: Tile,
    pub pose: Pose,
    pub walk: Option<Walk>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TrustLevel {
    Stranger,
    Familiar,
    Friend,
    Devoted,
}

/// One cat's trust in you, 0 to 100, sent only to you.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TrustView {
    pub cat: String,
    pub value: f32,
    pub level: TrustLevel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FurnitureView {
    pub id: u32,
    pub kind: String,
    pub x: u8,
    pub y: u8,
    pub w: u8,
    pub h: u8,
}

/// The floor plan: `tiles` holds one string per row (W wall, G window, D door,
/// C chalkboard, . floor).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RoomView {
    pub width: u8,
    pub height: u8,
    pub tiles: Vec<String>,
    pub door: Tile,
    pub furniture: Vec<FurnitureView>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Snapshot {
    pub room: RoomView,
    pub people: Vec<PersonView>,
    pub cats: Vec<CatView>,
    pub your_trust: Vec<TrustView>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ErrorCode {
    Empty,
    TooLong,
    RateLimited,
    NotFromWindow,
    UnknownCat,
    UnknownPerson,
    BadTile,
    MovedAway,
}

/// What a client asks for. The server decides what happens (AGENTS.md).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
#[ts(export)]
pub enum ClientMsg {
    WalkTo { tile: Tile },
    Say { text: String, to: Option<u32> },
    Pet { cat: String },
    Call { cat: String },
    Leave {},
}

/// What the server tells clients: a snapshot on joining, then events in order.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
#[ts(export)]
pub enum ServerMsg {
    Welcome { you: u32, build: String, now: u64, cap: u32, snapshot: Snapshot },
    Replaced {},
    PersonJoined { person: PersonView },
    PersonLeft { id: u32 },
    PersonPlaced { id: u32, place: Place, at: Tile, walk: Option<Walk> },
    PersonMoved { id: u32, walk: Walk },
    CatMoved { cat: String, walk: Walk },
    CatPosed { cat: String, pose: Pose, at: Tile },
    CatReacted { cat: String, reaction: Reaction },
    Said { from: u32, text: String, to: Option<u32>, ttl_ms: u32 },
    YourTrust { trust: TrustView },
    Error { code: ErrorCode, detail: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SignUpRequest {
    pub name: String,
    pub password: String,
    pub look: Look,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LogInRequest {
    pub name: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RecoverRequest {
    pub name: String,
    pub code: String,
    pub password: String,
}

/// Who you are. The recovery code is present only when it has just been
/// made, at sign-up or recovery, and is never shown again.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ApiMe {
    pub id: u32,
    pub name: String,
    pub look: Look,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    #[ts(optional)]
    pub recovery_code: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ApiErrorCode {
    BadInput,
    NameTaken,
    BadLogin,
    BadRecovery,
    RateLimited,
    Forbidden,
    SignedOut,
    Server,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ApiError {
    pub error: ApiErrorCode,
    pub detail: String,
}
```

- [ ] **Step 5: Run the tests to see them pass, which also writes the TypeScript**

Run: `cargo test -p cafe protocol && ls client/src/protocol`
Expected: PASS, 4 tests, plus the generated export tests; `client/src/protocol` holds `ApiError.ts ApiErrorCode.ts ApiMe.ts CatView.ts ClientMsg.ts ErrorCode.ts FurnitureView.ts LogInRequest.ts Look.ts PersonView.ts Place.ts Pose.ts Reaction.ts RecoverRequest.ts RoomView.ts ServerMsg.ts SignUpRequest.ts Snapshot.ts Tile.ts TrustLevel.ts TrustView.ts Walk.ts`. `ClientMsg.ts` reads:

```ts
export type ClientMsg = { "type": "walkTo", tile: Tile, } | { "type": "say", text: string, to: number | null, } | { "type": "pet", cat: string, } | { "type": "call", cat: string, } | { "type": "leave", };
```

and `Walk.ts` has `start: number` (not `bigint`).

- [ ] **Step 6: Write the drift check**

`scripts/check-protocol.sh`:

```bash
#!/usr/bin/env bash
# Regenerates the TypeScript protocol types from the Rust types and fails if
# they differ from what's committed: client/src/protocol is never edited by
# hand (AGENTS.md).
set -euo pipefail
cargo test --quiet -p cafe export_bindings > /dev/null
git diff --exit-code -- client/src/protocol
untracked=$(git ls-files --others --exclude-standard client/src/protocol)
if [ -n "$untracked" ]; then
  echo "generated but not committed: $untracked" >&2
  exit 1
fi
```

Run: `chmod +x scripts/check-protocol.sh && git add client/src/protocol && scripts/check-protocol.sh && echo clean`
Expected: `clean`.

- [ ] **Step 7: Commit**

```bash
git add .cargo/config.toml server/src/protocol.rs server/src/main.rs client/src/protocol scripts/check-protocol.sh
git commit -m "Define the wire protocol in Rust and generate its TypeScript"
git push origin HEAD:main
```

---

### Task 3: Tuning, content and the room

The numbers, the floor plan and the furniture, as data in `content/`, loaded
and checked when the server starts: a file that doesn't make sense stops the
server rather than serving a broken café. The room knows who can stand where
and finds paths.

**Files:**
- Create: `content/tuning.toml`, `content/furniture.toml`, `content/room.toml`, `server/src/tuning.rs`, `server/src/room.rs`, `server/src/content.rs`
- Modify: `server/src/main.rs` (add `mod content; mod room; mod tuning;`), `docs/design.md` (the per-IP attempt limit, Review Focus 1)

**Interfaces:**
- Consumes: `protocol::{Tile, FurnitureView, RoomView}`.
- Produces: `tuning::Tuning` (fields as in `content/tuning.toml`) with `Tuning::load(&Path)` and `bubble_ttl_ms(&self, chars: usize) -> u32`; `room::{Room, Walker, Ground, FurnitureKind, FurnitureFile, RoomFile, PieceFile, Piece, manhattan, chebyshev}`; `Room { width, height, door, entry, walkway, pieces }` with `build(&RoomFile, &HashMap<String, FurnitureKind>)`, `ground(Tile) -> Ground`, `in_bounds`, `piece_at(Tile) -> Option<&Piece>`, `walkable(Tile, Walker) -> bool`, `path(from, to, Walker) -> Option<Vec<Tile>>` (both ends included), `around(Tile, Walker) -> Vec<Tile>` (the 8 neighbours someone can stand on), `spots(impl Fn(&FurnitureKind) -> bool) -> Vec<Tile>`, `floor(Walker) -> Vec<Tile>`, `view() -> RoomView`; `content::{Content, load}` with `Content { tuning, room }` (Task 7 adds `cats`), and, in tests, `content::repo_content()`.

- [ ] **Step 1: Write the content files**

`content/tuning.toml`:

```toml
# Every tunable number (docs/design.md, "Numbers to tune"). Changing one
# doesn't reopen its decision, but the design's table changes with it.

cap = 6                       # people inside
grace_secs = 30               # seat kept after a dropped connection

bubble_max_chars = 100
bubble_base_ms = 3000         # a bubble shows for base + per-char, at most max
bubble_per_char_ms = 60
bubble_max_ms = 10000
bubble_burst = 5.0            # bubbles: a burst, then one every refill_secs
bubble_refill_secs = 2.0
action_burst = 10.0           # everything else: 10 a second
action_per_sec = 10.0

trust_levels = [20.0, 50.0, 80.0]   # comes when called; greets you at the door; naps on your lap
trust_daily_cap = 10.0              # per cat, per person, per Canberra day, times the cat's trust rate

person_speed = 3.0            # tiles per second
cat_speed = 2.0

save_every_secs = 5           # the cats' state is saved this often, and on stop
outbound_queue = 256          # unsent messages before a slow connection is dropped
session_days = 30

auth_per_name_per_min = 5.0   # sign-up, log-in and recovery attempts
auth_per_ip_per_min = 60.0    # generous: a whole venue can share one address
```

`content/furniture.toml`:

```toml
# What each kind of furniture is. w and h are in tiles. People can't walk
# through a piece that blocks; cats walk and jump over everything. nap, hide
# and perch mark where cats like to do those things.

[kinds.cat_tower]
w = 2
h = 2
blocks = true
nap = true
hide = true

[kinds.window_seat]
w = 2
h = 1
blocks = true
nap = true
perch = true

[kinds.sofa]
w = 3
h = 1
blocks = true
nap = true

[kinds.rug]
w = 4
h = 3

[kinds.table]
w = 2
h = 1
blocks = true

[kinds.chair]
w = 1
h = 1
blocks = true

[kinds.cat_bed]
w = 1
h = 1
blocks = true
nap = true

[kinds.box]
w = 1
h = 1
blocks = true
nap = true
hide = true

[kinds.plant]
w = 1
h = 1
blocks = true

[kinds.bowls]
w = 2
h = 1
blocks = true

[kinds.toys]
w = 1
h = 1
blocks = true
```

`content/room.toml` (the floor plan approved in `docs/notes/mockups/client-layouts.html`):

```toml
# The café floor, seen from inside with the street wall at the top.
# W wall, G window, D door, C chalkboard, . floor
width = 12
height = 10
tiles = [
  "WWGGGGWDCWWW",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
]
entry = { x = 7, y = 1 }                                    # the floor just inside the door
walkway = [{ x = 7, y = 1 }, { x = 7, y = 2 }, { x = 7, y = 3 }]   # never blocked (AGENTS.md)

[[furniture]]
kind = "cat_tower"
x = 0
y = 1

[[furniture]]
kind = "window_seat"
x = 2
y = 1

[[furniture]]
kind = "plant"
x = 11
y = 1

[[furniture]]
kind = "table"
x = 9
y = 3

[[furniture]]
kind = "chair"
x = 9
y = 4

[[furniture]]
kind = "chair"
x = 10
y = 4

[[furniture]]
kind = "rug"
x = 4
y = 4

[[furniture]]
kind = "sofa"
x = 0
y = 5

[[furniture]]
kind = "cat_bed"
x = 0
y = 7

[[furniture]]
kind = "toys"
x = 7
y = 8

[[furniture]]
kind = "box"
x = 1
y = 9

[[furniture]]
kind = "plant"
x = 6
y = 9

[[furniture]]
kind = "bowls"
x = 10
y = 9
```

In `docs/design.md`'s "Numbers to tune" table, change the attempts row to:

```markdown
| Sign-up, log-in and recovery attempts | 5 a minute per name; 60 a minute per IP address, since a whole venue can share one |
```

- [ ] **Step 2: Write the failing tests**

`server/src/tuning.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn repo() -> Tuning {
        Tuning::load(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/tuning.toml")).unwrap()
    }

    #[test]
    fn the_numbers_match_the_design() {
        let t = repo();
        assert_eq!((t.cap, t.grace_secs, t.bubble_max_chars), (6, 30, 100));
        assert_eq!(t.trust_levels, [20.0, 50.0, 80.0]);
        assert_eq!((t.auth_per_name_per_min, t.auth_per_ip_per_min), (5.0, 60.0));
    }

    #[test]
    fn a_bubble_stays_up_longer_for_a_longer_message() {
        let t = repo();
        assert_eq!(t.bubble_ttl_ms(0), 3000);
        assert_eq!(t.bubble_ttl_ms(5), 3300);
        assert_eq!(t.bubble_ttl_ms(100), 9000);
        assert_eq!(t.bubble_ttl_ms(1000), 10_000);
    }

    #[test]
    fn a_misspelt_number_stops_the_server() {
        let text = std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/tuning.toml")).unwrap();
        assert!(toml::from_str::<Tuning>(&text.replace("grace_secs", "grace_sec")).is_err());
    }
}
```

`server/src/room.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn room() -> Room {
        crate::content::repo_content().room
    }

    fn t(x: u8, y: u8) -> Tile {
        Tile { x, y }
    }

    #[test]
    fn the_door_and_entry_come_from_the_floor_plan() {
        let r = room();
        assert_eq!((r.door, r.entry), (t(7, 0), t(7, 1)));
        assert_eq!(r.ground(t(3, 0)), Ground::Window);
        assert_eq!(r.ground(t(8, 0)), Ground::Board);
    }

    #[test]
    fn walls_and_windows_are_never_walkable() {
        let r = room();
        for who in [Walker::Person, Walker::Cat] {
            assert!(!r.walkable(t(0, 0), who));
            assert!(!r.walkable(t(3, 0), who));
            assert!(r.walkable(r.door, who));
        }
    }

    #[test]
    fn people_walk_around_furniture_that_blocks() {
        let r = room();
        let path = r.path(r.entry, t(1, 8), Walker::Person).expect("a path");
        assert_eq!((path[0], *path.last().unwrap()), (r.entry, t(1, 8)));
        assert!(path.iter().all(|&s| r.walkable(s, Walker::Person)));
        assert!(path.windows(2).all(|w| manhattan(w[0], w[1]) == 1));
    }

    #[test]
    fn cats_reach_the_sofa_but_people_cannot_stand_on_it() {
        let r = room();
        assert!(r.path(r.entry, t(1, 5), Walker::Cat).is_some());
        assert!(r.path(r.entry, t(1, 5), Walker::Person).is_none());
        assert!(r.path(r.entry, t(5, 5), Walker::Person).is_some(), "the rug doesn't block");
    }

    #[test]
    fn every_tile_a_person_can_stand_on_is_reachable_from_the_entry() {
        let r = room();
        for tile in r.floor(Walker::Person) {
            assert!(r.path(r.entry, tile, Walker::Person).is_some(), "({}, {}) is cut off", tile.x, tile.y);
        }
    }

    #[test]
    fn nap_and_hide_spots_come_from_the_furniture() {
        let r = room();
        assert!(r.spots(|k| k.hide).contains(&t(1, 9)), "the box");
        assert!(r.spots(|k| k.nap).contains(&t(0, 5)), "the sofa");
    }

    #[test]
    fn around_lists_only_tiles_you_can_stand_on() {
        let r = room();
        let near_sofa = r.around(t(1, 5), Walker::Person);
        assert!(!near_sofa.is_empty());
        assert!(near_sofa.iter().all(|&n| r.walkable(n, Walker::Person) && chebyshev(n, t(1, 5)) == 1));
    }

    #[test]
    fn furniture_on_the_walkway_is_refused() {
        let file = RoomFile {
            width: 3,
            height: 3,
            tiles: vec!["WDW".into(), "...".into(), "...".into()],
            entry: t(1, 1),
            walkway: vec![t(1, 1), t(1, 2)],
            furniture: vec![PieceFile { kind: "box".into(), x: 1, y: 2 }],
        };
        let kinds = HashMap::from([(
            "box".to_string(),
            FurnitureKind { w: 1, h: 1, blocks: true, nap: false, hide: false, perch: false },
        )]);
        let err = Room::build(&file, &kinds).unwrap_err().to_string();
        assert!(err.contains("walkway"), "{err}");
    }

    #[test]
    fn the_view_lists_every_piece() {
        let r = room();
        let v = r.view();
        assert_eq!(v.furniture.len(), r.pieces.len());
        assert_eq!(v.tiles[0], "WWGGGGWDCWWW");
    }
}
```

`server/src/content.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_repo_content_loads() {
        let c = repo_content();
        assert_eq!(c.tuning.cap, 6);
        assert_eq!(c.room.pieces.len(), 13);
    }

    #[test]
    fn a_missing_file_names_itself() {
        let dir = tempfile::tempdir().unwrap();
        let err = load(dir.path()).err().expect("an error").to_string();
        assert!(err.contains("tuning.toml"), "{err}");
    }
}
```

Add `mod content; mod room; mod tuning;` to `server/src/main.rs`.

- [ ] **Step 3: Run the tests to see them fail**

Run: `cargo test -p cafe -- tuning room content`
Expected: compile errors, `cannot find type Tuning` / `Room` / `function load`.

- [ ] **Step 4: Write the implementation**

Above the tests in `server/src/tuning.rs`:

```rust
//! Every tunable number, from content/tuning.toml. design.md's "Numbers to
//! tune" lists the same values; change both together.
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Tuning {
    pub cap: usize,
    pub grace_secs: u64,
    pub bubble_max_chars: usize,
    pub bubble_base_ms: u32,
    pub bubble_per_char_ms: u32,
    pub bubble_max_ms: u32,
    pub bubble_burst: f64,
    pub bubble_refill_secs: f64,
    pub action_burst: f64,
    pub action_per_sec: f64,
    pub trust_levels: [f32; 3],
    pub trust_daily_cap: f32,
    pub person_speed: f32,
    pub cat_speed: f32,
    pub save_every_secs: u64,
    pub outbound_queue: usize,
    pub session_days: u64,
    pub auth_per_name_per_min: f64,
    pub auth_per_ip_per_min: f64,
}

impl Tuning {
    pub fn load(path: &Path) -> anyhow::Result<Tuning> {
        let text = std::fs::read_to_string(path)?;
        Ok(toml::from_str(&text)?)
    }

    /// How long a bubble of `chars` characters stays up.
    pub fn bubble_ttl_ms(&self, chars: usize) -> u32 {
        (self.bubble_base_ms + self.bubble_per_char_ms * chars as u32).min(self.bubble_max_ms)
    }
}
```

Above the tests in `server/src/room.rs`:

```rust
//! The café floor (design.md, "The room"): ground tiles, furniture, who can
//! stand where, and shortest paths. People can't walk through furniture that
//! blocks; cats walk and jump over all of it; nobody walks through a wall.
use crate::protocol::{FurnitureView, RoomView, Tile};
use serde::Deserialize;
use std::collections::{HashMap, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ground {
    Floor,
    Wall,
    Window,
    Door,
    Board,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FurnitureKind {
    pub w: u8,
    pub h: u8,
    #[serde(default)]
    pub blocks: bool,
    #[serde(default)]
    pub nap: bool,
    #[serde(default)]
    pub hide: bool,
    #[serde(default)]
    pub perch: bool,
}

#[derive(Debug, Deserialize)]
pub struct FurnitureFile {
    pub kinds: HashMap<String, FurnitureKind>,
}

#[derive(Debug, Deserialize)]
pub struct RoomFile {
    pub width: u8,
    pub height: u8,
    pub tiles: Vec<String>,
    pub entry: Tile,
    pub walkway: Vec<Tile>,
    #[serde(default)]
    pub furniture: Vec<PieceFile>,
}

#[derive(Debug, Deserialize)]
pub struct PieceFile {
    pub kind: String,
    pub x: u8,
    pub y: u8,
}

#[derive(Debug, Clone)]
pub struct Piece {
    pub id: u32,
    pub kind: String,
    pub x: u8,
    pub y: u8,
    pub spec: FurnitureKind,
}

impl Piece {
    pub fn covers(&self, t: Tile) -> bool {
        t.x >= self.x && t.x < self.x + self.spec.w && t.y >= self.y && t.y < self.y + self.spec.h
    }

    pub fn tiles(&self) -> Vec<Tile> {
        (self.y..self.y + self.spec.h)
            .flat_map(|y| (self.x..self.x + self.spec.w).map(move |x| Tile { x, y }))
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Walker {
    Person,
    Cat,
}

#[derive(Debug, Clone)]
pub struct Room {
    pub width: u8,
    pub height: u8,
    rows: Vec<String>,
    ground: Vec<Ground>,
    pub door: Tile,
    pub entry: Tile,
    pub walkway: Vec<Tile>,
    pub pieces: Vec<Piece>,
}

impl Room {
    pub fn build(file: &RoomFile, kinds: &HashMap<String, FurnitureKind>) -> anyhow::Result<Room> {
        anyhow::ensure!(
            file.tiles.len() == file.height as usize,
            "room.toml: {} rows of tiles for a height of {}",
            file.tiles.len(),
            file.height
        );
        let mut ground = Vec::with_capacity(file.width as usize * file.height as usize);
        let mut door = None;
        for (y, row) in file.tiles.iter().enumerate() {
            anyhow::ensure!(row.chars().count() == file.width as usize, "room.toml: row {y} isn't {} tiles wide", file.width);
            for (x, c) in row.chars().enumerate() {
                let g = match c {
                    '.' => Ground::Floor,
                    'W' => Ground::Wall,
                    'G' => Ground::Window,
                    'D' => Ground::Door,
                    'C' => Ground::Board,
                    other => anyhow::bail!("room.toml: unknown tile {other:?} at ({x}, {y})"),
                };
                if g == Ground::Door {
                    anyhow::ensure!(door.is_none(), "room.toml: more than one door");
                    door = Some(Tile { x: x as u8, y: y as u8 });
                }
                ground.push(g);
            }
        }
        let door = door.ok_or_else(|| anyhow::anyhow!("room.toml: no door"))?;
        let mut room = Room {
            width: file.width,
            height: file.height,
            rows: file.tiles.clone(),
            ground,
            door,
            entry: file.entry,
            walkway: file.walkway.clone(),
            pieces: Vec::new(),
        };
        anyhow::ensure!(
            room.ground(room.entry) == Ground::Floor && manhattan(room.entry, door) == 1,
            "room.toml: the entry must be the floor tile just inside the door"
        );
        for &w in &room.walkway {
            anyhow::ensure!(room.ground(w) == Ground::Floor, "room.toml: the walkway must be floor");
        }
        for (i, p) in file.furniture.iter().enumerate() {
            let spec = kinds
                .get(&p.kind)
                .ok_or_else(|| anyhow::anyhow!("room.toml: unknown furniture kind {:?}", p.kind))?
                .clone();
            let piece = Piece { id: i as u32 + 1, kind: p.kind.clone(), x: p.x, y: p.y, spec };
            for t in piece.tiles() {
                anyhow::ensure!(
                    room.in_bounds(t) && room.ground(t) == Ground::Floor,
                    "room.toml: the {} at ({}, {}) leaves the floor",
                    p.kind,
                    p.x,
                    p.y
                );
                anyhow::ensure!(room.piece_at(t).is_none(), "room.toml: the {} at ({}, {}) overlaps another piece", p.kind, p.x, p.y);
                anyhow::ensure!(!room.walkway.contains(&t), "room.toml: the {} at ({}, {}) blocks the door's walkway", p.kind, p.x, p.y);
            }
            room.pieces.push(piece);
        }
        Ok(room)
    }

    pub fn in_bounds(&self, t: Tile) -> bool {
        t.x < self.width && t.y < self.height
    }

    pub fn ground(&self, t: Tile) -> Ground {
        if self.in_bounds(t) {
            self.ground[t.y as usize * self.width as usize + t.x as usize]
        } else {
            Ground::Wall
        }
    }

    pub fn piece_at(&self, t: Tile) -> Option<&Piece> {
        self.pieces.iter().find(|p| p.covers(t))
    }

    pub fn walkable(&self, t: Tile, who: Walker) -> bool {
        match self.ground(t) {
            Ground::Door => true,
            Ground::Floor => who == Walker::Cat || self.piece_at(t).is_none_or(|p| !p.spec.blocks),
            _ => false,
        }
    }

    fn neighbours(&self, t: Tile, diagonals: bool) -> Vec<Tile> {
        let steps: &[(i16, i16)] = if diagonals {
            &[(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
        } else {
            &[(0, -1), (1, 0), (0, 1), (-1, 0)]
        };
        steps
            .iter()
            .map(|(dx, dy)| (t.x as i16 + dx, t.y as i16 + dy))
            .filter(|&(x, y)| x >= 0 && y >= 0)
            .map(|(x, y)| Tile { x: x as u8, y: y as u8 })
            .filter(|&n| self.in_bounds(n))
            .collect()
    }

    /// The shortest four-way path from `from` to `to`, both included.
    pub fn path(&self, from: Tile, to: Tile, who: Walker) -> Option<Vec<Tile>> {
        if !self.walkable(to, who) {
            return None;
        }
        if from == to {
            return Some(vec![from]);
        }
        let mut came: HashMap<Tile, Tile> = HashMap::from([(from, from)]);
        let mut queue = VecDeque::from([from]);
        while let Some(t) = queue.pop_front() {
            for n in self.neighbours(t, false) {
                if came.contains_key(&n) || !self.walkable(n, who) {
                    continue;
                }
                came.insert(n, t);
                if n == to {
                    let mut path = vec![to];
                    let mut cur = to;
                    while cur != from {
                        cur = came[&cur];
                        path.push(cur);
                    }
                    path.reverse();
                    return Some(path);
                }
                queue.push_back(n);
            }
        }
        None
    }

    /// The tiles touching `t`, diagonals included, that `who` can stand on.
    pub fn around(&self, t: Tile, who: Walker) -> Vec<Tile> {
        self.neighbours(t, true)
            .into_iter()
            .filter(|&n| self.ground(n) == Ground::Floor && self.walkable(n, who))
            .collect()
    }

    /// The top-left tile of each piece whose kind passes `keep`.
    pub fn spots(&self, keep: impl Fn(&FurnitureKind) -> bool) -> Vec<Tile> {
        self.pieces.iter().filter(|p| keep(&p.spec)).map(|p| Tile { x: p.x, y: p.y }).collect()
    }

    /// Every floor tile `who` can stand on.
    pub fn floor(&self, who: Walker) -> Vec<Tile> {
        (0..self.height)
            .flat_map(|y| (0..self.width).map(move |x| Tile { x, y }))
            .filter(|&t| self.ground(t) == Ground::Floor && self.walkable(t, who))
            .collect()
    }

    pub fn view(&self) -> RoomView {
        RoomView {
            width: self.width,
            height: self.height,
            tiles: self.rows.clone(),
            door: self.door,
            furniture: self
                .pieces
                .iter()
                .map(|p| FurnitureView { id: p.id, kind: p.kind.clone(), x: p.x, y: p.y, w: p.spec.w, h: p.spec.h })
                .collect(),
        }
    }
}

pub fn manhattan(a: Tile, b: Tile) -> u32 {
    a.x.abs_diff(b.x) as u32 + a.y.abs_diff(b.y) as u32
}

pub fn chebyshev(a: Tile, b: Tile) -> u32 {
    a.x.abs_diff(b.x).max(a.y.abs_diff(b.y)) as u32
}
```

Above the tests in `server/src/content.rs`:

```rust
//! Loads everything in content/: the tuning numbers, the room and its
//! furniture (and, from Task 7, the cats). A file that doesn't parse or
//! doesn't make sense stops the server at startup.
use crate::room::{FurnitureFile, Room, RoomFile};
use crate::tuning::Tuning;
use anyhow::Context;
use serde::de::DeserializeOwned;
use std::path::Path;

pub struct Content {
    pub tuning: Tuning,
    pub room: Room,
}

pub fn load(dir: &Path) -> anyhow::Result<Content> {
    let tuning = Tuning::load(&dir.join("tuning.toml")).context("reading content/tuning.toml")?;
    let kinds: FurnitureFile = read_toml(&dir.join("furniture.toml"))?;
    let room_file: RoomFile = read_toml(&dir.join("room.toml"))?;
    let room = Room::build(&room_file, &kinds.kinds)?;
    Ok(Content { tuning, room })
}

pub fn read_toml<T: DeserializeOwned>(path: &Path) -> anyhow::Result<T> {
    let text = std::fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    toml::from_str(&text).with_context(|| format!("parsing {}", path.display()))
}

#[cfg(test)]
pub fn repo_content() -> Content {
    load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("../content")).expect("the repo's content loads")
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cargo test -p cafe -- tuning room content`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add content server/src docs/design.md
git commit -m "Load the tuning, furniture and floor plan from content/"
git push origin HEAD:main
```

---

### Task 4: The store

All durable state in one SQLite file, owned by one thread (ADR 0005). Async
code awaits a reply with `call`; the world sends writes it doesn't wait for
with `fire`. Jobs that queue up together run in one transaction.

**Files:**
- Create: `server/src/store.rs`
- Modify: `server/src/main.rs` (add `mod store;`)

**Interfaces:**
- Produces: `store::Store` (`Clone`) with `Store::open(&Path) -> anyhow::Result<Store>`, `async call<T>(&self, impl FnOnce(&mut Connection) -> rusqlite::Result<T>) -> anyhow::Result<T>`, `fire(&self, impl FnOnce(&mut Connection) -> rusqlite::Result<()>)`, `async flush(&self)`; rows `UserRow { id: i64, name, password_hash, recovery_hash, avatar: u8, colour: u8 }` and `TrustRow { cat_id: String, user_id: i64, value: f32, day: String, gained_today: f32 }`; queries on `&Connection`: `insert_user(..) -> Option<i64>` (None if the name is taken), `user_by_name`, `user_by_id`, `set_secrets`, `insert_session`, `session_user(hash, now) -> Option<i64>`, `extend_session`, `delete_session`, `delete_sessions_for`, `all_trust`, `put_trust`, `all_cat_states -> Vec<(String, String)>`, `put_cat_state`, `get_world`, `put_world`.

- [ ] **Step 1: Write the failing tests**

`server/src/store.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let mut conn = Connection::open(dir.path().join("t.db")).unwrap();
        migrate(&mut conn).unwrap();
        (dir, conn)
    }

    #[test]
    fn names_are_unique_whatever_their_case() {
        let (_d, c) = db();
        let id = insert_user(&c, "Sam", "ph", "rh", 1, 2, 10).unwrap();
        assert!(id.is_some());
        assert_eq!(insert_user(&c, "sam", "ph", "rh", 0, 0, 11).unwrap(), None);
        let found = user_by_name(&c, "SAM").unwrap().unwrap();
        assert_eq!((found.name.as_str(), found.avatar, found.colour), ("Sam", 1, 2));
        assert_eq!(user_by_id(&c, found.id).unwrap().unwrap().name, "Sam");
    }

    #[test]
    fn secrets_can_be_replaced() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "old-p", "old-r", 0, 0, 1).unwrap().unwrap();
        set_secrets(&c, id, "new-p", "new-r").unwrap();
        let u = user_by_id(&c, id).unwrap().unwrap();
        assert_eq!((u.password_hash.as_str(), u.recovery_hash.as_str()), ("new-p", "new-r"));
    }

    #[test]
    fn sessions_expire_and_can_be_ended() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap().unwrap();
        insert_session(&c, "h1", id, 1000).unwrap();
        assert_eq!(session_user(&c, "h1", 999).unwrap(), Some(id));
        assert_eq!(session_user(&c, "h1", 1000).unwrap(), None);
        extend_session(&c, "h1", 5000).unwrap();
        assert_eq!(session_user(&c, "h1", 1000).unwrap(), Some(id));
        insert_session(&c, "h2", id, 5000).unwrap();
        delete_session(&c, "h1").unwrap();
        assert_eq!(session_user(&c, "h1", 1).unwrap(), None);
        delete_sessions_for(&c, id).unwrap();
        assert_eq!(session_user(&c, "h2", 1).unwrap(), None);
    }

    #[test]
    fn trust_rows_are_replaced_not_duplicated() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap().unwrap();
        let mut row = TrustRow { cat_id: "mochi".into(), user_id: id, value: 2.0, day: "2026-10-07".into(), gained_today: 2.0 };
        put_trust(&c, &row).unwrap();
        row.value = 3.5;
        put_trust(&c, &row).unwrap();
        assert_eq!(all_trust(&c).unwrap(), vec![row]);
    }

    #[test]
    fn cat_states_and_world_values_are_replaced_not_duplicated() {
        let (_d, c) = db();
        put_cat_state(&c, "mochi", "{\"a\":1}", 1).unwrap();
        put_cat_state(&c, "mochi", "{\"a\":2}", 2).unwrap();
        assert_eq!(all_cat_states(&c).unwrap(), vec![("mochi".to_string(), "{\"a\":2}".to_string())]);
        assert_eq!(get_world(&c, "saved_at").unwrap(), None);
        put_world(&c, "saved_at", "1").unwrap();
        put_world(&c, "saved_at", "2").unwrap();
        assert_eq!(get_world(&c, "saved_at").unwrap().as_deref(), Some("2"));
    }

    #[test]
    fn reopening_keeps_the_data_and_the_schema_version() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("t.db");
        {
            let mut c = Connection::open(&path).unwrap();
            migrate(&mut c).unwrap();
            insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap();
        }
        let mut c = Connection::open(&path).unwrap();
        migrate(&mut c).unwrap();
        assert!(user_by_name(&c, "sam").unwrap().is_some());
        let version: i64 = c.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version as usize, MIGRATIONS.len());
    }

    #[tokio::test]
    async fn the_store_thread_runs_writes_in_order_before_a_later_call() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("cafe.db")).unwrap();
        store.fire(|c| put_world(c, "k", "first"));
        store.fire(|c| put_world(c, "k", "second"));
        let value = store.call(|c| get_world(c, "k")).await.unwrap();
        assert_eq!(value.as_deref(), Some("second"));
        store.flush().await.unwrap();
    }
}
```

Add `mod store;` to `server/src/main.rs`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cargo test -p cafe store`
Expected: compile errors, `cannot find function migrate` / `insert_user` / `type Store`.

- [ ] **Step 3: Write the implementation**

Above the tests in `server/src/store.rs`:

```rust
//! All durable state in one SQLite file at /data/cafe.db, owned by one thread
//! (ADR 0005). Async callers wait for a reply with `call`; the world sends
//! writes it doesn't wait for with `fire`. Jobs that queue up together run in
//! one transaction. Nothing said in a bubble is ever written here (AGENTS.md).
use rusqlite::{Connection, OptionalExtension, params};
use std::path::Path;
use std::sync::mpsc;
use tokio::sync::oneshot;

type Job = Box<dyn FnOnce(&mut Connection) + Send>;

#[derive(Clone)]
pub struct Store {
    tx: mpsc::Sender<Job>,
}

/// Numbered migrations; `PRAGMA user_version` records how many have run.
const MIGRATIONS: &[&str] = &[
    "CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        recovery_hash TEXT NOT NULL,
        avatar INTEGER NOT NULL,
        colour INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );
    CREATE TABLE trust (
        cat_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        day TEXT NOT NULL,
        gained_today REAL NOT NULL,
        PRIMARY KEY (cat_id, user_id)
    );
    CREATE TABLE cat_state (
        cat_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        saved_at INTEGER NOT NULL
    );
    CREATE TABLE world (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );",
];

impl Store {
    /// Opens (or creates) the database, runs any new migrations, and starts
    /// the store thread. Fails loudly: a café that can't open its database
    /// mustn't serve an empty one.
    pub fn open(path: &Path) -> anyhow::Result<Store> {
        let mut conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;")?;
        migrate(&mut conn)?;
        let (tx, rx) = mpsc::channel::<Job>();
        std::thread::Builder::new().name("store".into()).spawn(move || run(conn, rx))?;
        Ok(Store { tx })
    }

    pub async fn call<T, F>(&self, f: F) -> anyhow::Result<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> rusqlite::Result<T> + Send + 'static,
    {
        let (reply, answer) = oneshot::channel();
        self.tx
            .send(Box::new(move |conn| {
                let _ = reply.send(f(conn));
            }))
            .map_err(|_| anyhow::anyhow!("the store thread has stopped"))?;
        Ok(answer.await.map_err(|_| anyhow::anyhow!("the store thread dropped a reply"))??)
    }

    pub fn fire<F>(&self, f: F)
    where
        F: FnOnce(&mut Connection) -> rusqlite::Result<()> + Send + 'static,
    {
        let _ = self.tx.send(Box::new(move |conn| {
            if let Err(e) = f(conn) {
                tracing::error!(target: "store", error = %e, "a write failed");
            }
        }));
    }

    /// Waits until every job sent before this call has run.
    pub async fn flush(&self) -> anyhow::Result<()> {
        self.call(|_| Ok(())).await
    }
}

fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let done: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(done as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", i + 1))?;
        tx.commit()?;
    }
    Ok(())
}

fn run(mut conn: Connection, rx: mpsc::Receiver<Job>) {
    while let Ok(first) = rx.recv() {
        let mut jobs = vec![first];
        while let Ok(more) = rx.try_recv() {
            jobs.push(more);
        }
        let batched = jobs.len() > 1 && conn.execute_batch("BEGIN").is_ok();
        for job in jobs {
            job(&mut conn);
        }
        if batched && let Err(e) = conn.execute_batch("COMMIT") {
            tracing::error!(target: "store", error = %e, "a commit failed");
        }
    }
}

#[derive(Debug, Clone)]
pub struct UserRow {
    pub id: i64,
    pub name: String,
    pub password_hash: String,
    pub recovery_hash: String,
    pub avatar: u8,
    pub colour: u8,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrustRow {
    pub cat_id: String,
    pub user_id: i64,
    pub value: f32,
    pub day: String,
    pub gained_today: f32,
}

const USER_COLUMNS: &str = "id, name, password_hash, recovery_hash, avatar, colour";

fn user_from(row: &rusqlite::Row) -> rusqlite::Result<UserRow> {
    Ok(UserRow {
        id: row.get(0)?,
        name: row.get(1)?,
        password_hash: row.get(2)?,
        recovery_hash: row.get(3)?,
        avatar: row.get(4)?,
        colour: row.get(5)?,
    })
}

/// Adds a user, or returns None when the name is taken, whatever its case.
pub fn insert_user(
    conn: &Connection,
    name: &str,
    password_hash: &str,
    recovery_hash: &str,
    avatar: u8,
    colour: u8,
    now: u64,
) -> rusqlite::Result<Option<i64>> {
    let res = conn.execute(
        "INSERT INTO users (name, name_key, password_hash, recovery_hash, avatar, colour, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![name, name.to_lowercase(), password_hash, recovery_hash, avatar, colour, now as i64],
    );
    match res {
        Ok(_) => Ok(Some(conn.last_insert_rowid())),
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == rusqlite::ErrorCode::ConstraintViolation => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn user_by_name(conn: &Connection, name: &str) -> rusqlite::Result<Option<UserRow>> {
    conn.query_row(&format!("SELECT {USER_COLUMNS} FROM users WHERE name_key = ?1"), params![name.to_lowercase()], user_from)
        .optional()
}

pub fn user_by_id(conn: &Connection, id: i64) -> rusqlite::Result<Option<UserRow>> {
    conn.query_row(&format!("SELECT {USER_COLUMNS} FROM users WHERE id = ?1"), params![id], user_from).optional()
}

pub fn set_secrets(conn: &Connection, id: i64, password_hash: &str, recovery_hash: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE users SET password_hash = ?1, recovery_hash = ?2 WHERE id = ?3",
        params![password_hash, recovery_hash, id],
    )?;
    Ok(())
}

pub fn insert_session(conn: &Connection, token_hash: &str, user_id: i64, expires_at: u64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)",
        params![token_hash, user_id, expires_at as i64],
    )?;
    Ok(())
}

pub fn session_user(conn: &Connection, token_hash: &str, now: u64) -> rusqlite::Result<Option<i64>> {
    conn.query_row(
        "SELECT user_id FROM sessions WHERE token_hash = ?1 AND expires_at > ?2",
        params![token_hash, now as i64],
        |r| r.get(0),
    )
    .optional()
}

pub fn extend_session(conn: &Connection, token_hash: &str, expires_at: u64) -> rusqlite::Result<()> {
    conn.execute("UPDATE sessions SET expires_at = ?2 WHERE token_hash = ?1", params![token_hash, expires_at as i64])?;
    Ok(())
}

pub fn delete_session(conn: &Connection, token_hash: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM sessions WHERE token_hash = ?1", params![token_hash])?;
    Ok(())
}

pub fn delete_sessions_for(conn: &Connection, user_id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM sessions WHERE user_id = ?1", params![user_id])?;
    Ok(())
}

pub fn all_trust(conn: &Connection) -> rusqlite::Result<Vec<TrustRow>> {
    let mut stmt = conn.prepare("SELECT cat_id, user_id, value, day, gained_today FROM trust ORDER BY cat_id, user_id")?;
    let rows = stmt.query_map([], |r| {
        Ok(TrustRow { cat_id: r.get(0)?, user_id: r.get(1)?, value: r.get(2)?, day: r.get(3)?, gained_today: r.get(4)? })
    })?;
    rows.collect()
}

pub fn put_trust(conn: &Connection, row: &TrustRow) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO trust (cat_id, user_id, value, day, gained_today) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (cat_id, user_id) DO UPDATE SET value = excluded.value, day = excluded.day, gained_today = excluded.gained_today",
        params![row.cat_id, row.user_id, row.value, row.day, row.gained_today],
    )?;
    Ok(())
}

pub fn all_cat_states(conn: &Connection) -> rusqlite::Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT cat_id, state FROM cat_state ORDER BY cat_id")?;
    let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

pub fn put_cat_state(conn: &Connection, cat_id: &str, state: &str, now: u64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO cat_state (cat_id, state, saved_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (cat_id) DO UPDATE SET state = excluded.state, saved_at = excluded.saved_at",
        params![cat_id, state, now as i64],
    )?;
    Ok(())
}

pub fn get_world(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM world WHERE key = ?1", params![key], |r| r.get(0)).optional()
}

pub fn put_world(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO world (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p cafe store`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/store.rs server/src/main.rs
git commit -m "Keep the café's durable state in SQLite, owned by one thread"
git push origin HEAD:main
```

---

### Task 5: Accounts

Sign up with a name, a password and a look, and see a recovery code once; log
in; log out; recover with the code (ADR 0007). Passwords and codes are hashed
with argon2id at OWASP's minimum, at most two at a time. Attempts are limited
per name and per address, in memory only.

**Files:**
- Create: `server/src/auth.rs`, `server/src/limits.rs`, `server/src/api.rs`, `spec/helpers.ts`, `spec/accounts.test.ts`
- Modify: `server/src/http.rs` (AppState grows; API routes; `origin_ok`; `client_ip`; test helper), `server/src/main.rs` (open the store, load the content, new modules)

**Interfaces:**
- Consumes: `store::*` (Task 4), `tuning::Tuning` (Task 3), `protocol::{ApiMe, ApiError, ApiErrorCode, SignUpRequest, LogInRequest, RecoverRequest, Look}` (Task 2).
- Produces: `auth::{valid_username, valid_password, hash_secret, verify_secret, new_recovery_code, normalise_code, new_session_token, token_hash, session_cookie, cookie_value, SESSION_COOKIE}`; `limits::{Bucket, Keyed}` with `Bucket::new(burst, refill_per_sec, now)`, `Bucket::take(&mut self, now) -> bool`, `Keyed::new(burst, refill_per_sec)`, `Keyed::take(&mut self, key, now) -> bool`; `api::current_user(&AppState, &HeaderMap) -> Result<Option<UserRow>, Failure>` (the WebSocket uses it in Task 10); `http::AppState { config, readme, store, tuning, hashing, auth_limits }` with `AppState::new(config, readme, store, tuning)`; `http::origin_ok(&HeaderMap) -> bool`; `http::client_ip(&HeaderMap, SocketAddr) -> String`.

- [ ] **Step 1: Write the failing Rust tests**

`server/src/auth.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_three_to_twenty_safe_characters() {
        for ok in ["sam", "Sam_99", "a-b-c", "abcdefghijklmnopqrst"] {
            assert!(valid_username(ok), "{ok}");
        }
        for bad in ["sa", "abcdefghijklmnopqrstu", "sam smith", "sam!", "émile", ""] {
            assert!(!valid_username(bad), "{bad}");
        }
    }

    #[test]
    fn passwords_are_eight_to_128_characters() {
        assert!(!valid_password("1234567"));
        assert!(valid_password("12345678"));
        assert!(valid_password(&"x".repeat(128)));
        assert!(!valid_password(&"x".repeat(129)));
        assert!(valid_password("éééééééé"), "counted in characters, not bytes");
    }

    #[test]
    fn a_hashed_secret_verifies_only_itself() {
        let hash = hash_secret("correct horse");
        assert!(hash.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"));
        assert!(verify_secret("correct horse", &hash));
        assert!(!verify_secret("wrong horse", &hash));
        assert!(!verify_secret("correct horse", "not a hash"));
    }

    #[test]
    fn recovery_codes_are_four_groups_of_four_unambiguous_characters() {
        let code = new_recovery_code();
        let groups: Vec<&str> = code.split('-').collect();
        assert_eq!(groups.len(), 4);
        assert!(groups.iter().all(|g| g.len() == 4 && g.bytes().all(|b| CODE_ALPHABET.contains(&b))));
        assert_ne!(code, new_recovery_code());
    }

    #[test]
    fn typed_codes_fold_back_to_the_canonical_form() {
        assert_eq!(normalise_code("k7qf-2m9d xr4t-8hwc"), "K7QF2M9DXR4T8HWC");
        assert_eq!(normalise_code("O0Il"), "0011");
    }

    #[test]
    fn session_tokens_are_long_and_kept_only_as_hashes() {
        let token = new_session_token();
        assert_eq!(token.len(), 43);
        let hash = token_hash(&token);
        assert_eq!(hash.len(), 64);
        assert!(hash.bytes().all(|b| b.is_ascii_hexdigit()));
        assert_eq!(hash, token_hash(&token));
    }

    #[test]
    fn the_session_cookie_is_http_only_secure_and_lax() {
        let c = session_cookie("abc", 60);
        for part in ["session=abc", "HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=60"] {
            assert!(c.contains(part), "{c} lacks {part}");
        }
    }

    #[test]
    fn cookies_are_found_by_exact_name() {
        assert_eq!(cookie_value("a=1; session=xyz; b=2", "session"), Some("xyz"));
        assert_eq!(cookie_value("sessionx=1", "session"), None);
        assert_eq!(cookie_value("", "session"), None);
    }
}
```

`server/src/limits.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bucket_allows_its_burst_then_refills() {
        let mut b = Bucket::new(5.0, 0.5, 0); // five at once, then one every two seconds
        for _ in 0..5 {
            assert!(b.take(0));
        }
        assert!(!b.take(0));
        assert!(!b.take(1_000));
        assert!(b.take(2_000));
        assert!(!b.take(2_000));
    }

    #[test]
    fn a_bucket_never_holds_more_than_its_burst() {
        let mut b = Bucket::new(3.0, 1.0, 0);
        for _ in 0..3 {
            assert!(b.take(1_000_000));
        }
        assert!(!b.take(1_000_000));
    }

    #[test]
    fn keyed_buckets_are_separate() {
        let mut k = Keyed::new(1.0, 0.001);
        assert!(k.take("a", 0));
        assert!(!k.take("a", 0));
        assert!(k.take("b", 0));
    }
}
```

Add to the tests in `server/src/http.rs`:

```rust
    #[test]
    fn a_browser_origin_must_match_the_host() {
        let mut h = axum::http::HeaderMap::new();
        h.insert(header::HOST, "cafe.fly.dev".parse().unwrap());
        assert!(origin_ok(&h), "no Origin: not a browser, so nothing to forge");
        h.insert(header::ORIGIN, "https://cafe.fly.dev".parse().unwrap());
        assert!(origin_ok(&h));
        h.insert(header::ORIGIN, "https://evil.example".parse().unwrap());
        assert!(!origin_ok(&h));
    }

    #[test]
    fn the_client_address_comes_from_fly_when_it_says() {
        let peer: std::net::SocketAddr = "10.0.0.1:5000".parse().unwrap();
        let mut h = axum::http::HeaderMap::new();
        assert_eq!(client_ip(&h, peer), "10.0.0.1");
        h.insert("fly-client-ip", "203.0.113.9".parse().unwrap());
        assert_eq!(client_ip(&h, peer), "203.0.113.9");
    }
```

and change the test helper `app` in `server/src/http.rs` to build the new state:

```rust
    fn app(dir: &std::path::Path) -> Router {
        let config = Config::from_lookup(|k| match k {
            "CLIENT_DIR" => Some(dir.join("no-client-yet").display().to_string()),
            "DOCS_DIR" => Some(dir.display().to_string()),
            _ => None,
        });
        let store = crate::store::Store::open(&dir.join("cafe.db")).unwrap();
        let tuning = crate::content::repo_content().tuning;
        router(AppState::new(config, crate::readme::render_page("# Hello\n\n## Second"), store, tuning))
    }
```

Add `mod api; mod auth; mod limits;` to `server/src/main.rs`.

- [ ] **Step 2: Write the failing spec tests**

`spec/helpers.ts`:

```ts
import { inject } from "vitest";

// Helpers for checks that run against the running app (spec/global-setup.ts
// finds it). Every account they make has a fresh name.
export const baseUrl = inject("baseUrl");

/** A fresh name for each call, within the 20-character limit. */
export function uniqueName(prefix = "t"): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 20);
}

export interface Account {
  name: string;
  password: string;
  cookie: string;
  id: number;
  recoveryCode: string;
}

export function sessionCookie(res: Response): string {
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("session="));
  if (!cookie) throw new Error(`no session cookie (status ${res.status})`);
  return cookie.split(";")[0];
}

export function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

export async function signUp(name = uniqueName(), password = "correct horse"): Promise<Account> {
  const res = await post("/api/signup", { name, password, look: { avatar: 1, colour: 2 } });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const me = (await res.json()) as { id: number; recoveryCode: string };
  return { name, password, cookie: sessionCookie(res), id: me.id, recoveryCode: me.recoveryCode };
}
```

`spec/accounts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { baseUrl, post, sessionCookie, signUp, uniqueName } from "./helpers";

// Accounts (ADR 0007): a name, a password, a look, and a recovery code shown once.
describe("accounts", () => {
  it("shows a recovery code once, at sign-up", async () => {
    const account = await signUp();
    expect(account.recoveryCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    const me = await fetch(new URL("/api/me", baseUrl), { headers: { cookie: account.cookie } });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.name).toBe(account.name);
    expect(body).not.toHaveProperty("recoveryCode");
  });

  it("refuses a name that's taken in another case", async () => {
    const account = await signUp();
    const res = await post("/api/signup", {
      name: account.name.toUpperCase(),
      password: "another one",
      look: { avatar: 0, colour: 0 },
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("nameTaken");
  });

  it("logs in with the right password only", async () => {
    const account = await signUp();
    expect((await post("/api/login", { name: account.name, password: "not it at all" })).status).toBe(401);
    const ok = await post("/api/login", { name: account.name, password: account.password });
    expect(ok.status).toBe(200);
    expect(sessionCookie(ok)).toMatch(/^session=/);
  });

  it("recovers with the code, which then can't be used again", async () => {
    const account = await signUp();
    const res = await post("/api/recover", {
      name: account.name,
      code: account.recoveryCode.toLowerCase(),
      password: "a brand new one",
    });
    expect(res.status).toBe(200);
    const fresh = (await res.json()).recoveryCode as string;
    expect(fresh).not.toBe(account.recoveryCode);
    expect((await post("/api/login", { name: account.name, password: account.password })).status).toBe(401);
    expect((await post("/api/login", { name: account.name, password: "a brand new one" })).status).toBe(200);
    const again = await post("/api/recover", { name: account.name, code: account.recoveryCode, password: "and another" });
    expect(again.status).toBe(401);
  });

  it("signs out", async () => {
    const account = await signUp();
    expect((await post("/api/logout", {}, account.cookie)).status).toBe(204);
    const me = await fetch(new URL("/api/me", baseUrl), { headers: { cookie: account.cookie } });
    expect(me.status).toBe(401);
  });

  it("lets a whole room on one network sign up at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        post("/api/signup", { name: uniqueName("r"), password: "correct horse", look: { avatar: 0, colour: 0 } }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(10).fill(200));
  });

  it("refuses a request from another site", async () => {
    const res = await fetch(new URL("/api/login", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ name: "someone", password: "something" }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `cargo test -p cafe -- auth limits http`
Expected: compile errors, `cannot find function valid_username` / `type Bucket` / `function origin_ok`.

- [ ] **Step 4: Write the implementation**

Above the tests in `server/src/auth.rs`:

```rust
//! Accounts (ADR 0007): what makes a valid name and password, hashing
//! passwords and recovery codes with argon2id, session tokens and the cookie
//! that carries them. Secrets are never logged.
use argon2::{Algorithm, Argon2, Params, PasswordHash, PasswordHasher, PasswordVerifier, Version};
use base64::Engine;
use rand::{Rng, RngExt};
use sha2::{Digest, Sha256};

pub const SESSION_COOKIE: &str = "session";

/// Crockford's base32: no I, L, O or U to misread.
pub const CODE_ALPHABET: &[u8] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

pub fn valid_username(name: &str) -> bool {
    (3..=20).contains(&name.chars().count()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn valid_password(password: &str) -> bool {
    (8..=128).contains(&password.chars().count())
}

/// argon2id at OWASP's minimum: 19 MiB, 2 iterations, parallelism 1.
fn argon() -> Argon2<'static> {
    let params = Params::new(19_456, 2, 1, None).expect("valid argon2 parameters");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Slow on purpose: call it from `spawn_blocking`, behind the hashing semaphore.
pub fn hash_secret(secret: &str) -> String {
    argon().hash_password(secret.as_bytes()).expect("argon2 hashing").to_string()
}

pub fn verify_secret(secret: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|h| argon().verify_password(secret.as_bytes(), &h).is_ok())
}

/// Sixteen characters in four groups, like `K7QF-2M9D-XR4T-8HWC`: about 80 bits.
pub fn new_recovery_code() -> String {
    let mut rng = rand::rng();
    let chars: Vec<char> = (0..16).map(|_| CODE_ALPHABET[rng.random_range(0..CODE_ALPHABET.len())] as char).collect();
    chars.chunks(4).map(|group| group.iter().collect::<String>()).collect::<Vec<_>>().join("-")
}

/// What someone types, folded back to the code: case, dashes and spaces
/// don't matter, and O, I and L read as 0, 1 and 1.
pub fn normalise_code(input: &str) -> String {
    input
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_uppercase() {
            'O' => '0',
            'I' | 'L' => '1',
            upper => upper,
        })
        .collect()
}

pub fn new_session_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Sessions are stored only as this hash, so the database can't be used to log in.
pub fn token_hash(token: &str) -> String {
    Sha256::digest(token.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

pub fn session_cookie(token: &str, max_age_secs: u64) -> String {
    format!("{SESSION_COOKIE}={token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age={max_age_secs}")
}

pub fn cookie_value<'a>(cookie_header: &'a str, name: &str) -> Option<&'a str> {
    cookie_header.split(';').map(str::trim).find_map(|kv| kv.strip_prefix(name)?.strip_prefix('='))
}
```

Above the tests in `server/src/limits.rs`:

```rust
//! Token buckets: a burst, then a steady refill. Kept in memory only: the
//! per-address buckets are never written down or logged (AGENTS.md).
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Bucket {
    tokens: f64,
    burst: f64,
    refill_per_sec: f64,
    last: u64,
}

impl Bucket {
    pub fn new(burst: f64, refill_per_sec: f64, now: u64) -> Bucket {
        Bucket { tokens: burst, burst, refill_per_sec, last: now }
    }

    pub fn take(&mut self, now: u64) -> bool {
        let elapsed = now.saturating_sub(self.last) as f64;
        self.tokens = (self.tokens + elapsed * self.refill_per_sec / 1000.0).min(self.burst);
        self.last = now;
        if self.tokens >= 1.0 - 1e-9 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Buckets by key: a lower-cased name or an address.
pub struct Keyed {
    burst: f64,
    refill_per_sec: f64,
    buckets: HashMap<String, Bucket>,
}

impl Keyed {
    pub fn new(burst: f64, refill_per_sec: f64) -> Keyed {
        Keyed { burst, refill_per_sec, buckets: HashMap::new() }
    }

    pub fn take(&mut self, key: &str, now: u64) -> bool {
        if self.buckets.len() > 10_000 {
            // Forget keys idle for ten minutes; a full bucket is the same as none.
            self.buckets.retain(|_, b| now.saturating_sub(b.last) < 600_000);
        }
        let (burst, refill) = (self.burst, self.refill_per_sec);
        self.buckets.entry(key.to_string()).or_insert_with(|| Bucket::new(burst, refill, now)).take(now)
    }
}
```

`server/src/api.rs`:

```rust
//! The accounts API (ADR 0007): sign up, log in, log out, who am I, recover.
//! Answers are JSON (`ApiMe` or `ApiError`); a session is an HttpOnly cookie.
use crate::auth;
use crate::http::{AppState, client_ip, origin_ok};
use crate::protocol::{ApiError, ApiErrorCode, ApiMe, Look, LogInRequest, RecoverRequest, SignUpRequest};
use crate::store::{self, UserRow};
use crate::time::now_ms;
use axum::Json;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use std::net::SocketAddr;

const AVATARS: u8 = 4;
const COLOURS: u8 = 6;

pub struct Failure(StatusCode, ApiErrorCode, &'static str);

impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        (self.0, Json(ApiError { error: self.1, detail: self.2.to_string() })).into_response()
    }
}

type Answer = Result<Response, Failure>;

fn server_error() -> Failure {
    Failure(StatusCode::INTERNAL_SERVER_ERROR, ApiErrorCode::Server, "Something went wrong in the café. Try again.")
}

fn server<E: std::fmt::Display>(e: E) -> Failure {
    tracing::error!(target: "api", error = %e, "request failed");
    server_error()
}

fn bad_input(detail: &'static str) -> Failure {
    Failure(StatusCode::BAD_REQUEST, ApiErrorCode::BadInput, detail)
}

fn me_of(user: &UserRow) -> ApiMe {
    ApiMe { id: user.id as u32, name: user.name.clone(), look: Look { avatar: user.avatar, colour: user.colour }, recovery_code: None }
}

/// Origin check, then the per-address and per-name buckets.
fn guard(app: &AppState, headers: &HeaderMap, peer: SocketAddr, name: &str) -> Result<(), Failure> {
    if !origin_ok(headers) {
        return Err(Failure(StatusCode::FORBIDDEN, ApiErrorCode::Forbidden, "Requests must come from the café's own pages."));
    }
    let now = now_ms();
    let mut limits = app.auth_limits.lock().expect("the limits lock isn't poisoned");
    let by_ip = limits.by_ip.take(&client_ip(headers, peer), now);
    let by_name = limits.by_name.take(&name.to_lowercase(), now);
    if by_ip && by_name {
        Ok(())
    } else {
        Err(Failure(StatusCode::TOO_MANY_REQUESTS, ApiErrorCode::RateLimited, "Too many tries. Wait a minute and try again."))
    }
}

async fn hash(app: &AppState, secret: String) -> Result<String, Failure> {
    let _permit = app.hashing.acquire().await.map_err(server)?;
    tokio::task::spawn_blocking(move || auth::hash_secret(&secret)).await.map_err(server)
}

async fn verify(app: &AppState, secret: String, hash: String) -> Result<bool, Failure> {
    let _permit = app.hashing.acquire().await.map_err(server)?;
    tokio::task::spawn_blocking(move || auth::verify_secret(&secret, &hash)).await.map_err(server)
}

async fn start_session(app: &AppState, user_id: i64, me: ApiMe) -> Answer {
    let token = auth::new_session_token();
    let token_hash = auth::token_hash(&token);
    let max_age = app.tuning.session_days * 86_400;
    let expires = now_ms() + max_age * 1000;
    app.store.call(move |c| store::insert_session(c, &token_hash, user_id, expires)).await.map_err(server)?;
    let cookie = HeaderValue::from_str(&auth::session_cookie(&token, max_age)).map_err(server)?;
    Ok(([(header::SET_COOKIE, cookie)], Json(me)).into_response())
}

fn session_token(headers: &HeaderMap) -> Option<String> {
    let cookies = headers.get(header::COOKIE)?.to_str().ok()?;
    auth::cookie_value(cookies, auth::SESSION_COOKIE).map(str::to_string)
}

/// The signed-in user, extending the session by another 30 days from now.
pub async fn current_user(app: &AppState, headers: &HeaderMap) -> Result<Option<UserRow>, Failure> {
    let Some(token) = session_token(headers) else { return Ok(None) };
    let token_hash = auth::token_hash(&token);
    let now = now_ms();
    let extend_to = now + app.tuning.session_days * 86_400_000;
    app.store
        .call(move |c| {
            let Some(user_id) = store::session_user(c, &token_hash, now)? else { return Ok(None) };
            store::extend_session(c, &token_hash, extend_to)?;
            store::user_by_id(c, user_id)
        })
        .await
        .map_err(server)
}

pub async fn signup(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<SignUpRequest>,
) -> Answer {
    guard(&app, &headers, peer, &req.name)?;
    if !auth::valid_username(&req.name) {
        return Err(bad_input("A name is 3 to 20 letters, digits, _ or -."));
    }
    if !auth::valid_password(&req.password) {
        return Err(bad_input("A password is 8 to 128 characters."));
    }
    if req.look.avatar >= AVATARS || req.look.colour >= COLOURS {
        return Err(bad_input("Pick one of the looks on offer."));
    }
    let code = auth::new_recovery_code();
    let password_hash = hash(&app, req.password.clone()).await?;
    let recovery_hash = hash(&app, auth::normalise_code(&code)).await?;
    let (name, look, now) = (req.name.clone(), req.look, now_ms());
    let id = app
        .store
        .call(move |c| store::insert_user(c, &name, &password_hash, &recovery_hash, look.avatar, look.colour, now))
        .await
        .map_err(server)?
        .ok_or(Failure(StatusCode::CONFLICT, ApiErrorCode::NameTaken, "That name is taken."))?;
    tracing::info!(target: "action", uid = id, who = %req.name, what = "signup");
    start_session(&app, id, ApiMe { id: id as u32, name: req.name, look: req.look, recovery_code: Some(code) }).await
}

pub async fn login(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<LogInRequest>,
) -> Answer {
    guard(&app, &headers, peer, &req.name)?;
    let name = req.name.clone();
    let user = app.store.call(move |c| store::user_by_name(c, &name)).await.map_err(server)?;
    let refused = Failure(StatusCode::UNAUTHORIZED, ApiErrorCode::BadLogin, "That name and password don't match.");
    let Some(user) = user else {
        // Spend the time a real check takes, so a missing name isn't quicker to find.
        let _ = hash(&app, req.password).await;
        tracing::info!(target: "action", what = "login", outcome = "refused");
        return Err(refused);
    };
    if !verify(&app, req.password, user.password_hash.clone()).await? {
        tracing::info!(target: "action", what = "login", outcome = "refused");
        return Err(refused);
    }
    tracing::info!(target: "action", uid = user.id, who = %user.name, what = "login");
    start_session(&app, user.id, me_of(&user)).await
}

pub async fn logout(State(app): State<AppState>, headers: HeaderMap) -> Answer {
    if !origin_ok(&headers) {
        return Err(Failure(StatusCode::FORBIDDEN, ApiErrorCode::Forbidden, "Requests must come from the café's own pages."));
    }
    if let Some(token) = session_token(&headers) {
        let token_hash = auth::token_hash(&token);
        app.store.call(move |c| store::delete_session(c, &token_hash)).await.map_err(server)?;
    }
    let clear = HeaderValue::from_str(&auth::session_cookie("", 0)).map_err(server)?;
    Ok((StatusCode::NO_CONTENT, [(header::SET_COOKIE, clear)]).into_response())
}

pub async fn me(State(app): State<AppState>, headers: HeaderMap) -> Answer {
    let Some(user) = current_user(&app, &headers).await? else {
        return Err(Failure(StatusCode::UNAUTHORIZED, ApiErrorCode::SignedOut, "You're not signed in."));
    };
    Ok(Json(me_of(&user)).into_response())
}

pub async fn recover(
    State(app): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<RecoverRequest>,
) -> Answer {
    guard(&app, &headers, peer, &req.name)?;
    if !auth::valid_password(&req.password) {
        return Err(bad_input("A password is 8 to 128 characters."));
    }
    let name = req.name.clone();
    let user = app.store.call(move |c| store::user_by_name(c, &name)).await.map_err(server)?;
    let refused = Failure(StatusCode::UNAUTHORIZED, ApiErrorCode::BadRecovery, "That name and recovery code don't match.");
    let Some(user) = user else {
        let _ = hash(&app, req.code).await;
        return Err(refused);
    };
    if !verify(&app, auth::normalise_code(&req.code), user.recovery_hash.clone()).await? {
        tracing::info!(target: "action", uid = user.id, what = "recover", outcome = "refused");
        return Err(refused);
    }
    let code = auth::new_recovery_code();
    let password_hash = hash(&app, req.password).await?;
    let recovery_hash = hash(&app, auth::normalise_code(&code)).await?;
    let user_id = user.id;
    app.store
        .call(move |c| {
            store::set_secrets(c, user_id, &password_hash, &recovery_hash)?;
            store::delete_sessions_for(c, user_id)
        })
        .await
        .map_err(server)?;
    tracing::info!(target: "action", uid = user_id, who = %user.name, what = "recover");
    let mut me = me_of(&user);
    me.recovery_code = Some(code);
    start_session(&app, user_id, me).await
}
```

In `server/src/http.rs`, replace the imports, `AppState` and `router` with:

```rust
use crate::config::Config;
use crate::limits::Keyed;
use crate::store::Store;
use crate::tuning::Tuning;
use axum::Router;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{Html, IntoResponse, Redirect, Response};
use axum::routing::{get, post};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::sync::Semaphore;
use tower_http::services::ServeDir;

pub struct AuthLimits {
    pub by_name: Keyed,
    pub by_ip: Keyed,
}

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub readme: Arc<str>,
    pub store: Store,
    pub tuning: Arc<Tuning>,
    /// At most two password hashes at once: argon2id takes 19 MiB each, and the
    /// machine has 256 MB.
    pub hashing: Arc<Semaphore>,
    pub auth_limits: Arc<Mutex<AuthLimits>>,
}

impl AppState {
    pub fn new(config: Config, readme: String, store: Store, tuning: Tuning) -> AppState {
        let per_min = |n: f64| Keyed::new(n, n / 60.0);
        let auth_limits = AuthLimits { by_name: per_min(tuning.auth_per_name_per_min), by_ip: per_min(tuning.auth_per_ip_per_min) };
        AppState {
            config: Arc::new(config),
            readme: readme.into(),
            store,
            tuning: Arc::new(tuning),
            hashing: Arc::new(Semaphore::new(2)),
            auth_limits: Arc::new(Mutex::new(auth_limits)),
        }
    }
}

pub fn router(state: AppState) -> Router {
    let assets = ServeDir::new(state.config.client_dir.clone());
    Router::new()
        .route("/", get(index))
        .route("/readme", get(|| async { Redirect::permanent("/readme/") }))
        .route("/readme/", get(readme_page))
        .route("/readme/docs/{*path}", get(readme_asset))
        .route("/api/signup", post(crate::api::signup))
        .route("/api/login", post(crate::api::login))
        .route("/api/logout", post(crate::api::logout))
        .route("/api/me", get(crate::api::me))
        .route("/api/recover", post(crate::api::recover))
        .fallback_service(assets)
        .with_state(state)
}

/// A browser always sends Origin on a POST or a WebSocket; it must name this
/// host, so another site can't act with your cookie. No Origin means no
/// browser, and nothing to forge.
pub fn origin_ok(headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(header::ORIGIN) else { return true };
    let host = headers.get(header::HOST).and_then(|h| h.to_str().ok());
    let origin_host = origin.to_str().ok().and_then(|o| o.split_once("://")).map(|(_, rest)| rest);
    matches!((origin_host, host), (Some(o), Some(h)) if o.eq_ignore_ascii_case(h))
}

/// The visitor's address: Fly's proxy says it in a header; locally, the peer.
pub fn client_ip(headers: &HeaderMap, peer: SocketAddr) -> String {
    headers
        .get("fly-client-ip")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
        .unwrap_or_else(|| peer.ip().to_string())
}
```

(`index`, `HOLDING_PAGE`, `readme_page` and `readme_asset` stay as they are.)

Replace `server/src/main.rs`:

```rust
//! The cat café server: one binary that serves the client, the README, the
//! accounts API and the WebSocket, and owns the café's world.
mod api;
mod auth;
mod config;
mod content;
mod http;
mod limits;
mod protocol;
mod readme;
mod room;
mod store;
mod time;
mod tuning;

use std::net::SocketAddr;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().json().flatten_event(true).init();
    let config = config::Config::from_env();
    std::fs::create_dir_all(&config.data_dir)?;
    let store = store::Store::open(&config.data_dir.join("cafe.db"))?;
    let content = content::load(&config.content_dir)?;
    let readme = readme::render_page(&std::fs::read_to_string(&config.readme_path).unwrap_or_default());
    let port = config.port;
    let state = http::AppState::new(config, readme, store, content.tuning);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(target: "sys", port, "listening");
    axum::serve(listener, http::router(state).into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Fly stops a machine with SIGINT; SIGTERM is the fallback.
async fn shutdown_signal() {
    let interrupt = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut s) => {
                s.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    tokio::select! {
        _ = interrupt => {}
        _ = terminate => {}
    }
}
```

- [ ] **Step 5: Run the Rust tests to see them pass**

Run: `cargo test -p cafe -- auth limits http`
Expected: PASS (auth 8, limits 3, http 5).

- [ ] **Step 6: Run the spec against the running server**

Run: `cargo run -p cafe` in one terminal, then `pnpm test` in another.
Expected: `spec/accounts.test.ts` passes (7 tests), alongside the two shipped checks.

- [ ] **Step 7: Commit**

```bash
git add server/src spec/helpers.ts spec/accounts.test.ts
git commit -m "Add accounts: sign-up with a recovery code, log-in, recovery"
git push origin HEAD:main
```

---

### Task 6: The trust book

Each cat's trust in each person (design.md, "The cats"): it grows with welcome
interactions, tapers within a Canberra day so regular visits beat one long
session, dips when someone pushes, and never fades with absence.

**Files:**
- Create: `server/src/trust.rs`
- Modify: `server/src/main.rs` (add `mod trust;`)

**Interfaces:**
- Consumes: `store::TrustRow` (Task 4); `protocol::{TrustLevel, TrustView}` (Task 2).
- Produces: `trust::TrustRecord { value: f32, day: String, gained_today: f32 }`; `trust::TrustBook` with `new(levels: [f32; 3], daily_cap: f32)`, `load(Vec<TrustRow>)`, `value(cat, person: u32) -> f32`, `has_met(cat, person) -> bool`, `apply(cat, trust_rate, person, delta, today) -> Option<TrustRecord>` (Some when it changed), `level(value) -> TrustLevel`, `view(cat, person) -> TrustView` (value rounded to one decimal), `TrustBook::row(cat, person, &TrustRecord) -> TrustRow`.

- [ ] **Step 1: Write the failing tests**

`server/src/trust.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn book() -> TrustBook {
        TrustBook::new([20.0, 50.0, 80.0], 10.0)
    }

    #[test]
    fn gains_taper_within_a_day_and_stop_at_the_cap() {
        let mut b = book();
        let mut gains = Vec::new();
        for _ in 0..20 {
            let before = b.value("mochi", 1);
            b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
            gains.push(b.value("mochi", 1) - before);
        }
        assert!(gains.windows(2).all(|w| w[1] <= w[0]), "each gain is no bigger than the last: {gains:?}");
        assert!(b.value("mochi", 1) <= 10.0 + 1e-4);
        assert!(b.value("mochi", 1) > 5.0);
    }

    #[test]
    fn a_slow_cat_has_a_smaller_daily_allowance() {
        let mut b = book();
        for _ in 0..50 {
            b.apply("burakku", 0.3, 1, 0.6, "2026-10-07");
        }
        assert!(b.value("burakku", 1) <= 3.0 + 1e-4);
    }

    #[test]
    fn a_new_day_brings_a_new_allowance_and_keeps_the_trust() {
        let mut b = book();
        for _ in 0..30 {
            b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
        }
        let yesterday = b.value("mochi", 1);
        b.apply("mochi", 1.0, 1, 2.0, "2026-10-08");
        assert!(b.value("mochi", 1) > yesterday);
    }

    #[test]
    fn dips_are_untapered_and_stop_at_zero() {
        let mut b = book();
        b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
        b.apply("mochi", 1.0, 1, -1.0, "2026-10-07");
        assert!((b.value("mochi", 1) - 1.0).abs() < 1e-4);
        b.apply("mochi", 1.0, 1, -5.0, "2026-10-07");
        assert_eq!(b.value("mochi", 1), 0.0);
    }

    #[test]
    fn absence_never_costs_trust() {
        let mut b = book();
        b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
        let before = b.value("mochi", 1);
        assert_eq!(b.apply("mochi", 1.0, 1, 0.0, "2027-10-07"), None);
        assert_eq!(b.value("mochi", 1), before);
    }

    #[test]
    fn levels_follow_the_thresholds() {
        let b = book();
        assert_eq!(b.level(19.9), TrustLevel::Stranger);
        assert_eq!(b.level(20.0), TrustLevel::Familiar);
        assert_eq!(b.level(50.0), TrustLevel::Friend);
        assert_eq!(b.level(80.0), TrustLevel::Devoted);
    }

    #[test]
    fn a_cat_has_met_someone_once_it_has_a_record_of_them() {
        let mut b = book();
        assert!(!b.has_met("tora", 7));
        b.apply("tora", 0.6, 7, 0.6, "2026-10-07");
        assert!(b.has_met("tora", 7));
        assert!(!b.has_met("mochi", 7));
    }

    #[test]
    fn records_round_trip_through_store_rows() {
        let mut b = book();
        let rec = b.apply("mochi", 1.0, 3, 2.0, "2026-10-07").unwrap();
        let row = TrustBook::row("mochi", 3, &rec);
        let mut again = book();
        again.load(vec![row]);
        assert_eq!(again.value("mochi", 3), b.value("mochi", 3));
        assert_eq!(again.view("mochi", 3).value, 2.0);
    }
}
```

Add `mod trust;` to `server/src/main.rs`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cargo test -p cafe trust`
Expected: compile errors, `cannot find type TrustBook`.

- [ ] **Step 3: Write the implementation**

Above the tests in `server/src/trust.rs`:

```rust
//! Each cat's trust in each person (design.md, "The cats"): it grows with
//! welcome interactions, tapers within a Canberra day so regular visits beat
//! one long session, dips when someone pushes, and never fades with absence
//! (AGENTS.md): only what a person does to a cat changes its trust in them.
use crate::protocol::{TrustLevel, TrustView};
use crate::store::TrustRow;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct TrustRecord {
    pub value: f32,
    pub day: String,
    pub gained_today: f32,
}

#[derive(Debug, Clone)]
pub struct TrustBook {
    records: HashMap<(String, u32), TrustRecord>,
    levels: [f32; 3],
    daily_cap: f32,
}

impl TrustBook {
    pub fn new(levels: [f32; 3], daily_cap: f32) -> TrustBook {
        TrustBook { records: HashMap::new(), levels, daily_cap }
    }

    pub fn load(&mut self, rows: Vec<TrustRow>) {
        for r in rows {
            self.records.insert((r.cat_id, r.user_id as u32), TrustRecord { value: r.value, day: r.day, gained_today: r.gained_today });
        }
    }

    pub fn value(&self, cat: &str, person: u32) -> f32 {
        self.records.get(&(cat.to_string(), person)).map_or(0.0, |r| r.value)
    }

    pub fn has_met(&self, cat: &str, person: u32) -> bool {
        self.records.contains_key(&(cat.to_string(), person))
    }

    /// A gain (positive, tapered by what this person already gained with this
    /// cat today, up to the cat's daily allowance) or a dip (negative,
    /// untapered). Returns the record when the value changed.
    pub fn apply(&mut self, cat: &str, trust_rate: f32, person: u32, delta: f32, today: &str) -> Option<TrustRecord> {
        if delta == 0.0 {
            return None;
        }
        let cap = self.daily_cap * trust_rate;
        let rec = self
            .records
            .entry((cat.to_string(), person))
            .or_insert_with(|| TrustRecord { value: 0.0, day: today.to_string(), gained_today: 0.0 });
        if rec.day != today {
            rec.day = today.to_string();
            rec.gained_today = 0.0;
        }
        let change = if delta > 0.0 {
            let left = (cap - rec.gained_today).max(0.0);
            let taper = if cap > 0.0 { left / cap } else { 0.0 };
            (delta * taper).min(left)
        } else {
            delta
        };
        let before = rec.value;
        rec.value = (rec.value + change).clamp(0.0, 100.0);
        if delta > 0.0 {
            rec.gained_today += rec.value - before;
        }
        (rec.value != before).then(|| rec.clone())
    }

    pub fn level(&self, value: f32) -> TrustLevel {
        if value >= self.levels[2] {
            TrustLevel::Devoted
        } else if value >= self.levels[1] {
            TrustLevel::Friend
        } else if value >= self.levels[0] {
            TrustLevel::Familiar
        } else {
            TrustLevel::Stranger
        }
    }

    pub fn view(&self, cat: &str, person: u32) -> TrustView {
        let value = self.value(cat, person);
        TrustView { cat: cat.to_string(), value: (value * 10.0).round() / 10.0, level: self.level(value) }
    }

    pub fn row(cat: &str, person: u32, rec: &TrustRecord) -> TrustRow {
        TrustRow { cat_id: cat.to_string(), user_id: person as i64, value: rec.value, day: rec.day.clone(), gained_today: rec.gained_today }
    }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p cafe trust`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/trust.rs server/src/main.rs
git commit -m "Keep each cat's trust in each person: tapering, never fading"
git push origin HEAD:main
```

---

### Task 7: Cat characters

Each cat is a data file (ADR 0011). This task reads the three files and adds
the pure rules that turn a cat's character, needs and room into choices: what
to do next (utility scoring, then a weighted pick among the best three), and
how to answer a pet.

**Files:**
- Create: `content/cats/mochi.toml`, `content/cats/burakku.toml`, `content/cats/tora.toml`, `server/src/cats.rs`
- Modify: `server/src/content.rs` (load the cats; `Content` gains `cats`), `server/src/main.rs` (add `mod cats;`)

**Interfaces:**
- Consumes: `protocol::{Pose, Tile}`; `content::read_toml`.
- Produces: `cats::{CatDef, Traits, Rhythm, Weights, Saved, Situation, Choice, Outcome, options, pick, welcome_chance, pet_outcome}`; `CatDef { id, name, coat, traits, rhythm, weights }` with `validate()`, `awake_at(minute: u32) -> bool`, `hide_threshold() -> f32` (bubbles a minute), `speed_factor(minute) -> f32`; `Saved { at: Tile, tiredness: f32, company: f32 }` (what a cat keeps across restarts); `Situation { minute, people: &[(u32, f32)], noise: f32, tiredness, company }`; `Choice { Idle, Wander, Nap, Approach(u32), Hide }`; `options(&CatDef, &Situation) -> Vec<(Choice, f32)>`; `pick(Vec<(Choice, f32)>, &mut impl Rng) -> Choice`; `Outcome { Welcome, Tolerate, Refuse }`; `pet_outcome(&CatDef, Pose, trust: f32, roll: f32) -> Outcome`; `content::Content { tuning, room, cats: Vec<CatDef> }` (sorted by file name: burakku, mochi, tora).

- [ ] **Step 1: Write the cat files**

`content/cats/mochi.toml`:

```toml
# Mochi: round, white and grey. Sociable and greedy; goes where the people
# and the food are; naps after lunch and overnight, and more when the café
# is empty.
id = "mochi"
name = "Mochi"
coat = "white_grey"

[traits]
sociability = 0.9
boldness = 0.7
curiosity = 0.4
playfulness = 0.3
appetite = 0.95
energy = 0.4
affection = 0.8
alone_activity = 0.5   # under 1: sleepier when nobody's there
trust_rate = 1.0       # trusts quickly
temper = 0.2
grudge_hours = 2.0

[rhythm]
awake = ["06:00-12:30", "15:00-22:00"]   # Canberra time

[weights]
approach = 1.3
hide = 0.5
```

`content/cats/burakku.toml`:

```toml
# Burakku (ブラック, "black"): shy. Hides when the room is noisy, explores when
# it's empty, and is awake at night, so she leaves the night's traces. Slow
# to trust, devoted once she does.
id = "burakku"
name = "Burakku"
coat = "black"

[traits]
sociability = 0.3
boldness = 0.15
curiosity = 0.6
playfulness = 0.4
appetite = 0.5
energy = 0.5
affection = 0.7        # devoted once she trusts you
alone_activity = 1.6   # over 1: livelier when nobody's there
trust_rate = 0.3       # slow to warm up
temper = 0.5
grudge_hours = 48.0

[rhythm]
awake = ["21:00-05:00"]

[weights]
hide = 1.5
wander = 1.2
```

`content/cats/tora.toml`:

```toml
# Tora: an orange tabby, curious and playful. First to new furniture, chases
# toys, knocks things over; tolerates petting, loves play. Zoomies at dawn
# and dusk, like real cats.
id = "tora"
name = "Tora"
coat = "orange_tabby"

[traits]
sociability = 0.6
boldness = 0.8
curiosity = 0.95
playfulness = 0.95
appetite = 0.6
energy = 0.9
affection = 0.4
alone_activity = 1.0
trust_rate = 0.6
temper = 0.6
grudge_hours = 4.0

[rhythm]
awake = ["04:30-10:00", "16:00-21:30"]
zoomies = true

[weights]
wander = 1.3
```

- [ ] **Step 2: Write the failing tests**

`server/src/cats.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;

    fn cat(id: &str) -> CatDef {
        crate::content::repo_content().cats.into_iter().find(|c| c.id == id).expect("a cat")
    }

    fn score(options: &[(Choice, f32)], choice: Choice) -> f32 {
        options.iter().find(|(c, _)| *c == choice).map_or(0.0, |(_, s)| *s)
    }

    fn situation(people: &[(u32, f32)]) -> Situation<'_> {
        Situation { minute: 10 * 60, people, noise: 0.0, tiredness: 0.2, company: 0.5 }
    }

    #[test]
    fn the_three_cats_load_in_file_order() {
        let ids: Vec<String> = crate::content::repo_content().cats.into_iter().map(|c| c.id).collect();
        assert_eq!(ids, ["burakku", "mochi", "tora"]);
    }

    #[test]
    fn awake_hours_can_wrap_midnight() {
        let b = cat("burakku");
        assert!(b.awake_at(23 * 60) && b.awake_at(2 * 60));
        assert!(!b.awake_at(12 * 60));
    }

    #[test]
    fn mochi_naps_after_lunch_and_overnight() {
        let m = cat("mochi");
        assert!(m.awake_at(9 * 60) && m.awake_at(16 * 60));
        assert!(!m.awake_at(13 * 60) && !m.awake_at(23 * 60));
    }

    #[test]
    fn a_tired_cat_would_rather_nap_than_wander() {
        let mut s = situation(&[]);
        s.tiredness = 0.9;
        let o = options(&cat("mochi"), &s);
        assert!(score(&o, Choice::Nap) > score(&o, Choice::Wander));
    }

    #[test]
    fn noise_sends_shy_burakku_to_hide_but_not_bold_tora() {
        let mut s = situation(&[(1, 0.0)]);
        s.noise = 5.0;
        assert!(score(&options(&cat("burakku"), &s), Choice::Hide) > 0.0);
        assert_eq!(score(&options(&cat("tora"), &s), Choice::Hide), 0.0);
    }

    #[test]
    fn burakku_is_livelier_and_mochi_sleepier_when_the_cafe_is_empty() {
        let (alone, company) = (situation(&[]), situation(&[(1, 0.0)]));
        let b = cat("burakku");
        assert!(score(&options(&b, &alone), Choice::Wander) > score(&options(&b, &company), Choice::Wander));
        let m = cat("mochi");
        assert!(score(&options(&m, &alone), Choice::Nap) > score(&options(&m, &company), Choice::Nap));
    }

    #[test]
    fn trust_draws_a_cat_to_someone() {
        let o = options(&cat("mochi"), &situation(&[(1, 0.0), (2, 80.0)]));
        assert!(score(&o, Choice::Approach(2)) > score(&o, Choice::Approach(1)));
        assert_eq!(score(&options(&cat("mochi"), &situation(&[])), Choice::Approach(1)), 0.0);
    }

    #[test]
    fn welcome_chances_follow_character_and_trust() {
        let (m, b, t) = (cat("mochi"), cat("burakku"), cat("tora"));
        assert!(welcome_chance(&m, 0.0) > welcome_chance(&t, 0.0));
        assert!(welcome_chance(&t, 0.0) > welcome_chance(&b, 0.0));
        assert!(welcome_chance(&b, 80.0) > welcome_chance(&b, 0.0) + 0.3);
    }

    #[test]
    fn asleep_or_hiding_a_cat_refuses() {
        let m = cat("mochi");
        assert_eq!(pet_outcome(&m, Pose::Nap, 100.0, 0.0), Outcome::Refuse);
        assert_eq!(pet_outcome(&m, Pose::Hide, 100.0, 0.0), Outcome::Refuse);
        assert_eq!(pet_outcome(&m, Pose::Idle, 100.0, 0.0), Outcome::Welcome);
    }

    #[test]
    fn pick_chooses_only_among_the_best_three() {
        let mut rng = rand_chacha::ChaCha8Rng::seed_from_u64(1);
        let o = vec![(Choice::Idle, 1.0), (Choice::Wander, 0.9), (Choice::Nap, 0.8), (Choice::Hide, 0.01), (Choice::Approach(1), 0.02)];
        for _ in 0..500 {
            let c = pick(o.clone(), &mut rng);
            assert!(matches!(c, Choice::Idle | Choice::Wander | Choice::Nap), "{c:?}");
        }
    }

    #[test]
    fn a_bad_awake_range_fails_validation() {
        let mut m = cat("mochi");
        m.rhythm.awake = vec!["25:00-26:00".into()];
        assert!(m.validate().is_err());
    }

    #[test]
    fn tora_has_zoomies_only_in_her_waking_hours() {
        let t = cat("tora");
        assert_eq!(t.speed_factor(5 * 60), 2.0);
        assert_eq!(t.speed_factor(13 * 60), 1.0);
        assert_eq!(cat("mochi").speed_factor(9 * 60), 1.0);
    }
}
```

In `server/src/content.rs`, add to the tests:

```rust
    #[test]
    fn cat_ids_are_unique() {
        let c = repo_content();
        let mut ids: Vec<&str> = c.cats.iter().map(|cat| cat.id.as_str()).collect();
        ids.dedup();
        assert_eq!(ids.len(), c.cats.len());
    }
```

Add `mod cats;` to `server/src/main.rs`.

- [ ] **Step 3: Run the tests to see them fail**

Run: `cargo test -p cafe -- cats content`
Expected: compile errors, `cannot find type CatDef` / `no field cats on type Content`.

- [ ] **Step 4: Write the implementation**

Above the tests in `server/src/cats.rs`:

```rust
//! A cat's character, from its file in content/cats (ADR 0011), and the pure
//! rules that turn character, needs and the room into choices: what to do
//! next, and how to answer a pet. The world (world/cat_life.rs) applies them.
use crate::protocol::{Pose, Tile};
use rand::{Rng, RngExt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CatDef {
    pub id: String,
    pub name: String,
    pub coat: String,
    pub traits: Traits,
    pub rhythm: Rhythm,
    #[serde(default)]
    pub weights: Weights,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Traits {
    pub sociability: f32,
    pub boldness: f32,
    pub curiosity: f32,
    pub playfulness: f32,
    pub appetite: f32,
    pub energy: f32,
    pub affection: f32,
    pub alone_activity: f32,
    pub trust_rate: f32,
    pub temper: f32,
    pub grudge_hours: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rhythm {
    /// Canberra-time ranges, "HH:MM-HH:MM"; a range may wrap midnight.
    pub awake: Vec<String>,
    /// Twice the walking speed in the awake hours.
    #[serde(default)]
    pub zoomies: bool,
}

/// Multipliers on the shared behaviours, for a cat's particular leanings.
#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Weights {
    pub idle: f32,
    pub wander: f32,
    pub nap: f32,
    pub approach: f32,
    pub hide: f32,
}

impl Default for Weights {
    fn default() -> Weights {
        Weights { idle: 1.0, wander: 1.0, nap: 1.0, approach: 1.0, hide: 1.0 }
    }
}

impl CatDef {
    pub fn validate(&self) -> anyhow::Result<()> {
        let t = &self.traits;
        for (name, v) in [
            ("sociability", t.sociability),
            ("boldness", t.boldness),
            ("curiosity", t.curiosity),
            ("playfulness", t.playfulness),
            ("appetite", t.appetite),
            ("energy", t.energy),
            ("affection", t.affection),
            ("trust_rate", t.trust_rate),
            ("temper", t.temper),
        ] {
            anyhow::ensure!((0.0..=1.0).contains(&v), "{}: {name} must be between 0 and 1", self.id);
        }
        anyhow::ensure!(t.alone_activity > 0.0 && t.alone_activity <= 3.0, "{}: alone_activity must be above 0 and at most 3", self.id);
        anyhow::ensure!(t.grudge_hours > 0.0, "{}: grudge_hours must be positive", self.id);
        anyhow::ensure!(!self.rhythm.awake.is_empty(), "{}: needs at least one awake range", self.id);
        for r in &self.rhythm.awake {
            anyhow::ensure!(parse_range(r).is_some(), "{}: can't read the awake range {r:?}; use HH:MM-HH:MM", self.id);
        }
        Ok(())
    }

    /// Whether `minute` (minutes since Canberra midnight) is in an awake range.
    pub fn awake_at(&self, minute: u32) -> bool {
        self.rhythm.awake.iter().filter_map(|r| parse_range(r)).any(|(from, to)| {
            if from <= to { minute >= from && minute < to } else { minute >= from || minute < to }
        })
    }

    /// Bubbles in the last minute that send this cat into hiding.
    pub fn hide_threshold(&self) -> f32 {
        3.0 + 8.0 * self.traits.boldness
    }

    pub fn speed_factor(&self, minute: u32) -> f32 {
        if self.rhythm.zoomies && self.awake_at(minute) { 2.0 } else { 1.0 }
    }
}

fn parse_range(s: &str) -> Option<(u32, u32)> {
    let (from, to) = s.split_once('-')?;
    Some((parse_hm(from)?, parse_hm(to)?))
}

fn parse_hm(s: &str) -> Option<u32> {
    let (h, m) = s.trim().split_once(':')?;
    let (h, m): (u32, u32) = (h.parse().ok()?, m.parse().ok()?);
    (h < 24 && m < 60).then_some(h * 60 + m)
}

/// What a cat keeps across restarts: where it is, and how tired and how
/// lonely it is. Everything else starts afresh.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Saved {
    pub at: Tile,
    pub tiredness: f32,
    pub company: f32,
}

/// The room as a cat deciding what to do sees it.
pub struct Situation<'a> {
    pub minute: u32,
    /// People inside, with this cat's trust in each.
    pub people: &'a [(u32, f32)],
    /// Bubbles in the last minute.
    pub noise: f32,
    pub tiredness: f32,
    pub company: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Choice {
    Idle,
    Wander,
    Nap,
    Approach(u32),
    Hide,
}

/// Every behaviour scores itself from character, needs, trust, noise and the hour.
pub fn options(def: &CatDef, s: &Situation) -> Vec<(Choice, f32)> {
    let (t, w) = (&def.traits, &def.weights);
    let alone = s.people.is_empty();
    let lively = if alone { t.alone_activity } else { 1.0 };
    let awake = def.awake_at(s.minute);
    let mut out = vec![
        (Choice::Idle, 0.2 * w.idle),
        (Choice::Wander, w.wander * (0.2 + 0.6 * t.energy) * (1.0 - s.tiredness) * lively),
        (Choice::Nap, w.nap * (1.5 * s.tiredness + if awake { 0.0 } else { 0.6 }) / lively),
    ];
    for &(id, trust) in s.people {
        out.push((Choice::Approach(id), w.approach * t.sociability * (0.4 + 0.6 * s.company) * (0.5 + trust / 100.0)));
    }
    let threshold = def.hide_threshold();
    if s.noise >= threshold {
        out.push((Choice::Hide, w.hide * (1.0 - t.boldness) * (s.noise / threshold).min(2.0)));
    }
    out
}

/// One of the three best options, at random, weighted by score: in character
/// without being predictable.
pub fn pick(mut options: Vec<(Choice, f32)>, rng: &mut impl Rng) -> Choice {
    options.retain(|(_, s)| *s > 0.0);
    options.sort_by(|a, b| b.1.total_cmp(&a.1));
    options.truncate(3);
    let total: f32 = options.iter().map(|(_, s)| s).sum();
    if total <= 0.0 {
        return Choice::Idle;
    }
    let mut roll = rng.random::<f32>() * total;
    for (choice, score) in &options {
        if roll < *score {
            return *choice;
        }
        roll -= score;
    }
    options.last().map_or(Choice::Idle, |(c, _)| *c)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Welcome,
    Tolerate,
    Refuse,
}

/// The chance this cat welcomes a pet from someone it trusts this much
/// (0 to 100). Shy cats hold back from strangers.
pub fn welcome_chance(def: &CatDef, trust: f32) -> f32 {
    let (a, b, t) = (def.traits.affection, def.traits.boldness, trust / 100.0);
    let shy = if t < 0.2 { 0.2 * (1.0 - b) } else { 0.0 };
    (0.05 + 0.45 * a + 0.25 * b + 0.25 * t - shy).clamp(0.05, 0.95)
}

/// How a cat answers a pet, given a roll in [0, 1). Asleep or hiding, it refuses.
pub fn pet_outcome(def: &CatDef, pose: Pose, trust: f32, roll: f32) -> Outcome {
    if matches!(pose, Pose::Nap | Pose::Hide) {
        return Outcome::Refuse;
    }
    let welcome = welcome_chance(def, trust);
    if roll < welcome {
        Outcome::Welcome
    } else if roll < welcome + 0.2 {
        Outcome::Tolerate
    } else {
        Outcome::Refuse
    }
}
```

In `server/src/content.rs`, replace `Content` and `load` with:

```rust
pub struct Content {
    pub tuning: Tuning,
    pub room: Room,
    pub cats: Vec<CatDef>,
}

pub fn load(dir: &Path) -> anyhow::Result<Content> {
    let tuning = Tuning::load(&dir.join("tuning.toml")).context("reading content/tuning.toml")?;
    let kinds: FurnitureFile = read_toml(&dir.join("furniture.toml"))?;
    let room_file: RoomFile = read_toml(&dir.join("room.toml"))?;
    let room = Room::build(&room_file, &kinds.kinds)?;
    let cats = load_cats(&dir.join("cats"))?;
    Ok(Content { tuning, room, cats })
}

/// Every cat file, in file-name order, each validated; ids must be unique.
fn load_cats(dir: &Path) -> anyhow::Result<Vec<CatDef>> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .with_context(|| format!("reading {}", dir.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "toml"))
        .collect();
    files.sort();
    let mut cats: Vec<CatDef> = Vec::new();
    for file in files {
        let cat: CatDef = read_toml(&file)?;
        cat.validate()?;
        anyhow::ensure!(!cats.iter().any(|c| c.id == cat.id), "two cats are called {:?}", cat.id);
        cats.push(cat);
    }
    anyhow::ensure!(!cats.is_empty(), "content/cats has no cats");
    Ok(cats)
}
```

and add `use crate::cats::CatDef;` to its imports.

- [ ] **Step 5: Run the tests to see them pass**

Run: `cargo test -p cafe -- cats content`
Expected: PASS (cats 12, content 3).

- [ ] **Step 6: Commit**

```bash
git add content/cats server/src/cats.rs server/src/content.rs server/src/main.rs
git commit -m "Give Mochi, Burakku and Tora their characters as data"
git push origin HEAD:main
```

---

### Task 8: The world: people, the line, walking and talking

The world task's core (ADR 0004), without cats yet: arriving through the door,
six inside and a first-come line at the window (ADR 0008), walking, public
bubbles that are never logged (ADR 0010), the grace period after a dropped
connection, a second tab, and leaving. Everything is plain method calls with
explicit times, so it's tested without a socket.

**Files:**
- Create: `server/src/world/mod.rs`, `server/src/world/people.rs`
- Modify: `server/src/main.rs` (add `mod world;`), `docs/design.md` (the Leave button)

**Interfaces:**
- Consumes: `content::Content` (Task 7), `trust::TrustBook` (Task 6), `room::{Room, Walker}` (Task 3), `store::Store` (Task 4), `tuning::Tuning`, `protocol::*`.
- Produces: `world::{World, Input, Out, To, walk_tile, walk_end}`; `World::new(content, trust, saved_cats: Vec<(String, String)>, seed: u64, store: Option<Store>, build: String, now: u64)`; `World::handle(&mut self, now, Input) -> Vec<Out>`; `World::tick(&mut self, now) -> Vec<Out>`; `World::snapshot_for(&self, id, now) -> Snapshot`; `World::save(&mut self, now)`; `Input { Join { id, name, look }, Drop { id }, Msg { id, msg } }`; `Out { to: To, msg: ServerMsg }`; `To { All, One(u32) }`. Inside the `world` module (for Task 9): `Person`, `Pending::Pet(String)`, `Heard { by, text }`, the fields `arrivals: Vec<u32>` and `heard: Vec<Heard>`, and on `World`: `person(id)`, `person_tile(id, now) -> Option<Tile>`, `inside_or_refuse(id, out) -> bool`, `approach(now, id, target, Pending, out) -> bool`, `say(now, id, text, to, out)`, `people_tick(now, out) -> Vec<(u32, Pending)>`, `people::person_view(&Person, now)`, and the free function `error(out, id, code, detail)`.

- [ ] **Step 1: Write the failing tests**

`server/src/world/people.rs`:

```rust
#[cfg(test)]
pub(crate) mod tests {
    use super::super::*;
    use crate::protocol::{ClientMsg, ErrorCode, Look, Place, ServerMsg, Tile};

    pub(crate) fn world() -> World {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        World::new(content, trust, Vec::new(), 7, None, "test".into(), 0)
    }

    pub(crate) fn join(w: &mut World, id: u32, now: u64) -> Vec<Out> {
        w.handle(now, Input::Join { id, name: format!("p{id}"), look: Look { avatar: 0, colour: 0 } })
    }

    fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
        w.handle(now, Input::Msg { id, msg })
    }

    fn errors(outs: &[Out]) -> Vec<(To, ErrorCode)> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::Error { code, .. } => Some((o.to, *code)),
                _ => None,
            })
            .collect()
    }

    fn place_of(w: &World, id: u32) -> Option<Place> {
        w.people.iter().find(|p| p.id == id).map(|p| p.place)
    }

    #[test]
    fn a_newcomer_is_welcomed_and_walks_in_through_the_door() {
        let mut w = world();
        let outs = join(&mut w, 1, 1_000);
        match &outs[0] {
            Out { to: To::One(1), msg: ServerMsg::Welcome { you: 1, cap: 6, snapshot, .. } } => {
                assert_eq!(snapshot.people.len(), 1)
            }
            other => panic!("expected a welcome first, got {other:?}"),
        }
        let (to, person) = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonJoined { person } => Some((o.to, person.clone())),
                _ => None,
            })
            .expect("everyone hears about the newcomer");
        assert_eq!((to, person.place), (To::All, Place::Inside));
        let walk = person.walk.expect("walking in");
        assert_eq!((walk.path[0], *walk.path.last().unwrap()), (w.room.door, w.room.entry));
    }

    #[test]
    fn the_seventh_person_waits_at_the_window_and_can_only_talk() {
        let mut w = world();
        for id in 1..=7 {
            join(&mut w, id, 0);
        }
        assert_eq!(place_of(&w, 6), Some(Place::Inside));
        assert_eq!(place_of(&w, 7), Some(Place::Window));
        let outs = send(&mut w, 7, 10, ClientMsg::WalkTo { tile: Tile { x: 5, y: 5 } });
        assert_eq!(errors(&outs), vec![(To::One(7), ErrorCode::NotFromWindow)]);
        let outs = send(&mut w, 7, 10, ClientMsg::Say { text: "can I come in?".into(), to: None });
        assert!(outs.iter().any(|o| o.to == To::All && matches!(o.msg, ServerMsg::Said { from: 7, .. })));
    }

    #[test]
    fn when_someone_leaves_the_first_in_line_comes_in() {
        let mut w = world();
        for id in 1..=8 {
            join(&mut w, id, id as u64);
        }
        let outs = send(&mut w, 3, 100, ClientMsg::Leave {});
        assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { id: 3 })));
        assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonPlaced { id: 7, place: Place::Inside, .. })));
        assert_eq!(place_of(&w, 8), Some(Place::Window));
    }

    #[test]
    fn a_bubble_reaches_everyone_and_lasts_by_its_length() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        let outs = send(&mut w, 1, 10, ClientMsg::Say { text: "  hello  ".into(), to: Some(2) });
        assert_eq!(
            outs,
            vec![Out { to: To::All, msg: ServerMsg::Said { from: 1, text: "hello".into(), to: Some(2), ttl_ms: 3300 } }]
        );
    }

    #[test]
    fn empty_overlong_and_misaddressed_bubbles_reach_nobody() {
        let mut w = world();
        join(&mut w, 1, 0);
        let say = |text: String, to| ClientMsg::Say { text, to };
        assert_eq!(errors(&send(&mut w, 1, 1, say("   ".into(), None))), vec![(To::One(1), ErrorCode::Empty)]);
        assert_eq!(errors(&send(&mut w, 1, 1, say("x".repeat(101), None))), vec![(To::One(1), ErrorCode::TooLong)]);
        assert_eq!(errors(&send(&mut w, 1, 1, say("hi".into(), Some(99)))), vec![(To::One(1), ErrorCode::UnknownPerson)]);
    }

    #[test]
    fn emoji_count_as_one_character_each() {
        let mut w = world();
        join(&mut w, 1, 0);
        assert!(errors(&send(&mut w, 1, 1, ClientMsg::Say { text: "😺".repeat(100), to: None })).is_empty());
        let outs = send(&mut w, 1, 1, ClientMsg::Say { text: "😺".repeat(101), to: None });
        assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::TooLong)]);
    }

    #[test]
    fn what_was_said_is_never_logged() {
        let mut w = world();
        join(&mut w, 1, 0);
        let log = capture_logs(|| {
            send(&mut w, 1, 1, ClientMsg::Say { text: "the secret phrase".into(), to: None });
        });
        assert!(log.contains(r#""what":"say""#), "{log}");
        assert!(!log.contains("secret phrase"), "{log}");
    }

    #[test]
    fn walking_goes_round_furniture_and_never_into_a_wall() {
        let mut w = world();
        join(&mut w, 1, 0);
        let outs = send(&mut w, 1, 5_000, ClientMsg::WalkTo { tile: Tile { x: 1, y: 8 } });
        let walk = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: 1, walk } => Some(walk.clone()),
                _ => None,
            })
            .expect("a walk");
        assert_eq!(*walk.path.last().unwrap(), Tile { x: 1, y: 8 });
        let outs = send(&mut w, 1, 6_000, ClientMsg::WalkTo { tile: Tile { x: 0, y: 0 } });
        assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::BadTile)]);
    }

    #[test]
    fn a_dropped_connection_keeps_the_seat_for_the_grace_period() {
        let mut w = world();
        join(&mut w, 1, 0);
        w.handle(1_000, Input::Drop { id: 1 });
        assert!(!w.tick(30_999).iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { .. })));
        assert!(w.tick(31_000).iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { id: 1 })));
    }

    #[test]
    fn coming_back_within_the_grace_period_keeps_the_seat() {
        let mut w = world();
        join(&mut w, 1, 0);
        w.handle(1_000, Input::Drop { id: 1 });
        let outs = join(&mut w, 1, 5_000);
        assert!(matches!(outs.as_slice(), [Out { msg: ServerMsg::Welcome { .. }, .. }]), "only a welcome: {outs:?}");
        assert!(!w.tick(40_000).iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { .. })));
    }

    #[test]
    fn a_second_tab_does_not_make_a_second_person() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 1, 10);
        assert_eq!(w.people.len(), 1);
    }

    /// Runs `f` with JSON logging captured, and returns what was logged.
    pub(crate) fn capture_logs(f: impl FnOnce()) -> String {
        use std::sync::{Arc, Mutex};
        #[derive(Clone)]
        struct Sink(Arc<Mutex<Vec<u8>>>);
        impl std::io::Write for Sink {
            fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
                self.0.lock().unwrap().extend_from_slice(data);
                Ok(data.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let writer = sink.clone();
        let subscriber = tracing_subscriber::fmt().json().flatten_event(true).with_writer(move || writer.clone()).finish();
        tracing::subscriber::with_default(subscriber, f);
        let bytes = sink.0.lock().unwrap().clone();
        String::from_utf8(bytes).unwrap()
    }
}
```

Add `mod world;` to `server/src/main.rs`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `cargo test -p cafe world`
Expected: compile errors, `file not found for module world` / `cannot find type World`.

- [ ] **Step 3: Write the implementation**

`server/src/world/mod.rs`:

```rust
//! The café's one world (ADR 0004): people, the line at the window, walks and
//! bubbles (Task 9 adds the cats). `handle` and `tick` return messages for
//! the connection layer to route; nothing here touches a socket, and durable
//! changes go to the store as writes it doesn't wait for.
mod people;

use crate::content::Content;
use crate::protocol::{ClientMsg, ErrorCode, Look, Place, ServerMsg, Snapshot, Tile, Walk};
use crate::room::Room;
use crate::store::Store;
use crate::trust::TrustBook;
use crate::tuning::Tuning;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum To {
    All,
    One(u32),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Out {
    pub to: To,
    pub msg: ServerMsg,
}

#[derive(Debug, Clone)]
pub enum Input {
    Join { id: u32, name: String, look: Look },
    /// The connection dropped; the seat is kept for the grace period.
    Drop { id: u32 },
    Msg { id: u32, msg: ClientMsg },
}

#[derive(Debug, Clone)]
struct Person {
    id: u32,
    name: String,
    look: Look,
    place: Place,
    at: Tile,
    walk: Option<Walk>,
    joined: u64,
    away_since: Option<u64>,
    pending: Option<Pending>,
}

/// Something a person asked for that happens when their walk ends.
#[derive(Debug, Clone, PartialEq)]
enum Pending {
    Pet(String),
}

/// A bubble, held in memory until the next tick so the cats can hear it.
#[derive(Debug, Clone)]
struct Heard {
    by: u32,
    text: String,
}

pub struct World {
    room: Room,
    tuning: Tuning,
    people: Vec<Person>,
    trust: TrustBook,
    /// When each bubble of the last minute was said: the room's noise.
    noise: VecDeque<u64>,
    heard: Vec<Heard>,
    /// People who have just come inside, for the cats to notice.
    arrivals: Vec<u32>,
    rng: ChaCha8Rng,
    store: Option<Store>,
    build: String,
    last_tick: u64,
    last_save: u64,
}

impl World {
    pub fn new(
        content: Content,
        trust: TrustBook,
        _saved_cats: Vec<(String, String)>,
        seed: u64,
        store: Option<Store>,
        build: String,
        now: u64,
    ) -> World {
        World {
            room: content.room,
            tuning: content.tuning,
            people: Vec::new(),
            trust,
            noise: VecDeque::new(),
            heard: Vec::new(),
            arrivals: Vec::new(),
            rng: ChaCha8Rng::seed_from_u64(seed),
            store,
            build,
            last_tick: now,
            last_save: now,
        }
    }

    pub fn handle(&mut self, now: u64, input: Input) -> Vec<Out> {
        let mut out = Vec::new();
        match input {
            Input::Join { id, name, look } => self.join(now, id, name, look, &mut out),
            Input::Drop { id } => self.drop_connection(now, id),
            Input::Msg { id, msg } => match msg {
                ClientMsg::WalkTo { tile } => self.walk_to(now, id, tile, &mut out),
                ClientMsg::Say { text, to } => self.say(now, id, text, to, &mut out),
                ClientMsg::Leave {} => self.remove(now, id, "left", &mut out),
                ClientMsg::Pet { .. } | ClientMsg::Call { .. } => {
                    error(&mut out, id, ErrorCode::UnknownCat, "There's no cat by that name here.")
                }
            },
        }
        out
    }

    pub fn tick(&mut self, now: u64) -> Vec<Out> {
        let mut out = Vec::new();
        self.last_tick = now;
        self.noise.retain(|&t| now.saturating_sub(t) < 60_000);
        let _arrived = self.people_tick(now, &mut out);
        self.heard.clear();
        self.arrivals.clear();
        if now.saturating_sub(self.last_save) >= self.tuning.save_every_secs * 1000 {
            self.save(now);
        }
        out
    }

    pub fn snapshot_for(&self, _id: u32, now: u64) -> Snapshot {
        Snapshot {
            room: self.room.view(),
            people: self.people.iter().map(|p| people::person_view(p, now)).collect(),
            cats: Vec::new(),
            your_trust: Vec::new(),
        }
    }

    /// Saves what the world keeps across restarts (Task 9 adds the cats).
    pub fn save(&mut self, now: u64) {
        self.last_save = now;
        if let Some(store) = &self.store {
            store.fire(move |c| crate::store::put_world(c, "saved_at", &now.to_string()));
        }
    }
}

fn error(out: &mut Vec<Out>, id: u32, code: ErrorCode, detail: &str) {
    out.push(Out { to: To::One(id), msg: ServerMsg::Error { code, detail: detail.to_string() } });
}

/// The tile a walk has most recently reached at `now`.
pub fn walk_tile(walk: &Walk, now: u64) -> Tile {
    let steps = (now.saturating_sub(walk.start) as f64 * walk.speed as f64 / 1000.0) as usize;
    walk.path[steps.min(walk.path.len() - 1)]
}

/// When a walk reaches its last tile.
pub fn walk_end(walk: &Walk) -> u64 {
    walk.start + (walk.path.len().saturating_sub(1) as f64 / walk.speed as f64 * 1000.0).ceil() as u64
}
```

Above the tests in `server/src/world/people.rs`:

```rust
//! People in the café: arriving, the line at the window (ADR 0008), walking,
//! talking (ADR 0010), dropping out, coming back and leaving.
use super::{Heard, Out, Pending, Person, To, World, error, walk_end, walk_tile};
use crate::protocol::{ErrorCode, Look, PersonView, Place, ServerMsg, Tile, Walk};
use crate::room::Walker;

pub(super) fn person_view(p: &Person, now: u64) -> PersonView {
    PersonView {
        id: p.id,
        name: p.name.clone(),
        look: p.look,
        place: p.place,
        at: p.walk.as_ref().map_or(p.at, |w| walk_tile(w, now)),
        walk: p.walk.clone(),
    }
}

impl World {
    pub(super) fn inside(&self) -> usize {
        self.people.iter().filter(|p| p.place == Place::Inside).count()
    }

    pub(super) fn person(&self, id: u32) -> Option<&Person> {
        self.people.iter().find(|p| p.id == id)
    }

    fn person_mut(&mut self, id: u32) -> Option<&mut Person> {
        self.people.iter_mut().find(|p| p.id == id)
    }

    /// Where someone is now, mid-walk or standing.
    pub(super) fn person_tile(&self, id: u32, now: u64) -> Option<Tile> {
        self.person(id).map(|p| p.walk.as_ref().map_or(p.at, |w| walk_tile(w, now)))
    }

    pub(super) fn join(&mut self, now: u64, id: u32, name: String, look: Look, out: &mut Vec<Out>) {
        if let Some(p) = self.person_mut(id) {
            // Back within the grace period, or a second tab: the same seat.
            p.away_since = None;
        } else {
            let place = if self.inside() < self.tuning.cap { Place::Inside } else { Place::Window };
            let walk = (place == Place::Inside).then(|| self.entering_walk(now));
            let door = self.room.door;
            self.people.push(Person { id, name: name.clone(), look, place, at: door, walk, joined: now, away_since: None, pending: None });
            tracing::info!(target: "action", uid = id, who = %name, what = "arrive", place = ?place);
            let person = person_view(self.person(id).expect("just added"), now);
            out.push(Out { to: To::All, msg: ServerMsg::PersonJoined { person } });
            if place == Place::Inside {
                self.arrivals.push(id);
            }
        }
        let snapshot = self.snapshot_for(id, now);
        let welcome = ServerMsg::Welcome { you: id, build: self.build.clone(), now, cap: self.tuning.cap as u32, snapshot };
        out.insert(0, Out { to: To::One(id), msg: welcome });
    }

    pub(super) fn drop_connection(&mut self, now: u64, id: u32) {
        if let Some(p) = self.person_mut(id) {
            p.away_since = Some(now);
        }
    }

    pub(super) fn remove(&mut self, now: u64, id: u32, why: &str, out: &mut Vec<Out>) {
        let Some(i) = self.people.iter().position(|p| p.id == id) else { return };
        let gone = self.people.remove(i);
        tracing::info!(target: "action", uid = id, who = %gone.name, what = "leave", why);
        out.push(Out { to: To::All, msg: ServerMsg::PersonLeft { id } });
        self.promote(now, out);
    }

    /// While seats are free, the first in line at the window walks in.
    fn promote(&mut self, now: u64, out: &mut Vec<Out>) {
        while self.inside() < self.tuning.cap {
            let Some(i) = self
                .people
                .iter()
                .enumerate()
                .filter(|(_, p)| p.place == Place::Window)
                .min_by_key(|(_, p)| p.joined)
                .map(|(i, _)| i)
            else {
                break;
            };
            let walk = self.entering_walk(now);
            let door = self.room.door;
            let p = &mut self.people[i];
            p.place = Place::Inside;
            p.at = door;
            p.walk = Some(walk.clone());
            let id = p.id;
            tracing::info!(target: "action", uid = id, who = %p.name, what = "come_in");
            out.push(Out { to: To::All, msg: ServerMsg::PersonPlaced { id, place: Place::Inside, at: door, walk: Some(walk) } });
            self.arrivals.push(id);
        }
    }

    fn entering_walk(&self, now: u64) -> Walk {
        let path = self
            .room
            .path(self.room.door, self.room.entry, Walker::Person)
            .unwrap_or_else(|| vec![self.room.door, self.room.entry]);
        Walk { path, start: now, speed: self.tuning.person_speed }
    }

    /// True if `id` is inside; someone at the window is told they can only talk.
    pub(super) fn inside_or_refuse(&self, id: u32, out: &mut Vec<Out>) -> bool {
        match self.person(id).map(|p| p.place) {
            Some(Place::Inside) => true,
            Some(Place::Window) => {
                error(out, id, ErrorCode::NotFromWindow, "From the window you can only talk.");
                false
            }
            None => false,
        }
    }

    pub(super) fn walk_to(&mut self, now: u64, id: u32, tile: Tile, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let from = self.person_tile(id, now).expect("checked above");
        let Some(path) = self.room.path(from, tile, Walker::Person) else {
            return error(out, id, ErrorCode::BadTile, "You can't stand there.");
        };
        self.start_walk(now, id, from, path, None, out);
        let name = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %name, what = "walk", x = tile.x, y = tile.y);
    }

    /// Walks to `target` and does `then` on arrival. False if there's no way there.
    pub(super) fn approach(&mut self, now: u64, id: u32, target: Tile, then: Pending, out: &mut Vec<Out>) -> bool {
        let Some(from) = self.person_tile(id, now) else { return false };
        let Some(path) = self.room.path(from, target, Walker::Person) else { return false };
        self.start_walk(now, id, from, path, Some(then), out);
        true
    }

    fn start_walk(&mut self, now: u64, id: u32, from: Tile, path: Vec<Tile>, then: Option<Pending>, out: &mut Vec<Out>) {
        let walk = Walk { path, start: now, speed: self.tuning.person_speed };
        let p = self.person_mut(id).expect("callers check the person is here");
        p.at = from;
        p.walk = Some(walk.clone());
        p.pending = then;
        out.push(Out { to: To::All, msg: ServerMsg::PersonMoved { id, walk } });
    }

    pub(super) fn say(&mut self, now: u64, id: u32, text: String, to: Option<u32>, out: &mut Vec<Out>) {
        let Some(p) = self.person(id) else { return };
        let name = p.name.clone();
        let text = text.trim().to_string();
        let chars = text.chars().count();
        if chars == 0 {
            return error(out, id, ErrorCode::Empty, "Say something first.");
        }
        if chars > self.tuning.bubble_max_chars {
            return error(out, id, ErrorCode::TooLong, &format!("A bubble holds {} characters.", self.tuning.bubble_max_chars));
        }
        if to.is_some_and(|t| self.person(t).is_none()) {
            return error(out, id, ErrorCode::UnknownPerson, "They've left.");
        }
        // Never log what was said (AGENTS.md): who, how long, and to whom.
        tracing::info!(target: "action", uid = id, who = %name, what = "say", len = chars, to = ?to);
        let ttl_ms = self.tuning.bubble_ttl_ms(chars);
        self.noise.push_back(now);
        self.heard.push(Heard { by: id, text: text.clone() });
        out.push(Out { to: To::All, msg: ServerMsg::Said { from: id, text, to, ttl_ms } });
    }

    /// Ends finished walks, returning what people asked to do when they got
    /// there, and lets go of seats whose grace period has run out.
    pub(super) fn people_tick(&mut self, now: u64, out: &mut Vec<Out>) -> Vec<(u32, Pending)> {
        let mut arrived = Vec::new();
        for p in &mut self.people {
            if let Some(w) = &p.walk
                && now >= walk_end(w)
            {
                p.at = *w.path.last().expect("paths are never empty");
                p.walk = None;
                if let Some(then) = p.pending.take() {
                    arrived.push((p.id, then));
                }
            }
        }
        let grace = self.tuning.grace_secs * 1000;
        let expired: Vec<u32> = self
            .people
            .iter()
            .filter(|p| p.away_since.is_some_and(|t| now.saturating_sub(t) >= grace))
            .map(|p| p.id)
            .collect();
        for id in expired {
            self.remove(now, id, "timed out", out);
        }
        arrived
    }
}
```

In `docs/design.md`, under "People", after the "Arriving" bullet, add:

```markdown
- **Leaving:** a Leave button walks you out at once and frees your seat for the
  next in line; closing the tab or losing the connection keeps the seat for the
  grace period.
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p cafe world`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add server/src/world server/src/main.rs docs/design.md
git commit -m "Run the café's world: arriving, the window line, walking, talking"
git push origin HEAD:main
```

---

### Task 9: The world: cats

The cats come into the world (ADR 0011): placed where they were saved, with
needs that drift, choosing what to do by the rules in `cats.rs`, walking, and
answering people. Pets change trust and only the petter is told; their name in
a bubble makes them look up (and come, if they know the speaker); a noisy room
sends shy cats into hiding; a friend is greeted at the door; and the first time
a cat meets someone while awake it sniffs their hand, so even a first visit
leaves a trace.

**Files:**
- Create: `server/src/world/cat_life.rs`
- Modify: `server/src/world/mod.rs` (replace: cats in the struct, `new`, `handle`, `tick`, `snapshot_for`, `save`), `docs/design.md` (the first sniff)

**Interfaces:**
- Consumes: Task 8's world internals; `cats::{CatDef, Saved, Situation, Choice, Outcome, options, pick, pet_outcome}` (Task 7); `trust::TrustBook::{apply, value, has_met, view, row}` (Task 6); `room::{Walker, chebyshev, manhattan, FurnitureKind}`; `time::{canberra_day, canberra_minute_of_day}`.
- Produces: no new public items. `World::new` now uses `saved_cats` (JSON of `cats::Saved`, by cat id); `snapshot_for` fills `cats` and `your_trust`; `save` writes each cat's `Saved` state and `saved_at`. Messages: `CatMoved`, `CatPosed`, `CatReacted`, `YourTrust` (only to the person concerned).

- [ ] **Step 1: Write the failing tests**

`server/src/world/cat_life.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::super::people::tests::{join, world};
    use super::super::*;
    use super::*;
    use crate::protocol::ClientMsg;

    fn seeded(seed: u64) -> World {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        World::new(content, trust, Vec::new(), seed, None, "test".into(), 0)
    }

    fn cat_index(w: &World, id: &str) -> usize {
        w.cats.iter().position(|c| c.def.id == id).unwrap()
    }

    /// Holds a cat still and awake at `at`, so a test decides what happens.
    fn hold(w: &mut World, cat: &str, at: Tile) -> usize {
        let i = cat_index(w, cat);
        let c = &mut w.cats[i];
        c.walk = None;
        c.pose = Pose::Idle;
        c.until = u64::MAX;
        c.plan = Plan::Idle;
        c.at = at;
        i
    }

    /// Stands a person, still, at `at`.
    fn stand(w: &mut World, person: u32, at: Tile) {
        let p = w.people.iter_mut().find(|p| p.id == person).unwrap();
        p.walk = None;
        p.at = at;
    }

    fn pet(id: u32, cat: &str) -> Input {
        Input::Msg { id, msg: ClientMsg::Pet { cat: cat.into() } }
    }

    fn reactions(outs: &[Out]) -> Vec<Reaction> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::CatReacted { reaction, .. } => Some(*reaction),
                _ => None,
            })
            .collect()
    }

    fn trust_msgs(outs: &[Out]) -> Vec<(To, f32)> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::YourTrust { trust } => Some((o.to, trust.value)),
                _ => None,
            })
            .collect()
    }

    fn walk_of(outs: &[Out], cat: &str) -> Option<Walk> {
        outs.iter().find_map(|o| match &o.msg {
            ServerMsg::CatMoved { cat: c, walk } if c == cat => Some(walk.clone()),
            _ => None,
        })
    }

    const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };

    #[test]
    fn cats_start_on_tiles_a_cat_can_stand_on() {
        let w = world();
        assert_eq!(w.cats.len(), 3);
        for c in &w.cats {
            assert!(w.room.walkable(c.at, Walker::Cat));
        }
    }

    #[test]
    fn cats_move_on_their_own() {
        let mut w = seeded(2);
        let moved: usize = (1..=6_000u64)
            .map(|step| w.tick(step * 100).iter().filter(|o| matches!(o.msg, ServerMsg::CatMoved { .. })).count())
            .sum();
        assert!(moved > 0, "nobody moved in ten minutes");
    }

    #[test]
    fn the_first_pet_from_a_stranger_is_a_sniff_that_leaves_a_trace() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        hold(&mut w, "burakku", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        let outs = w.handle(10, pet(1, "burakku"));
        assert_eq!(reactions(&outs), vec![Reaction::Sniff { by: 1 }]);
        let trust = trust_msgs(&outs);
        assert_eq!(trust.len(), 1);
        assert_eq!(trust[0].0, To::One(1), "only the person petting hears about their trust");
        assert!(trust[0].1 > 0.0);
    }

    #[test]
    fn pets_after_the_first_build_trust_within_the_daily_allowance() {
        let mut w = seeded(4);
        join(&mut w, 1, 0);
        for n in 0..60u64 {
            let i = hold(&mut w, "mochi", T(5, 7));
            w.cats[i].refused.clear();
            stand(&mut w, 1, T(5, 8));
            w.handle(1_000 + n * 20_000, pet(1, "mochi"));
        }
        let value = w.trust.value("mochi", 1);
        assert!(value > 2.0, "{value}");
        assert!(value <= 10.0 + 1e-3, "{value}");
    }

    #[test]
    fn a_napping_cat_refuses_and_stays_asleep() {
        let mut w = world();
        join(&mut w, 1, 0);
        let i = hold(&mut w, "mochi", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        w.trust.apply("mochi", 1.0, 1, 5.0, "1970-01-01");
        w.cats[i].pose = Pose::Nap;
        let outs = w.handle(10, pet(1, "mochi"));
        assert_eq!(reactions(&outs), vec![Reaction::Refuse { by: 1 }]);
        assert!(trust_msgs(&outs).is_empty());
        assert_eq!(w.cats[i].pose, Pose::Nap);
    }

    #[test]
    fn petting_again_right_after_a_refusal_is_pushing_and_costs_trust() {
        let mut w = world();
        join(&mut w, 1, 0);
        let i = hold(&mut w, "mochi", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        w.trust.apply("mochi", 1.0, 1, 5.0, "1970-01-01");
        w.cats[i].pose = Pose::Nap;
        w.handle(10, pet(1, "mochi"));
        let before = w.trust.value("mochi", 1);
        let outs = w.handle(5_000, pet(1, "mochi"));
        assert_eq!(reactions(&outs), vec![Reaction::Refuse { by: 1 }]);
        assert!(w.trust.value("mochi", 1) < before);
        assert_eq!(trust_msgs(&outs).len(), 1);
    }

    #[test]
    fn a_cat_looks_up_at_its_name_and_comes_to_someone_it_knows() {
        let mut w = world();
        join(&mut w, 1, 0);
        stand(&mut w, 1, T(6, 2));
        hold(&mut w, "mochi", T(1, 8));
        for day in ["1970-01-01", "1970-01-02", "1970-01-03"] {
            w.trust.apply("mochi", 1.0, 1, 10.0, day);
        }
        w.handle(100, Input::Msg { id: 1, msg: ClientMsg::Say { text: "Mochi, come here!".into(), to: None } });
        let outs = w.tick(200);
        assert!(reactions(&outs).contains(&Reaction::LookUp { at: 1 }));
        let walk = walk_of(&outs, "mochi").expect("mochi comes over");
        assert!(chebyshev(*walk.path.last().unwrap(), T(6, 2)) <= 1);
    }

    #[test]
    fn a_stranger_calling_gets_only_a_look() {
        let mut w = world();
        join(&mut w, 1, 0);
        stand(&mut w, 1, T(6, 2));
        hold(&mut w, "mochi", T(1, 8));
        w.handle(100, Input::Msg { id: 1, msg: ClientMsg::Say { text: "mochi?".into(), to: None } });
        let outs = w.tick(200);
        assert!(reactions(&outs).contains(&Reaction::LookUp { at: 1 }));
        assert!(walk_of(&outs, "mochi").is_none());
    }

    #[test]
    fn calling_a_cat_is_saying_its_name() {
        let mut w = world();
        join(&mut w, 1, 0);
        let outs = w.handle(10, Input::Msg { id: 1, msg: ClientMsg::Call { cat: "tora".into() } });
        assert!(outs.iter().any(|o| matches!(&o.msg, ServerMsg::Said { from: 1, text, .. } if text == "Tora")));
    }

    #[test]
    fn a_noisy_room_sends_burakku_into_hiding() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        hold(&mut w, "burakku", T(6, 7));
        for n in 0..5u64 {
            let id = 1 + (n as u32 % 2);
            w.handle(100 + n, Input::Msg { id, msg: ClientMsg::Say { text: format!("chatter {n}"), to: None } });
        }
        let outs = w.tick(200);
        let walk = walk_of(&outs, "burakku").expect("burakku moves");
        assert!(w.room.spots(|k| k.hide).contains(walk.path.last().unwrap()));
    }

    #[test]
    fn a_friend_is_greeted_at_the_door() {
        let mut w = world();
        hold(&mut w, "mochi", T(1, 8));
        for d in 1..=6 {
            w.trust.apply("mochi", 1.0, 1, 10.0, &format!("1970-01-0{d}"));
        }
        join(&mut w, 1, 0);
        let outs = w.tick(100);
        let walk = walk_of(&outs, "mochi").expect("mochi heads for the door");
        assert!(chebyshev(*walk.path.last().unwrap(), w.room.entry) <= 1);
        let later = w.tick(walk_end(&walk) + 1);
        assert!(reactions(&later).contains(&Reaction::Greet { to: 1 }));
    }

    #[test]
    fn petting_from_across_the_room_walks_over_first() {
        let mut w = world();
        join(&mut w, 1, 0);
        hold(&mut w, "tora", T(5, 8));
        stand(&mut w, 1, T(7, 1));
        let outs = w.handle(10, pet(1, "tora"));
        let walk = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: 1, walk } => Some(walk.clone()),
                _ => None,
            })
            .expect("walks over");
        assert!(reactions(&outs).is_empty());
        let later = w.tick(walk_end(&walk) + 1);
        assert_eq!(reactions(&later), vec![Reaction::Sniff { by: 1 }]);
    }

    #[test]
    fn the_welcome_shows_the_cats_and_your_trust_in_each() {
        let mut w = world();
        w.trust.apply("tora", 0.6, 1, 0.6, "1970-01-01");
        let outs = join(&mut w, 1, 0);
        let ServerMsg::Welcome { snapshot, .. } = &outs[0].msg else { panic!("welcome first") };
        assert_eq!(snapshot.cats.len(), 3);
        assert_eq!(snapshot.your_trust.iter().find(|t| t.cat == "tora").unwrap().value, 0.6);
    }

    #[test]
    fn saved_cats_come_back_where_they_were_unless_that_is_now_a_wall() {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        let saved = vec![
            ("mochi".to_string(), r#"{"at":{"x":1,"y":5},"tiredness":0.7,"company":0.1}"#.to_string()),
            ("tora".to_string(), r#"{"at":{"x":0,"y":0},"tiredness":0.1,"company":0.1}"#.to_string()),
        ];
        let w = World::new(content, trust, saved, 11, None, "test".into(), 0);
        let mochi = &w.cats[cat_index(&w, "mochi")];
        assert_eq!((mochi.at, mochi.tiredness), (T(1, 5), 0.7));
        let tora = &w.cats[cat_index(&w, "tora")];
        assert!(w.room.walkable(tora.at, Walker::Cat));
    }

    #[tokio::test]
    async fn saving_writes_each_cat_and_the_clock() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("cafe.db")).unwrap();
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        let mut w = World::new(content, trust, Vec::new(), 13, Some(store.clone()), "test".into(), 0);
        w.save(5_000);
        let states = store.call(|c| crate::store::all_cat_states(c)).await.unwrap();
        assert_eq!(states.len(), 3);
        let saved_at = store.call(|c| crate::store::get_world(c, "saved_at")).await.unwrap();
        assert_eq!(saved_at.as_deref(), Some("5000"));
    }
}
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cargo test -p cafe world`
Expected: compile errors in `cat_life.rs`, `cannot find type Plan` / `no field cats on World`.

- [ ] **Step 3: Write the implementation**

Above the tests in `server/src/world/cat_life.rs`:

```rust
//! The cats in the café (ADR 0011; design.md, "The cats"): where they start,
//! their needs, what they choose to do, and how they answer people: a first
//! sniff, pets, their names in a bubble, a friend at the door, a noisy room.
use super::{Heard, Out, Pending, To, World, error, walk_end, walk_tile};
use crate::cats::{CatDef, Choice, Outcome, Saved, Situation, options, pet_outcome, pick};
use crate::protocol::{CatView, ErrorCode, Place, Pose, Reaction, ServerMsg, Tile, Walk};
use crate::room::{FurnitureKind, Walker, chebyshev, manhattan};
use crate::time::{canberra_day, canberra_minute_of_day};
use crate::trust::TrustBook;
use rand::RngExt;

/// Petting a cat again this soon after it refused you is pushing.
const PUSHING_MS: u64 = 10_000;

#[derive(Debug, Clone)]
pub(super) struct Cat {
    pub def: CatDef,
    pub at: Tile,
    pub walk: Option<Walk>,
    pub pose: Pose,
    /// When the current pose ends and the cat chooses again.
    pub until: u64,
    /// What the cat does when its walk ends.
    pub plan: Plan,
    pub tiredness: f32,
    pub company: f32,
    /// Whom it refused, and when, for spotting pushing.
    pub refused: Vec<(u32, u64)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) enum Plan {
    Idle,
    Nap,
    Sit,
    Hide,
    Greet(u32),
}

impl Cat {
    pub fn tile(&self, now: u64) -> Tile {
        self.walk.as_ref().map_or(self.at, |w| walk_tile(w, now))
    }

    pub fn resting(&self) -> bool {
        matches!(self.pose, Pose::Nap | Pose::Hide)
    }

    pub fn view(&self, now: u64) -> CatView {
        CatView {
            id: self.def.id.clone(),
            name: self.def.name.clone(),
            coat: self.def.coat.clone(),
            at: self.tile(now),
            pose: self.pose,
            walk: self.walk.clone(),
        }
    }

    pub fn saved(&self, now: u64) -> Saved {
        Saved { at: self.tile(now), tiredness: self.tiredness, company: self.company }
    }
}

fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).map(str::to_lowercase).collect()
}

fn contains_words(said: &[String], name: &[String]) -> bool {
    !name.is_empty() && said.windows(name.len()).any(|w| w == name)
}

impl World {
    /// A cat comes back where it was saved, if a cat can still stand there;
    /// otherwise somewhere on the floor, rested.
    pub(super) fn place_cat(&mut self, def: CatDef, saved: Option<Saved>, now: u64) -> Cat {
        let saved = saved.filter(|s| self.room.walkable(s.at, Walker::Cat));
        let (at, tiredness, company) = match saved {
            Some(s) => (s.at, s.tiredness.clamp(0.0, 1.0), s.company.clamp(0.0, 1.0)),
            None => (self.random_floor(), 0.2, 0.5),
        };
        let until = now + self.rng.random_range(3_000..8_000u64);
        Cat { def, at, walk: None, pose: Pose::Idle, until, plan: Plan::Idle, tiredness, company, refused: Vec::new() }
    }

    fn random_floor(&mut self) -> Tile {
        let tiles: Vec<Tile> = self.room.floor(Walker::Cat).into_iter().filter(|t| !self.room.walkway.contains(t)).collect();
        if tiles.is_empty() {
            return self.room.entry;
        }
        tiles[self.rng.random_range(0..tiles.len())]
    }

    fn cat_on(&self, t: Tile, except: usize, now: u64) -> bool {
        self.cats.iter().enumerate().any(|(j, c)| j != except && c.tile(now) == t)
    }

    pub(super) fn cats_tick(&mut self, now: u64, dt: u64, out: &mut Vec<Out>) {
        let minute = canberra_minute_of_day(now);
        let hours = dt as f32 / 3_600_000.0;
        let people: Vec<Tile> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside)
            .filter_map(|p| self.person_tile(p.id, now))
            .collect();
        for cat in &mut self.cats {
            if cat.pose == Pose::Nap {
                // A nap rests a cat in about twenty minutes.
                cat.tiredness = (cat.tiredness - hours * 3.0).max(0.0);
            } else {
                cat.tiredness = (cat.tiredness + hours * (1.2 - cat.def.traits.energy)).min(1.0);
            }
            let near = people.iter().any(|&t| chebyshev(t, cat.tile(now)) <= 2);
            cat.company = if near { (cat.company - hours * 6.0).max(0.0) } else { (cat.company + hours * 2.0).min(1.0) };
        }
        for id in std::mem::take(&mut self.arrivals) {
            self.greet(now, minute, id, out);
        }
        for heard in std::mem::take(&mut self.heard) {
            self.hear(now, minute, heard, out);
        }
        for i in 0..self.cats.len() {
            let arrived = self.cats[i].walk.as_ref().is_some_and(|w| now >= walk_end(w));
            if arrived {
                self.settle(i, now, out);
            } else if self.cats[i].walk.is_none() && now >= self.cats[i].until {
                self.choose(i, now, minute, out);
            }
        }
    }

    fn choose(&mut self, i: usize, now: u64, minute: u32, out: &mut Vec<Out>) {
        let id = self.cats[i].def.id.clone();
        let people: Vec<(u32, f32)> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside)
            .map(|p| (p.id, self.trust.value(&id, p.id)))
            .collect();
        let situation = Situation {
            minute,
            people: &people,
            noise: self.noise.len() as f32,
            tiredness: self.cats[i].tiredness,
            company: self.cats[i].company,
        };
        let scored = options(&self.cats[i].def, &situation);
        let choice = pick(scored, &mut self.rng);
        let from = self.cats[i].tile(now);
        let (target, plan) = match choice {
            Choice::Idle => (None, Plan::Idle),
            Choice::Wander => (self.wander_target(i, from, now), Plan::Idle),
            Choice::Nap => (self.free_spot(i, now, |k| k.nap), Plan::Nap),
            Choice::Hide => (self.free_spot(i, now, |k| k.hide), Plan::Hide),
            Choice::Approach(person) => (self.beside(i, person, now), Plan::Sit),
        };
        match target {
            Some(t) => self.walk_cat(i, now, minute, t, plan, out),
            None => {
                self.cats[i].plan = plan;
                self.settle(i, now, out);
            }
        }
    }

    fn wander_target(&mut self, i: usize, from: Tile, now: u64) -> Option<Tile> {
        let near: Vec<Tile> = self
            .room
            .floor(Walker::Cat)
            .into_iter()
            .filter(|&t| t != from && manhattan(t, from) <= 6 && !self.cat_on(t, i, now))
            .collect();
        (!near.is_empty()).then(|| near[self.rng.random_range(0..near.len())])
    }

    fn free_spot(&mut self, i: usize, now: u64, keep: impl Fn(&FurnitureKind) -> bool) -> Option<Tile> {
        let spots: Vec<Tile> = self.room.spots(keep).into_iter().filter(|&t| !self.cat_on(t, i, now)).collect();
        (!spots.is_empty()).then(|| spots[self.rng.random_range(0..spots.len())])
    }

    /// A tile next to a person that no other cat is on.
    fn beside(&mut self, i: usize, person: u32, now: u64) -> Option<Tile> {
        let at = self.person_tile(person, now)?;
        let tiles: Vec<Tile> = self.room.around(at, Walker::Cat).into_iter().filter(|&t| !self.cat_on(t, i, now)).collect();
        (!tiles.is_empty()).then(|| tiles[self.rng.random_range(0..tiles.len())])
    }

    fn walk_cat(&mut self, i: usize, now: u64, minute: u32, target: Tile, plan: Plan, out: &mut Vec<Out>) {
        let from = self.cats[i].tile(now);
        self.cats[i].plan = plan;
        match self.room.path(from, target, Walker::Cat) {
            Some(path) if path.len() > 1 => {
                let speed = self.tuning.cat_speed * self.cats[i].def.speed_factor(minute);
                let walk = Walk { path, start: now, speed };
                let cat = &mut self.cats[i];
                cat.at = from;
                cat.walk = Some(walk.clone());
                cat.pose = Pose::Walk;
                out.push(Out { to: To::All, msg: ServerMsg::CatMoved { cat: cat.def.id.clone(), walk } });
            }
            _ => {
                let cat = &mut self.cats[i];
                cat.at = from;
                cat.walk = None;
                self.settle(i, now, out);
            }
        }
    }

    /// Ends a walk, or a choice that needed none, in the pose its plan asked for.
    fn settle(&mut self, i: usize, now: u64, out: &mut Vec<Out>) {
        let plan = self.cats[i].plan;
        let secs: u64 = match plan {
            Plan::Nap => self.rng.random_range(120..600),
            Plan::Sit => self.rng.random_range(20..60),
            Plan::Hide => 60,
            Plan::Greet(_) => 10,
            Plan::Idle => self.rng.random_range(3..8),
        };
        let pose = match plan {
            Plan::Nap => Pose::Nap,
            Plan::Hide => Pose::Hide,
            Plan::Sit | Plan::Greet(_) => Pose::Sit,
            Plan::Idle => Pose::Idle,
        };
        let cat = &mut self.cats[i];
        if let Some(w) = cat.walk.take() {
            cat.at = *w.path.last().expect("paths are never empty");
        }
        cat.pose = pose;
        cat.until = now + secs * 1000;
        cat.plan = Plan::Idle;
        let (id, at) = (cat.def.id.clone(), cat.at);
        out.push(Out { to: To::All, msg: ServerMsg::CatPosed { cat: id.clone(), pose, at } });
        if let Plan::Greet(to) = plan {
            out.push(Out { to: To::All, msg: ServerMsg::CatReacted { cat: id, reaction: Reaction::Greet { to } } });
        }
    }

    /// Someone came inside: each awake cat that counts them a friend goes to the door.
    fn greet(&mut self, now: u64, minute: u32, person: u32, out: &mut Vec<Out>) {
        let friend = self.tuning.trust_levels[1];
        for i in 0..self.cats.len() {
            if self.cats[i].resting() || self.trust.value(&self.cats[i].def.id, person) < friend {
                continue;
            }
            let spot = self
                .room
                .around(self.room.entry, Walker::Cat)
                .into_iter()
                .find(|t| !self.room.walkway.contains(t) && !self.cat_on(*t, i, now));
            if let Some(spot) = spot {
                self.walk_cat(i, now, minute, spot, Plan::Greet(person), out);
            }
        }
    }

    /// A bubble: a cat named in it looks up (and comes to someone it knows);
    /// otherwise, if the room has got too noisy for it, a shy cat goes to hide.
    fn hear(&mut self, now: u64, minute: u32, heard: Heard, out: &mut Vec<Out>) {
        let said = words(&heard.text);
        let noise = self.noise.len() as f32;
        let familiar = self.tuning.trust_levels[0];
        let speaker_inside = self.person(heard.by).is_some_and(|p| p.place == Place::Inside);
        for i in 0..self.cats.len() {
            let id = self.cats[i].def.id.clone();
            let resting = self.cats[i].resting();
            if contains_words(&said, &words(&self.cats[i].def.name)) {
                out.push(Out { to: To::All, msg: ServerMsg::CatReacted { cat: id.clone(), reaction: Reaction::LookUp { at: heard.by } } });
                if !resting
                    && speaker_inside
                    && self.trust.value(&id, heard.by) >= familiar
                    && let Some(t) = self.beside(i, heard.by, now)
                {
                    self.walk_cat(i, now, minute, t, Plan::Sit, out);
                }
            } else if !resting
                && self.cats[i].plan != Plan::Hide
                && noise >= self.cats[i].def.hide_threshold()
                && let Some(t) = self.free_spot(i, now, |k| k.hide)
            {
                self.walk_cat(i, now, minute, t, Plan::Hide, out);
            }
        }
    }

    pub(super) fn pet(&mut self, now: u64, id: u32, cat: &str, out: &mut Vec<Out>) {
        let Some(i) = self.cats.iter().position(|c| c.def.id == cat) else {
            return error(out, id, ErrorCode::UnknownCat, "There's no cat by that name here.");
        };
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let here = self.person_tile(id, now).expect("checked above");
        let walking = self.person(id).is_some_and(|p| p.walk.is_some());
        let cat_at = self.cats[i].tile(now);
        if !walking && chebyshev(here, cat_at) <= 1 {
            return self.touch(now, id, i, out);
        }
        let spot = self.room.around(cat_at, Walker::Person).into_iter().min_by_key(|&t| manhattan(t, here));
        let walked = spot.is_some_and(|spot| self.approach(now, id, spot, Pending::Pet(cat.to_string()), out));
        if !walked {
            error(out, id, ErrorCode::BadTile, "You can't get next to that cat from here.");
        }
    }

    /// Someone's walk ended with something to do.
    pub(super) fn arrived_with(&mut self, now: u64, id: u32, then: Pending, out: &mut Vec<Out>) {
        let Pending::Pet(cat) = then;
        let Some(i) = self.cats.iter().position(|c| c.def.id == cat) else { return };
        let close = self.person_tile(id, now).is_some_and(|h| chebyshev(h, self.cats[i].tile(now)) <= 1);
        if close {
            self.touch(now, id, i, out);
        } else {
            error(out, id, ErrorCode::MovedAway, &format!("{} moved away.", self.cats[i].def.name));
        }
    }

    /// Calling a cat is saying its name (design.md, "People").
    pub(super) fn call(&mut self, now: u64, id: u32, cat: &str, out: &mut Vec<Out>) {
        let Some(name) = self.cats.iter().find(|c| c.def.id == cat).map(|c| c.def.name.clone()) else {
            return error(out, id, ErrorCode::UnknownCat, "There's no cat by that name here.");
        };
        self.say(now, id, name, None, out);
    }

    fn touch(&mut self, now: u64, id: u32, i: usize, out: &mut Vec<Out>) {
        let cat_id = self.cats[i].def.id.clone();
        let rate = self.cats[i].def.traits.trust_rate;
        let today = canberra_day(now);
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        // The first hello: awake, a cat sniffs the hand of someone it has never met.
        if !self.cats[i].resting() && !self.trust.has_met(&cat_id, id) {
            self.react(i, Reaction::Sniff { by: id }, out);
            self.change_trust(i, id, rate, &today, out);
            tracing::info!(target: "action", uid = id, who = %who, what = "pet", cat = %cat_id, outcome = "sniff");
            return;
        }
        let pushing = self.cats[i].refused.iter().any(|&(by, at)| by == id && now.saturating_sub(at) < PUSHING_MS);
        let outcome = if pushing {
            Outcome::Refuse
        } else {
            let roll: f32 = self.rng.random();
            pet_outcome(&self.cats[i].def, self.cats[i].pose, self.trust.value(&cat_id, id), roll)
        };
        match outcome {
            Outcome::Welcome => {
                self.react(i, Reaction::Purr { by: id }, out);
                self.change_trust(i, id, 2.0 * rate, &today, out);
                let cat = &mut self.cats[i];
                cat.at = cat.tile(now);
                cat.walk = None;
                cat.plan = Plan::Sit;
                self.settle(i, now, out);
            }
            Outcome::Tolerate => {
                self.react(i, Reaction::Tolerate { by: id }, out);
                self.change_trust(i, id, 0.5 * rate, &today, out);
            }
            Outcome::Refuse => {
                self.react(i, Reaction::Refuse { by: id }, out);
                if pushing {
                    self.change_trust(i, id, -1.0, &today, out);
                }
                let cat = &mut self.cats[i];
                cat.refused.retain(|&(_, at)| now.saturating_sub(at) < PUSHING_MS);
                cat.refused.push((id, now));
                if !self.cats[i].resting() {
                    self.walk_away(i, id, now, out);
                }
            }
        }
        let outcome = match (pushing, outcome) {
            (true, _) => "pushed",
            (false, Outcome::Welcome) => "welcome",
            (false, Outcome::Tolerate) => "tolerate",
            (false, Outcome::Refuse) => "refuse",
        };
        tracing::info!(target: "action", uid = id, who = %who, what = "pet", cat = %cat_id, outcome);
    }

    fn react(&mut self, i: usize, reaction: Reaction, out: &mut Vec<Out>) {
        out.push(Out { to: To::All, msg: ServerMsg::CatReacted { cat: self.cats[i].def.id.clone(), reaction } });
    }

    /// Applies a change in trust, stores it, and tells only the person concerned.
    fn change_trust(&mut self, i: usize, id: u32, delta: f32, today: &str, out: &mut Vec<Out>) {
        let cat_id = self.cats[i].def.id.clone();
        let Some(rec) = self.trust.apply(&cat_id, self.cats[i].def.traits.trust_rate, id, delta, today) else { return };
        if let Some(store) = &self.store {
            let row = TrustBook::row(&cat_id, id, &rec);
            store.fire(move |c| crate::store::put_trust(c, &row));
        }
        out.push(Out { to: To::One(id), msg: ServerMsg::YourTrust { trust: self.trust.view(&cat_id, id) } });
    }

    /// A refusing cat walks off, a few tiles from whoever it refused.
    fn walk_away(&mut self, i: usize, from_person: u32, now: u64, out: &mut Vec<Out>) {
        let minute = canberra_minute_of_day(now);
        let them = self.person_tile(from_person, now).unwrap_or(self.room.entry);
        let here = self.cats[i].tile(now);
        let away: Vec<Tile> = self
            .room
            .floor(Walker::Cat)
            .into_iter()
            .filter(|&t| manhattan(t, them) >= 3 && manhattan(t, here) <= 6 && !self.cat_on(t, i, now))
            .collect();
        if !away.is_empty() {
            let target = away[self.rng.random_range(0..away.len())];
            self.walk_cat(i, now, minute, target, Plan::Idle, out);
        }
    }
}
```

Replace `server/src/world/mod.rs`:

```rust
//! The café's one world (ADR 0004): people, the line at the window, walks,
//! bubbles and the cats. `handle` and `tick` return messages for the
//! connection layer to route; nothing here touches a socket, and durable
//! changes go to the store as writes it doesn't wait for.
mod cat_life;
mod people;

use crate::cats::Saved;
use crate::content::Content;
use crate::protocol::{ClientMsg, ErrorCode, Look, Place, ServerMsg, Snapshot, Tile, Walk};
use crate::room::Room;
use crate::store::Store;
use crate::trust::TrustBook;
use crate::tuning::Tuning;
use cat_life::Cat;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::collections::VecDeque;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum To {
    All,
    One(u32),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Out {
    pub to: To,
    pub msg: ServerMsg,
}

#[derive(Debug, Clone)]
pub enum Input {
    Join { id: u32, name: String, look: Look },
    /// The connection dropped; the seat is kept for the grace period.
    Drop { id: u32 },
    Msg { id: u32, msg: ClientMsg },
}

#[derive(Debug, Clone)]
struct Person {
    id: u32,
    name: String,
    look: Look,
    place: Place,
    at: Tile,
    walk: Option<Walk>,
    joined: u64,
    away_since: Option<u64>,
    pending: Option<Pending>,
}

/// Something a person asked for that happens when their walk ends.
#[derive(Debug, Clone, PartialEq)]
enum Pending {
    Pet(String),
}

/// A bubble, held in memory until the next tick so the cats can hear it.
#[derive(Debug, Clone)]
struct Heard {
    by: u32,
    text: String,
}

pub struct World {
    room: Room,
    tuning: Tuning,
    people: Vec<Person>,
    cats: Vec<Cat>,
    trust: TrustBook,
    /// When each bubble of the last minute was said: the room's noise.
    noise: VecDeque<u64>,
    heard: Vec<Heard>,
    /// People who have just come inside, for the cats to notice.
    arrivals: Vec<u32>,
    rng: ChaCha8Rng,
    store: Option<Store>,
    build: String,
    last_tick: u64,
    last_save: u64,
}

impl World {
    pub fn new(
        content: Content,
        trust: TrustBook,
        saved_cats: Vec<(String, String)>,
        seed: u64,
        store: Option<Store>,
        build: String,
        now: u64,
    ) -> World {
        let Content { tuning, room, cats } = content;
        let mut world = World {
            room,
            tuning,
            people: Vec::new(),
            cats: Vec::new(),
            trust,
            noise: VecDeque::new(),
            heard: Vec::new(),
            arrivals: Vec::new(),
            rng: ChaCha8Rng::seed_from_u64(seed),
            store,
            build,
            last_tick: now,
            last_save: now,
        };
        for def in cats {
            let saved = saved_cats
                .iter()
                .find(|(id, _)| *id == def.id)
                .and_then(|(_, json)| serde_json::from_str::<Saved>(json).ok());
            let cat = world.place_cat(def, saved, now);
            world.cats.push(cat);
        }
        world
    }

    pub fn handle(&mut self, now: u64, input: Input) -> Vec<Out> {
        let mut out = Vec::new();
        match input {
            Input::Join { id, name, look } => self.join(now, id, name, look, &mut out),
            Input::Drop { id } => self.drop_connection(now, id),
            Input::Msg { id, msg } => match msg {
                ClientMsg::WalkTo { tile } => self.walk_to(now, id, tile, &mut out),
                ClientMsg::Say { text, to } => self.say(now, id, text, to, &mut out),
                ClientMsg::Pet { cat } => self.pet(now, id, &cat, &mut out),
                ClientMsg::Call { cat } => self.call(now, id, &cat, &mut out),
                ClientMsg::Leave {} => self.remove(now, id, "left", &mut out),
            },
        }
        out
    }

    pub fn tick(&mut self, now: u64) -> Vec<Out> {
        let mut out = Vec::new();
        let dt = now.saturating_sub(self.last_tick);
        self.last_tick = now;
        self.noise.retain(|&t| now.saturating_sub(t) < 60_000);
        for (id, then) in self.people_tick(now, &mut out) {
            self.arrived_with(now, id, then, &mut out);
        }
        self.cats_tick(now, dt, &mut out);
        if now.saturating_sub(self.last_save) >= self.tuning.save_every_secs * 1000 {
            self.save(now);
        }
        out
    }

    pub fn snapshot_for(&self, id: u32, now: u64) -> Snapshot {
        Snapshot {
            room: self.room.view(),
            people: self.people.iter().map(|p| people::person_view(p, now)).collect(),
            cats: self.cats.iter().map(|c| c.view(now)).collect(),
            your_trust: self.cats.iter().map(|c| self.trust.view(&c.def.id, id)).collect(),
        }
    }

    /// Saves each cat's place and needs, and the world clock, through the store.
    pub fn save(&mut self, now: u64) {
        self.last_save = now;
        let Some(store) = &self.store else { return };
        let cats: Vec<(String, String)> = self
            .cats
            .iter()
            .map(|c| (c.def.id.clone(), serde_json::to_string(&c.saved(now)).expect("a cat's state serialises")))
            .collect();
        store.fire(move |conn| {
            for (id, json) in &cats {
                crate::store::put_cat_state(conn, id, json, now)?;
            }
            crate::store::put_world(conn, "saved_at", &now.to_string())
        });
    }
}

fn error(out: &mut Vec<Out>, id: u32, code: ErrorCode, detail: &str) {
    out.push(Out { to: To::One(id), msg: ServerMsg::Error { code, detail: detail.to_string() } });
}

/// The tile a walk has most recently reached at `now`.
pub fn walk_tile(walk: &Walk, now: u64) -> Tile {
    let steps = (now.saturating_sub(walk.start) as f64 * walk.speed as f64 / 1000.0) as usize;
    walk.path[steps.min(walk.path.len() - 1)]
}

/// When a walk reaches its last tile.
pub fn walk_end(walk: &Walk) -> u64 {
    walk.start + (walk.path.len().saturating_sub(1) as f64 / walk.speed as f64 * 1000.0).ceil() as u64
}
```

In `docs/design.md`, under "The cats", at the start of the "Being handled" bullet, add the sentence:

```markdown
The first time a cat that's awake meets someone, it sniffs their hand: a small
first gain in trust, so even a first visit leaves a trace.
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cargo test -p cafe world`
Expected: PASS: Task 8's 11 tests and these 14.

- [ ] **Step 5: Run the whole suite**

Run: `cargo test -p cafe`
Expected: PASS, every test so far.

- [ ] **Step 6: Commit**

```bash
git add server/src/world docs/design.md
git commit -m "Let the cats live in the café: needs, choices, pets, names, noise"
git push origin HEAD:main
```

---

<!-- tasks follow -->
