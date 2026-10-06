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
