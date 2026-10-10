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
    #[serde(default)]
    pub hunger: f32,
    #[serde(default)]
    pub play: f32,
}

/// The room as a cat deciding what to do sees it.
#[derive(Default)]
pub struct Situation<'a> {
    pub minute: u32,
    /// People inside, with this cat's trust in each.
    pub people: &'a [(u32, f32)],
    /// Bubbles in the last minute.
    pub noise: f32,
    pub tiredness: f32,
    pub company: f32,
    pub hunger: f32,
    pub play: f32,
    /// A portion in the bowls, or a treat on the floor.
    pub food: bool,
    /// Toys to play with.
    pub toys: bool,
    /// Someone waiting at the window, and a window seat to watch them from.
    pub window: bool,
    /// A piece placed in the last two minutes.
    pub new_piece: bool,
    /// A plant, lamp or the toys standing, to knock over.
    pub knockable: bool,
    /// People sitting, with this cat's trust in each.
    pub laps: &'a [(u32, f32)],
    /// The trust a lap takes: the third trust level.
    pub lap_trust: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Choice {
    Idle,
    Wander,
    Nap,
    Approach(u32),
    Hide,
    Eat,
    Play,
    Groom,
    Perch,
    Investigate,
    Knock,
    Lap(u32),
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
    out.push((Choice::Groom, 0.15));
    if s.food {
        // A greedy cat is first to any food.
        out.push((Choice::Eat, 2.5 * s.hunger * (0.4 + t.appetite)));
    }
    if s.toys {
        out.push((Choice::Play, 1.6 * s.play * t.playfulness * lively.min(1.5)));
    }
    if s.window {
        out.push((Choice::Perch, 0.8 * t.curiosity));
    }
    if s.new_piece {
        // A curious, bold cat is first to new furniture.
        out.push((Choice::Investigate, 1.8 * t.curiosity * (0.5 + t.boldness)));
    }
    if s.knockable && alone {
        out.push((Choice::Knock, 0.35 * t.curiosity * t.alone_activity));
    }
    for &(id, trust) in s.laps {
        if trust >= s.lap_trust {
            out.push((Choice::Lap(id), 1.5 * t.affection * (0.4 + s.tiredness)));
        }
    }
    out
}

/// How hungry and how keen to play a cat gets over `hours`, by its appetite
/// and playfulness; a full cat is hungry again in three to six hours.
pub fn drift(def: &CatDef, hunger: f32, play: f32, hours: f32) -> (f32, f32) {
    let t = &def.traits;
    (
        (hunger + hours * (0.15 + 0.2 * t.appetite)).min(1.0),
        (play + hours * (0.1 + 0.4 * t.playfulness)).min(1.0),
    )
}

/// Ways of handling a cat; each answers by the same rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Handling {
    Pet,
    Play,
    Offer,
    PickUp,
}

impl Handling {
    /// Its name in the logs and in a ban.
    pub fn name(self) -> &'static str {
        match self {
            Handling::Pet => "pet",
            Handling::Play => "play",
            Handling::Offer => "offer",
            Handling::PickUp => "pick_up",
        }
    }

    /// What a banned person is told the cat won't do: "won't {this} for another…".
    pub fn refusal(self) -> &'static str {
        match self {
            Handling::Pet => "be petted by you",
            Handling::Play => "play with you",
            Handling::Offer => "take treats from you",
            Handling::PickUp => "be picked up by you",
        }
    }
}

/// The chance a cat welcomes this handling. `need` is its hunger for an
/// offered treat and its keenness to play for play.
pub fn handling_chance(def: &CatDef, how: Handling, trust: f32, need: f32) -> f32 {
    let t = &def.traits;
    let trusted = trust / 100.0;
    let chance = match how {
        Handling::Pet => return welcome_chance(def, trust),
        Handling::Play => 0.1 + 0.6 * t.playfulness * (0.4 + 0.6 * need) + 0.25 * trusted,
        Handling::Offer => 0.15 + 0.85 * need * (0.3 + t.appetite) + 0.2 * trusted,
        Handling::PickUp => welcome_chance(def, trust) * (0.4 + 0.6 * t.affection),
    };
    chance.clamp(0.05, 0.95)
}

