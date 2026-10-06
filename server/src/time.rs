//! Wall-clock helpers. The café keeps Canberra time, which is the
//! Australia/Sydney zone, daylight saving included.
use chrono::{DateTime, TimeZone, Timelike, Utc};
use chrono_tz::Australia::Sydney;
use chrono_tz::Tz;

/// Milliseconds since the Unix epoch.
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
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
}
