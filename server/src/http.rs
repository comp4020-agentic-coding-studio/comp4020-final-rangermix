//! Routes: the client, /readme/, and (from later tasks) the API and the
//! WebSocket.
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
    /// The world task's inbox.
    pub world: tokio::sync::mpsc::Sender<crate::ws::Command>,
    pub conn_ids: Arc<std::sync::atomic::AtomicU64>,
}

impl AppState {
    pub fn new(
        config: Config,
        readme: String,
        store: Store,
        tuning: Tuning,
        world: tokio::sync::mpsc::Sender<crate::ws::Command>,
    ) -> AppState {
        let per_min = |n: f64| Keyed::new(n, n / 60.0);
        let auth_limits = AuthLimits {
            by_name: per_min(tuning.auth_per_name_per_min),
            by_ip: per_min(tuning.auth_per_ip_per_min),
        };
        AppState {
            config: Arc::new(config),
            readme: readme.into(),
            store,
            tuning: Arc::new(tuning),
            hashing: Arc::new(Semaphore::new(2)),
            auth_limits: Arc::new(Mutex::new(auth_limits)),
            world,
            conn_ids: Arc::new(std::sync::atomic::AtomicU64::new(1)),
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
        .route("/ws", get(crate::ws::upgrade))
        // Sign-up and log-in bodies are tiny; nothing needs axum's 2 MB default.
        .layer(axum::extract::DefaultBodyLimit::max(16 * 1024))
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
pub fn client_ip(headers: &HeaderMap, peer: SocketAddr, behind_fly: bool) -> String {
    headers
        .get("fly-client-ip")
        .filter(|_| behind_fly)
        .and_then(|v| v.to_str().ok())
        .map(str::to_string)
        .unwrap_or_else(|| peer.ip().to_string())
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

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    pub(crate) fn app(dir: &std::path::Path) -> Router {
        let config = Config::from_lookup(|k| match k {
            "CLIENT_DIR" => Some(dir.join("no-client-yet").display().to_string()),
            "DOCS_DIR" => Some(dir.display().to_string()),
            _ => None,
        });
        let store = crate::store::Store::open(&dir.join("cafe.db")).unwrap();
        let tuning = crate::content::repo_content().tuning;
        let (world, _) = tokio::sync::mpsc::channel(1);
        router(AppState::new(
            config,
            crate::readme::render_page("# Hello\n\n## Second"),
            store,
            tuning,
            world,
        ))
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
        assert_eq!(client_ip(&h, peer, true), "10.0.0.1");
        h.insert("fly-client-ip", "203.0.113.9".parse().unwrap());
        assert_eq!(client_ip(&h, peer, true), "203.0.113.9");
    }

    #[test]
    fn off_fly_the_header_is_anyones_to_forge_so_it_is_ignored() {
        let peer: std::net::SocketAddr = "10.0.0.1:5000".parse().unwrap();
        let mut h = axum::http::HeaderMap::new();
        h.insert("fly-client-ip", "203.0.113.9".parse().unwrap());
        assert_eq!(client_ip(&h, peer, false), "10.0.0.1");
    }
}
