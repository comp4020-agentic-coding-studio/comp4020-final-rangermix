//! Bowls and treats (design.md, "People": treats; plan-phase-3.md decision
//! 6). The café fills the bowls on a schedule, so no cat goes hungry because
//! nobody came; each visitor has a few treats a Canberra day to put down,
//! offer by hand, or give to someone else.
use super::cat_life::Food;
use super::{Out, To, World, error};
use crate::protocol::{ErrorCode, ServerMsg, Tile, TreatView};
use crate::room::{Ground, Walker};
use crate::store::TreatRow;
use crate::time::{canberra_day, canberra_day_before, canberra_minute_of_day};

/// A treat on the floor, until a cat eats it.
#[derive(Debug, Clone)]
pub(super) struct FloorTreat {
    pub id: u32,
    pub at: Tile,
    pub by: u32,
}

/// Each visitor's treats for their latest Canberra day.
pub(super) type TreatBook = std::collections::HashMap<u32, TreatRow>;

impl World {
    /// Treats `id` has left today: the day's allowance plus any given to them.
    pub(super) fn treats_left(&self, id: u32, now: u64) -> u32 {
        let today = canberra_day(now);
        match self.treat_book.get(&id) {
            Some(row) if row.day == today => (self.tuning.treats_per_day + row.received).saturating_sub(row.used),
            _ => self.tuning.treats_per_day,
        }
    }

    /// Today's row for `id`, started afresh on a new day.
    fn todays_row(&mut self, id: u32, now: u64) -> &mut TreatRow {
        let today = canberra_day(now);
        let row = self.treat_book.entry(id).or_insert_with(|| TreatRow {
            user_id: id as i64,
            day: today.clone(),
            used: 0,
            received: 0,
        });
        if row.day != today {
            *row = TreatRow {
                user_id: id as i64,
                day: today,
                used: 0,
                received: 0,
            };
        }
        row
    }

    fn keep_treats(&mut self, id: u32, now: u64, out: &mut Vec<Out>) {
        let row = self.todays_row(id, now).clone();
        if let Some(store) = &self.store {
            store.fire(move |c| crate::store::put_treats(c, &row));
        }
        out.push(Out {
            to: To::One(id),
            msg: ServerMsg::YourTreats {
                left: self.treats_left(id, now),
            },
        });
    }

    /// Spends one of `id`'s treats; callers check there's one to spend.
    pub(super) fn use_treat(&mut self, id: u32, now: u64, out: &mut Vec<Out>) {
        self.todays_row(id, now).used += 1;
        self.keep_treats(id, now, out);
    }

    pub(super) fn put_treat(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        if self.treats_left(id, now) == 0 {
            return error(out, id, ErrorCode::NoTreats, "You've no treats left today.");
        }
        let Some(feet) = self.person_tile(id, now) else { return };
        // At your feet, on the café's floor: never out in the doorway.
        let at = self
            .room
            .nearest(feet, Walker::Person, |t| self.room.ground(t) == Ground::Floor)
            .unwrap_or(self.room.entry);
        self.use_treat(id, now, out);
        let treat = FloorTreat {
            id: self.next_treat,
            at,
            by: id,
        };
        self.next_treat += 1;
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %who, what = "put_treat", outcome = "ok", x = at.x, y = at.y);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::TreatPlaced {
                treat: TreatView { id: treat.id, at },
                by: id,
            },
        });
        self.floor_treats.push(treat);
    }

    pub(super) fn give_treat(&mut self, now: u64, id: u32, to: u32, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let Some(them) = self.present(to, id).map(|p| p.name.clone()) else {
            return error(out, id, ErrorCode::UnknownPerson, "They aren't inside.");
        };
        if self.treats_left(id, now) == 0 {
            return error(out, id, ErrorCode::NoTreats, "You've no treats left today.");
        }
        self.use_treat(id, now, out);
        self.todays_row(to, now).received += 1;
        self.keep_treats(to, now, out);
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %who, what = "give_treat", outcome = "ok", to = %them);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::TreatGiven { from: id, to },
        });
    }

    /// A cat at its food: a treat if it's still there, a bowl portion if any
    /// are left. True if it ate. A treat's giver gains a little trust.
    pub(super) fn eat(&mut self, i: usize, food: Food, out: &mut Vec<Out>) -> bool {
        let cat_id = self.cats[i].def.id.clone();
        match food {
            Food::Treat(id) => {
                let Some(k) = self.floor_treats.iter().position(|t| t.id == id) else {
                    return false;
                };
                let treat = self.floor_treats.remove(k);
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::TreatEaten { id, cat: cat_id },
                });
                let rate = self.cats[i].def.traits.trust_rate;
                let today = canberra_day(self.last_tick);
                self.change_trust(i, treat.by, rate, &today, out);
            }
            Food::Bowls => {
                if self.bowls == 0 {
                    return false;
                }
                self.bowls -= 1;
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::Bowls { portions: self.bowls },
                });
            }
        }
        self.cats[i].hunger = 0.0;
        true
    }

    /// A new Canberra day: everyone's allowance is back, and each is told.
    pub(super) fn treats_tick(&mut self, now: u64, out: &mut Vec<Out>) {
        let today = canberra_day(now);
        if today == self.treat_day {
            return;
        }
        self.treat_day = today;
        let people: Vec<u32> = self.people.iter().map(|p| p.id).collect();
        for id in people {
            out.push(Out {
                to: To::One(id),
                msg: ServerMsg::YourTreats {
                    left: self.treats_left(id, now),
                },
            });
        }
    }

    /// The café's schedule: the bowls refill at each refill time, once.
    pub(super) fn bowls_tick(&mut self, now: u64, out: &mut Vec<Out>) {
        let key = refill_key(now, &self.tuning.bowl_refills);
        if key == self.bowls_key {
            return;
        }
        self.bowls_key = key;
        self.bowls = self.tuning.bowl_portions;
        tracing::info!(target: "cafe", what = "bowls_filled", portions = self.bowls);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::Bowls { portions: self.bowls },
        });
    }

    pub(super) fn treat_views(&self) -> Vec<TreatView> {
        self.floor_treats.iter().map(|t| TreatView { id: t.id, at: t.at }).collect()
    }

    /// The bowls as saved: portions, and which refill they came from.
    pub fn bowls_json(&self) -> String {
        format!("{}|{}", self.bowls, self.bowls_key)
    }

    /// Puts back the bowls and every visitor's treats as they were saved.
    pub fn restore_treats(&mut self, bowls: Option<String>, treats: Vec<TreatRow>) {
        if let Some((portions, key)) = bowls.as_deref().and_then(|b| b.split_once('|')) {
            self.bowls = portions.parse().unwrap_or(0).min(self.tuning.bowl_portions);
            self.bowls_key = key.to_string();
        }
        self.treat_book = treats.into_iter().map(|r| (r.user_id as u32, r)).collect();
    }
}

/// Which refill the bowls are on at `now`: the latest refill time that has
/// passed, today's or (before the first) yesterday's last.
pub(super) fn refill_key(now: u64, refills: &[u32]) -> String {
    let minute = canberra_minute_of_day(now);
    match refills.iter().rev().find(|&&r| r <= minute) {
        Some(r) => format!("{}@{r}", canberra_day(now)),
        None => format!("{}@{}", canberra_day_before(now), refills.last().copied().unwrap_or(0)),
    }
}
