//! A cat's anger at one person (design.md, "Being handled"): it rises with
//! unwelcome handling, by the cat's temper, and cools away over the cat's
//! grudge. It lives in memory only. Angry, a cat scratches; furious, it bans
//! the action from that person for as long as its grudge lasts.

/// Angry enough to scratch instead of just pulling away.
pub const SCRATCH: f32 = 0.6;
/// Furious: the action is banned for the cat's grudge.
pub const FURIOUS: f32 = 1.0;

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Anger {
    pub level: f32,
    pub at: u64,
}

impl Anger {
    /// What's left of it at `now`: most of it is gone by the end of the grudge.
    pub fn at(&self, now: u64, grudge_hours: f32) -> f32 {
        let tau = grudge_hours * 3_600_000.0 / 3.0;
        self.level * (-(now.saturating_sub(self.at) as f32) / tau).exp()
    }

    /// After an unwelcome handling (a refusal, pushing, a scratch).
    pub fn provoked(&self, now: u64, temper: f32, grudge_hours: f32) -> Anger {
        Anger {
            level: self.at(now, grudge_hours) + 0.3 + 0.5 * temper,
            at: now,
        }
    }
}

/// How long a ban has left, as words: "1 h 40 min", "12 min", "under a minute".
pub fn time_left(ms: u64) -> String {
    let minutes = ms.div_ceil(60_000);
    match (minutes / 60, minutes % 60) {
        (0, 0) => "under a minute".into(),
        (0, m) => format!("{m} min"),
        (h, 0) => format!("{h} h"),
        (h, m) => format!("{h} h {m} min"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR: u64 = 3_600_000;

    #[test]
    fn a_short_tempered_cat_is_provoked_faster() {
        let calm = Anger::default().provoked(0, 0.2, 2.0);
        let short = Anger::default().provoked(0, 0.6, 4.0);
        assert!(short.level > calm.level);
    }

    #[test]
    fn mochi_is_furious_after_three_unwelcome_tries_burakku_after_two() {
        // Mochi: temper 0.2, grudge 2 h. Burakku: temper 0.5, grudge 48 h.
        let mut m = Anger::default();
        for n in 0..3 {
            m = m.provoked(n * 10_000, 0.2, 2.0);
        }
        assert!(m.level >= FURIOUS, "{}", m.level);
        let mut b = Anger::default();
        b = b.provoked(0, 0.5, 48.0);
        assert!(b.level < FURIOUS);
        b = b.provoked(10_000, 0.5, 48.0);
        assert!(b.level >= FURIOUS, "{}", b.level);
    }

    #[test]
    fn anger_cools_away_over_the_grudge() {
        let a = Anger { level: 1.0, at: 0 };
        assert!(a.at(0, 2.0) == 1.0);
        assert!(a.at(HOUR, 2.0) < 0.3);
        assert!(a.at(2 * HOUR, 2.0) < 0.06);
        assert!(a.at(2 * HOUR, 48.0) > 0.85, "Burakku still remembers");
    }

    #[test]
    fn time_left_reads_as_words() {
        assert_eq!(time_left(30_000), "1 min");
        assert_eq!(time_left(0), "under a minute");
        assert_eq!(time_left(100 * 60_000), "1 h 40 min");
        assert_eq!(time_left(48 * HOUR), "48 h");
    }
}
