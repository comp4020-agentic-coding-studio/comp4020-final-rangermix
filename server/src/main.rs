//! The cat café server: one binary that serves the client, the README, the
//! accounts API and the WebSocket, and owns the café's world.
mod config;
mod http;
mod protocol;
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
