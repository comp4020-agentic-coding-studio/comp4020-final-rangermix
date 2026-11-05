//! A demo account moves the café's clock on (slice 17, ADR 0022): the café
//! lives the hours between by the replay a sleep uses, and the clock never
//! goes back.
//!
//! It's two steps, so every page can be told before the replay starts: the
//! ask answers with `jumping` to everyone and holds the jump; the world task
//! then runs it off the runtime and sends everyone a fresh welcome.
use super::{Out, Pending, To, World, error, walk_tile};
use crate::protocol::{ErrorCode, Place, ServerMsg};
use crate::room::Walker;

/// A jump asked for and not yet run: who asked, and to when.
#[derive(Debug, Clone, PartialEq)]
pub struct Jump {
    pub by: u32,
    pub to: u64,
}

impl World {
    pub(super) fn ask_jump(&mut self, now: u64, id: u32, minute: Option<u32>, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(id, out) {
            return;
        }
        if self.jump.is_some() || now < self.next_jump_at() {
            let secs = self.next_jump_at().saturating_sub(now).div_ceil(1000).max(1);
            return error(out, id, ErrorCode::TooSoon, &format!("The clock can move on again in {secs} s."));
        }
        let most = self.tuning.jump_max_hours * 3_600_000;
        let to = match minute {
            Some(minute) => crate::time::next_time_of_day(now, minute),
            None => crate::time::realign_gap(self.ahead).map(|gap| now + gap),
        };
        let Some(to) = to.filter(|&to| to - now <= most) else {
            let why = if minute.is_none() {
                "The café is on Canberra time already."
            } else {
                "That time isn't within a day."
            };
            return error(out, id, ErrorCode::BadTime, why);
        };
        let by = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %by, what = "set_clock", outcome = "ok", gap_secs = (to - now) / 1000);
        self.jump = Some(Jump { by: id, to });
        out.push(Out {
            to: To::All,
            msg: ServerMsg::Jumping { by, to },
        });
    }

    /// The jump the last ask held, for the world task to run.
    pub fn take_jump(&mut self) -> Option<Jump> {
        self.jump.take()
    }

    /// When, by the café's clock, it can move on again: a minute after the
    /// last jump landed (`jump_every_secs`).
    pub(super) fn next_jump_at(&self) -> u64 {
        self.last_jump.map_or(0, |at| at + self.tuning.jump_every_secs * 1000)
    }

    /// Lives the hours from `now` to the jump's time as the café lives a
    /// sleep, with the people inside set aside, then brings them back with
    /// their timers moved on by the gap, so the jump itself walks nobody
    /// out. The café's lead grows by the gap and is saved with the replay.
    /// Returns a welcome at the new time for everyone.
    pub fn run_jump(&mut self, now: u64, jump: Jump) -> Vec<Out> {
        let began = std::time::Instant::now();
        let to = jump.to.max(now);
        let gap = to - now;
        let who = self.person(jump.by).map(|p| p.name.clone()).unwrap_or_default();
        // Everyone gets a fresh welcome, so what settling says goes nowhere.
        let mut settling = Vec::new();
        self.settle_for_jump(now, &mut settling);
        self.ahead += gap;
        let mut people = std::mem::take(&mut self.people);
        self.arrivals.clear();
        self.heard.clear();
        let replay = self.replay(to);
        for p in &mut people {
            let later = |t: &mut u64| *t += gap;
            later(&mut p.joined);
            later(&mut p.last_input);
            p.away_since.as_mut().map(later);
            p.hidden_since.as_mut().map(later);
            p.nudged.as_mut().map(later);
        }
        self.people = people;
        self.cats_off_people(to);
        self.last_jump = Some(to);
        tracing::info!(target: "cafe", what = "jumped", uid = jump.by, who = %who, gap_secs = gap / 1000,
            steps = replay.steps, took_ms = began.elapsed().as_millis() as u64, refills = replay.refills,
            walks = %replay.walks_text());
        self.people
            .iter()
            .map(|p| Out {
                to: To::One(p.id),
                msg: self.welcome(p.id, to),
            })
            .collect()
    }

    /// Before a jump: walks end where they are, errands are called off, and
    /// what anyone carries goes back. A held cat gets down, and a lap ends,
    /// on the replay's first step, when their person isn't there.
    fn settle_for_jump(&mut self, now: u64, out: &mut Vec<Out>) {
        let ids: Vec<u32> = self.people.iter().map(|p| p.id).collect();
        for id in ids {
            if let Some(p) = self.people.iter_mut().find(|p| p.id == id) {
                if let Some(walk) = p.walk.take() {
                    p.at = walk_tile(&walk, now);
                }
                if let Some(Pending::Grab(piece)) = p.pending.take()
                    && self.reserved.get(&piece) == Some(&id)
                {
                    self.reserved.remove(&piece);
                }
            }
            self.put_back(now, id, Some("jumped"), out);
        }
    }

    /// Cats never settle where someone is (design.md): after a jump, one the
    /// café lived without people in it may have. It moves to the nearest
    /// free floor, and a walk that ends on someone ends where the cat is.
    pub(super) fn cats_off_people(&mut self, now: u64) {
        let tiles: Vec<_> = self.people.iter().filter(|p| p.place == Place::Inside).map(|p| p.at).collect();
        for i in 0..self.cats.len() {
            if self.cats[i].taken() {
                continue;
            }
            if let Some(walk) = &self.cats[i].walk
                && walk.path.last().is_some_and(|t| tiles.contains(t))
            {
                let here = walk_tile(walk, now);
                self.cats[i].at = here;
                self.cats[i].walk = None;
            }
            let at = self.cats[i].tile(now);
            if self.cats[i].walk.is_none() && tiles.contains(&at) {
                let free = self.room.nearest(at, Walker::Cat, |t| self.free_for(i, t, now));
                if let Some(t) = free {
                    self.cats[i].at = t;
                }
            }
        }
    }
}
