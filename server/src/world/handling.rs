//! Handling a cat (design.md, "Being handled"; plan-phase-3.md decisions 7
//! and 8): pet, play, offer a treat, pick up. The cat answers from its
//! character, its state, its trust in you and its anger at you; unwelcome
//! handling makes it angry, an angry cat scratches, and a furious one bans
//! that from you for as long as its grudge lasts. Also carrying: putting a
//! cat down, passing it on, and its jumping down.
use super::cat_life::Plan;
use super::{Out, Pending, To, World, error};
use crate::anger::{Anger, FURIOUS, SCRATCH, time_left};
use crate::cats::{Handling, Outcome, handling_outcome, hold_ms};
use crate::protocol::{ErrorCode, Place, Pose, Reaction, ServerMsg};
use crate::room::{Walker, chebyshev, manhattan};
use crate::store::BanRow;
use crate::time::canberra_day;
use rand::RngExt;

/// Handling a cat again this soon after it refused you is pushing.
const PUSHING_MS: u64 = 10_000;

impl World {
    /// The cat `id` is holding, if any.
    pub(super) fn holding_cat(&self, id: u32) -> Option<usize> {
        self.cats.iter().position(|c| c.held_by == Some(id))
    }

    fn cat_index(&self, cat: &str) -> Option<usize> {
        self.cats.iter().position(|c| c.def.id == cat)
    }

    /// When a ban on `how` from `id` by this cat ends, if one is in force.
    fn banned_until(&self, cat: &str, id: u32, how: Handling, now: u64) -> Option<u64> {
        self.bans
            .iter()
            .find(|b| b.cat_id == cat && b.user_id == id as i64 && b.action == how.name() && b.until > now)
            .map(|b| b.until)
    }

    /// Calling a cat is saying its name (design.md, "People").
    pub(super) fn call(&mut self, now: u64, id: u32, cat: &str, out: &mut Vec<Out>) {
        let Some(name) = self.cats.iter().find(|c| c.def.id == cat).map(|c| c.def.name.clone()) else {
            return error(out, id, ErrorCode::UnknownCat, "There's no cat by that name here.");
        };
        self.speak(now, id, name, None, "call", out);
    }

    /// Pet, play, offer a treat or pick up: walk over first if need be.
    pub(super) fn handle_cat(&mut self, now: u64, id: u32, cat: &str, how: Handling, out: &mut Vec<Out>) {
        let Some(i) = self.cat_index(cat) else {
            return error(out, id, ErrorCode::UnknownCat, "There's no cat by that name here.");
        };
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let name = self.cats[i].def.name.clone();
        if let Some(until) = self.banned_until(cat, id, how, now) {
            let words = format!("{name} won't {} for another {}.", how.refusal(), time_left(until - now));
            return error(out, id, ErrorCode::Banned, &words);
        }
        if how == Handling::Offer && self.treats_left(id, now) == 0 {
            return error(out, id, ErrorCode::NoTreats, "You've no treats left today.");
        }
        if let Some(holder) = self.cats[i].held_by
            && holder != id
        {
            let who = self.person(holder).map(|p| p.name.clone()).unwrap_or_default();
            return error(out, id, ErrorCode::Taken, &format!("{who} is holding {name}."));
        }
        if how == Handling::PickUp && (self.holding_cat(id).is_some() || self.held.iter().any(|h| h.by == id)) {
            return error(out, id, ErrorCode::HandsFull, "Your arms are full.");
        }
        let here = self.person_tile(id, now).expect("checked above");
        let walking = self.person(id).is_some_and(|p| p.walk.is_some());
        let cat_at = self.cats[i].tile(now);
        if !walking && chebyshev(here, cat_at) <= 1 {
            return self.answer(now, id, i, how, out);
        }
        let spot = self
            .room
            .around(cat_at, Walker::Person)
            .into_iter()
            .min_by_key(|&t| manhattan(t, here));
        let walked = spot.is_some_and(|spot| self.approach(now, id, spot, Pending::Handle(cat.to_string(), how), out));
        if !walked {
            error(out, id, ErrorCode::BadTile, "You can't get next to that cat from here.");
        }
    }

