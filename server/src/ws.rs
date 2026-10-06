//! The task that owns the world (ADR 0004), the routing of its messages to
//! connections, and the WebSocket endpoint at /ws.
use crate::api::current_user;
use crate::http::{AppState, origin_ok};
use crate::limits::Bucket;
use crate::protocol::{ClientMsg, ErrorCode, Look, ServerMsg};
use crate::store::UserRow;
use crate::time::now_ms;
use crate::world::{Input, Out, To, World};
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot};

pub enum Command {
    Join { id: u32, name: String, look: Look, conn: u64, tx: mpsc::Sender<Arc<str>> },
    Leave { id: u32, conn: u64 },
    Msg { id: u32, conn: u64, msg: ClientMsg },
    /// Save the world and stop: Fly is stopping the machine.
    Shutdown { done: oneshot::Sender<()> },
}

/// Each person's current connection: its id, and where to send its messages.
type Conns = HashMap<u32, (u64, mpsc::Sender<Arc<str>>)>;

pub fn spawn_world(world: World) -> mpsc::Sender<Command> {
    let (tx, rx) = mpsc::channel(1024);
    tokio::spawn(world_task(world, rx));
    tx
}

async fn world_task(mut world: World, mut rx: mpsc::Receiver<Command>) {
    let mut conns: Conns = HashMap::new();
    let mut ticker = tokio::time::interval(Duration::from_millis(100));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        tokio::select! {
            cmd = rx.recv() => {
                let Some(cmd) = cmd else { break };
                let now = now_ms();
                match cmd {
                    Command::Join { id, name, look, conn, tx } => {
                        if let Some((_, old)) = conns.insert(id, (conn, tx)) {
                            // A second tab: the first is told, then let go.
                            let _ = old.try_send(text(&ServerMsg::Replaced {}));
                        }
                        let outs = world.handle(now, Input::Join { id, name, look });
                        deliver(&mut world, &mut conns, outs, now);
                    }
                    Command::Leave { id, conn } => {
                        if conns.get(&id).is_some_and(|(c, _)| *c == conn) {
                            conns.remove(&id);
                            let outs = world.handle(now, Input::Drop { id });
                            deliver(&mut world, &mut conns, outs, now);
                        }
                    }
                    Command::Msg { id, conn, msg } => {
                        if conns.get(&id).is_some_and(|(c, _)| *c == conn) {
                            let outs = world.handle(now, Input::Msg { id, msg });
                            deliver(&mut world, &mut conns, outs, now);
                        }
                    }
                    Command::Shutdown { done } => {
                        world.save(now);
                        let _ = done.send(());
                        break;
                    }
                }
            }
            _ = ticker.tick() => {
                let now = now_ms();
                let outs = world.tick(now);
                deliver(&mut world, &mut conns, outs, now);
            }
        }
    }
}

/// Sends each message to its connections. A connection whose queue is full
/// has fallen too far behind: it's let go (its client reconnects to a fresh
/// snapshot) and the world hears it dropped.
fn deliver(world: &mut World, conns: &mut Conns, outs: Vec<Out>, now: u64) {
    let mut pending = outs;
    while !pending.is_empty() {
        let dropped = route(conns, pending);
        pending = dropped.into_iter().flat_map(|id| world.handle(now, Input::Drop { id })).collect();
    }
}

fn route(conns: &mut Conns, outs: Vec<Out>) -> Vec<u32> {
    let mut dropped = Vec::new();
    for out in outs {
        let msg = text(&out.msg);
        match out.to {
            To::All => conns.retain(|id, (_, tx)| {
                let ok = tx.try_send(msg.clone()).is_ok();
                if !ok {
                    dropped.push(*id);
                }
                ok
            }),
            To::One(id) => {
                if let Some((_, tx)) = conns.get(&id)
                    && tx.try_send(msg).is_err()
                {
                    conns.remove(&id);
                    dropped.push(id);
                }
            }
        }
    }
    dropped
}

fn text(msg: &ServerMsg) -> Arc<str> {
    serde_json::to_string(msg).expect("server messages serialise").into()
}

