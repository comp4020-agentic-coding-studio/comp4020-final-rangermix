//! The chalkboard (design.md, "The room"): what the cats got up to over a
//! rolling day, written by the server from what they do. People never write
//! on it, and nothing anyone said can reach it: a line is fixed fields.
use super::{Out, To, World};
use crate::protocol::{ChalkLine, ChalkWhat, ServerMsg};

/// At most this many lines are kept, the oldest dropping first.
const KEPT: usize = 500;
/// The same doing by the same cat is written at most this often.
const AGAIN_MS: u64 = 3_600_000;

/// Doings told every time; the rest at most once an hour per cat and key.
fn every_time(what: &ChalkWhat) -> bool {
    matches!(what, ChalkWhat::KnockedOver { .. } | ChalkWhat::Met { .. } | ChalkWhat::Lap { .. })
}

/// What makes two lines the same doing: its kind, and whom or what it was with.
fn key(what: &ChalkWhat) -> (std::mem::Discriminant<ChalkWhat>, Option<&str>) {
    let with = match what {
        ChalkWhat::Greeted { with } | ChalkWhat::PlayedWith { with } => Some(with.as_str()),
        ChalkWhat::Investigated { piece } => Some(piece.as_str()),
        _ => None,
    };
    (std::mem::discriminant(what), with)
}

impl World {
    /// Writes a line for cat `i` and tells everyone, unless it's the same
    /// doing as one it did within the hour.
    pub(super) fn chalk(&mut self, now: u64, i: usize, what: ChalkWhat, out: &mut Vec<Out>) {
        let cat = self.cats[i].def.name.clone();
        let again = self
            .chalk
            .iter()
            .rev()
            .take_while(|l| now.saturating_sub(l.at) < AGAIN_MS)
            .any(|l| l.cat == cat && key(&l.what) == key(&what));
        if again && !every_time(&what) {
            return;
        }
        let line = ChalkLine { at: now, cat, what };
        out.push(Out {
            to: To::All,
            msg: ServerMsg::Chalked { line: line.clone() },
        });
        self.chalk.push_back(line);
        while self.chalk.len() > KEPT {
            self.chalk.pop_front();
        }
    }

    /// Drops the lines a day old.
    pub(super) fn chalk_tick(&mut self, now: u64) {
        let day = self.tuning.chalk_hours * 3_600_000;
        while self.chalk.front().is_some_and(|l| now.saturating_sub(l.at) >= day) {
            self.chalk.pop_front();
        }
    }

    /// The latest lines, oldest first, for a snapshot.
    pub fn chalk_view(&self) -> Vec<ChalkLine> {
        let skip = self.chalk.len().saturating_sub(self.tuning.chalk_shown);
        self.chalk.iter().skip(skip).cloned().collect()
    }
}
