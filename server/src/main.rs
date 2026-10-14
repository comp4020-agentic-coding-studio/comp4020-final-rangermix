//! The cat café server: one binary that serves the client, the README, the
//! accounts API and the WebSocket, and owns the café's world.
mod anger;
mod api;
mod auth;
mod cats;
mod config;
mod content;
mod http;
mod limits;
mod protocol;
mod readme;
mod room;
mod store;
#[cfg(test)]
mod test_logs;
mod time;
mod trust;
mod tuning;
mod wake;
mod world;
mod ws;

use anyhow::Context;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().json().flatten_event(true).init();
    // A panic is one of the café's JSON lines too, not Rust's plain text.
    std::panic::set_hook(Box::new(|info| {
        tracing::error!(target: "sys", error = %info, "panicked");
    }));
    // Failures are loud (design.md, "Persistence and fast-forward"), and in
    // the café's own JSON lines, like everything else it says.
    if let Err(e) = run().await {
        tracing::error!(target: "sys", error = %format!("{e:#}"), "stopping: the café can't start");
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let config = config::Config::from_env();
    std::fs::create_dir_all(&config.data_dir)?;
    let db = config.data_dir.join("cafe.db");
    let store = store::Store::open(&db).with_context(|| format!("can't open the database at {}", db.display()))?;
    let content = content::load(&config.content_dir)?;
    let tuning = content.tuning.clone();
    let build = config.build_id();
    let now = time::now_ms();
    // The doors open only once the café has caught up on its sleep (ADR 0006).
    let world = wake::wake(&store, content, build.clone(), now, now).await?;
    let world_tx = ws::spawn_world(world);
    let readme = readme::render_page(&std::fs::read_to_string(&config.readme_path).unwrap_or_default());
    let port = config.port;
    let state = http::AppState::new(config, readme, store.clone(), tuning, world_tx.clone());
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(target: "sys", port, build = %build, "listening");
    let save_on_stop = async move {
        shutdown_signal().await;
        tracing::info!(target: "sys", "stopping: saving the café");
        let (done, saved) = tokio::sync::oneshot::channel();
        if world_tx.send(ws::Command::Shutdown { done }).await.is_ok() {
            let _ = saved.await;
        }
        let _ = store.flush().await;
    };
    axum::serve(listener, http::router(state).into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(save_on_stop)
        .await?;
    Ok(())
}

/// Fly stops a machine with SIGINT, and waits only about five seconds; SIGTERM
/// is the fallback. The world is saved every five seconds anyway.
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
