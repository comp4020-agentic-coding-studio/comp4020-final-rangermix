//! A cat's character, from its file in content/cats (ADR 0011), and the pure
//! rules that turn character, needs and the room into choices: what to do
//! next, and how to answer a pet. The world (world/cat_life.rs) applies them.
use crate::protocol::{Pose, Tile};
use rand::{Rng, RngExt};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CatDef {
    pub id: String,
    pub name: String,
    pub coat: String,
    pub traits: Traits,
    pub rhythm: Rhythm,
    #[serde(default)]
    pub weights: Weights,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Traits {
    pub sociability: f32,
    pub boldness: f32,
    pub curiosity: f32,
    pub playfulness: f32,
    pub appetite: f32,
    pub energy: f32,
    pub affection: f32,
    pub alone_activity: f32,
    pub trust_rate: f32,
    pub temper: f32,
    pub grudge_hours: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rhythm {
    /// Canberra-time ranges, "HH:MM-HH:MM"; a range may wrap midnight.
    pub awake: Vec<String>,
    /// Twice the walking speed in the awake hours.
    #[serde(default)]
    pub zoomies: bool,
}

/// Multipliers on the shared behaviours, for a cat's particular leanings.
#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct Weights {
    pub idle: f32,
    pub wander: f32,
    pub nap: f32,
    pub approach: f32,
    pub hide: f32,
}

impl Default for Weights {
    fn default() -> Weights {
        Weights {
            idle: 1.0,
            wander: 1.0,
            nap: 1.0,
            approach: 1.0,
            hide: 1.0,
        }
    }
}

impl CatDef {
    pub fn validate(&self) -> anyhow::Result<()> {
        let t = &self.traits;
        for (name, v) in [
            ("sociability", t.sociability),
            ("boldness", t.boldness),
            ("curiosity", t.curiosity),
            ("playfulness", t.playfulness),
            ("appetite", t.appetite),
            ("energy", t.energy),
            ("affection", t.affection),
            ("trust_rate", t.trust_rate),
            ("temper", t.temper),
        ] {
            anyhow::ensure!((0.0..=1.0).contains(&v), "{}: {name} must be between 0 and 1", self.id);
        }
        anyhow::ensure!(
            t.alone_activity > 0.0 && t.alone_activity <= 3.0,
            "{}: alone_activity must be above 0 and at most 3",
            self.id
        );
        anyhow::ensure!(t.grudge_hours > 0.0, "{}: grudge_hours must be positive", self.id);
        anyhow::ensure!(!self.rhythm.awake.is_empty(), "{}: needs at least one awake range", self.id);
        for r in &self.rhythm.awake {
            anyhow::ensure!(
                parse_range(r).is_some(),
                "{}: can't read the awake range {r:?}; use HH:MM-HH:MM",
                self.id
            );
        }
        Ok(())
    }

    /// Whether `minute` (minutes since Canberra midnight) is in an awake range.
    pub fn awake_at(&self, minute: u32) -> bool {
        self.rhythm.awake.iter().filter_map(|r| parse_range(r)).any(|(from, to)| {
            if from <= to {
                minute >= from && minute < to
            } else {
                minute >= from || minute < to
            }
        })
    }

    /// Bubbles in the last minute that send this cat into hiding.
    pub fn hide_threshold(&self) -> f32 {
        3.0 + 8.0 * self.traits.boldness
    }

    pub fn speed_factor(&self, minute: u32) -> f32 {
        if self.rhythm.zoomies && self.awake_at(minute) { 2.0 } else { 1.0 }
    }
}

fn parse_range(s: &str) -> Option<(u32, u32)> {
    let (from, to) = s.split_once('-')?;
    Some((parse_hm(from)?, parse_hm(to)?))
}

fn parse_hm(s: &str) -> Option<u32> {
    let (h, m) = s.trim().split_once(':')?;
    let (h, m): (u32, u32) = (h.parse().ok()?, m.parse().ok()?);
    (h < 24 && m < 60).then_some(h * 60 + m)
}

/// What a cat keeps across restarts: where it is, and how tired and how
/// lonely it is. Everything else starts afresh.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Saved {
    pub at: Tile,
    pub tiredness: f32,
    pub company: f32,
}

