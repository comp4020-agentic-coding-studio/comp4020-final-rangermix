//! The cats in the café (ADR 0011; design.md, "The cats"): where they start,
//! their needs, what they choose to do, and what they do on their own: eat,
//! play, perch, investigate, knock things over, nap on a lap, and answer a
//! noisy room, their names, and a friend at the door. How they answer being
//! handled is in handling.rs.
use super::{Heard, Out, To, World, walk_end, walk_tile};
use crate::cats::{CatDef, Choice, Saved, Situation, drift, options, pick};
use crate::protocol::{CatView, Place, Pose, Reaction, ServerMsg, Tile, Walk};
use crate::room::{FurnitureKind, Walker, chebyshev, manhattan};
use crate::time::canberra_minute_of_day;
use crate::trust::TrustBook;
use rand::RngExt;

/// A piece placed this recently is new enough to investigate.
const NEW_PIECE_MS: u64 = 120_000;

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
    pub hunger: f32,
    pub play: f32,
    /// Whom it refused, and when, for spotting pushing.
    pub refused: Vec<(u32, u64)>,
    /// In someone's arms, until it has had enough.
    pub held_by: Option<u32>,
    pub held_until: u64,
    /// Asleep on someone's lap.
    pub lap: Option<u32>,
}

/// What a hungry cat is heading for.
#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) enum Food {
    Bowls,
    Treat(u32),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) enum Plan {
    Idle,
    Nap,
    Sit,
    /// Sitting by someone it came over to.
    Near(u32),
    Hide,
    Greet(u32),
    Eat(Food),
    Play,
    Groom,
    Perch,
    Investigate,
    Knock(u32),
    Lap(u32),
}

impl Cat {
    pub fn tile(&self, now: u64) -> Tile {
        self.walk.as_ref().map_or(self.at, |w| walk_tile(w, now))
    }

    pub fn resting(&self) -> bool {
        matches!(self.pose, Pose::Nap | Pose::Hide)
    }

    /// Held, or asleep on a lap: not free to wander off on its own.
    pub fn taken(&self) -> bool {
        self.held_by.is_some() || self.lap.is_some()
    }

    pub fn view(&self, now: u64) -> CatView {
        CatView {
            id: self.def.id.clone(),
            name: self.def.name.clone(),
            coat: self.def.coat.clone(),
            at: self.tile(now),
            pose: self.pose,
            walk: self.walk.clone(),
            held_by: self.held_by,
        }
    }

