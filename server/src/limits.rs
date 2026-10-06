//! Token buckets: a burst, then a steady refill. Kept in memory only: the
//! per-address buckets are never written down or logged (AGENTS.md).
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Bucket {
    tokens: f64,
    burst: f64,
    refill_per_sec: f64,
    last: u64,
}

impl Bucket {
    pub fn new(burst: f64, refill_per_sec: f64, now: u64) -> Bucket {
        Bucket {
            tokens: burst,
            burst,
            refill_per_sec,
            last: now,
        }
    }

    pub fn take(&mut self, now: u64) -> bool {
        let elapsed = now.saturating_sub(self.last) as f64;
        self.tokens = (self.tokens + elapsed * self.refill_per_sec / 1000.0).min(self.burst);
        self.last = now;
        if self.tokens >= 1.0 - 1e-9 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Buckets by key: a lower-cased name or an address.
pub struct Keyed {
    burst: f64,
    refill_per_sec: f64,
    buckets: HashMap<String, Bucket>,
}

impl Keyed {
    pub fn new(burst: f64, refill_per_sec: f64) -> Keyed {
        Keyed {
            burst,
            refill_per_sec,
            buckets: HashMap::new(),
        }
    }

    pub fn take(&mut self, key: &str, now: u64) -> bool {
        if self.buckets.len() > 10_000 {
            // Forget keys idle for ten minutes; a full bucket is the same as none.
            self.buckets.retain(|_, b| now.saturating_sub(b.last) < 600_000);
        }
        let (burst, refill) = (self.burst, self.refill_per_sec);
        self.buckets
            .entry(key.to_string())
            .or_insert_with(|| Bucket::new(burst, refill, now))
            .take(now)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bucket_allows_its_burst_then_refills() {
        let mut b = Bucket::new(5.0, 0.5, 0); // five at once, then one every two seconds
        for _ in 0..5 {
            assert!(b.take(0));
        }
        assert!(!b.take(0));
        assert!(!b.take(1_000));
        assert!(b.take(2_000));
        assert!(!b.take(2_000));
    }

    #[test]
    fn a_bucket_never_holds_more_than_its_burst() {
        let mut b = Bucket::new(3.0, 1.0, 0);
        for _ in 0..3 {
            assert!(b.take(1_000_000));
        }
        assert!(!b.take(1_000_000));
    }

    #[test]
    fn keyed_buckets_are_separate() {
        let mut k = Keyed::new(1.0, 0.001);
        assert!(k.take("a", 0));
        assert!(!k.take("a", 0));
        assert!(k.take("b", 0));
    }
}