/// The room as a cat deciding what to do sees it.
pub struct Situation<'a> {
    pub minute: u32,
    /// People inside, with this cat's trust in each.
    pub people: &'a [(u32, f32)],
    /// Bubbles in the last minute.
    pub noise: f32,
    pub tiredness: f32,
    pub company: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Choice {
    Idle,
    Wander,
    Nap,
    Approach(u32),
    Hide,
}

/// Every behaviour scores itself from character, needs, trust, noise and the hour.
pub fn options(def: &CatDef, s: &Situation) -> Vec<(Choice, f32)> {
    let (t, w) = (&def.traits, &def.weights);
    let alone = s.people.is_empty();
    let lively = if alone { t.alone_activity } else { 1.0 };
    let awake = def.awake_at(s.minute);
    let mut out = vec![
        (Choice::Idle, 0.2 * w.idle),
        (Choice::Wander, w.wander * (0.2 + 0.6 * t.energy) * (1.0 - s.tiredness) * lively),
        (Choice::Nap, w.nap * (1.5 * s.tiredness + if awake { 0.0 } else { 0.6 }) / lively),
    ];
    for &(id, trust) in s.people {
        out.push((
            Choice::Approach(id),
            w.approach * t.sociability * (0.4 + 0.6 * s.company) * (0.5 + trust / 100.0),
        ));
    }
    let threshold = def.hide_threshold();
    if s.noise >= threshold {
        out.push((Choice::Hide, w.hide * (1.0 - t.boldness) * (s.noise / threshold).min(2.0)));
    }
    out
}

/// One of the three best options, at random, weighted by score: in character
/// without being predictable.
pub fn pick(mut options: Vec<(Choice, f32)>, rng: &mut impl Rng) -> Choice {
    options.retain(|(_, s)| *s > 0.0);
    options.sort_by(|a, b| b.1.total_cmp(&a.1));
    options.truncate(3);
    let total: f32 = options.iter().map(|(_, s)| s).sum();
    if total <= 0.0 {
        return Choice::Idle;
    }
    let mut roll = rng.random::<f32>() * total;
    for (choice, score) in &options {
        if roll < *score {
            return *choice;
        }
        roll -= score;
    }
    options.last().map_or(Choice::Idle, |(c, _)| *c)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Welcome,
    Tolerate,
    Refuse,
}

/// The chance this cat welcomes a pet from someone it trusts this much
/// (0 to 100). Shy cats hold back from strangers.
pub fn welcome_chance(def: &CatDef, trust: f32) -> f32 {
    let (a, b, t) = (def.traits.affection, def.traits.boldness, trust / 100.0);
    let shy = if t < 0.2 { 0.2 * (1.0 - b) } else { 0.0 };
    (0.05 + 0.45 * a + 0.25 * b + 0.25 * t - shy).clamp(0.05, 0.95)
}