    pub fn saved(&self, now: u64) -> Saved {
        Saved {
            at: self.tile(now),
            tiredness: self.tiredness,
            company: self.company,
            hunger: self.hunger,
            play: self.play,
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
        let (at, tiredness, company, hunger, play) = match saved {
            Some(s) => (
                s.at,
                s.tiredness.clamp(0.0, 1.0),
                s.company.clamp(0.0, 1.0),
                s.hunger.clamp(0.0, 1.0),
                s.play.clamp(0.0, 1.0),
            ),
            None => (self.random_floor(), 0.2, 0.5, 0.3, 0.3),
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
            hunger,
            play,
            refused: Vec::new(),
            held_by: None,
            held_until: 0,
            lap: None,
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

    pub(super) fn cat_on(&self, t: Tile, except: usize, now: u64) -> bool {
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
            (cat.hunger, cat.play) = drift(&cat.def, cat.hunger, cat.play, hours);
        }
        self.held_tick(now, out);
        self.laps_tick(now, out);
        for id in std::mem::take(&mut self.arrivals) {
            self.greet(now, minute, id, out);
        }
        for heard in std::mem::take(&mut self.heard) {
            self.hear(now, minute, heard, out);
        }
        self.new_pieces.retain(|&(_, _, at)| now.saturating_sub(at) < NEW_PIECE_MS);
        for i in 0..self.cats.len() {
            if self.cats[i].taken() {
                continue;
            }
            let arrived = self.cats[i].walk.as_ref().is_some_and(|w| now >= walk_end(w));
            if arrived {
                self.settle(i, now, out);
            } else if self.cats[i].walk.is_none() && now >= self.cats[i].until {
                self.choose(i, now, minute, out);
            }
        }
    }

    /// A held cat goes where its holder goes, and jumps down when it has had
    /// enough, at the door, or when its holder isn't there to hold it.
    fn held_tick(&mut self, now: u64, out: &mut Vec<Out>) {
        for i in 0..self.cats.len() {
            let Some(holder) = self.cats[i].held_by else { continue };
            let here = self
                .person(holder)
                .filter(|p| p.place == Place::Inside && !p.leaving && p.away_since.is_none());
            let why = match here.and_then(|_| self.person_tile(holder, now)) {
                None => "holder_left",
                Some(t) if t == self.room.door => "door",
                Some(_) if now >= self.cats[i].held_until => "had_enough",
                Some(t) => {
                    self.cats[i].at = t;
                    continue;
                }
            };
            self.jump_down(i, now, why, out);
        }
    }

    /// A cat on a lap stays only while its person sits there.
    fn laps_tick(&mut self, now: u64, out: &mut Vec<Out>) {
        for i in 0..self.cats.len() {
            let Some(person) = self.cats[i].lap else { continue };
            let still = self
                .person(person)
                .is_some_and(|p| p.sitting.is_some() && p.at == self.cats[i].at && p.walk.is_none());
            if !still || now >= self.cats[i].until {
                let cat = &mut self.cats[i];
                cat.lap = None;
                cat.plan = Plan::Idle;
                let why = if still { "had_enough" } else { "got_up" };
                tracing::info!(target: "cat", cat = %cat.def.name, what = "jump_down", why);
                self.settle(i, now, out);
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
        let laps: Vec<(u32, f32)> = self
            .people
            .iter()
            .filter(|p| p.sitting.is_some() && !self.cats.iter().any(|c| c.lap == Some(p.id)))
            .map(|p| (p.id, self.trust.value(&id, p.id)))
            .collect();
        let at_window = self.people.iter().any(|p| p.place == Place::Window && p.away_since.is_none());
        let situation = Situation {
            minute,
            people: &people,
            noise: self.noise.len() as f32,
            tiredness: self.cats[i].tiredness,
            company: self.cats[i].company,
            hunger: self.cats[i].hunger,
            play: self.cats[i].play,
            food: self.bowls > 0 || !self.floor_treats.is_empty(),
            toys: self.upright("toys").is_some(),
            window: at_window && self.room.pieces.iter().any(|p| p.spec.perch),
            new_piece: !self.new_pieces.is_empty(),
            knockable: self.room.pieces.iter().any(|p| p.spec.knocks && !p.toppled),
            laps: &laps,
        };
        let scored = options(&self.cats[i].def, &situation);
        let choice = pick(scored, &mut self.rng);
        let from = self.cats[i].tile(now);
        let (target, plan) = match choice {
            Choice::Idle => (None, Plan::Idle),
            Choice::Wander => (self.wander_target(i, from, now), Plan::Idle),
            Choice::Nap => (self.nap_spot(i, now), Plan::Nap),
            Choice::Hide => (self.free_spot(i, now, |k| k.hide), Plan::Hide),
            Choice::Approach(person) => (self.beside(i, person, now), Plan::Near(person)),
            Choice::Groom => (None, Plan::Groom),
            Choice::Eat => self.food_for(from),
            Choice::Play => (self.upright("toys").map(|p| Tile { x: p.x, y: p.y }), Plan::Play),
            Choice::Perch => (self.free_spot(i, now, |k| k.perch), Plan::Perch),
            Choice::Investigate => (self.new_pieces.last().map(|&(_, t, _)| t), Plan::Investigate),
            Choice::Knock => {
                let knockable: Vec<(u32, Tile)> = self
                    .room
                    .pieces
                    .iter()
                    .filter(|p| p.spec.knocks && !p.toppled)
                    .map(|p| (p.id, Tile { x: p.x, y: p.y }))
                    .collect();
                match knockable.get(self.rng.random_range(0..knockable.len().max(1))) {
                    Some(&(piece, t)) => (Some(t), Plan::Knock(piece)),
                    None => (None, Plan::Idle),
                }
            }
            Choice::Lap(person) => (self.person_tile(person, now), Plan::Lap(person)),
        };
        // A plan whose place has gone (no food left, no toys) is just idling.
        let plan = if target.is_none() && !matches!(plan, Plan::Idle | Plan::Groom) {
            Plan::Idle
        } else {
            plan
        };
        match target {
            Some(t) => self.walk_cat(i, now, minute, t, plan, out),
            None => {
                self.cats[i].plan = plan;
                self.settle(i, now, out);
            }
        }
    }

    /// The first standing piece of `kind`.
    fn upright(&self, kind: &str) -> Option<&crate::room::Piece> {
        self.room.pieces.iter().find(|p| p.kind == kind && !p.toppled)
    }

    /// The nearest treat on the floor, else the bowls if they hold anything.
    fn food_for(&self, from: Tile) -> (Option<Tile>, Plan) {
        if let Some(t) = self.floor_treats.iter().min_by_key(|t| manhattan(t.at, from)) {
            return (Some(t.at), Plan::Eat(Food::Treat(t.id)));
        }
        let bowls = self.room.pieces.iter().find(|p| p.kind == "bowls").map(|p| Tile { x: p.x, y: p.y });
        match bowls {
            Some(t) if self.bowls > 0 => (Some(t), Plan::Eat(Food::Bowls)),
            _ => (None, Plan::Idle),
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

    /// Where to nap. Cats notice each other: a sociable cat would rather nap
    /// near another resting cat, a shy one keeps two tiles from any cat.
    fn nap_spot(&mut self, i: usize, now: u64) -> Option<Tile> {
        let spots: Vec<Tile> = self
            .room
            .spots(|k| k.nap)
            .into_iter()
            .filter(|&t| !self.cat_on(t, i, now))
            .collect();
        let others: Vec<(Tile, bool)> = self
            .cats
            .iter()
            .enumerate()
            .filter(|&(j, _)| j != i)
            .map(|(_, c)| (c.tile(now), c.resting()))
            .collect();
        let sociability = self.cats[i].def.traits.sociability;
        let chosen: Vec<Tile> = if sociability >= 0.6 {
            let near: Vec<Tile> = spots
                .iter()
                .copied()
                .filter(|&s| others.iter().any(|&(t, resting)| resting && chebyshev(s, t) <= 2))
                .collect();
            if near.is_empty() { spots } else { near }
        } else if sociability < 0.4 {
            spots
                .into_iter()
                .filter(|&s| others.iter().all(|&(t, _)| chebyshev(s, t) > 2))
                .collect()
        } else {
            spots
        };
        (!chosen.is_empty()).then(|| chosen[self.rng.random_range(0..chosen.len())])
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

    pub(super) fn walk_cat(&mut self, i: usize, now: u64, minute: u32, target: Tile, plan: Plan, out: &mut Vec<Out>) {
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

    /// Ends a walk, or a choice that needed none, in the pose its plan asked
    /// for, doing what the plan was for if what it came for is still there.
    pub(super) fn settle(&mut self, i: usize, now: u64, out: &mut Vec<Out>) {
        let mut plan = self.cats[i].plan;
        let end = self.cats[i]
            .walk
            .as_ref()
            .map_or(self.cats[i].at, |w| *w.path.last().expect("paths are never empty"));
        // The bed it was heading for may have been carried off on the way.
        let spot_kept = |k: &FurnitureKind| match plan {
            Plan::Nap => k.nap,
            Plan::Hide => k.hide,
            Plan::Perch => k.perch,
            _ => true,
        };
        if matches!(plan, Plan::Nap | Plan::Hide | Plan::Perch) && !self.room.pieces.iter().any(|p| p.covers(end) && spot_kept(&p.spec)) {
            plan = Plan::Idle;
        }
        // What it came for: still there, still standing, still sitting.
        plan = match plan {
            Plan::Eat(food) if self.eat(i, food, out) => plan,
            Plan::Eat(_) => Plan::Idle,
            Plan::Knock(piece) if self.knock_over(piece, end, out) => plan,
            Plan::Knock(_) => Plan::Idle,
            Plan::Lap(person) if self.person(person).is_some_and(|p| p.sitting.is_some() && p.at == end) => {
                self.cats[i].lap = Some(person);
                plan
            }
            Plan::Lap(_) => Plan::Idle,
            Plan::Play => {
                self.cats[i].play = 0.0;
                plan
            }
            other => other,
        };
        let secs: u64 = match plan {
            Plan::Nap => self.rng.random_range(120..600),
            Plan::Lap(_) => self.rng.random_range(300..900),
            Plan::Sit | Plan::Near(_) | Plan::Perch => self.rng.random_range(20..60),
            Plan::Hide => 60,
            Plan::Greet(_) | Plan::Groom | Plan::Investigate => 10,
            Plan::Eat(_) | Plan::Play => 15,
            Plan::Idle | Plan::Knock(_) => self.rng.random_range(3..8),
        };
        let pose = match plan {
            Plan::Nap | Plan::Lap(_) => Pose::Nap,
            Plan::Hide => Pose::Hide,
            Plan::Sit | Plan::Near(_) | Plan::Greet(_) | Plan::Perch | Plan::Investigate => Pose::Sit,
            Plan::Eat(_) => Pose::Eat,
            Plan::Play => Pose::Play,
            Plan::Groom => Pose::Groom,
            Plan::Idle | Plan::Knock(_) => Pose::Idle,
        };
        let cat = &mut self.cats[i];
        if let Some(w) = cat.walk.take() {
            cat.at = *w.path.last().expect("paths are never empty");
        }
        cat.pose = pose;
        cat.until = now + secs * 1000;
        cat.plan = Plan::Idle;
        let (id, at) = (cat.def.id.clone(), cat.at);
        self.log_cat(i, plan);
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

    /// A `cat` line when a cat settles into something worth narrating; never
    /// wandering, idling or grooming, so the logs tell its story and not its steps.
    pub(super) fn log_cat(&self, i: usize, plan: Plan) {
        let cat = &self.cats[i];
        let name_of = |id: u32| self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        let piece = self.room.piece_at(cat.at).map(|p| p.kind.clone()).unwrap_or_else(|| "floor".into());
        let (what, with, on) = match plan {
            Plan::Nap => ("nap", None, piece),
            Plan::Hide => ("hide", None, piece),
            Plan::Near(person) => ("come_to", Some(name_of(person)), piece),
            Plan::Greet(person) => ("greet", Some(name_of(person)), piece),
            Plan::Eat(Food::Bowls) => ("eat", None, "bowls".into()),
            Plan::Eat(Food::Treat(_)) => ("eat", None, "treat".into()),
            Plan::Play => ("play", None, "toys".into()),
            Plan::Perch => ("perch", None, piece),
            Plan::Investigate => ("investigate", None, piece),
            Plan::Knock(_) => ("knock_over", None, piece),
            Plan::Lap(person) => ("lap", Some(name_of(person)), piece),
            Plan::Idle | Plan::Sit | Plan::Groom => return,
        };
        tracing::info!(target: "cat", cat = %cat.def.name, what, on = %on, with);
    }

    /// Someone came inside: each awake cat that counts them a friend goes to the door.
    fn greet(&mut self, now: u64, minute: u32, person: u32, out: &mut Vec<Out>) {
        let friend = self.tuning.trust_levels[1];
        for i in 0..self.cats.len() {
            if self.cats[i].resting() || self.cats[i].taken() || self.trust.value(&self.cats[i].def.id, person) < friend {
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
            let resting = self.cats[i].resting() || self.cats[i].taken();
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
                    self.walk_cat(i, now, minute, t, Plan::Near(heard.by), out);
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

    pub(super) fn react(&mut self, i: usize, reaction: Reaction, out: &mut Vec<Out>) {
        out.push(Out {
            to: To::All,
            msg: ServerMsg::CatReacted {
                cat: self.cats[i].def.id.clone(),
                reaction,
            },
        });
    }

    /// Applies a change in trust, stores it, and tells only the person concerned.
    pub(super) fn change_trust(&mut self, i: usize, id: u32, delta: f32, today: &str, out: &mut Vec<Out>) {
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

    /// Someone picked up a piece: any cat lying or sitting on it jumps off,
    /// annoyed, and walks a little way off.
    pub(super) fn cats_jump_off(&mut self, now: u64, by: u32, tiles: &[Tile], out: &mut Vec<Out>) {
        for i in 0..self.cats.len() {
            if self.cats[i].walk.is_some() || self.cats[i].taken() || !tiles.contains(&self.cats[i].at) {
                continue;
            }
            self.react(i, Reaction::Annoyed { by }, out);
            let cat = &mut self.cats[i];
            cat.plan = Plan::Idle;
            cat.pose = Pose::Idle;
            self.walk_away(i, by, now, out);
            if self.cats[i].walk.is_none() {
                self.settle(i, now, out);
            }
        }
    }

    /// A refusing cat walks off, a few tiles from whoever it refused.
    pub(super) fn walk_away(&mut self, i: usize, from_person: u32, now: u64, out: &mut Vec<Out>) {
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
        World::new(content, trust, Vec::new(), SavedArrangement::Fresh, seed, None, "test".into(), 0)
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
    fn a_second_pet_on_the_way_replaces_the_first() {
        // The crit 8 script petted each cat in turn from across the room and
        // only Tora answered: each pet starts a walk, and a new walk replaces
        // the one before, with whatever was waiting at its end.
        let mut w = world();
        join(&mut w, 1, 0);
        hold(&mut w, "mochi", T(1, 8));
        hold(&mut w, "tora", T(10, 7));
        stand(&mut w, 1, T(7, 1));
        w.handle(10, pet(1, "mochi"));
        let outs = w.handle(20, pet(1, "tora"));
        let walk = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: 1, walk } => Some(walk.clone()),
                _ => None,
            })
            .expect("walks over to tora");
        assert!(chebyshev(*walk.path.last().unwrap(), T(10, 7)) <= 1);
        let log = super::super::people::tests::capture_logs(|| {
            let later = w.tick(walk_end(&walk) + 1);
            assert_eq!(reactions(&later), vec![Reaction::Sniff { by: 1 }]);
        });
        assert!(log.contains(r#""cat":"Tora""#), "{log}");
        assert!(!log.contains(r#""cat":"Mochi""#), "{log}");
    }

    #[test]
    fn a_cat_that_walks_off_before_you_arrive_says_so() {
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
        hold(&mut w, "tora", T(1, 2));
        let later = w.tick(walk_end(&walk) + 1);
        assert!(reactions(&later).is_empty());
        assert!(later.iter().any(|o| o.to == To::One(1)
            && matches!(&o.msg, ServerMsg::Error { code: ErrorCode::MovedAway, detail } if detail == "Tora moved away.")));
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
        let w = World::new(content, trust, saved, SavedArrangement::Fresh, 11, None, "test".into(), 0);
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
        let mut w = World::new(
            content,
            trust,
            Vec::new(),
            SavedArrangement::Fresh,
            13,
            Some(store.clone()),
            "test".into(),
            0,
        );
        w.save(5_000);
        let states = store.call(|c| crate::store::all_cat_states(c)).await.unwrap();
        assert_eq!(states.len(), 3);
        let saved_at = store.call(|c| crate::store::get_world(c, "saved_at")).await.unwrap();
        assert_eq!(saved_at.as_deref(), Some("5000"));
    }
}
