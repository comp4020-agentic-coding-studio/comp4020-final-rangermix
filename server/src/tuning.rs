//! Every tunable number, from content/tuning.toml. design.md's "Numbers to
//! tune" lists the same values; change both together.
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Tuning {
    pub cap: usize,
    pub grace_secs: u64,
    pub quiet_hidden_secs: u64,
    pub quiet_idle_secs: u64,
    pub nudge_answer_secs: u64,
    pub bubble_max_chars: usize,
    pub bubble_base_ms: u32,
    pub bubble_per_char_ms: u32,
    pub bubble_max_ms: u32,
    pub bubble_burst: f64,
    pub bubble_refill_secs: f64,
    pub furniture_burst: f64,
    pub furniture_refill_secs: f64,
    pub action_burst: f64,
    pub action_per_sec: f64,
    pub trust_levels: [f32; 3],
    pub trust_daily_cap: f32,
    pub person_speed: f32,
    pub cat_speed: f32,
    pub save_every_secs: u64,
    pub outbound_queue: usize,
    pub session_days: u64,
    pub auth_per_name_per_min: f64,
    pub auth_per_ip_per_min: f64,
}

impl Tuning {
    pub fn load(path: &Path) -> anyhow::Result<Tuning> {
        let text = std::fs::read_to_string(path)?;
        Ok(toml::from_str(&text)?)
    }

    /// How long a bubble of `chars` characters stays up.
    pub fn bubble_ttl_ms(&self, chars: usize) -> u32 {
        (self.bubble_base_ms + self.bubble_per_char_ms * chars as u32).min(self.bubble_max_ms)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo() -> Tuning {
        Tuning::load(&std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/tuning.toml")).unwrap()
    }

    #[test]
    fn the_numbers_match_the_design() {
        let t = repo();
        assert_eq!((t.cap, t.grace_secs, t.bubble_max_chars), (6, 30, 100));
        assert_eq!(t.trust_levels, [20.0, 50.0, 80.0]);
        assert_eq!((t.auth_per_name_per_min, t.auth_per_ip_per_min), (5.0, 60.0));
    }

    #[test]
    fn a_bubble_stays_up_longer_for_a_longer_message() {
        let t = repo();
        assert_eq!(t.bubble_ttl_ms(0), 3000);
        assert_eq!(t.bubble_ttl_ms(5), 3300);
        assert_eq!(t.bubble_ttl_ms(100), 9000);
        assert_eq!(t.bubble_ttl_ms(1000), 10_000);
    }

    #[test]
    fn a_misspelt_number_stops_the_server() {
        let text = std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/tuning.toml")).unwrap();
        assert!(toml::from_str::<Tuning>(&text.replace("grace_secs", "grace_sec")).is_err());
    }
}
