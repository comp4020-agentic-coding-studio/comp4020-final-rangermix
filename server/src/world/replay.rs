//! Fast-forward (ADR 0006): the time the café was asleep, replayed in
//! one-second steps by the rules it runs awake, with nobody inside.
use super::World;
use crate::protocol::ServerMsg;

const STEP_MS: u64 = 1_000;

#[cfg(test)]
thread_local! {
    /// A test's way to make a replay panic at a given step.
    pub static PANIC_AT_STEP: std::cell::Cell<Option<u64>> = const { std::cell::Cell::new(None) };
}

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

/// Where a replay starts: the saved clock, or `cap` before `now` if the café
/// slept longer (tuning.toml's `replay_max_days`: by then the cats' needs
/// have settled); `now` itself with no clock, or one that isn't behind.
pub fn replay_start(saved_at: Option<u64>, now: u64, cap: u64) -> u64 {
    match saved_at {
        Some(at) if at < now => at.max(now.saturating_sub(cap)),
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
                #[cfg(test)]
                if PANIC_AT_STEP.with(|p| p.get()) == Some(replay.steps) {
                    panic!("a test's panic at step {}", replay.steps);
                }
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