pub async fn upgrade(State(app): State<AppState>, headers: HeaderMap, ws: WebSocketUpgrade) -> Response {
    if !origin_ok(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    match current_user(&app, &headers).await {
        Ok(Some(user)) => ws.on_upgrade(move |socket| connection(socket, app, user)),
        Ok(None) => StatusCode::UNAUTHORIZED.into_response(),
        Err(failure) => failure.into_response(),
    }
}

async fn connection(socket: WebSocket, app: AppState, user: UserRow) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::channel::<Arc<str>>(app.tuning.outbound_queue);
    let conn = app.conn_ids.fetch_add(1, Ordering::Relaxed);
    let id = user.id as u32;
    let look = Look { avatar: user.avatar, colour: user.colour };
    if app.world.send(Command::Join { id, name: user.name.clone(), look, conn, tx }).await.is_err() {
        return;
    }
    let t = &app.tuning;
    let now = now_ms();
    let mut speech = Bucket::new(t.bubble_burst, 1.0 / t.bubble_refill_secs, now);
    let mut actions = Bucket::new(t.action_burst, t.action_per_sec, now);
    // Fly's proxy drops connections that go quiet; a ping keeps a calm café open.
    let mut ping = tokio::time::interval(Duration::from_secs(25));
    loop {
        tokio::select! {
            out = rx.recv() => match out {
                Some(text) => {
                    if sink.send(Message::Text(text.as_ref().into())).await.is_err() {
                        break;
                    }
                }
                // The world let go: another tab took over, or this one fell behind.
                None => break,
            },
            incoming = stream.next() => match incoming {
                Some(Ok(Message::Text(frame))) => {
                    let Ok(msg) = serde_json::from_str::<ClientMsg>(frame.as_str()) else { continue };
                    let now = now_ms();
                    let allowed = match msg {
                        ClientMsg::Say { .. } | ClientMsg::Call { .. } => speech.take(now),
                        _ => actions.take(now),
                    };
                    if !allowed {
                        let slow = text(&ServerMsg::Error { code: ErrorCode::RateLimited, detail: "Slow down a little.".into() });
                        if sink.send(Message::Text(slow.as_ref().into())).await.is_err() {
                            break;
                        }
                        continue;
                    }
                    if app.world.send(Command::Msg { id, conn, msg }).await.is_err() {
                        break;
                    }
                }
                Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                Some(Ok(_)) => {}
            },
            _ = ping.tick() => {
                if sink.send(Message::Ping(Vec::new().into())).await.is_err() {
                    break;
                }
            }
        }
    }
    let _ = app.world.send(Command::Leave { id, conn }).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn out(to: To, n: u32) -> Out {
        Out { to, msg: ServerMsg::PersonLeft { id: n } }
    }

    #[test]
    fn a_connection_that_falls_behind_is_dropped_and_the_others_keep_receiving() {
        let mut conns: Conns = HashMap::new();
        let (slow_tx, _slow_rx) = mpsc::channel(1);
        let (fast_tx, mut fast_rx) = mpsc::channel(16);
        conns.insert(1, (1, slow_tx));
        conns.insert(2, (2, fast_tx));
        let dropped = route(&mut conns, (0..3).map(|n| out(To::All, n)).collect());
        assert_eq!(dropped, vec![1]);
        assert!(!conns.contains_key(&1));
        let mut received = 0;
        while fast_rx.try_recv().is_ok() {
            received += 1;
        }
        assert_eq!(received, 3);
    }

    #[test]
    fn a_message_for_one_person_reaches_only_them() {
        let mut conns: Conns = HashMap::new();
        let (a_tx, mut a_rx) = mpsc::channel(4);
        let (b_tx, mut b_rx) = mpsc::channel(4);
        conns.insert(1, (1, a_tx));
        conns.insert(2, (2, b_tx));
        assert!(route(&mut conns, vec![out(To::One(2), 9)]).is_empty());
        assert!(a_rx.try_recv().is_err());
        assert_eq!(b_rx.try_recv().unwrap().as_ref(), r#"{"type":"personLeft","id":9}"#);
    }
}