/// Below this hunger a cat isn't hungry, and takes no treat from anyone's hand.
pub const PECKISH: f32 = 0.2;

/// How a cat answers being handled, given a roll in [0, 1). Asleep or hiding,
/// it refuses; an angry cat scratches where it would otherwise pull away. A
/// refused treat is only a refusal: there's no anger in not being hungry.
pub fn handling_outcome(def: &CatDef, how: Handling, pose: Pose, trust: f32, need: f32, angry: bool, roll: f32) -> Outcome {
    let refuse = if angry && how != Handling::Offer {
        Outcome::Scratch
    } else {
        Outcome::Refuse
    };
    if matches!(pose, Pose::Nap | Pose::Hide) || (how == Handling::Offer && need < PECKISH) {
        return refuse;
    }
    let welcome = handling_chance(def, how, trust, need);
    if roll < welcome {
        Outcome::Welcome
    } else if roll < welcome + 0.2 {
        Outcome::Tolerate
    } else {
        refuse
    }
}

/// How long a cat puts up with being held, in milliseconds: longer the more
/// it trusts and loves its holder, and half that if it only tolerated it.
pub fn hold_ms(def: &CatDef, trust: f32, tolerated: bool) -> u64 {
    let secs = 8.0 + 52.0 * (trust / 100.0) * def.traits.affection;
    let secs = if tolerated { secs / 2.0 } else { secs };
    (secs * 1000.0) as u64
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
    /// Refused with claws: an angry cat.
    Scratch,
}

/// The chance this cat welcomes a pet from someone it trusts this much
/// (0 to 100). Shy cats hold back from strangers.
pub fn welcome_chance(def: &CatDef, trust: f32) -> f32 {
    let (a, b, t) = (def.traits.affection, def.traits.boldness, trust / 100.0);
    let shy = if t < 0.2 { 0.2 * (1.0 - b) } else { 0.0 };
    (0.05 + 0.45 * a + 0.25 * b + 0.25 * t - shy).clamp(0.05, 0.95)
}

