//! The cats in the café (ADR 0011; design.md, "The cats"): where they start,
//! their needs, what they choose to do, and how they answer people: a first
//! sniff, pets, their names in a bubble, a friend at the door, a noisy room.
use super::{Heard, Out, Pending, To, World, error, walk_end, walk_tile};
use crate::cats::{CatDef, Choice, Outcome, Saved, Situation, options, pet_outcome, pick};
use crate::protocol::{CatView, ErrorCode, Place, Pose, Reaction, ServerMsg, Tile, Walk};
use crate::room::{FurnitureKind, Walker, chebyshev, manhattan};
use crate::time::{canberra_day, canberra_minute_of_day};
use crate::trust::TrustBook;
use rand::RngExt;

/// Petting a cat again this soon after it refused you is pushing.
const PUSHING_MS: u64 = 10_000;

#[derive(Debug, Clone)]
pub(super) struct Cat {
    pub def: CatDef,
    pub at: Tile,
    pub walk: Option<Walk>,
    pub pose: Pose,
    /// When the current pose ends and the cat chooses again.
    pub until: u64,
    /// What the cat does when its walk ends.
    pub plan: Plan,
    pub tiredness: f32,
    pub company: f32,
    /// Whom it refused, and when, for spotting pushing.
    pub refused: Vec<(u32, u64)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) enum Plan {
    Idle,
    Nap,
    Sit,
    Hide,
    Greet(u32),
}

impl Cat {
    pub fn tile(&self, now: u64) -> Tile {
        self.walk.as_ref().map_or(self.at, |w| walk_tile(w, now))
    }

    pub fn resting(&self) -> bool {
        matches!(self.pose, Pose::Nap | Pose::Hide)
    }

    pub fn view(&self, now: u64) -> CatView {
        CatView {
            id: self.def.id.clone(),
            name: self.def.name.clone(),
            coat: self.def.coat.clone(),
            at: self.tile(now),
            pose: self.pose,
            walk: self.walk.clone(),
        }
    }

    pub fn saved(&self, now: u64) -> Saved {
        Saved {
            at: self.tile(now),
            tiredness: self.tiredness,
            company: self.company,
        }
    }
}

fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !c.is_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_lowercase)
        .collect()
}

fn contains_words(said: &[String], name: &[String]) -> bool {
    !name.is_empty() && said.windows(name.len()).any(|w| w == name)
}

impl World {
    /// A cat comes back where it was saved, if a cat can still stand there and
    /// be reached; otherwise somewhere on the floor, rested.
    pub(super) fn place_cat(&mut self, def: CatDef, saved: Option<Saved>, now: u64) -> Cat {
        let saved = saved.filter(|s| self.room.walkable(s.at, Walker::Cat) && self.room.pettable(s.at));
        let (at, tiredness, company) = match saved {
            Some(s) => (s.at, s.tiredness.clamp(0.0, 1.0), s.company.clamp(0.0, 1.0)),
            None => (self.random_floor(), 0.2, 0.5),
        };
        let until = now + self.rng.random_range(3_000..8_000u64);
        Cat {
            def,
            at,
            walk: None,
            pose: Pose::Idle,
            until,
            plan: Plan::Idle,
            tiredness,
            company,
            refused: Vec::new(),
        }
    }

    /// Somewhere a cat can be, off the walkway, that someone could reach to pet it.
    fn random_floor(&mut self) -> Tile {
        let tiles: Vec<Tile> = self
            .room
            .floor(Walker::Cat)
            .into_iter()
            .filter(|&t| !self.room.walkway.contains(&t) && self.room.pettable(t))
            .collect();
        if tiles.is_empty() {
            return self.room.entry;
        }
        tiles[self.rng.random_range(0..tiles.len())]
    }

    fn cat_on(&self, t: Tile, except: usize, now: u64) -> bool {
        self.cats.iter().enumerate().any(|(j, c)| j != except && c.tile(now) == t)
    }

