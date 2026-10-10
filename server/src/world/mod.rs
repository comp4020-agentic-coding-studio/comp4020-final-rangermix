//! The café's one world (ADR 0004): people, the line at the window, walks,
//! bubbles and the cats. `handle` and `tick` return messages for the
//! connection layer to route; nothing here touches a socket, and durable
//! changes go to the store as writes it doesn't wait for.
mod cat_life;
#[cfg(test)]
mod cats_tests;
mod furniture;
#[cfg(test)]
mod furniture_tests;
mod handling;
#[cfg(test)]
mod log_tests;
mod people;
mod quiet;
mod treats;

use crate::cats::{Handling, Saved};
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
    /// When they last sent anything but "my tab is hidden" (ADR 0009).
    last_input: u64,
    hidden_since: Option<u64>,
    /// When they were asked "still there?", until they answer.
    nudged: Option<u64>,
    /// Walking out after an unanswered nudge; their seat is already free.
    leaving: bool,
    /// The piece they sit on; `at` is the seat.
    sitting: Option<u32>,
    /// Their furniture changes: a burst, then a slow refill (per person, so a
    /// reconnect doesn't refill it).
    furniture: crate::limits::Bucket,
}

/// Something a person asked for that happens when their walk ends.
#[derive(Debug, Clone, PartialEq)]
enum Pending {
    /// Pet, play, offer a treat or pick up this cat.
    Handle(String, crate::cats::Handling),
    Tidy(u32),
    Grab(u32),
    Place(Tile),
    Sit(u32),
}

/// How the furniture was left when the server last stopped.
pub enum SavedArrangement {
    /// Nothing saved: `room.toml` as it is.
    Fresh,
    /// Every movable piece by kind and place.
    Current(String),
    /// Phase 1's cushion-only save, by list position.
    Legacy(String),
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
    held: Vec<furniture::Held>,
    reserved: furniture::Reserved,
    anger: handling::Angers,
    bans: Vec<crate::store::BanRow>,
    treat_book: treats::TreatBook,
    floor_treats: Vec<treats::FloorTreat>,
    next_treat: u32,
    bowls: u8,
    /// Which refill the bowls are on, so each refill happens once.
    bowls_key: String,
    /// Pieces put down lately, for curious cats: piece, where, when.
    new_pieces: Vec<(u32, Tile, u64)>,
    /// A cat answered this action and its line is written.
    answered: bool,
}

