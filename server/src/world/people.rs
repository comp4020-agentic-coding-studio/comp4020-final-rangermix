//! People in the café: arriving, the line at the window (ADR 0008), walking,
//! talking (ADR 0010), dropping out, coming back and leaving.
use super::{Heard, Out, Pending, Person, To, World, error, walk_end, walk_tile};
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

    pub(super) fn join(&mut self, now: u64, id: u32, name: String, look: Look, out: &mut Vec<Out>) {
        if let Some(p) = self.person_mut(id) {
            // Back within the grace period, or a second tab: the same seat.
            p.away_since = None;
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
            });
            tracing::info!(target: "action", uid = id, who = %name, what = "arrive", place = ?place);
            let person = person_view(self.person(id).expect("just added"), now);
            out.push(Out {
                to: To::All,
                msg: ServerMsg::PersonJoined { person },
            });
            if place == Place::Inside {
                self.arrivals.push(id);
            }
        }
        let snapshot = self.snapshot_for(id, now);
        let welcome = ServerMsg::Welcome {
            you: id,
            build: self.build.clone(),
            now,
            cap: self.tuning.cap as u32,
            snapshot,
        };
        out.insert(
            0,
            Out {
                to: To::One(id),
                msg: welcome,
            },
        );
    }

    pub(super) fn drop_connection(&mut self, now: u64, id: u32) {
        if let Some(p) = self.person_mut(id) {
            p.away_since = Some(now);
        }
    }

    pub(super) fn remove(&mut self, now: u64, id: u32, why: &str, out: &mut Vec<Out>) {
        let Some(i) = self.people.iter().position(|p| p.id == id) else {
            return;
        };
        let gone = self.people.remove(i);
        tracing::info!(target: "action", uid = id, who = %gone.name, what = "leave", why);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::PersonLeft { id },
        });
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
            tracing::info!(target: "action", uid = id, who = %p.name, what = "come_in");
            out.push(Out {
                to: To::All,
                msg: ServerMsg::PersonPlaced {
                    id,
                    place: Place::Inside,
                    at: door,
                    walk: Some(walk),
                },
            });
            self.arrivals.push(id);
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
        let from = self.person_tile(id, now).expect("checked above");
        let Some(path) = self.room.path(from, tile, Walker::Person) else {
            return error(out, id, ErrorCode::BadTile, "You can't stand there.");
        };
        self.start_walk(now, id, from, path, None, out);
        let name = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %name, what = "walk", x = tile.x, y = tile.y);
    }

    /// Walks to `target` and does `then` on arrival. False if there's no way there.
    pub(super) fn approach(&mut self, now: u64, id: u32, target: Tile, then: Pending, out: &mut Vec<Out>) -> bool {
        let Some(from) = self.person_tile(id, now) else { return false };
        let Some(path) = self.room.path(from, target, Walker::Person) else {
            return false;
        };
        self.start_walk(now, id, from, path, Some(then), out);
        true
    }

    pub(super) fn start_walk(&mut self, now: u64, id: u32, from: Tile, path: Vec<Tile>, then: Option<Pending>, out: &mut Vec<Out>) {
        let walk = Walk {
            path,
            start: now,
            speed: self.tuning.person_speed,
        };
        let p = self.person_mut(id).expect("callers check the person is here");
        p.at = from;
        p.walk = Some(walk.clone());
        p.pending = then;
        out.push(Out {
            to: To::All,
            msg: ServerMsg::PersonMoved { id, walk },
        });
    }

    pub(super) fn say(&mut self, now: u64, id: u32, text: String, to: Option<u32>, out: &mut Vec<Out>) {
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
        tracing::info!(target: "action", uid = id, who = %name, what = "say", len = chars, to = ?to);
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
        tracing::info!(target: "action", uid = id, who = %name, what = "emote", emote = %format!("{emote:?}").to_lowercase());
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
        World::new(content, trust, Vec::new(), 7, None, "test".into(), 0)
    }

    pub(crate) fn join(w: &mut World, id: u32, now: u64) -> Vec<Out> {
        w.handle(
            now,
            Input::Join {
                id,
                name: format!("p{id}"),
                look: Look { avatar: 0, colour: 0 },
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
        use std::sync::{Arc, Mutex};
        #[derive(Clone)]
        struct Sink(Arc<Mutex<Vec<u8>>>);
        impl std::io::Write for Sink {
            fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
                self.0.lock().unwrap().extend_from_slice(data);
                Ok(data.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Ok(())
            }
        }
        let sink = Sink(Arc::new(Mutex::new(Vec::new())));
        let writer = sink.clone();
        let subscriber = tracing_subscriber::fmt()
            .json()
            .flatten_event(true)
            .with_writer(move || writer.clone())
            .finish();
        tracing::subscriber::with_default(subscriber, f);
        let bytes = sink.0.lock().unwrap().clone();
        String::from_utf8(bytes).unwrap()
    }
}
