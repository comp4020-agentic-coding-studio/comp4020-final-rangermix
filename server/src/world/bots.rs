//! Bots (slice 17): visitors the server runs for a demo account, which take
//! seats and join the line, and now and then walk somewhere or wave. They
//! never talk, sit, handle a cat or touch furniture; they're never stored,
//! and the cats never meet them, so no trust or board line names one.
use super::{Out, Person, To, World, error, walk_tile};
use crate::protocol::{Emote, ErrorCode, Look, Place, ServerMsg, Tile};
use crate::room::Walker;
use rand::RngExt;

/// Bots' ids start here, far above any account's.
pub const BOT_IDS: u32 = 4_000_000_000;

/// A bot's own clock: who added it, when it goes, and when it next moves.
#[derive(Debug, Clone, PartialEq)]
pub struct Bot {
    pub by: u32,
    pub until: u64,
    pub next: u64,
}

const EMOTES: [Emote; 4] = [Emote::Wave, Emote::Laugh, Emote::Heart, Emote::Yawn];

impl World {
    pub(super) fn add_bot(&mut self, now: u64, by: u32, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(by, out) {
            return;
        }
        let taken: Vec<u32> = self.people.iter().filter(|p| p.bot.is_some()).map(|p| p.id - BOT_IDS).collect();
        let Some(n) = (1..=self.tuning.bots_max as u32).find(|n| !taken.contains(n)) else {
            return error(out, by, ErrorCode::BotsFull, "The café takes no more bots.");
        };
        let (id, name) = (BOT_IDS + n, format!("bot_{n}"));
        let look = Look {
            avatar: (n % crate::api::AVATARS as u32) as u8,
            colour: ((n + 2) % crate::api::COLOURS as u32) as u8,
        };
        let mut joining = Vec::new();
        self.join(now, id, name.clone(), look, false, &mut joining);
        let first = now + self.bot_pause();
        if let Some(p) = self.people.iter_mut().find(|p| p.id == id) {
            p.bot = Some(Bot {
                by,
                until: now + self.tuning.bot_stay_mins * 60_000,
                next: first,
            });
        }
        // Nobody to welcome, nobody for the cats to meet, and everyone sees
        // it's a bot.
        joining.retain(|o| o.to != To::One(id));
        self.arrivals.retain(|&a| a != id);
        if let Some(p) = self.person(id) {
            let view = super::people::person_view(p, now);
            for o in &mut joining {
                if let ServerMsg::PersonJoined { person } = &mut o.msg
                    && person.id == id
                {
                    *person = view.clone();
                }
            }
        }
        out.extend(joining);
        let who = self.person(by).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = by, who = %who, what = "add_bot", outcome = "ok", bot = %name);
    }

    pub(super) fn remove_bot(&mut self, now: u64, by: u32, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(by, out) {
            return;
        }
        let newest = self.people.iter().filter(|p| p.bot.is_some()).max_by_key(|p| (p.joined, p.id));
        let Some((id, name)) = newest.map(|p| (p.id, p.name.clone())) else {
            return error(out, by, ErrorCode::NoBots, "There's no bot here.");
        };
        let who = self.person(by).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = by, who = %who, what = "remove_bot", outcome = "ok", bot = %name);
        self.remove(now, id, "removed", out);
    }

    /// A demo account that leaves takes its bots with it.
    pub(super) fn bots_follow(&mut self, now: u64, gone: u32, out: &mut Vec<Out>) {
        let theirs: Vec<u32> = self
            .people
            .iter()
            .filter(|p| p.bot.as_ref().is_some_and(|b| b.by == gone))
            .map(|p| p.id)
            .collect();
        for id in theirs {
            self.remove(now, id, "with_demo", out);
        }
    }

    /// Bots whose time is up leave; the rest, inside and standing still,
    /// now and then walk to somewhere free or wave.
    pub(super) fn bots_tick(&mut self, now: u64, out: &mut Vec<Out>) {
        let done: Vec<u32> = self
            .people
            .iter()
            .filter(|p| p.bot.as_ref().is_some_and(|b| now >= b.until))
            .map(|p| p.id)
            .collect();
        for id in done {
            self.remove(now, id, "time_up", out);
        }
        let due: Vec<u32> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside && p.walk.is_none() && !p.leaving)
            .filter(|p| p.bot.as_ref().is_some_and(|b| now >= b.next))
            .map(|p| p.id)
            .collect();
        for id in due {
            if self.rng.random_bool(0.75) {
                self.bot_wander(now, id, out);
            } else {
                let emote = EMOTES[self.rng.random_range(0..EMOTES.len())];
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::Emoted { from: id, emote },
                });
            }
            let pause = self.bot_pause();
            if let Some(b) = self.people.iter_mut().find(|p| p.id == id).and_then(|p| p.bot.as_mut()) {
                b.next = now + pause;
            }
        }
    }

    /// 20 to 40 seconds.
    fn bot_pause(&mut self) -> u64 {
        self.rng.random_range(20_000..=40_000)
    }

    /// A walk to the free floor nearest a tile picked at random: never onto
    /// someone, or the door's walkway.
    fn bot_wander(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        let Some(from) = self.person_tile(id, now) else { return };
        let pick = Tile {
            x: self.rng.random_range(0..self.room.width),
            y: self.rng.random_range(1..self.room.height),
        };
        let taken: Vec<Tile> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside)
            .flat_map(|p| {
                let here = p.walk.as_ref().map_or(p.at, |w| walk_tile(w, now));
                std::iter::once(here).chain(p.walk.as_ref().and_then(|w| w.path.last().copied()))
            })
            .collect();
        let walkway = self.room.walkway.clone();
        let Some(to) = self
            .room
            .nearest(pick, Walker::Person, |t| !taken.contains(&t) && !walkway.contains(&t))
        else {
            return;
        };
        if let Some(path) = self.room.path(from, to, Walker::Person).filter(|p| p.len() > 1) {
            self.start_walk(now, id, from, path, None, out);
        }
    }
}

/// A bot's timers move on with a jump, so the jump spends none of its time.
pub(super) fn later(p: &mut Person, gap: u64) {
    if let Some(b) = p.bot.as_mut() {
        b.until += gap;
        b.next += gap;
    }
}
