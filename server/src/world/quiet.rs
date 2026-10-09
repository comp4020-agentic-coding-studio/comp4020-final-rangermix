//! The quiet seat (ADR 0009): while someone waits at the window, a person
//! inside who has gone quiet is asked "still there?"; with no answer they
//! walk out and the first in line walks in. With nobody waiting, anyone can
//! stay as long as they like.
use super::{Out, To, World};
use crate::protocol::{ClientMsg, Place, ServerMsg};
use crate::room::Walker;

impl World {
    /// Notes a message from `id` as a sign of life, which also answers a
    /// "still there?". Hiding the tab is the one message that isn't.
    pub(super) fn heard_from(&mut self, now: u64, id: u32, msg: &ClientMsg, out: &mut Vec<Out>) {
        let Some(p) = self.people.iter_mut().find(|p| p.id == id) else {
            return;
        };
        match msg {
            ClientMsg::Presence { hidden: true } => {
                p.hidden_since.get_or_insert(now);
                return;
            }
            ClientMsg::Presence { hidden: false } => p.hidden_since = None,
            _ => {}
        }
        p.last_input = now;
        if p.nudged.take().is_some() {
            out.push(Out {
                to: To::One(id),
                msg: ServerMsg::NudgeOver {},
            });
        }
    }

    pub(super) fn quiet_tick(&mut self, now: u64, out: &mut Vec<Out>) {
        let waiting = self.people.iter().any(|p| p.place == Place::Window);
        let t = &self.tuning;
        let (hidden_ms, idle_ms, answer_ms) = (t.quiet_hidden_secs * 1000, t.quiet_idle_secs * 1000, t.nudge_answer_secs * 1000);
        let secs = t.nudge_answer_secs as u32;
        let mut unanswered = Vec::new();
        for p in self.people.iter_mut().filter(|p| p.place == Place::Inside && !p.leaving) {
            match p.nudged {
                Some(_) if !waiting => {
                    p.nudged = None;
                    out.push(Out {
                        to: To::One(p.id),
                        msg: ServerMsg::NudgeOver {},
                    });
                }
                Some(asked) if now.saturating_sub(asked) >= answer_ms => unanswered.push(p.id),
                Some(_) => {}
                // A dropped connection is the grace period's to settle.
                None if waiting && p.away_since.is_none() => {
                    let hidden = p.hidden_since.is_some_and(|h| now.saturating_sub(h) >= hidden_ms);
                    if hidden || now.saturating_sub(p.last_input) >= idle_ms {
                        p.nudged = Some(now);
                        tracing::info!(target: "action", uid = p.id, who = %p.name, what = "nudge");
                        out.push(Out {
                            to: To::One(p.id),
                            msg: ServerMsg::StillThere { secs },
                        });
                    }
                }
                None => {}
            }
        }
        for id in unanswered {
            self.walk_out(now, id, out);
        }
    }

    /// An unanswered nudge: the seat frees now, and they walk out the door.
    fn walk_out(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        let Some(from) = self.person_tile(id, now) else { return };
        let door = self.room.door;
        let path = self.room.path(from, door, Walker::Person).unwrap_or_else(|| vec![from, door]);
        let Some(p) = self.people.iter_mut().find(|p| p.id == id) else {
            return;
        };
        p.leaving = true;
        p.nudged = None;
        tracing::info!(target: "action", uid = id, who = %p.name, what = "walk_out");
        self.start_walk(now, id, from, path, None, out);
        self.promote(now, out);
    }
}

#[cfg(test)]
mod tests {
    use super::super::people::tests::{join, world};
    use super::super::*;
    use crate::protocol::{ClientMsg, Place, ServerMsg};

    const MIN: u64 = 60_000;

    fn send(w: &mut World, id: u32, now: u64, msg: ClientMsg) -> Vec<Out> {
        w.handle(now, Input::Msg { id, msg })
    }

    /// Six inside, all joined at 0; the seventh waits at the window.
    fn full() -> World {
        let mut w = world();
        for id in 1..=7 {
            join(&mut w, id, 0);
        }
        w
    }

    /// Everyone but `quiet` says they're here at `now`.
    fn others_active(w: &mut World, quiet: u32, now: u64) {
        for id in 1..=6 {
            if id != quiet {
                send(w, id, now, ClientMsg::Here {});
            }
        }
    }

    fn nudges(outs: &[Out]) -> Vec<To> {
        outs.iter()
            .filter(|o| matches!(o.msg, ServerMsg::StillThere { .. }))
            .map(|o| o.to)
            .collect()
    }

    fn overs(outs: &[Out]) -> Vec<To> {
        outs.iter()
            .filter(|o| matches!(o.msg, ServerMsg::NudgeOver {}))
            .map(|o| o.to)
            .collect()
    }

    fn place_of(w: &World, id: u32) -> Option<Place> {
        w.people.iter().find(|p| p.id == id).map(|p| p.place)
    }

