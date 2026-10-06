//! Each cat's trust in each person (design.md, "The cats"): it grows with
//! welcome interactions, tapers within a Canberra day so regular visits beat
//! one long session, dips when someone pushes, and never fades with absence
//! (AGENTS.md): only what a person does to a cat changes its trust in them.
use crate::protocol::{TrustLevel, TrustView};
use crate::store::TrustRow;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct TrustRecord {
    pub value: f32,
    pub day: String,
    pub gained_today: f32,
}

#[derive(Debug, Clone)]
pub struct TrustBook {
    records: HashMap<(String, u32), TrustRecord>,
    levels: [f32; 3],
    daily_cap: f32,
}

impl TrustBook {
    pub fn new(levels: [f32; 3], daily_cap: f32) -> TrustBook {
        TrustBook { records: HashMap::new(), levels, daily_cap }
    }

    pub fn load(&mut self, rows: Vec<TrustRow>) {
        for r in rows {
            self.records.insert((r.cat_id, r.user_id as u32), TrustRecord { value: r.value, day: r.day, gained_today: r.gained_today });
        }
    }

    pub fn value(&self, cat: &str, person: u32) -> f32 {
        self.records.get(&(cat.to_string(), person)).map_or(0.0, |r| r.value)
    }

    pub fn has_met(&self, cat: &str, person: u32) -> bool {
        self.records.contains_key(&(cat.to_string(), person))
    }

    /// A gain (positive, tapered by what this person already gained with this
    /// cat today, up to the cat's daily allowance) or a dip (negative,
    /// untapered). Returns the record when the value changed.
    pub fn apply(&mut self, cat: &str, trust_rate: f32, person: u32, delta: f32, today: &str) -> Option<TrustRecord> {
        if delta == 0.0 {
            return None;
        }
        let cap = self.daily_cap * trust_rate;
        let rec = self
            .records
            .entry((cat.to_string(), person))
            .or_insert_with(|| TrustRecord { value: 0.0, day: today.to_string(), gained_today: 0.0 });
        if rec.day != today {
            rec.day = today.to_string();
            rec.gained_today = 0.0;
        }
        let change = if delta > 0.0 {
            let left = (cap - rec.gained_today).max(0.0);
            let taper = if cap > 0.0 { left / cap } else { 0.0 };
            (delta * taper).min(left)
        } else {
            delta
        };
        let before = rec.value;
        rec.value = (rec.value + change).clamp(0.0, 100.0);
        if delta > 0.0 {
            rec.gained_today += rec.value - before;
        }
        (rec.value != before).then(|| rec.clone())
    }

    pub fn level(&self, value: f32) -> TrustLevel {
        if value >= self.levels[2] {
            TrustLevel::Devoted
        } else if value >= self.levels[1] {
            TrustLevel::Friend
        } else if value >= self.levels[0] {
            TrustLevel::Familiar
        } else {
            TrustLevel::Stranger
        }
    }

    pub fn view(&self, cat: &str, person: u32) -> TrustView {
        let value = self.value(cat, person);
        TrustView { cat: cat.to_string(), value: (value * 10.0).round() / 10.0, level: self.level(value) }
    }

    pub fn row(cat: &str, person: u32, rec: &TrustRecord) -> TrustRow {
        TrustRow { cat_id: cat.to_string(), user_id: person as i64, value: rec.value, day: rec.day.clone(), gained_today: rec.gained_today }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn book() -> TrustBook {
        TrustBook::new([20.0, 50.0, 80.0], 10.0)
    }

    #[test]
    fn gains_taper_within_a_day_and_stop_at_the_cap() {
        let mut b = book();
        let mut gains = Vec::new();
        for _ in 0..20 {
            let before = b.value("mochi", 1);
            b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
            gains.push(b.value("mochi", 1) - before);
        }
        assert!(gains.windows(2).all(|w| w[1] <= w[0]), "each gain is no bigger than the last: {gains:?}");
        assert!(b.value("mochi", 1) <= 10.0 + 1e-4);
        assert!(b.value("mochi", 1) > 5.0);
    }

    #[test]
    fn a_slow_cat_has_a_smaller_daily_allowance() {
        let mut b = book();
        for _ in 0..50 {
            b.apply("burakku", 0.3, 1, 0.6, "2026-10-07");
        }
        assert!(b.value("burakku", 1) <= 3.0 + 1e-4);
    }

    #[test]
    fn a_new_day_brings_a_new_allowance_and_keeps_the_trust() {
        let mut b = book();
        for _ in 0..30 {
            b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
        }
        let yesterday = b.value("mochi", 1);
        b.apply("mochi", 1.0, 1, 2.0, "2026-10-08");
        assert!(b.value("mochi", 1) > yesterday);
    }

    #[test]
    fn dips_are_untapered_and_stop_at_zero() {
        let mut b = book();
        b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
        b.apply("mochi", 1.0, 1, -1.0, "2026-10-07");
        assert!((b.value("mochi", 1) - 1.0).abs() < 1e-4);
        b.apply("mochi", 1.0, 1, -5.0, "2026-10-07");
        assert_eq!(b.value("mochi", 1), 0.0);
    }

    #[test]
    fn absence_never_costs_trust() {
        let mut b = book();
        b.apply("mochi", 1.0, 1, 2.0, "2026-10-07");
        let before = b.value("mochi", 1);
        assert_eq!(b.apply("mochi", 1.0, 1, 0.0, "2027-10-07"), None);
        assert_eq!(b.value("mochi", 1), before);
    }

    #[test]
    fn levels_follow_the_thresholds() {
        let b = book();
        assert_eq!(b.level(19.9), TrustLevel::Stranger);
        assert_eq!(b.level(20.0), TrustLevel::Familiar);
        assert_eq!(b.level(50.0), TrustLevel::Friend);
        assert_eq!(b.level(80.0), TrustLevel::Devoted);
    }

    #[test]
    fn a_cat_has_met_someone_once_it_has_a_record_of_them() {
        let mut b = book();
        assert!(!b.has_met("tora", 7));
        b.apply("tora", 0.6, 7, 0.6, "2026-10-07");
        assert!(b.has_met("tora", 7));
        assert!(!b.has_met("mochi", 7));
    }

    #[test]
    fn records_round_trip_through_store_rows() {
        let mut b = book();
        let rec = b.apply("mochi", 1.0, 3, 2.0, "2026-10-07").unwrap();
        let row = TrustBook::row("mochi", 3, &rec);
        let mut again = book();
        again.load(vec![row]);
        assert_eq!(again.value("mochi", 3), b.value("mochi", 3));
        assert_eq!(again.view("mochi", 3).value, 2.0);
    }
}
