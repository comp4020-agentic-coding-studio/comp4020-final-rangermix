//! The café's one world (ADR 0004): people, the line at the window, walks,
//! bubbles and the cats. `handle` and `tick` return messages for the
//! connection layer to route; nothing here touches a socket, and durable
//! changes go to the store as writes it doesn't wait for.
mod cat_life;
mod furniture;
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
    Join {
        id: u32,
        name: String,
        look: Look,
    },
    /// The connection dropped; the seat is kept for the grace period.
    Drop {
        id: u32,
    },
    Msg {
        id: u32,
        msg: ClientMsg,
    },
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
                ClientMsg::MoveFurniture { id: piece, to } => self.move_furniture(id, piece, to, &mut out),
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
            .map(|c| {
                (
                    c.def.id.clone(),
                    serde_json::to_string(&c.saved(now)).expect("a cat's state serialises"),
                )
            })
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
    out.push(Out {
        to: To::One(id),
        msg: ServerMsg::Error {
            code,
            detail: detail.to_string(),
        },
    });
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