    #[test]
    fn with_nobody_waiting_nobody_is_asked() {
        let mut w = world();
        join(&mut w, 1, 0);
        for minute in 1..=60 {
            assert!(nudges(&w.tick(minute * MIN)).is_empty(), "minute {minute}");
        }
    }

    #[test]
    fn someone_idle_is_asked_once_when_someone_waits() {
        let mut w = full();
        others_active(&mut w, 1, 9 * MIN);
        assert!(nudges(&w.tick(10 * MIN - 1)).is_empty());
        assert_eq!(nudges(&w.tick(10 * MIN)), vec![To::One(1)]);
        assert!(nudges(&w.tick(10 * MIN + 100)).is_empty(), "asked once");
    }

    #[test]
    fn any_answer_keeps_the_seat() {
        let mut w = full();
        others_active(&mut w, 1, 9 * MIN);
        w.tick(10 * MIN);
        let outs = send(&mut w, 1, 10 * MIN + 5_000, ClientMsg::Here {});
        assert_eq!(overs(&outs), vec![To::One(1)]);
        others_active(&mut w, 1, 10 * MIN + 30_000);
        let outs = w.tick(11 * MIN + 1_000);
        assert!(!outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonMoved { id: 1, .. })));
        assert_eq!(place_of(&w, 7), Some(Place::Window));
    }

    #[test]
    fn no_answer_walks_them_out_and_lets_the_first_in_line_in() {
        let mut w = full();
        others_active(&mut w, 1, 9 * MIN);
        w.tick(10 * MIN);
        others_active(&mut w, 1, 10 * MIN + 30_000);
        assert!(
            w.tick(11 * MIN - 1)
                .iter()
                .all(|o| !matches!(o.msg, ServerMsg::PersonMoved { id: 1, .. }))
        );
        let outs = w.tick(11 * MIN);
        let walk = outs
            .iter()
            .find_map(|o| match &o.msg {
                ServerMsg::PersonMoved { id: 1, walk } => Some(walk.clone()),
                _ => None,
            })
            .expect("walks out");
        assert_eq!(*walk.path.last().unwrap(), w.room.door);
        assert!(outs.iter().any(|o| matches!(
            o.msg,
            ServerMsg::PersonPlaced {
                id: 7,
                place: Place::Inside,
                ..
            }
        )));
        assert!(
            !outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { id: 1 })),
            "still walking"
        );
        // On the way out, nothing they ask for happens.
        let ignored = send(&mut w, 1, 11 * MIN + 10, ClientMsg::Here {});
        assert!(ignored.is_empty());
        let later = w.tick(walk_end(&walk) + 1);
        assert!(later.iter().any(|o| matches!(o.msg, ServerMsg::PersonLeft { id: 1 })));
        assert_eq!(place_of(&w, 1), None);
    }

    #[test]
    fn the_line_emptying_calls_off_the_question() {
        let mut w = full();
        others_active(&mut w, 1, 9 * MIN);
        w.tick(10 * MIN);
        send(&mut w, 7, 10 * MIN + 1_000, ClientMsg::Leave {});
        let outs = w.tick(10 * MIN + 1_100);
        assert_eq!(overs(&outs), vec![To::One(1)]);
        let outs = w.tick(12 * MIN);
        assert!(!outs.iter().any(|o| matches!(o.msg, ServerMsg::PersonMoved { id: 1, .. })));
    }

    #[test]
    fn a_tab_hidden_for_two_minutes_counts_as_quiet() {
        let mut w = full();
        send(&mut w, 1, MIN, ClientMsg::Presence { hidden: true });
        others_active(&mut w, 1, 2 * MIN);
        assert!(nudges(&w.tick(3 * MIN - 1)).is_empty());
        assert_eq!(nudges(&w.tick(3 * MIN)), vec![To::One(1)]);
    }

    #[test]
    fn showing_the_tab_again_is_an_answer() {
        let mut w = full();
        send(&mut w, 1, MIN, ClientMsg::Presence { hidden: true });
        others_active(&mut w, 1, 2 * MIN);
        w.tick(3 * MIN);
        let outs = send(&mut w, 1, 3 * MIN + 1_000, ClientMsg::Presence { hidden: false });
        assert_eq!(overs(&outs), vec![To::One(1)]);
    }

    #[test]
    fn hiding_the_tab_is_not_an_answer() {
        let mut w = full();
        others_active(&mut w, 1, 9 * MIN);
        w.tick(10 * MIN);
        let outs = send(&mut w, 1, 10 * MIN + 1_000, ClientMsg::Presence { hidden: true });
        assert!(overs(&outs).is_empty());
    }

    #[test]
    fn someone_whose_connection_dropped_is_left_to_the_grace_period() {
        let mut w = full();
        w.handle(9 * MIN + 50_000, Input::Drop { id: 1 });
        others_active(&mut w, 1, 9 * MIN);
        assert!(nudges(&w.tick(10 * MIN)).is_empty());
    }
}
