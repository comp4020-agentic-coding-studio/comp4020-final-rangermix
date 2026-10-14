//! Fast-forward (ADR 0006): the time the café was asleep, replayed in
//! one-second steps by the rules it runs awake, with nobody inside.
use super::World;
use crate::protocol::ServerMsg;

/// At most this much of a gap is replayed: by then the cats' needs have settled.
pub const MAX_REPLAY_MS: u64 = 7 * 24 * 3_600_000;
const STEP_MS: u64 = 1_000;

/// What a wake-up's replay did, for its log line.
#[derive(Debug, Clone, PartialEq)]
pub struct Replay {
    pub from: u64,
    pub to: u64,
    pub steps: u64,
    /// How many times the café's schedule filled the bowls.
    pub refills: u32,
    /// Each cat's walks, by name, in content order.
    pub walks: Vec<(String, u32)>,
}

impl Replay {
    /// `[["Burakku",40],["Mochi",3],["Tora",12]]`, for the log line: JSON,
    /// so a cat's name with a space or a colon in it stays whole.
    pub fn walks_text(&self) -> String {
        serde_json::to_string(&self.walks).expect("names and counts serialise")
    }
}

/// Where a replay starts: the saved clock, or a week before `now` if the
/// café slept longer; `now` itself with no clock, or one that isn't behind.
pub fn replay_start(saved_at: Option<u64>, now: u64) -> u64 {
    match saved_at {
        Some(at) if at < now => at.max(now.saturating_sub(MAX_REPLAY_MS)),
        _ => now,
    }
}

impl World {
    /// Replays from the world's clock up to `to`. Nothing is written on the
    /// way and nothing is logged: what changed is saved once at the end,
    /// before anyone is let in, and the wake-up logs one summary.
    pub fn replay(&mut self, to: u64) -> Replay {
        let from = self.last_tick;
        let ids: Vec<String> = self.cats.iter().map(|c| c.def.id.clone()).collect();
        let mut replay = Replay {
            from,
            to,
            steps: 0,
            refills: 0,
            walks: self.cats.iter().map(|c| (c.def.name.clone(), 0)).collect(),
        };
        let store = self.store.take();
        tracing::subscriber::with_default(tracing::subscriber::NoSubscriber::default(), || {
            let mut at = from + STEP_MS;
            while at <= to {
                let key = self.bowls_key.clone();
                for out in self.tick(at) {
                    if let ServerMsg::CatMoved { cat, .. } = &out.msg
                        && let Some(i) = ids.iter().position(|id| id == cat)
                    {
                        replay.walks[i].1 += 1;
                    }
                }
                if self.bowls_key != key {
                    replay.refills += 1;
                }
                replay.steps += 1;
                at += STEP_MS;
            }
        });
        self.store = store;
        self.save_with(self.last_tick, true);
        replay
    }
}