/// How a cat answers a pet, given a roll in [0, 1). Asleep or hiding, it refuses.
pub fn pet_outcome(def: &CatDef, pose: Pose, trust: f32, roll: f32) -> Outcome {
    if matches!(pose, Pose::Nap | Pose::Hide) {
        return Outcome::Refuse;
    }
    let welcome = welcome_chance(def, trust);
    if roll < welcome {
        Outcome::Welcome
    } else if roll < welcome + 0.2 {
        Outcome::Tolerate
    } else {
        Outcome::Refuse
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;

    fn cat(id: &str) -> CatDef {
        crate::content::repo_content().cats.into_iter().find(|c| c.id == id).expect("a cat")
    }

    fn score(options: &[(Choice, f32)], choice: Choice) -> f32 {
        options.iter().find(|(c, _)| *c == choice).map_or(0.0, |(_, s)| *s)
    }

    fn situation(people: &[(u32, f32)]) -> Situation<'_> {
        Situation {
            minute: 10 * 60,
            people,
            noise: 0.0,
            tiredness: 0.2,
            company: 0.5,
        }
    }

    #[test]
    fn the_three_cats_load_in_file_order() {
        let ids: Vec<String> = crate::content::repo_content().cats.into_iter().map(|c| c.id).collect();
        assert_eq!(ids, ["burakku", "mochi", "tora"]);
    }

    #[test]
    fn awake_hours_can_wrap_midnight() {
        let b = cat("burakku");
        assert!(b.awake_at(23 * 60) && b.awake_at(2 * 60));
        assert!(!b.awake_at(12 * 60));
    }

    #[test]
    fn mochi_naps_after_lunch_and_overnight() {
        let m = cat("mochi");
        assert!(m.awake_at(9 * 60) && m.awake_at(16 * 60));
        assert!(!m.awake_at(13 * 60) && !m.awake_at(23 * 60));
    }

    #[test]
    fn a_tired_cat_would_rather_nap_than_wander() {
        let mut s = situation(&[]);
        s.tiredness = 0.9;
        let o = options(&cat("mochi"), &s);
        assert!(score(&o, Choice::Nap) > score(&o, Choice::Wander));
    }

    #[test]
    fn noise_sends_shy_burakku_to_hide_but_not_bold_tora() {
        let mut s = situation(&[(1, 0.0)]);
        s.noise = 5.0;
        assert!(score(&options(&cat("burakku"), &s), Choice::Hide) > 0.0);
        assert_eq!(score(&options(&cat("tora"), &s), Choice::Hide), 0.0);
    }

    #[test]
    fn burakku_is_livelier_and_mochi_sleepier_when_the_cafe_is_empty() {
        let (alone, company) = (situation(&[]), situation(&[(1, 0.0)]));
        let b = cat("burakku");
        assert!(score(&options(&b, &alone), Choice::Wander) > score(&options(&b, &company), Choice::Wander));
        let m = cat("mochi");
        assert!(score(&options(&m, &alone), Choice::Nap) > score(&options(&m, &company), Choice::Nap));
    }

    #[test]
    fn trust_draws_a_cat_to_someone() {
        let o = options(&cat("mochi"), &situation(&[(1, 0.0), (2, 80.0)]));
        assert!(score(&o, Choice::Approach(2)) > score(&o, Choice::Approach(1)));
        assert_eq!(score(&options(&cat("mochi"), &situation(&[])), Choice::Approach(1)), 0.0);
    }

    #[test]
    fn welcome_chances_follow_character_and_trust() {
        let (m, b, t) = (cat("mochi"), cat("burakku"), cat("tora"));
        assert!(welcome_chance(&m, 0.0) > welcome_chance(&t, 0.0));
        assert!(welcome_chance(&t, 0.0) > welcome_chance(&b, 0.0));
        assert!(welcome_chance(&b, 80.0) > welcome_chance(&b, 0.0) + 0.3);
    }

    #[test]
    fn asleep_or_hiding_a_cat_refuses() {
        let m = cat("mochi");
        assert_eq!(pet_outcome(&m, Pose::Nap, 100.0, 0.0), Outcome::Refuse);
        assert_eq!(pet_outcome(&m, Pose::Hide, 100.0, 0.0), Outcome::Refuse);
        assert_eq!(pet_outcome(&m, Pose::Idle, 100.0, 0.0), Outcome::Welcome);
    }

    #[test]
    fn pick_chooses_only_among_the_best_three() {
        let mut rng = rand_chacha::ChaCha8Rng::seed_from_u64(1);
        let o = vec![
            (Choice::Idle, 1.0),
            (Choice::Wander, 0.9),
            (Choice::Nap, 0.8),
            (Choice::Hide, 0.01),
            (Choice::Approach(1), 0.02),
        ];
        for _ in 0..500 {
            let c = pick(o.clone(), &mut rng);
            assert!(matches!(c, Choice::Idle | Choice::Wander | Choice::Nap), "{c:?}");
        }
    }

    #[test]
    fn a_bad_awake_range_fails_validation() {
        let mut m = cat("mochi");
        m.rhythm.awake = vec!["25:00-26:00".into()];
        assert!(m.validate().is_err());
    }

    #[test]
    fn tora_has_zoomies_only_in_her_waking_hours() {
        let t = cat("tora");
        assert_eq!(t.speed_factor(5 * 60), 2.0);
        assert_eq!(t.speed_factor(13 * 60), 1.0);
        assert_eq!(cat("mochi").speed_factor(9 * 60), 1.0);
    }
}