    /// Someone walked over to handle a cat.
    pub(super) fn handle_on_arrival(&mut self, now: u64, id: u32, cat: &str, how: Handling, out: &mut Vec<Out>) {
        let Some(i) = self.cat_index(cat) else { return };
        let close = self.person_tile(id, now).is_some_and(|h| chebyshev(h, self.cats[i].tile(now)) <= 1);
        if !close {
            return error(out, id, ErrorCode::MovedAway, &format!("{} moved away.", self.cats[i].def.name));
        }
        // It may have been banned, or picked up, while they walked.
        self.handle_cat(now, id, cat, how, out);
    }

    /// The cat's answer, and what follows from it.
    fn answer(&mut self, now: u64, id: u32, i: usize, how: Handling, out: &mut Vec<Out>) {
        let cat_id = self.cats[i].def.id.clone();
        let cat_name = self.cats[i].def.name.clone();
        let (rate, temper, grudge) = {
            let t = &self.cats[i].def.traits;
            (t.trust_rate, t.temper, t.grudge_hours)
        };
        let today = canberra_day(now);
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        // The first hello: a cat sniffs the hand of someone it has never met,
        // even half asleep, so a first visit always leaves a trace. A cat
        // that's hiding stays hidden.
        if how == Handling::Pet && self.cats[i].pose != Pose::Hide && !self.trust.has_met(&cat_id, id) {
            self.react(i, Reaction::Sniff { by: id }, out);
            self.change_trust(i, id, rate, &today, out);
            tracing::info!(target: "action", uid = id, who = %who, what = "pet", cat = %cat_name, outcome = "sniff");
            return;
        }
        let pushing = how != Handling::Offer
            && self.cats[i]
                .refused
                .iter()
                .any(|&(by, at)| by == id && now.saturating_sub(at) < PUSHING_MS);
        let anger = self.anger.get(&(cat_id.clone(), id)).copied().unwrap_or_default();
        let angry = anger.at(now, grudge) >= SCRATCH;
        let trust = self.trust.value(&cat_id, id);
        let need = match how {
            Handling::Offer => self.cats[i].hunger,
            Handling::Play => self.cats[i].play,
            _ => 0.0,
        };
        let outcome = if pushing {
            if angry { Outcome::Scratch } else { Outcome::Refuse }
        } else {
            let roll: f32 = self.rng.random();
            handling_outcome(&self.cats[i].def, how, self.cats[i].pose, trust, need, angry, roll)
        };
        match (how, outcome) {
            (Handling::Pet, Outcome::Welcome) => {
                self.react(i, Reaction::Purr { by: id }, out);
                self.change_trust(i, id, 2.0 * rate, &today, out);
                self.sit_still(i, now, Plan::Sit, out);
            }
            (Handling::Play, Outcome::Welcome | Outcome::Tolerate) => {
                let playful = self.cats[i].def.traits.playfulness;
                let gain = if outcome == Outcome::Welcome {
                    (1.0 + playful) * rate
                } else {
                    0.5 * rate
                };
                self.react(i, Reaction::Play { with: id }, out);
                self.change_trust(i, id, gain, &today, out);
                self.sit_still(i, now, Plan::Play, out);
            }
            (Handling::Offer, Outcome::Welcome | Outcome::Tolerate) => {
                self.use_treat(id, now, out);
                self.cats[i].hunger = 0.0;
                self.react(i, Reaction::Eat { from: id }, out);
                let gain = if outcome == Outcome::Welcome { 2.0 * rate } else { rate };
                self.change_trust(i, id, gain, &today, out);
                self.sit_still(i, now, Plan::Sit, out);
            }
            (Handling::PickUp, Outcome::Welcome | Outcome::Tolerate) => {
                let tolerated = outcome == Outcome::Tolerate;
                let reaction = if tolerated {
                    Reaction::Tolerate { by: id }
                } else {
                    Reaction::Purr { by: id }
                };
                self.react(i, reaction, out);
                self.change_trust(i, id, 0.5 * rate, &today, out);
                let ms = hold_ms(&self.cats[i].def, trust, tolerated);
                let arms = self.person_tile(id, now);
                let cat = &mut self.cats[i];
                cat.walk = None;
                cat.plan = Plan::Idle;
                cat.lap = None;
                cat.pose = Pose::Held;
                cat.held_by = Some(id);
                cat.held_until = now + ms;
                cat.at = arms.unwrap_or(cat.at);
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::CatHeld {
                        cat: cat_id.clone(),
                        by: Some(id),
                    },
                });
            }
            (_, Outcome::Tolerate) => {
                self.react(i, Reaction::Tolerate { by: id }, out);
                self.change_trust(i, id, 0.5 * rate, &today, out);
            }
            (Handling::Offer, _) => {
                // Not hungry, or asleep: no quarrel, and the treat stays yours.
                self.react(i, Reaction::Refuse { by: id }, out);
            }
            (_, Outcome::Refuse | Outcome::Scratch) => {
                let scratch = outcome == Outcome::Scratch;
                self.react(
                    i,
                    if scratch {
                        Reaction::Scratch { by: id }
                    } else {
                        Reaction::Refuse { by: id }
                    },
                    out,
                );
                if scratch {
                    self.change_trust(i, id, -2.0, &today, out);
                } else if pushing {
                    self.change_trust(i, id, -1.0, &today, out);
                }
                let cat = &mut self.cats[i];
                cat.refused.retain(|&(_, at)| now.saturating_sub(at) < PUSHING_MS);
                cat.refused.push((id, now));
                let provoked = anger.provoked(now, temper, grudge);
                self.anger.insert((cat_id.clone(), id), provoked);
                if provoked.level >= FURIOUS {
                    self.ban(now, id, i, how, out);
                }
                if !self.cats[i].resting() {
                    self.walk_away(i, id, now, out);
                }
            }
        }
        let said = match (pushing, outcome) {
            (true, Outcome::Scratch) => "scratch",
            (true, _) => "pushed",
            (false, Outcome::Welcome) => "welcome",
            (false, Outcome::Tolerate) => "tolerate",
            (false, Outcome::Refuse) => "refuse",
            (false, Outcome::Scratch) => "scratch",
        };
        tracing::info!(target: "action", uid = id, who = %who, what = how.name(), cat = %cat_name, outcome = said);
    }

    /// The cat stays where it is, in the pose `plan` asks for.
    fn sit_still(&mut self, i: usize, now: u64, plan: Plan, out: &mut Vec<Out>) {
        let cat = &mut self.cats[i];
        cat.at = cat.tile(now);
        cat.walk = None;
        cat.plan = plan;
        self.settle(i, now, out);
    }

    /// Furious: no more of `how` from this person for the cat's grudge. Kept
    /// until it expires, and the person is told how long.
    fn ban(&mut self, now: u64, id: u32, i: usize, how: Handling, out: &mut Vec<Out>) {
        let def = &self.cats[i].def;
        let ms = (def.traits.grudge_hours * 3_600_000.0) as u64;
        let row = BanRow {
            cat_id: def.id.clone(),
            user_id: id as i64,
            action: how.name().to_string(),
            until: now + ms,
        };
        let words = format!("{} has had enough, and won't {} for {}.", def.name, how.refusal(), time_left(ms));
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %who, what = "banned", cat = %def.name, action = how.name(), hours = def.traits.grudge_hours);
        self.anger.remove(&(def.id.clone(), id));
        self.bans
            .retain(|b| !(b.cat_id == row.cat_id && b.user_id == row.user_id && b.action == row.action));
        self.bans.push(row.clone());
        if let Some(store) = &self.store {
            store.fire(move |c| crate::store::put_ban(c, &row));
        }
        error(out, id, ErrorCode::Banned, &words);
    }

    /// Restores the bans still in force; anger starts afresh, as it's never kept.
    pub fn restore_bans(&mut self, bans: Vec<BanRow>) {
        self.bans = bans;
    }

    pub(super) fn put_down_cat(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        let Some(i) = self.holding_cat(id) else {
            return error(out, id, ErrorCode::NotHolding, "You aren't holding a cat.");
        };
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %who, what = "put_down", cat = %self.cats[i].def.name, outcome = "ok");
        self.jump_down(i, now, "put_down", out);
    }

    /// Passes the held cat to someone beside you; it goes if it knows them.
    pub(super) fn pass_cat(&mut self, now: u64, id: u32, to: u32, out: &mut Vec<Out>) {
        let Some(i) = self.holding_cat(id) else {
            return error(out, id, ErrorCode::NotHolding, "You aren't holding a cat.");
        };
        let Some(them) = self
            .person(to)
            .filter(|p| p.place == Place::Inside && p.id != id)
            .map(|p| p.name.clone())
        else {
            return error(out, id, ErrorCode::UnknownPerson, "They aren't inside.");
        };
        let (Some(a), Some(b)) = (self.person_tile(id, now), self.person_tile(to, now)) else {
            return;
        };
        if chebyshev(a, b) > 1 {
            return error(out, id, ErrorCode::BadTile, &format!("Get closer to {them} first."));
        }
        if self.holding_cat(to).is_some() || self.held.iter().any(|h| h.by == to) {
            return error(out, id, ErrorCode::HandsFull, &format!("{them}'s arms are full."));
        }
        let cat_id = self.cats[i].def.id.clone();
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        let trust = self.trust.value(&cat_id, to);
        if trust >= self.tuning.trust_levels[0] {
            let ms = hold_ms(&self.cats[i].def, trust, false);
            let cat = &mut self.cats[i];
            cat.held_by = Some(to);
            cat.held_until = now + ms;
            cat.at = b;
            tracing::info!(target: "action", uid = id, who = %who, what = "pass_cat", cat = %cat.def.name, to = %them, outcome = "taken");
            out.push(Out {
                to: To::All,
                msg: ServerMsg::CatHeld { cat: cat_id, by: Some(to) },
            });
        } else {
            tracing::info!(target: "action", uid = id, who = %who, what = "pass_cat", cat = %self.cats[i].def.name, to = %them, outcome = "jumped_down");
            self.jump_down(i, now, "wont_go", out);
        }
    }

    /// A held cat gets down beside its holder.
    pub(super) fn jump_down(&mut self, i: usize, now: u64, why: &str, out: &mut Vec<Out>) {
        let Some(holder) = self.cats[i].held_by else { return };
        let from = self.person_tile(holder, now).unwrap_or(self.cats[i].at);
        let spot = self
            .room
            .around(from, Walker::Cat)
            .into_iter()
            .find(|&t| self.room.pettable(t) && !self.cat_on(t, i, now) && t != self.room.door)
            .unwrap_or(from);
        let cat = &mut self.cats[i];
        cat.held_by = None;
        cat.at = spot;
        cat.walk = None;
        cat.plan = Plan::Idle;
        tracing::info!(target: "cat", cat = %cat.def.name, what = "jump_down", why);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::CatHeld {
                cat: cat.def.id.clone(),
                by: None,
            },
        });
        self.settle(i, now, out);
    }

    /// Whoever leaves, or drops, lets go of the cat they hold.
    pub(super) fn let_go_of_cat(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        if let Some(i) = self.holding_cat(id) {
            self.jump_down(i, now, "holder_left", out);
        }
    }
}

/// Anger kept per cat and person, in memory only.
pub(super) type Angers = std::collections::HashMap<(String, u32), Anger>;