/// How a cat answers a pet, given a roll in [0, 1). Asleep or hiding, it refuses.
#[cfg(test)]
pub fn pet_outcome(def: &CatDef, pose: Pose, trust: f32, roll: f32) -> Outcome {
    handling_outcome(def, Handling::Pet, pose, trust, 0.0, false, roll)
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
            ..Default::default()
        }
    }

    fn best(options: &[(Choice, f32)]) -> Choice {
        options.iter().max_by(|a, b| a.1.total_cmp(&b.1)).unwrap().0
    }

    #[test]
    fn a_hungry_cat_goes_for_food_and_mochi_most_of_all() {
        let mut s = situation(&[(1, 0.0)]);
        s.food = true;
        s.hunger = 0.6;
        assert_eq!(best(&options(&cat("mochi"), &s)), Choice::Eat);
        assert!(score(&options(&cat("mochi"), &s), Choice::Eat) > score(&options(&cat("burakku"), &s), Choice::Eat));
        s.food = false;
        assert_eq!(score(&options(&cat("mochi"), &s), Choice::Eat), 0.0, "no food, no eating");
    }

    #[test]
    fn tora_is_first_to_new_furniture_and_to_the_toys() {
        let mut s = situation(&[(1, 0.0)]);
        s.new_piece = true;
        s.toys = true;
        s.play = 0.8;
        let (t, m, b) = (cat("tora"), cat("mochi"), cat("burakku"));
        assert!(score(&options(&t, &s), Choice::Investigate) > score(&options(&m, &s), Choice::Investigate));
        assert!(score(&options(&t, &s), Choice::Investigate) > score(&options(&b, &s), Choice::Investigate));
        assert!(score(&options(&t, &s), Choice::Play) > score(&options(&m, &s), Choice::Play));
        assert!(handling_chance(&t, Handling::Play, 0.0, 0.8) > handling_chance(&m, Handling::Play, 0.0, 0.8));
    }

    #[test]
    fn burakku_knocks_things_over_when_nobody_is_there() {
        let mut s = situation(&[]);
        s.knockable = true;
        let b = cat("burakku");
        assert!(score(&options(&b, &s), Choice::Knock) > score(&options(&cat("mochi"), &s), Choice::Knock));
        assert_eq!(
            score(&options(&b, &situation(&[(1, 0.0)])), Choice::Knock),
            0.0,
            "not with people about"
        );
    }

    #[test]
    fn a_cat_perches_to_watch_the_line() {
        let mut s = situation(&[(1, 0.0)]);
        assert_eq!(score(&options(&cat("tora"), &s), Choice::Perch), 0.0);
        s.window = true;
        assert!(score(&options(&cat("tora"), &s), Choice::Perch) > 0.0);
    }

    #[test]
    fn only_trust_of_eighty_earns_a_lap() {
        let mut s = situation(&[(1, 0.0), (2, 0.0)]);
        let laps = [(1, 79.0), (2, 85.0)];
        s.laps = &laps;
        s.lap_trust = 80.0;
        let o = options(&cat("mochi"), &s);
        assert_eq!(score(&o, Choice::Lap(1)), 0.0);
        assert!(score(&o, Choice::Lap(2)) > 0.0);
    }

    #[test]
    fn a_lap_takes_the_trust_the_tuning_says() {
        // Review finding 29: the third trust level, not a number of its own.
        let mut s = situation(&[(1, 0.0)]);
        let laps = [(1, 75.0)];
        s.laps = &laps;
        s.lap_trust = 70.0;
        assert!(score(&options(&cat("mochi"), &s), Choice::Lap(1)) > 0.0);
        s.lap_trust = 80.0;
        assert_eq!(score(&options(&cat("mochi"), &s), Choice::Lap(1)), 0.0);
    }

    #[test]
    fn hunger_and_play_grow_by_character() {
        let (m, b) = (cat("mochi"), cat("burakku"));
        let (mh, _) = drift(&m, 0.0, 0.0, 2.0);
        let (bh, _) = drift(&b, 0.0, 0.0, 2.0);
        assert!(mh > bh, "greedy Mochi gets hungry first");
        let (_, tp) = drift(&cat("tora"), 0.0, 0.0, 1.0);
        let (_, mp) = drift(&m, 0.0, 0.0, 1.0);
        assert!(tp > mp);
        assert_eq!(drift(&m, 0.9, 0.9, 100.0), (1.0, 1.0));
    }

    #[test]
    fn an_angry_cat_scratches_but_a_refused_treat_is_no_quarrel() {
        let m = cat("mochi");
        assert_eq!(
            handling_outcome(&m, Handling::Pet, Pose::Idle, 0.0, 0.0, true, 0.99),
            Outcome::Scratch
        );
        assert_eq!(
            handling_outcome(&m, Handling::Pet, Pose::Nap, 0.0, 0.0, true, 0.0),
            Outcome::Scratch
        );
        assert_eq!(
            handling_outcome(&m, Handling::Offer, Pose::Nap, 0.0, 1.0, true, 0.0),
            Outcome::Refuse
        );
        assert_eq!(
            handling_outcome(&m, Handling::Offer, Pose::Idle, 0.0, 1.0, false, 0.5),
            Outcome::Welcome
        );
    }

    #[test]
    fn a_cat_that_isnt_hungry_doesnt_take_a_treat_from_anyone() {
        // Review finding 22: not even from someone it adores, however the roll goes.
        let m = cat("mochi");
        for roll in [0.0, 0.2, 0.4, 0.6] {
            assert_eq!(
                handling_outcome(&m, Handling::Offer, Pose::Idle, 100.0, 0.0, false, roll),
                Outcome::Refuse
            );
        }
        assert_eq!(
            handling_outcome(&m, Handling::Offer, Pose::Idle, 0.0, 0.6, false, 0.0),
            Outcome::Welcome
        );
    }

    #[test]
    fn a_cat_puts_up_with_being_held_longer_by_someone_it_loves() {
        let (m, b) = (cat("mochi"), cat("burakku"));
        assert!(hold_ms(&m, 90.0, false) > hold_ms(&m, 10.0, false));
        assert!(hold_ms(&m, 50.0, true) < hold_ms(&m, 50.0, false));
        assert!(handling_chance(&b, Handling::PickUp, 0.0, 0.0) < handling_chance(&m, Handling::PickUp, 0.0, 0.0));
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
