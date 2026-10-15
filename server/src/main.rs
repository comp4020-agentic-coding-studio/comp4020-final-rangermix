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
use std::future::IntoFuture;
use std::net::SocketAddr;
use std::sync::atomic::Ordering;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().json().flatten_event(true).init();
    // A panic is one of the café's JSON lines too, not Rust's plain text.
    std::panic::set_hook(Box::new(|info| {
        tracing::error!(target: "sys", error = %info, "panicked");
    }));
    // Failures are loud (design.md, "Persistence and fast-forward"), and in
    // the café's own JSON lines, like everything else it says.
    match run().await {
        // Without waiting for a replay a stop cut short: the save it started
        // from still stands.
        Ok(()) => std::process::exit(0),
        Err(e) => {
            tracing::error!(target: "sys", error = %format!("{e:#}"), "stopping: the café can't go on");
            std::process::exit(1);
        }
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
    let (world_tx, world_rx) = tokio::sync::mpsc::channel(1024);
    let readme = readme::render_page(&std::fs::read_to_string(&config.readme_path).unwrap_or_default());
    let port = config.port;
    let state = http::AppState::new(config, readme, store.clone(), tuning, world_tx.clone());
    let awake = state.awake.clone();
    // The doors open at once (slice 07): the page and the accounts work while
    // the café replays its sleep, and a café page opened meanwhile is told so.
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!(target: "sys", port, build = %build, "listening");
    let waking = {
        let (store, awake) = (store.clone(), awake.clone());
        tokio::spawn(async move {
            // The replay is CPU work: on a thread of its own, off the runtime's.
            let handle = tokio::runtime::Handle::current();
            let world = tokio::task::spawn_blocking(move || handle.block_on(wake::wake(&store, content, build, now, now))).await??;
            awake.store(true, Ordering::SeqCst);
            ws::world_task(world, world_rx).await;
            anyhow::Ok(())
        })
    };
    let save_on_stop = async move {
        shutdown_signal().await;
        if awake.load(Ordering::SeqCst) {
            tracing::info!(target: "sys", "stopping: saving the café");
            let (done, saved) = tokio::sync::oneshot::channel();
            if world_tx.send(ws::Command::Shutdown { done }).await.is_ok() {
                let _ = saved.await;
            }
        } else {
            tracing::info!(target: "sys", "stopping while the café wakes: its last save stands");
        }
        let _ = store.flush().await;
    };
    let server = axum::serve(listener, http::router(state).into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(save_on_stop)
        .into_future();
    supervise(async { server.await.map_err(anyhow::Error::from) }, waking).await
}

/// Runs the server until it has stopped, watching the café's world beside it.
/// A world that can't wake, or dies, is fatal: the process exits, and Fly
/// starts it again from the last save, rather than serve pages with no café
/// behind them (slice 07). A world that stopped on the stop signal waits for
/// the server to finish shutting down.
async fn supervise(
    server: impl std::future::Future<Output = anyhow::Result<()>>,
    mut world: tokio::task::JoinHandle<anyhow::Result<()>>,
) -> anyhow::Result<()> {
    tokio::pin!(server);
    tokio::select! {
        served = &mut server => served,
        ended = &mut world => match ended {
            Ok(Ok(())) => server.await,
            Ok(Err(e)) => Err(e.context("the café's world couldn't wake")),
            Err(e) => Err(anyhow::anyhow!("the café's world stopped: {e}")),
        },
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn a_world_that_panics_is_fatal() {
        // Slice 07: a café serving pages with a dead world is no café; Fly
        // restarts a process that exits.
        let world = tokio::spawn(async { panic!("a bug in a tick") });
        let server = std::future::pending::<anyhow::Result<()>>();
        let err = supervise(server, world).await.unwrap_err();
        assert!(format!("{err:#}").contains("world"), "{err:#}");
    }

    #[tokio::test]
    async fn a_world_that_cant_wake_is_fatal() {
        let world = tokio::spawn(async { Err(anyhow::anyhow!("can't read the store")) });
        let server = std::future::pending::<anyhow::Result<()>>();
        let err = supervise(server, world).await.unwrap_err();
        assert!(format!("{err:#}").contains("can't read the store"), "{err:#}");
    }

    #[tokio::test]
    async fn a_world_that_stopped_on_the_stop_signal_waits_for_the_server() {
        let world = tokio::spawn(async { Ok(()) });
        let server = async {
            tokio::time::sleep(Duration::from_millis(50)).await;
            Ok(())
        };
        supervise(server, world).await.unwrap();
    }
}
