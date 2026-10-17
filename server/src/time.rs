//! The café's clock, and wall-clock helpers. The café keeps Canberra time,
//! which is the Australia/Sydney zone, daylight saving included.
//!
//! Every instant the server reads comes from `now_ms`. A test can start the
//! clock at a chosen instant (`CAFE_CLOCK_START`, slice 08, ADR 0016), and
//! from there it runs at the wall's speed; otherwise it is the wall clock.
use anyhow::Context;
use chrono::{DateTime, TimeZone, Timelike, Utc};
use chrono_tz::Australia::Sydney;
use chrono_tz::Tz;
use std::sync::OnceLock;

/// How far the café's clock is from the wall's, in ms: set once at start.
static OFFSET: OnceLock<i64> = OnceLock::new();

fn wall_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Milliseconds since the Unix epoch, by the café's clock.
pub fn now_ms() -> u64 {
    now_with(OFFSET.get().copied().unwrap_or(0), wall_ms())
}

/// Starts the café's clock at `at`; it runs on at the wall's speed. Once
/// only, before anything reads the time: a clock that moved mid-run would
/// break every timer the café keeps.
pub fn start_at(at: u64) {
    OFFSET.set(offset_for(at, wall_ms())).expect("the café's clock is started once");
}

/// An RFC 3339 instant with its offset (`2026-10-16T23:00:00+11:00`), as
/// ms since the epoch: the offset says which Canberra time is meant, across
/// daylight saving.
pub fn parse_start(text: &str) -> anyhow::Result<u64> {
    let at =
        DateTime::parse_from_rfc3339(text).with_context(|| format!("CAFE_CLOCK_START {text:?} isn't an RFC 3339 time with an offset"))?;
    u64::try_from(at.timestamp_millis()).context("CAFE_CLOCK_START is before 1970")
}

fn offset_for(start: u64, wall: u64) -> i64 {
    start as i64 - wall as i64
}

fn now_with(offset: i64, wall: u64) -> u64 {
    (wall as i64).saturating_add(offset).max(0) as u64
}

fn canberra(ms: u64) -> DateTime<Tz> {
    Utc.timestamp_millis_opt(ms as i64)
        .single()
        .unwrap_or_default()
        .with_timezone(&Sydney)
}

/// The Canberra calendar day of an instant, as `YYYY-MM-DD`.
pub fn canberra_day(ms: u64) -> String {
    canberra(ms).format("%Y-%m-%d").to_string()
}

/// The Canberra calendar day before the one an instant falls on, as
/// `YYYY-MM-DD`: by the calendar, so a day of 25 hours is still one day.
pub fn canberra_day_before(ms: u64) -> String {
    let day = canberra(ms).date_naive();
    day.pred_opt().unwrap_or(day).format("%Y-%m-%d").to_string()
}

/// Minutes since midnight, Canberra time.
pub fn canberra_minute_of_day(ms: u64) -> u32 {
    let t = canberra(ms);
    t.hour() * 60 + t.minute()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn utc(y: i32, mo: u32, d: u32, h: u32, mi: u32) -> u64 {
        chrono::Utc.with_ymd_and_hms(y, mo, d, h, mi, 0).unwrap().timestamp_millis() as u64
    }

    #[test]
    fn canberra_days_follow_daylight_saving() {
        // 13:48 UTC on 6 October is 00:48 on 7 October in Canberra (AEDT, UTC+11).
        assert_eq!(canberra_day(utc(2026, 10, 6, 13, 48)), "2026-10-07");
        assert_eq!(canberra_minute_of_day(utc(2026, 10, 6, 13, 48)), 48);
        // Midnight UTC on 1 July is 10:00 in Canberra (AEST, UTC+10).
        assert_eq!(canberra_minute_of_day(utc(2026, 7, 1, 0, 0)), 600);
    }

    #[test]
    fn now_is_after_the_project_began() {
        assert!(now_ms() > utc(2026, 10, 1, 0, 0));
    }

    #[test]
    fn a_start_is_an_instant_with_its_offset() {
        // 23:00 on 16 October in Canberra (AEDT, UTC+11) is 12:00 UTC.
        assert_eq!(parse_start("2026-10-16T23:00:00+11:00").unwrap(), utc(2026, 10, 16, 12, 0));
        assert_eq!(parse_start("2026-10-16T12:00:00Z").unwrap(), utc(2026, 10, 16, 12, 0));
        for bad in ["tomorrow", "2026-10-16T23:00:00", "2026-10-16", ""] {
            assert!(parse_start(bad).is_err(), "{bad:?} has no offset, or isn't a time");
        }
    }

    #[test]
    fn a_clock_started_elsewhere_runs_at_the_walls_speed() {
        let (start, wall) = (utc(2026, 10, 16, 12, 0), utc(2026, 10, 18, 3, 30));
        let offset = offset_for(start, wall);
        assert!(offset < 0, "a start in the past is behind the wall");
        assert_eq!(now_with(offset, wall), start);
        assert_eq!(now_with(offset, wall + 5_000), start + 5_000);
        let ahead = offset_for(wall + 9 * 86_400_000, wall);
        assert_eq!(now_with(ahead, wall + 1), wall + 9 * 86_400_000 + 1);
        assert_eq!(now_with(0, wall), wall, "no offset is the wall clock");
    }
}