impl World {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        content: Content,
        trust: TrustBook,
        saved_cats: Vec<(String, String)>,
        arrangement: SavedArrangement,
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
            held: Vec::new(),
            reserved: Default::default(),
            anger: Default::default(),
            bans: Vec::new(),
            treat_book: Default::default(),
            floor_treats: Vec::new(),
            next_treat: 1,
            bowls: 0,
            bowls_key: String::new(),
            new_pieces: Vec::new(),
            answered: false,
        };
        // The furniture first, so each cat is checked against the room it wakes in.
        match arrangement {
            SavedArrangement::Fresh => {}
            SavedArrangement::Current(json) => world.restore_arrangement(&json),
            SavedArrangement::Legacy(json) => world.restore_legacy_arrangement(&json),
        }
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
            Input::Drop { id } => self.drop_connection(now, id, &mut out),
            Input::Msg { id, msg } => {
                // Someone walking out after an unanswered nudge is on their way.
                if self.person(id).is_none_or(|p| p.leaving) {
                    return out;
                }
                self.heard_from(now, id, &msg, &mut out);
                let what = action_name(&msg);
                let before = out.len();
                let pending_before = self.person(id).and_then(|p| p.pending.clone());
                self.answered = false;
                match msg {
                    ClientMsg::WalkTo { tile } => self.walk_to(now, id, tile, &mut out),
                    ClientMsg::Say { text, to } => self.say(now, id, text, to, &mut out),
                    ClientMsg::Pet { cat } => self.handle_cat(now, id, &cat, Handling::Pet, &mut out),
                    ClientMsg::Play { cat } => self.handle_cat(now, id, &cat, Handling::Play, &mut out),
                    ClientMsg::OfferTreat { cat } => self.handle_cat(now, id, &cat, Handling::Offer, &mut out),
                    ClientMsg::PickUp { cat } => self.handle_cat(now, id, &cat, Handling::PickUp, &mut out),
                    ClientMsg::PutDown {} => self.put_down_cat(now, id, &mut out),
                    ClientMsg::PassCat { to } => self.pass_cat(now, id, to, &mut out),
                    ClientMsg::PutTreat {} => self.put_treat(now, id, &mut out),
                    ClientMsg::GiveTreat { to } => self.give_treat(now, id, to, &mut out),
                    ClientMsg::Tidy { id: piece } => self.tidy(now, id, piece, &mut out),
                    ClientMsg::Call { cat } => self.call(now, id, &cat, &mut out),
                    ClientMsg::Grab { id: piece } => self.grab(now, id, piece, &mut out),
                    ClientMsg::Take { kind } => self.take(now, id, &kind, &mut out),
                    ClientMsg::Place { to } => self.place(now, id, to, &mut out),
                    // With empty hands and no grab on the way there's nothing to put back.
                    ClientMsg::PutBack {} if self.held.iter().all(|h| h.by != id) && !matches!(pending_before, Some(Pending::Grab(_))) => {
                        error(&mut out, id, ErrorCode::NotHolding, "You aren't carrying anything.")
                    }
                    ClientMsg::PutBack {} => self.put_back(now, id, &mut out),
                    ClientMsg::PutAway {} => self.put_away(now, id, &mut out),
                    ClientMsg::Sit { id: piece } => self.sit(now, id, piece, &mut out),
                    ClientMsg::Leave {} => self.remove(now, id, "left", &mut out),
                    ClientMsg::Emote { emote } => self.emote(id, emote, &mut out),
                    ClientMsg::Presence { .. } | ClientMsg::Here {} => {}
                }
                if let Some(what) = what {
                    self.log_request(id, what, &out[before..], pending_before);
                }
            }
        }
        out
    }

    /// One line per action, whatever happened (crit 10): a refusal with its
    /// code, or the start of a walk over to do it. Handlers log what happens
    /// when it happens.
    fn log_request(&self, id: u32, what: &str, outs: &[Out], pending_before: Option<Pending>) {
        if self.answered {
            return;
        }
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        let refusal = outs.iter().find_map(|o| match (&o.to, &o.msg) {
            (To::One(to), ServerMsg::Error { code, .. }) if *to == id => Some(*code),
            _ => None,
        });
        if let Some(code) = refusal {
            tracing::info!(target: "action", uid = id, who = %who, what, outcome = "refused", code = code_name(code));
            return;
        }
        let pending = self.person(id).and_then(|p| p.pending.clone());
        if pending.is_some() && pending != pending_before {
            tracing::info!(target: "action", uid = id, who = %who, what, outcome = "walking");
        }
    }

    /// Someone's walk ended with something to do.
    fn arrived_with(&mut self, now: u64, id: u32, then: Pending, out: &mut Vec<Out>) {
        // Gone, or on the way out, in the same tick: nothing more to do.
        if self.person(id).is_none_or(|p| p.leaving) {
            return;
        }
        match then {
            Pending::Handle(cat, how) => self.handle_on_arrival(now, id, &cat, how, out),
            Pending::Tidy(piece) => self.stand_up_piece(now, id, piece, out),
            Pending::Grab(piece) => self.pick_up(now, id, piece, out),
            Pending::Place(to) => self.put_down(now, id, to, out),
            Pending::Sit(piece) => self.sit_down(now, id, piece, out),
        }
    }

    pub fn tick(&mut self, now: u64) -> Vec<Out> {
        let mut out = Vec::new();
        let dt = now.saturating_sub(self.last_tick);
        self.last_tick = now;
        self.noise.retain(|&t| now.saturating_sub(t) < 60_000);
        for (id, then) in self.people_tick(now, &mut out) {
            self.arrived_with(now, id, then, &mut out);
        }
        self.quiet_tick(now, &mut out);
        self.bowls_tick(now, &mut out);
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
            held: self.held_views(),
            treats: self.treat_views(),
            your_treats: self.treats_left(id, now),
            bowls: self.bowls,
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
        let bowls = self.bowls_json();
        store.fire(move |conn| {
            for (id, json) in &cats {
                crate::store::put_cat_state(conn, id, json, now)?;
            }
            crate::store::put_world(conn, "bowls", &bowls)?;
            crate::store::put_world(conn, "saved_at", &now.to_string())
        });
    }
}

/// The name an action goes by in the logs; None for what isn't an action
/// (a hidden tab, a "still here").
pub fn action_name(msg: &ClientMsg) -> Option<&'static str> {
    Some(match msg {
        ClientMsg::WalkTo { .. } => "walk",
        ClientMsg::Say { .. } => "say",
        ClientMsg::Pet { .. } => "pet",
        ClientMsg::Call { .. } => "call",
        ClientMsg::Grab { .. } => "grab",
        ClientMsg::Take { .. } => "take",
        ClientMsg::Place { .. } => "place",
        ClientMsg::PutBack {} => "put_back",
        ClientMsg::PutAway {} => "put_away",
        ClientMsg::Sit { .. } => "sit",
        ClientMsg::Leave {} => "leave",
        ClientMsg::Emote { .. } => "emote",
        ClientMsg::Play { .. } => "play",
        ClientMsg::OfferTreat { .. } => "offer",
        ClientMsg::PickUp { .. } => "pick_up",
        ClientMsg::PutDown {} => "put_down",
        ClientMsg::PassCat { .. } => "pass_cat",
        ClientMsg::PutTreat {} => "put_treat",
        ClientMsg::GiveTreat { .. } => "give_treat",
        ClientMsg::Tidy { .. } => "tidy",
        ClientMsg::Presence { .. } | ClientMsg::Here {} => return None,
    })
}

/// An error code as the wire spells it, for the logs.
pub fn code_name(code: ErrorCode) -> String {
    serde_json::to_value(code)
        .ok()
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_default()
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
