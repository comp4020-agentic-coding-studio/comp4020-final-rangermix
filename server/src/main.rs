//! The cat café server: one binary that serves the client, the README, the
//! accounts API and the WebSocket, and owns the café's world.
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
mod time;
mod trust;
mod tuning;
mod world;
mod ws;

use std::net::SocketAddr;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().json().flatten_event(true).init();
    let config = config::Config::from_env();
    std::fs::create_dir_all(&config.data_dir)?;
    let store = store::Store::open(&config.data_dir.join("cafe.db"))?;
    let content = content::load(&config.content_dir)?;
    let tuning = content.tuning.clone();
    let mut trust = trust::TrustBook::new(tuning.trust_levels, tuning.trust_daily_cap);
    trust.load(store.call(|c| store::all_trust(c)).await?);
    let saved_cats = store.call(|c| store::all_cat_states(c)).await?;
    let build = config.build_id();
    let now = time::now_ms();
    let mut world = world::World::new(content, trust, saved_cats, now, Some(store.clone()), build.clone(), now);
    if let Some(arrangement) = store.call(|c| store::get_world(c, "furniture")).await? {
        world.restore_arrangement(&arrangement);
    }
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