    pub(super) fn cats_tick(&mut self, now: u64, dt: u64, out: &mut Vec<Out>) {
        let minute = canberra_minute_of_day(now);
        let hours = dt as f32 / 3_600_000.0;
        let people: Vec<Tile> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside)
            .filter_map(|p| self.person_tile(p.id, now))
            .collect();
        for cat in &mut self.cats {
            if cat.pose == Pose::Nap {
                // A nap rests a cat in about twenty minutes.
                cat.tiredness = (cat.tiredness - hours * 3.0).max(0.0);
            } else {
                cat.tiredness = (cat.tiredness + hours * (1.2 - cat.def.traits.energy)).min(1.0);
            }
            let near = people.iter().any(|&t| chebyshev(t, cat.tile(now)) <= 2);
            cat.company = if near {
                (cat.company - hours * 6.0).max(0.0)
            } else {
                (cat.company + hours * 2.0).min(1.0)
            };
        }
        for id in std::mem::take(&mut self.arrivals) {
            self.greet(now, minute, id, out);
        }
        for heard in std::mem::take(&mut self.heard) {
            self.hear(now, minute, heard, out);
        }
        for i in 0..self.cats.len() {
            let arrived = self.cats[i].walk.as_ref().is_some_and(|w| now >= walk_end(w));
            if arrived {
                self.settle(i, now, out);
            } else if self.cats[i].walk.is_none() && now >= self.cats[i].until {
                self.choose(i, now, minute, out);
            }
        }
    }

    fn choose(&mut self, i: usize, now: u64, minute: u32, out: &mut Vec<Out>) {
        let id = self.cats[i].def.id.clone();
        let people: Vec<(u32, f32)> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside)
            .map(|p| (p.id, self.trust.value(&id, p.id)))
            .collect();
        let situation = Situation {
            minute,
            people: &people,
            noise: self.noise.len() as f32,
            tiredness: self.cats[i].tiredness,
            company: self.cats[i].company,
        };
        let scored = options(&self.cats[i].def, &situation);
        let choice = pick(scored, &mut self.rng);
        let from = self.cats[i].tile(now);
        let (target, plan) = match choice {
            Choice::Idle => (None, Plan::Idle),
            Choice::Wander => (self.wander_target(i, from, now), Plan::Idle),
            Choice::Nap => (self.free_spot(i, now, |k| k.nap), Plan::Nap),
            Choice::Hide => (self.free_spot(i, now, |k| k.hide), Plan::Hide),
            Choice::Approach(person) => (self.beside(i, person, now), Plan::Sit),
        };
        match target {
            Some(t) => self.walk_cat(i, now, minute, t, plan, out),
            None => {
                self.cats[i].plan = plan;
                self.settle(i, now, out);
            }
        }
    }

    fn wander_target(&mut self, i: usize, from: Tile, now: u64) -> Option<Tile> {
        let near: Vec<Tile> = self
            .room
            .floor(Walker::Cat)
            .into_iter()
            .filter(|&t| t != from && manhattan(t, from) <= 6 && self.room.pettable(t) && !self.cat_on(t, i, now))
            .collect();
        (!near.is_empty()).then(|| near[self.rng.random_range(0..near.len())])
    }

    fn free_spot(&mut self, i: usize, now: u64, keep: impl Fn(&FurnitureKind) -> bool) -> Option<Tile> {
        let spots: Vec<Tile> = self.room.spots(keep).into_iter().filter(|&t| !self.cat_on(t, i, now)).collect();
        (!spots.is_empty()).then(|| spots[self.rng.random_range(0..spots.len())])
    }

    /// A tile next to a person that no other cat is on.
    fn beside(&mut self, i: usize, person: u32, now: u64) -> Option<Tile> {
        let at = self.person_tile(person, now)?;
        let tiles: Vec<Tile> = self
            .room
            .around(at, Walker::Cat)
            .into_iter()
            .filter(|&t| !self.cat_on(t, i, now))
            .collect();
        (!tiles.is_empty()).then(|| tiles[self.rng.random_range(0..tiles.len())])
    }

    fn walk_cat(&mut self, i: usize, now: u64, minute: u32, target: Tile, plan: Plan, out: &mut Vec<Out>) {
        let from = self.cats[i].tile(now);
        self.cats[i].plan = plan;
        match self.room.path(from, target, Walker::Cat) {
            Some(path) if path.len() > 1 => {
                let speed = self.tuning.cat_speed * self.cats[i].def.speed_factor(minute);
                let walk = Walk { path, start: now, speed };
                let cat = &mut self.cats[i];
                cat.at = from;
                cat.walk = Some(walk.clone());
                cat.pose = Pose::Walk;
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::CatMoved {
                        cat: cat.def.id.clone(),
                        walk,
                    },
                });
            }
            _ => {
                let cat = &mut self.cats[i];
                cat.at = from;
                cat.walk = None;
                self.settle(i, now, out);
            }
        }
    }

    /// Ends a walk, or a choice that needed none, in the pose its plan asked for.
    fn settle(&mut self, i: usize, now: u64, out: &mut Vec<Out>) {
        let plan = self.cats[i].plan;
        let secs: u64 = match plan {
            Plan::Nap => self.rng.random_range(120..600),
            Plan::Sit => self.rng.random_range(20..60),
            Plan::Hide => 60,
            Plan::Greet(_) => 10,
            Plan::Idle => self.rng.random_range(3..8),
        };
        let pose = match plan {
            Plan::Nap => Pose::Nap,
            Plan::Hide => Pose::Hide,
            Plan::Sit | Plan::Greet(_) => Pose::Sit,
            Plan::Idle => Pose::Idle,
        };
        let cat = &mut self.cats[i];
        if let Some(w) = cat.walk.take() {
            cat.at = *w.path.last().expect("paths are never empty");
        }
        cat.pose = pose;
        cat.until = now + secs * 1000;
        cat.plan = Plan::Idle;
        let (id, at) = (cat.def.id.clone(), cat.at);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::CatPosed { cat: id.clone(), pose, at },
        });
        if let Plan::Greet(to) = plan {
            out.push(Out {
                to: To::All,
                msg: ServerMsg::CatReacted {
                    cat: id,
                    reaction: Reaction::Greet { to },
                },
            });
        }
    }

    /// Someone came inside: each awake cat that counts them a friend goes to the door.
    fn greet(&mut self, now: u64, minute: u32, person: u32, out: &mut Vec<Out>) {
        let friend = self.tuning.trust_levels[1];
        for i in 0..self.cats.len() {
            if self.cats[i].resting() || self.trust.value(&self.cats[i].def.id, person) < friend {
                continue;
            }
            let spot = self
                .room
                .around(self.room.entry, Walker::Cat)
                .into_iter()
                .find(|t| !self.room.walkway.contains(t) && !self.cat_on(*t, i, now));
            if let Some(spot) = spot {
                self.walk_cat(i, now, minute, spot, Plan::Greet(person), out);
            }
        }
    }

    /// A bubble: a cat named in it looks up (and comes to someone it knows);
    /// otherwise, if the room has got too noisy for it, a shy cat goes to hide.
    fn hear(&mut self, now: u64, minute: u32, heard: Heard, out: &mut Vec<Out>) {
        let said = words(&heard.text);
        let noise = self.noise.len() as f32;
        let familiar = self.tuning.trust_levels[0];
        let speaker_inside = self.person(heard.by).is_some_and(|p| p.place == Place::Inside);
        for i in 0..self.cats.len() {
            let id = self.cats[i].def.id.clone();
            let resting = self.cats[i].resting();
            if contains_words(&said, &words(&self.cats[i].def.name)) {
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::CatReacted {
                        cat: id.clone(),
                        reaction: Reaction::LookUp { at: heard.by },
                    },
                });
                if !resting
                    && speaker_inside
                    && self.trust.value(&id, heard.by) >= familiar
                    && let Some(t) = self.beside(i, heard.by, now)
                {
                    self.walk_cat(i, now, minute, t, Plan::Sit, out);
                }
            } else if !resting
                && self.cats[i].plan != Plan::Hide
                && noise >= self.cats[i].def.hide_threshold()
                && let Some(t) = self.free_spot(i, now, |k| k.hide)
            {
                self.walk_cat(i, now, minute, t, Plan::Hide, out);
            }
        }
    }

    pub(super) fn pet(&mut self, now: u64, id: u32, cat: &str, out: &mut Vec<Out>) {
        let Some(i) = self.cats.iter().position(|c| c.def.id == cat) else {
            return error(out, id, ErrorCode::UnknownCat, "There's no cat by that name here.");
        };
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let here = self.person_tile(id, now).expect("checked above");
        let walking = self.person(id).is_some_and(|p| p.walk.is_some());
        let cat_at = self.cats[i].tile(now);
        if !walking && chebyshev(here, cat_at) <= 1 {
            return self.touch(now, id, i, out);
        }
        let spot = self
            .room
            .around(cat_at, Walker::Person)
            .into_iter()
            .min_by_key(|&t| manhattan(t, here));
        let walked = spot.is_some_and(|spot| self.approach(now, id, spot, Pending::Pet(cat.to_string()), out));
        if !walked {
            error(out, id, ErrorCode::BadTile, "You can't get next to that cat from here.");
        }
    }

    /// Someone's walk ended with something to do.
    pub(super) fn arrived_with(&mut self, now: u64, id: u32, then: Pending, out: &mut Vec<Out>) {
        let Pending::Pet(cat) = then;
        let Some(i) = self.cats.iter().position(|c| c.def.id == cat) else {
            return;
        };
        let close = self.person_tile(id, now).is_some_and(|h| chebyshev(h, self.cats[i].tile(now)) <= 1);
        if close {
            self.touch(now, id, i, out);
        } else {
            error(out, id, ErrorCode::MovedAway, &format!("{} moved away.", self.cats[i].def.name));
        }
    }

    /// Calling a cat is saying its name (design.md, "People").
    pub(super) fn call(&mut self, now: u64, id: u32, cat: &str, out: &mut Vec<Out>) {
        let Some(name) = self.cats.iter().find(|c| c.def.id == cat).map(|c| c.def.name.clone()) else {
            return error(out, id, ErrorCode::UnknownCat, "There's no cat by that name here.");
        };
        self.say(now, id, name, None, out);
    }

    fn touch(&mut self, now: u64, id: u32, i: usize, out: &mut Vec<Out>) {
        let cat_id = self.cats[i].def.id.clone();
        let rate = self.cats[i].def.traits.trust_rate;
        let today = canberra_day(now);
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        // The first hello: a cat sniffs the hand of someone it has never met,
        // even half asleep, so a first visit always leaves a trace. A cat
        // that's hiding stays hidden.
        if self.cats[i].pose != Pose::Hide && !self.trust.has_met(&cat_id, id) {
            self.react(i, Reaction::Sniff { by: id }, out);
            self.change_trust(i, id, rate, &today, out);
            tracing::info!(target: "action", uid = id, who = %who, what = "pet", cat = %cat_id, outcome = "sniff");
            return;
        }
        let pushing = self.cats[i]
            .refused
            .iter()
            .any(|&(by, at)| by == id && now.saturating_sub(at) < PUSHING_MS);
        let outcome = if pushing {
            Outcome::Refuse
        } else {
            let roll: f32 = self.rng.random();
            pet_outcome(&self.cats[i].def, self.cats[i].pose, self.trust.value(&cat_id, id), roll)
        };
        match outcome {
            Outcome::Welcome => {
                self.react(i, Reaction::Purr { by: id }, out);
                self.change_trust(i, id, 2.0 * rate, &today, out);
                let cat = &mut self.cats[i];
                cat.at = cat.tile(now);
                cat.walk = None;
                cat.plan = Plan::Sit;
                self.settle(i, now, out);
            }
            Outcome::Tolerate => {
                self.react(i, Reaction::Tolerate { by: id }, out);
                self.change_trust(i, id, 0.5 * rate, &today, out);
            }
            Outcome::Refuse => {
                self.react(i, Reaction::Refuse { by: id }, out);
                if pushing {
                    self.change_trust(i, id, -1.0, &today, out);
                }
                let cat = &mut self.cats[i];
                cat.refused.retain(|&(_, at)| now.saturating_sub(at) < PUSHING_MS);
                cat.refused.push((id, now));
                if !self.cats[i].resting() {
                    self.walk_away(i, id, now, out);
                }
            }
        }
        let outcome = match (pushing, outcome) {
            (true, _) => "pushed",
            (false, Outcome::Welcome) => "welcome",
            (false, Outcome::Tolerate) => "tolerate",
            (false, Outcome::Refuse) => "refuse",
        };
        tracing::info!(target: "action", uid = id, who = %who, what = "pet", cat = %cat_id, outcome);
    }

    fn react(&mut self, i: usize, reaction: Reaction, out: &mut Vec<Out>) {
        out.push(Out {
            to: To::All,
            msg: ServerMsg::CatReacted {
                cat: self.cats[i].def.id.clone(),
                reaction,
            },
        });
    }

    /// Applies a change in trust, stores it, and tells only the person concerned.
    fn change_trust(&mut self, i: usize, id: u32, delta: f32, today: &str, out: &mut Vec<Out>) {
        let cat_id = self.cats[i].def.id.clone();
        let Some(rec) = self.trust.apply(&cat_id, self.cats[i].def.traits.trust_rate, id, delta, today) else {
            return;
        };
        if let Some(store) = &self.store {
            let row = TrustBook::row(&cat_id, id, &rec);
            store.fire(move |c| crate::store::put_trust(c, &row));
        }
        out.push(Out {
            to: To::One(id),
            msg: ServerMsg::YourTrust {
                trust: self.trust.view(&cat_id, id),
            },
        });
    }

    /// A refusing cat walks off, a few tiles from whoever it refused.
    fn walk_away(&mut self, i: usize, from_person: u32, now: u64, out: &mut Vec<Out>) {
        let minute = canberra_minute_of_day(now);
        let them = self.person_tile(from_person, now).unwrap_or(self.room.entry);
        let here = self.cats[i].tile(now);
        let away: Vec<Tile> = self
            .room
            .floor(Walker::Cat)
            .into_iter()
            .filter(|&t| manhattan(t, them) >= 3 && manhattan(t, here) <= 6 && self.room.pettable(t) && !self.cat_on(t, i, now))
            .collect();
        if !away.is_empty() {
            let target = away[self.rng.random_range(0..away.len())];
            self.walk_cat(i, now, minute, target, Plan::Idle, out);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::super::people::tests::{join, world};
    use super::super::*;
    use super::*;
    use crate::protocol::ClientMsg;

    fn seeded(seed: u64) -> World {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        World::new(content, trust, Vec::new(), seed, None, "test".into(), 0)
    }

    fn cat_index(w: &World, id: &str) -> usize {
        w.cats.iter().position(|c| c.def.id == id).unwrap()
    }

    /// Holds a cat still and awake at `at`, so a test decides what happens.
    fn hold(w: &mut World, cat: &str, at: Tile) -> usize {
        let i = cat_index(w, cat);
        let c = &mut w.cats[i];
        c.walk = None;
        c.pose = Pose::Idle;
        c.until = u64::MAX;
        c.plan = Plan::Idle;
        c.at = at;
        i
    }

    /// Stands a person, still, at `at`.
    fn stand(w: &mut World, person: u32, at: Tile) {
        let p = w.people.iter_mut().find(|p| p.id == person).unwrap();
        p.walk = None;
        p.at = at;
    }

    fn pet(id: u32, cat: &str) -> Input {
        Input::Msg {
            id,
            msg: ClientMsg::Pet { cat: cat.into() },
        }
    }

    fn reactions(outs: &[Out]) -> Vec<Reaction> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::CatReacted { reaction, .. } => Some(*reaction),
                _ => None,
            })
            .collect()
    }

    fn trust_msgs(outs: &[Out]) -> Vec<(To, f32)> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::YourTrust { trust } => Some((o.to, trust.value)),
                _ => None,
            })
            .collect()
    }

    fn walk_of(outs: &[Out], cat: &str) -> Option<Walk> {
        outs.iter().find_map(|o| match &o.msg {
            ServerMsg::CatMoved { cat: c, walk } if c == cat => Some(walk.clone()),
            _ => None,
        })
    }

    const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };

    #[test]
    fn cats_start_on_tiles_a_cat_can_stand_on() {
        let w = world();
        assert_eq!(w.cats.len(), 3);
        for c in &w.cats {
            assert!(w.room.walkable(c.at, Walker::Cat));
        }
    }

    #[test]
    fn cats_move_on_their_own() {
        let mut w = seeded(2);
        let moved: usize = (1..=6_000u64)
            .map(|step| {
                w.tick(step * 100)
                    .iter()
                    .filter(|o| matches!(o.msg, ServerMsg::CatMoved { .. }))
                    .count()
            })
            .sum();
        assert!(moved > 0, "nobody moved in ten minutes");
    }

    #[test]
    fn the_first_pet_from_a_stranger_is_a_sniff_that_leaves_a_trace() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        hold(&mut w, "burakku", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        let outs = w.handle(10, pet(1, "burakku"));
        assert_eq!(reactions(&outs), vec![Reaction::Sniff { by: 1 }]);
        let trust = trust_msgs(&outs);
        assert_eq!(trust.len(), 1);
        assert_eq!(trust[0].0, To::One(1), "only the person petting hears about their trust");
        assert!(trust[0].1 > 0.0);
    }

    #[test]
    fn pets_after_the_first_build_trust_within_the_daily_allowance() {
        let mut w = seeded(4);
        join(&mut w, 1, 0);
        for n in 0..60u64 {
            let i = hold(&mut w, "mochi", T(5, 7));
            w.cats[i].refused.clear();
            stand(&mut w, 1, T(5, 8));
            w.handle(1_000 + n * 20_000, pet(1, "mochi"));
        }
        let value = w.trust.value("mochi", 1);
        assert!(value > 2.0, "{value}");
        assert!(value <= 10.0 + 1e-3, "{value}");
    }

    #[test]
    fn a_napping_cat_refuses_and_stays_asleep() {
        let mut w = world();
        join(&mut w, 1, 0);
        let i = hold(&mut w, "mochi", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        w.trust.apply("mochi", 1.0, 1, 5.0, "1970-01-01");
        w.cats[i].pose = Pose::Nap;
        let outs = w.handle(10, pet(1, "mochi"));
        assert_eq!(reactions(&outs), vec![Reaction::Refuse { by: 1 }]);
        assert!(trust_msgs(&outs).is_empty());
        assert_eq!(w.cats[i].pose, Pose::Nap);
    }

    #[test]
    fn a_napping_cat_still_sniffs_a_strangers_hand_and_stays_asleep() {
        let mut w = world();
        join(&mut w, 1, 0);
        let i = hold(&mut w, "mochi", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        w.cats[i].pose = Pose::Nap;
        let outs = w.handle(10, pet(1, "mochi"));
        assert_eq!(reactions(&outs), vec![Reaction::Sniff { by: 1 }]);
        assert_eq!(trust_msgs(&outs).len(), 1);
        assert_eq!(w.cats[i].pose, Pose::Nap);
    }

    #[test]
    fn a_hiding_cat_does_not_come_out_for_a_stranger() {
        let mut w = world();
        join(&mut w, 1, 0);
        let i = hold(&mut w, "burakku", T(1, 9));
        stand(&mut w, 1, T(1, 8));
        w.cats[i].pose = Pose::Hide;
        let outs = w.handle(10, pet(1, "burakku"));
        assert_eq!(reactions(&outs), vec![Reaction::Refuse { by: 1 }]);
        assert!(trust_msgs(&outs).is_empty());
    }

    #[test]
    fn cats_only_go_where_someone_can_reach_them() {
        for seed in [1, 2, 3, 5, 8] {
            let mut w = seeded(seed);
            for c in &w.cats {
                assert!(
                    !w.room.around(c.at, Walker::Person).is_empty(),
                    "seed {seed}: {} starts out of reach",
                    c.def.id
                );
            }
            for step in 1..=6_000u64 {
                for o in w.tick(step * 100) {
                    if let ServerMsg::CatMoved { cat, walk } = &o.msg {
                        let end = *walk.path.last().unwrap();
                        assert!(
                            !w.room.around(end, Walker::Person).is_empty(),
                            "seed {seed}: {cat} went to ({}, {})",
                            end.x,
                            end.y
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn petting_again_right_after_a_refusal_is_pushing_and_costs_trust() {
        let mut w = world();
        join(&mut w, 1, 0);
        let i = hold(&mut w, "mochi", T(5, 7));
        stand(&mut w, 1, T(5, 8));
        w.trust.apply("mochi", 1.0, 1, 5.0, "1970-01-01");
        w.cats[i].pose = Pose::Nap;
        w.handle(10, pet(1, "mochi"));
        let before = w.trust.value("mochi", 1);
        let outs = w.handle(5_000, pet(1, "mochi"));
        assert_eq!(reactions(&outs), vec![Reaction::Refuse { by: 1 }]);
        assert!(w.trust.value("mochi", 1) < before);
        assert_eq!(trust_msgs(&outs).len(), 1);
    }

    #[test]
    fn a_cat_looks_up_at_its_name_and_comes_to_someone_it_knows() {
        let mut w = world();
        join(&mut w, 1, 0);
        stand(&mut w, 1, T(6, 2));
        hold(&mut w, "mochi", T(1, 8));
        for day in ["1970-01-01", "1970-01-02", "1970-01-03"] {
            w.trust.apply("mochi", 1.0, 1, 10.0, day);
        }
        w.handle(
            100,
            Input::Msg {
                id: 1,
                msg: ClientMsg::Say {
                    text: "Mochi, come here!".into(),
                    to: None,
                },
            },
        );
        let outs = w.tick(200);
        assert!(reactions(&outs).contains(&Reaction::LookUp { at: 1 }));
        let walk = walk_of(&outs, "mochi").expect("mochi comes over");
        assert!(chebyshev(*walk.path.last().unwrap(), T(6, 2)) <= 1);
    }

    #[test]
    fn a_stranger_calling_gets_only_a_look() {
        let mut w = world();
        join(&mut w, 1, 0);
        stand(&mut w, 1, T(6, 2));
        hold(&mut w, "mochi", T(1, 8));
        w.handle(
            100,
            Input::Msg {
                id: 1,
                msg: ClientMsg::Say {
                    text: "mochi?".into(),
                    to: None,
                },
            },
        );
        let outs = w.tick(200);
        assert!(reactions(&outs).contains(&Reaction::LookUp { at: 1 }));
        assert!(walk_of(&outs, "mochi").is_none());
    }

    #[test]
    fn calling_a_cat_is_saying_its_name() {
        let mut w = world();
        join(&mut w, 1, 0);
        let outs = w.handle(
            10,
            Input::Msg {
                id: 1,
                msg: ClientMsg::Call { cat: "tora".into() },
            },
        );
        assert!(
            outs.iter()
                .any(|o| matches!(&o.msg, ServerMsg::Said { from: 1, text, .. } if text == "Tora"))
        );
    }

    #[test]
    fn a_noisy_room_sends_burakku_into_hiding() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        hold(&mut w, "burakku", T(6, 7));
        for n in 0..5u64 {
            let id = 1 + (n as u32 % 2);
            w.handle(
                100 + n,
                Input::Msg {
                    id,
                    msg: ClientMsg::Say {
                        text: format!("chatter {n}"),
                        to: None,
                    },
                },
            );
        }
        let outs = w.tick(200);
        let walk = walk_of(&outs, "burakku").expect("burakku moves");
        assert!(w.room.spots(|k| k.hide).contains(walk.path.last().unwrap()));
    }

    #[test]
    fn a_friend_is_greeted_at_the_door() {
        let mut w = world();
        hold(&mut w, "mochi", T(1, 8));
        for d in 1..=6 {
            w.trust.apply("mochi", 1.0, 1, 10.0, &format!("1970-01-0{d}"));
        }
        join(&mut w, 1, 0);
        let outs = w.tick(100);
        let walk = walk_of(&outs, "mochi").expect("mochi heads for the door");
        assert!(chebyshev(*walk.path.last().unwrap(), w.room.entry) <= 1);
        let later = w.tick(walk_end(&walk) + 1);
        assert!(reactions(&later).contains(&Reaction::Greet { to: 1 }));
    }

    #[test]
    fn petting_from_across_the_room_walks_over_first() {
        let mut w = world();
        join(&mut w, 1, 0);
        hold(&mut w, "tora", T(5, 8));
        stand(&mut w, 1, T(7, 1));
        let outs = w.handle(10, pet(1, "tora"));
        let walk = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: 1, walk } => Some(walk.clone()),
                _ => None,
            })
            .expect("walks over");
        assert!(reactions(&outs).is_empty());
        let later = w.tick(walk_end(&walk) + 1);
        assert_eq!(reactions(&later), vec![Reaction::Sniff { by: 1 }]);
    }

    #[test]
    fn the_welcome_shows_the_cats_and_your_trust_in_each() {
        let mut w = world();
        w.trust.apply("tora", 0.6, 1, 0.6, "1970-01-01");
        let outs = join(&mut w, 1, 0);
        let ServerMsg::Welcome { snapshot, .. } = &outs[0].msg else {
            panic!("welcome first")
        };
        assert_eq!(snapshot.cats.len(), 3);
        assert_eq!(snapshot.your_trust.iter().find(|t| t.cat == "tora").unwrap().value, 0.6);
    }

    #[test]
    fn saved_cats_come_back_where_they_were_unless_that_is_now_a_wall() {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        let saved = vec![
            (
                "mochi".to_string(),
                r#"{"at":{"x":1,"y":5},"tiredness":0.7,"company":0.1}"#.to_string(),
            ),
            (
                "tora".to_string(),
                r#"{"at":{"x":0,"y":0},"tiredness":0.1,"company":0.1}"#.to_string(),
            ),
        ];
        let w = World::new(content, trust, saved, 11, None, "test".into(), 0);
        let mochi = &w.cats[cat_index(&w, "mochi")];
        assert_eq!((mochi.at, mochi.tiredness), (T(1, 5), 0.7));
        let tora = &w.cats[cat_index(&w, "tora")];
        assert!(w.room.walkable(tora.at, Walker::Cat));
    }

    #[tokio::test]
    async fn saving_writes_each_cat_and_the_clock() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("cafe.db")).unwrap();
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        let mut w = World::new(content, trust, Vec::new(), 13, Some(store.clone()), "test".into(), 0);
        w.save(5_000);
        let states = store.call(|c| crate::store::all_cat_states(c)).await.unwrap();
        assert_eq!(states.len(), 3);
        let saved_at = store.call(|c| crate::store::get_world(c, "saved_at")).await.unwrap();
        assert_eq!(saved_at.as_deref(), Some("5000"));
    }
}
