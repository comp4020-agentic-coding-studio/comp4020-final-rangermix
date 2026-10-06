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
