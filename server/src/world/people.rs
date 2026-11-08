//! People in the café: arriving, the line at the window (ADR 0008), walking,
//! talking (ADR 0010), dropping out, coming back and leaving.
use super::{Heard, Out, Pending, Person, SetOff, To, World, error, walk_end, walk_tile};
use crate::protocol::{Emote, ErrorCode, Look, PersonView, Place, ServerMsg, Tile, Walk};
use crate::room::Walker;

pub(super) fn person_view(p: &Person, now: u64) -> PersonView {
    PersonView {
        id: p.id,
        name: p.name.clone(),
        look: p.look,
        place: p.place,
        at: p.walk.as_ref().map_or(p.at, |w| walk_tile(w, now)),
        walk: p.walk.clone(),
        sitting: p.sitting.is_some(),
        bot: p.bot.is_some(),
    }
}

impl World {
    pub(super) fn inside(&self) -> usize {
        self.people.iter().filter(|p| p.place == Place::Inside && !p.leaving).count()
    }

    pub(super) fn person(&self, id: u32) -> Option<&Person> {
        self.people.iter().find(|p| p.id == id)
    }

    fn person_mut(&mut self, id: u32) -> Option<&mut Person> {
        self.people.iter_mut().find(|p| p.id == id)
    }

    /// Where someone is now, mid-walk or standing.
    pub(super) fn person_tile(&self, id: u32, now: u64) -> Option<Tile> {
        self.person(id).map(|p| p.walk.as_ref().map_or(p.at, |w| walk_tile(w, now)))
    }

    /// Where a new walk of someone's sets off: past the end of any step under way.
    pub(super) fn person_set_off(&self, id: u32, now: u64) -> Option<SetOff> {
        self.person(id).map(|p| SetOff::at(p.walk.as_ref(), p.at, now))
    }

    pub(super) fn join(&mut self, now: u64, id: u32, name: String, look: Look, demo: bool, out: &mut Vec<Out>) {
        if let Some(p) = self.person_mut(id) {
            // Back within the grace period, or a second tab: the same seat.
            // Coming back is a sign of life, and answers any "still there?";
            // the new page reports a hidden tab itself.
            p.away_since = None;
            p.last_input = now;
            p.hidden_since = None;
            p.nudged = None;
        } else {
            let place = if self.inside() < self.tuning.cap {
                Place::Inside
            } else {
                Place::Window
            };
            let walk = (place == Place::Inside).then(|| self.entering_walk(now));
            let door = self.room.door;
            self.people.push(Person {
                id,
                name: name.clone(),
                look,
                place,
                at: door,
                walk,
                joined: now,
                away_since: None,
                pending: None,
                last_input: now,
                hidden_since: None,
                nudged: None,
                leaving: false,
                sitting: None,
                furniture: crate::limits::Bucket::new(self.tuning.furniture_burst, 1.0 / self.tuning.furniture_refill_secs, now),
                demo,
                bot: None,
            });
            tracing::info!(target: "action", uid = id, who = %name, what = "arrive", outcome = "ok", place = if place == Place::Inside { "inside" } else { "window" });
            let person = person_view(self.person(id).expect("just added"), now);
            out.push(Out {
                to: To::All,
                msg: ServerMsg::PersonJoined { person },
            });
            if place == Place::Inside {
                self.arrivals.push(id);
            }
        }
        out.insert(
            0,
            Out {
                to: To::One(id),
                msg: self.welcome(id, now),
            },
        );
    }

    /// The whole café for `id`, as it is at `now`: on joining, and for
    /// everyone after a jump (slice 17).
    pub(super) fn welcome(&self, id: u32, now: u64) -> ServerMsg {
        ServerMsg::Welcome {
            you: id,
            build: self.build.clone(),
            now,
            cap: self.tuning.cap as u32,
            chalk_hours: self.tuning.chalk_hours as u32,
            chalk_shown: self.tuning.chalk_shown as u32,
            demo: self.person(id).is_some_and(|p| p.demo),
            ahead: self.ahead,
            next_jump: self.next_jump_at(),
            layouts: self.layout_names(),
            next_layout: self.next_layout_at(),
            snapshot: Box::new(self.snapshot_for(id, now)),
        }
    }

    /// The seat waits for the grace period; what they carried goes back now,
    /// and a grab on the way is called off.
    pub(super) fn drop_connection(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        if let Some(p) = self.person_mut(id) {
            p.away_since = Some(now);
        }
        self.put_back(now, id, Some("dropped"), out);
        self.let_go_of_cat(now, id, out);
    }

    pub(super) fn remove(&mut self, now: u64, id: u32, why: &str, out: &mut Vec<Out>) {
        if !self.people.iter().any(|p| p.id == id) {
            return;
        }
        // Whatever they carried goes back where it was.
        self.put_back(now, id, Some("left"), out);
        self.let_go_of_cat(now, id, out);
        let i = self.people.iter().position(|p| p.id == id).expect("checked above");
        let gone = self.people.remove(i);
        // A bot's line says which demo account added it (slice 17).
        let added_by = gone.bot.as_ref().map(|b| b.by_name.clone());
        tracing::info!(target: "action", uid = id, who = %gone.name, what = "leave", outcome = "ok", why, added_by);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::PersonLeft { id },
        });
        self.bots_follow(now, id, out);
        self.promote(now, out);
    }

    /// While seats are free, the first in line at the window walks in.
    pub(super) fn promote(&mut self, now: u64, out: &mut Vec<Out>) {
        while self.inside() < self.tuning.cap {
            let Some(i) = self
                .people
                .iter()
                .enumerate()
                .filter(|(_, p)| p.place == Place::Window)
                .min_by_key(|(_, p)| p.joined)
                .map(|(i, _)| i)
            else {
                break;
            };
            let walk = self.entering_walk(now);
            let door = self.room.door;
            let p = &mut self.people[i];
            p.place = Place::Inside;
            p.at = door;
            p.walk = Some(walk.clone());
            let id = p.id;
            tracing::info!(target: "action", uid = id, who = %p.name, what = "come_in", outcome = "ok");
            let bot = p.bot.is_some();
            out.push(Out {
                to: To::All,
                msg: ServerMsg::PersonPlaced {
                    id,
                    place: Place::Inside,
                    at: door,
                    walk: Some(walk),
                },
            });
            // The cats never meet a bot.
            if !bot {
                self.arrivals.push(id);
            }
        }
    }

    /// A walk in from the door to the free tile nearest the entry, so people
    /// coming in don't stand on top of each other, and the walkway stays clear
    /// for the next.
    fn entering_walk(&self, now: u64) -> Walk {
        let taken: Vec<Tile> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside)
            .flat_map(|p| {
                let here = p.walk.as_ref().map_or(p.at, |w| walk_tile(w, now));
                let headed = p.walk.as_ref().and_then(|w| w.path.last().copied());
                std::iter::once(here).chain(headed)
            })
            .collect();
        let (entry, walkway) = (self.room.entry, &self.room.walkway);
        let target = self
            .room
            .nearest(entry, Walker::Person, |t| {
                !taken.contains(&t) && (t == entry || !walkway.contains(&t))
            })
            .unwrap_or(entry);
        let path = self
            .room
            .path(self.room.door, target, Walker::Person)
            .unwrap_or_else(|| vec![self.room.door, self.room.entry]);
        Walk {
            path,
            start: now,
            speed: self.tuning.person_speed,
        }
    }

    /// True if `id` is inside; someone at the window is told they can only talk.
    pub(super) fn inside_or_refuse(&self, id: u32, out: &mut Vec<Out>) -> bool {
        match self.person(id).map(|p| p.place) {
            Some(Place::Inside) => true,
            Some(Place::Window) => {
                error(out, id, ErrorCode::NotFromWindow, "From the window you can only talk.");
                false
            }
            None => false,
        }
    }

    pub(super) fn walk_to(&mut self, now: u64, id: u32, tile: Tile, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let set_off = self.person_set_off(id, now).expect("checked above");
        let Some(path) = self.room.path(set_off.from, tile, Walker::Person) else {
            return error(out, id, ErrorCode::BadTile, "You can't stand there.");
        };
        self.start_walk(now, id, set_off, path, None, out);
        let name = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %name, what = "walk", outcome = "ok", x = tile.x, y = tile.y);
    }

    /// Walks to `target` and does `then` on arrival. False if there's no way there.
    pub(super) fn approach(&mut self, now: u64, id: u32, target: Tile, then: Pending, out: &mut Vec<Out>) -> bool {
        let Some(set_off) = self.person_set_off(id, now) else {
            return false;
        };
        let Some(path) = self.room.path(set_off.from, target, Walker::Person) else {
            return false;
        };
        self.start_walk(now, id, set_off, path, Some(then), out);
        true
    }

    /// Sets someone off along `path`, which starts at `set_off.from`; a step
    /// under way is finished first, so nobody snaps back to the tile it left.
    pub(super) fn start_walk(&mut self, now: u64, id: u32, set_off: SetOff, path: Vec<Tile>, then: Option<Pending>, out: &mut Vec<Out>) {
        let walk = set_off.walk(path, now, self.tuning.person_speed);
        let p = self.person_mut(id).expect("callers check the person is here");
        p.at = walk.path[0];
        p.walk = Some(walk.clone());
        // A new walk stands you up, and replaces whatever waited at the old one's end.
        p.sitting = None;
        let replaced = std::mem::replace(&mut p.pending, then);
        let still = p.pending.clone();
        if let Some(Pending::Grab(piece)) = replaced
            && still != Some(Pending::Grab(piece))
            && self.reserved.get(&piece) == Some(&id)
        {
            self.reserved.remove(&piece);
        }
        out.push(Out {
            to: To::All,
            msg: ServerMsg::PersonMoved { id, walk },
        });
    }

    pub(super) fn say(&mut self, now: u64, id: u32, text: String, to: Option<u32>, out: &mut Vec<Out>) {
        self.speak(now, id, text, to, "say", out);
    }

    /// A bubble, logged as `what` (a call is a call, though to the cats it's
    /// saying the name).
    pub(super) fn speak(&mut self, now: u64, id: u32, text: String, to: Option<u32>, what: &str, out: &mut Vec<Out>) {
        let Some(p) = self.person(id) else { return };
        let name = p.name.clone();
        let text = text.trim().to_string();
        let chars = text.chars().count();
        if chars == 0 {
            return error(out, id, ErrorCode::Empty, "Say something first.");
        }
        if chars > self.tuning.bubble_max_chars {
            return error(
                out,
                id,
                ErrorCode::TooLong,
                &format!("A bubble holds {} characters.", self.tuning.bubble_max_chars),
            );
        }
        if to.is_some_and(|t| self.person(t).is_none()) {
            return error(out, id, ErrorCode::UnknownPerson, "They've left.");
        }
        // Never log what was said (AGENTS.md): who, how long, and to whom.
        let to_name = to.and_then(|t| self.person(t)).map(|p| p.name.clone());
        tracing::info!(target: "action", uid = id, who = %name, what, outcome = "ok", len = chars, to = to_name);
        let ttl_ms = self.tuning.bubble_ttl_ms(chars);
        self.noise.push_back(now);
        self.heard.push(Heard {
            by: id,
            text: text.clone(),
        });
        out.push(Out {
            to: To::All,
            msg: ServerMsg::Said {
                from: id,
                text,
                to,
                ttl_ms,
            },
        });
    }

    /// A wave, laugh, heart or yawn, for everyone; from inside only, since
    /// someone at the window can only talk (AGENTS.md).
    pub(super) fn emote(&mut self, id: u32, emote: Emote, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let name = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %name, what = "emote", outcome = "ok", emote = %format!("{emote:?}").to_lowercase());
        out.push(Out {
            to: To::All,
            msg: ServerMsg::Emoted { from: id, emote },
        });
    }

    /// Ends finished walks, returning what people asked to do when they got
    /// there, and lets go of seats whose grace period has run out.
    pub(super) fn people_tick(&mut self, now: u64, out: &mut Vec<Out>) -> Vec<(u32, Pending)> {
        let mut arrived = Vec::new();
        for p in &mut self.people {
            if let Some(w) = &p.walk
                && now >= walk_end(w)
            {
                p.at = *w.path.last().expect("paths are never empty");
                p.walk = None;
                if let Some(then) = p.pending.take() {
                    arrived.push((p.id, then));
                }
            }
        }
        let grace = self.tuning.grace_secs * 1000;
        let expired: Vec<u32> = self
            .people
            .iter()
            .filter(|p| p.away_since.is_some_and(|t| now.saturating_sub(t) >= grace))
            .map(|p| p.id)
            .collect();
        for id in expired {
            self.remove(now, id, "timed out", out);
        }
        let out_the_door: Vec<u32> = self.people.iter().filter(|p| p.leaving && p.walk.is_none()).map(|p| p.id).collect();
        for id in out_the_door {
            self.remove(now, id, "walked out", out);
        }
        arrived
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::super::*;
    use crate::protocol::{ClientMsg, Emote, ErrorCode, Look, Place, ServerMsg, Tile};

    pub(crate) fn world() -> World {
        let content = crate::content::repo_content();
        let trust = TrustBook::new(content.tuning.trust_levels, content.tuning.trust_daily_cap);
        World::new(
            content,
            trust,
            Vec::new(),
            SavedArrangement::Fresh,
            ChaCha8Rng::seed_from_u64(7),
            None,
            "test".into(),
            0,
        )
    }

    pub(crate) fn join(w: &mut World, id: u32, now: u64) -> Vec<Out> {
        w.handle(
            now,
            Input::Join {
                id,
                name: format!("p{id}"),
                look: Look { avatar: 0, colour: 0 },
                demo: false,
            },
        )
    }

    fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
        w.handle(now, Input::Msg { id, msg })
    }

    fn errors(outs: &[Out]) -> Vec<(To, ErrorCode)> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::Error { code, .. } => Some((o.to, *code)),
                _ => None,
            })
            .collect()
    }

    fn place_of(w: &World, id: u32) -> Option<Place> {
        w.people.iter().find(|p| p.id == id).map(|p| p.place)
    }

    #[test]
    fn a_newcomer_is_welcomed_and_walks_in_through_the_door() {
        let mut w = world();
        let outs = join(&mut w, 1, 1_000);
        match &outs[0] {
            Out {
                to: To::One(1),
                msg: ServerMsg::Welcome {
                    you: 1, cap: 6, snapshot, ..
                },
            } => {
                assert_eq!(snapshot.people.len(), 1)
            }
            other => panic!("expected a welcome first, got {other:?}"),
        }
        let (to, person) = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonJoined { person } => Some((o.to, person.clone())),
                _ => None,
            })
            .expect("everyone hears about the newcomer");
        assert_eq!((to, person.place), (To::All, Place::Inside));
        let walk = person.walk.expect("walking in");
        assert_eq!((walk.path[0], *walk.path.last().unwrap()), (w.room.door, w.room.entry));
    }

    fn walk_in(outs: &[Out], id: u32) -> Walk {
        outs.iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonJoined { person } if person.id == id => person.walk.clone(),
                ServerMsg::PersonPlaced { id: placed, walk, .. } if *placed == id => walk.clone(),
                _ => None,
            })
            .expect("walks in")
    }

    #[test]
    fn newcomers_dont_pile_up_on_one_tile() {
        // Everyone used to walk to the entry, so whoever stood there hid the
        // next person coming in (crit 8's "wrong look" after a sign-up).
        let mut w = world();
        let mut ends = Vec::new();
        for id in 1..=6 {
            let outs = join(&mut w, id, id as u64);
            let walk = walk_in(&outs, id);
            assert_eq!(walk.path[0], w.room.door);
            let end = *walk.path.last().unwrap();
            assert!(w.room.walkable(end, crate::room::Walker::Person));
            assert!(
                end == w.room.entry || !w.room.walkway.contains(&end),
                "({}, {}) is the walkway",
                end.x,
                end.y
            );
            ends.push(end);
        }
        assert_eq!(ends[0], w.room.entry);
        let mut distinct = ends.clone();
        distinct.sort_by_key(|t| (t.x, t.y));
        distinct.dedup();
        assert_eq!(distinct.len(), ends.len(), "{ends:?}");
    }

    #[test]
    fn someone_coming_in_from_the_line_finds_a_free_tile_too() {
        let mut w = world();
        for id in 1..=7 {
            join(&mut w, id, id as u64);
        }
        let outs = send(&mut w, 6, 50_000, ClientMsg::Leave {});
        let end = *walk_in(&outs, 7).path.last().unwrap();
        let taken: Vec<Tile> = (1..=5).filter_map(|id| w.person_tile(id, 50_000)).collect();
        assert!(!taken.contains(&end), "{end:?} is taken: {taken:?}");
    }

    #[test]
    fn the_seventh_person_waits_at_the_window_and_can_only_talk() {
        let mut w = world();
        for id in 1..=7 {
            join(&mut w, id, 0);
        }
        assert_eq!(place_of(&w, 6), Some(Place::Inside));
        assert_eq!(place_of(&w, 7), Some(Place::Window));
        let outs = send(&mut w, 7, 10, ClientMsg::WalkTo { tile: Tile { x: 5, y: 5 } });
        assert_eq!(errors(&outs), vec![(To::One(7), ErrorCode::NotFromWindow)]);
        let outs = send(
            &mut w,
            7,
            10,
            ClientMsg::Say {
                text: "can I come in?".into(),
                to: None,
            },
        );
        assert!(
            outs.iter()
                .any(|o| o.to == To::All && matches!(o.msg, ServerMsg::Said { from: 7, .. }))
        );
    }

    #[test]
    fn when_someone_leaves_the_first_in_line_comes_in() {
        let mut w = world();
        for id in 1..=8 {
            join(&mut w, id, id as u64);
        }
        let outs = send(&mut w, 3, 100, ClientMsg::Leave {});
        assert!(outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { id: 3 })));
        assert!(outs.iter().any(|o| matches!(
            o.msg,
            ServerMsg::PersonPlaced {
                id: 7,
                place: Place::Inside,
                ..
            }
        )));
        assert_eq!(place_of(&w, 8), Some(Place::Window));
    }

    #[test]
    fn a_bubble_reaches_everyone_and_lasts_by_its_length() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        let outs = send(
            &mut w,
            1,
            10,
            ClientMsg::Say {
                text: "  hello  ".into(),
                to: Some(2),
            },
        );
        assert_eq!(
            outs,
            vec![Out {
                to: To::All,
                msg: ServerMsg::Said {
                    from: 1,
                    text: "hello".into(),
                    to: Some(2),
                    ttl_ms: 3300
                }
            }]
        );
    }

    #[test]
    fn empty_overlong_and_misaddressed_bubbles_reach_nobody() {
        let mut w = world();
        join(&mut w, 1, 0);
        let say = |text: String, to| ClientMsg::Say { text, to };
        assert_eq!(
            errors(&send(&mut w, 1, 1, say("   ".into(), None))),
            vec![(To::One(1), ErrorCode::Empty)]
        );
        assert_eq!(
            errors(&send(&mut w, 1, 1, say("x".repeat(101), None))),
            vec![(To::One(1), ErrorCode::TooLong)]
        );
        assert_eq!(
            errors(&send(&mut w, 1, 1, say("hi".into(), Some(99)))),
            vec![(To::One(1), ErrorCode::UnknownPerson)]
        );
    }

    #[test]
    fn emoji_count_as_one_character_each() {
        let mut w = world();
        join(&mut w, 1, 0);
        assert!(
            errors(&send(
                &mut w,
                1,
                1,
                ClientMsg::Say {
                    text: "😺".repeat(100),
                    to: None
                }
            ))
            .is_empty()
        );
        let outs = send(
            &mut w,
            1,
            1,
            ClientMsg::Say {
                text: "😺".repeat(101),
                to: None,
            },
        );
        assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::TooLong)]);
    }

    #[test]
    fn an_emote_reaches_everyone_and_is_logged_by_kind() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        let log = capture_logs(|| {
            let outs = send(&mut w, 1, 10, ClientMsg::Emote { emote: Emote::Wave });
            assert_eq!(
                outs,
                vec![Out {
                    to: To::All,
                    msg: ServerMsg::Emoted {
                        from: 1,
                        emote: Emote::Wave
                    }
                }]
            );
        });
        assert!(log.contains(r#""what":"emote""#) && log.contains("wave"), "{log}");
    }

    #[test]
    fn someone_at_the_window_cant_emote() {
        let mut w = world();
        for id in 1..=7 {
            join(&mut w, id, 0);
        }
        let outs = send(&mut w, 7, 10, ClientMsg::Emote { emote: Emote::Heart });
        assert_eq!(errors(&outs), vec![(To::One(7), ErrorCode::NotFromWindow)]);
    }

    #[test]
    fn what_was_said_is_never_logged() {
        let mut w = world();
        join(&mut w, 1, 0);
        let log = capture_logs(|| {
            send(
                &mut w,
                1,
                1,
                ClientMsg::Say {
                    text: "the secret phrase".into(),
                    to: None,
                },
            );
        });
        assert!(log.contains(r#""what":"say""#), "{log}");
        assert!(!log.contains("secret phrase"), "{log}");
    }

    #[test]
    fn walking_goes_round_furniture_and_never_into_a_wall() {
        let mut w = world();
        join(&mut w, 1, 0);
        let outs = send(&mut w, 1, 5_000, ClientMsg::WalkTo { tile: Tile { x: 1, y: 8 } });
        let walk = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: 1, walk } => Some(walk.clone()),
                _ => None,
            })
            .expect("a walk");
        assert_eq!(*walk.path.last().unwrap(), Tile { x: 1, y: 8 });
        let outs = send(&mut w, 1, 6_000, ClientMsg::WalkTo { tile: Tile { x: 0, y: 0 } });
        assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::BadTile)]);
    }

    fn moved(outs: &[Out], id: u32) -> Walk {
        outs.iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: who, walk } if *who == id => Some(walk.clone()),
                _ => None,
            })
            .expect("a walk")
    }

    /// Where a walk puts someone at `now`, in fractional tiles, as every
    /// client draws it (client/src/motion.ts, `positionAt`).
    pub(crate) fn drawn_at(walk: &Walk, now: u64) -> (f64, f64) {
        let steps = (now.saturating_sub(walk.start) as f64 * walk.speed as f64 / 1000.0).max(0.0);
        let last = walk.path.len() - 1;
        if steps >= last as f64 {
            let end = walk.path[last];
            return (end.x as f64, end.y as f64);
        }
        let i = steps.floor() as usize;
        let f = steps - i as f64;
        let (a, b) = (walk.path[i], walk.path[i + 1]);
        (
            a.x as f64 + (b.x as f64 - a.x as f64) * f,
            a.y as f64 + (b.y as f64 - a.y as f64) * f,
        )
    }

    /// Within 0.005 of a tile: a walk starts on a whole millisecond.
    fn close(a: (f64, f64), b: (f64, f64)) -> bool {
        (a.0 - b.0).abs() < 0.005 && (a.1 - b.1).abs() < 0.005
    }

    const T: fn(u8, u8) -> Tile = |x, y| Tile { x, y };

    /// Person 1 standing still at (2, 10), on a row with nothing on it, and
    /// setting off along it at 10 s, three tiles a second.
    fn setting_off_along_row_10() -> (World, Walk) {
        let mut w = world();
        join(&mut w, 1, 0);
        let p = w.people.iter_mut().find(|p| p.id == 1).unwrap();
        (p.walk, p.at) = (None, T(2, 10));
        let walk = moved(&send(&mut w, 1, 10_000, ClientMsg::WalkTo { tile: T(12, 10) }), 1);
        assert_eq!(walk.path, (2..=12).map(|x| T(x, 10)).collect::<Vec<_>>());
        (w, walk)
    }

    #[test]
    fn a_new_destination_carries_on_from_mid_step_instead_of_snapping_back() {
        // The user's ask, 2026-11-07: changing where you're going reset the
        // walk to the last tile reached. Instead the step under way goes on to
        // its next tile, and the walk turns there for the new destination.
        let (mut w, first) = setting_off_along_row_10();
        // At 10.5 s they're halfway from (3, 10) to (4, 10).
        let now = 10_500;
        let was = drawn_at(&first, now);
        assert!(close(was, (3.5, 10.0)), "{was:?}");
        let second = moved(&send(&mut w, 1, now, ClientMsg::WalkTo { tile: T(9, 12) }), 1);
        assert!(
            close(drawn_at(&second, now), was),
            "drawn at {:?}, not {was:?}",
            drawn_at(&second, now)
        );
        assert_eq!(&second.path[..2], &[T(3, 10), T(4, 10)], "finishes the step first");
        assert_eq!(*second.path.last().unwrap(), T(9, 12));
        // Then four-way steps on to the new destination, every one a tile apart.
        assert!(
            second.path.windows(2).all(|s| crate::room::manhattan(s[0], s[1]) == 1),
            "{:?}",
            second.path
        );
        // The server agrees with the screens: mid-step they're still leaving (3, 10).
        assert_eq!(w.person_tile(1, now), Some(T(3, 10)));
        assert_eq!(w.person_tile(1, now + 200), Some(T(4, 10)));
    }

    #[test]
    fn turning_back_mid_step_finishes_the_step_then_comes_back() {
        let (mut w, first) = setting_off_along_row_10();
        let now = 10_400;
        let was = drawn_at(&first, now);
        let back = moved(&send(&mut w, 1, now, ClientMsg::WalkTo { tile: T(2, 10) }), 1);
        assert!(close(drawn_at(&back, now), was), "{:?} vs {was:?}", drawn_at(&back, now));
        assert_eq!(back.path, vec![T(3, 10), T(4, 10), T(3, 10), T(2, 10)]);
    }

    #[test]
    fn a_new_destination_on_a_tile_boundary_needs_no_extra_step() {
        let (mut w, _) = setting_off_along_row_10();
        // Exactly on (5, 10), three steps in: nothing under way to finish.
        let now = 11_000;
        let back = moved(&send(&mut w, 1, now, ClientMsg::WalkTo { tile: T(2, 10) }), 1);
        assert_eq!(back.path, vec![T(5, 10), T(4, 10), T(3, 10), T(2, 10)]);
        assert_eq!(back.start, now);
    }

    #[test]
    fn a_new_destination_where_the_step_arrives_just_finishes_the_step() {
        let (mut w, first) = setting_off_along_row_10();
        let now = 10_500;
        let was = drawn_at(&first, now);
        let stop = moved(&send(&mut w, 1, now, ClientMsg::WalkTo { tile: T(4, 10) }), 1);
        assert_eq!(stop.path, vec![T(3, 10), T(4, 10)]);
        assert!(close(drawn_at(&stop, now), was));
    }

    #[test]
    fn heading_for_something_mid_step_carries_on_too() {
        // A grab (or a pet, a sit) walks you beside it: from where you are,
        // not from the tile you last stood on.
        let (mut w, first) = setting_off_along_row_10();
        let now = 10_500;
        let was = drawn_at(&first, now);
        let cushion = w.room.pieces.iter().find(|p| p.kind == "cushion").expect("a cushion").id;
        let outs = send(&mut w, 1, now, ClientMsg::Grab { id: cushion });
        assert_eq!(errors(&outs), vec![]);
        let second = moved(&outs, 1);
        assert!(close(drawn_at(&second, now), was), "{:?} vs {was:?}", drawn_at(&second, now));
        assert_eq!(&second.path[..2], &[T(3, 10), T(4, 10)]);
    }

    #[test]
    fn a_dropped_connection_keeps_the_seat_for_the_grace_period() {
        let mut w = world();
        join(&mut w, 1, 0);
        w.handle(1_000, Input::Drop { id: 1 });
        assert!(!w.tick(30_999).iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { .. })));
        assert!(w.tick(31_000).iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { id: 1 })));
    }

    #[test]
    fn coming_back_within_the_grace_period_keeps_the_seat() {
        let mut w = world();
        join(&mut w, 1, 0);
        w.handle(1_000, Input::Drop { id: 1 });
        let outs = join(&mut w, 1, 5_000);
        assert!(
            matches!(
                outs.as_slice(),
                [Out {
                    msg: ServerMsg::Welcome { .. },
                    ..
                }]
            ),
            "only a welcome: {outs:?}"
        );
        assert!(!w.tick(40_000).iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { .. })));
    }

    #[test]
    fn a_second_tab_does_not_make_a_second_person() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 1, 10);
        assert_eq!(w.people.len(), 1);
    }

    /// Runs `f` with JSON logging captured, and returns what was logged.
    pub(crate) fn capture_logs(f: impl FnOnce()) -> String {
        let sink = crate::test_logs::LogSink::default();
        let guard = sink.capture();
        f();
        drop(guard);
        sink.text()
    }
}
