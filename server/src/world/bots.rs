//! Bots (slice 17): visitors the server runs for a demo account, which take
//! seats and join the line, and never talk, sit or touch anything.
use super::{Out, World};

impl World {
    pub(super) fn add_bot(&mut self, now: u64, by: u32, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(by, out) {
            return;
        }
        let _ = now;
    }

    pub(super) fn remove_bot(&mut self, now: u64, by: u32, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(by, out) {
            return;
        }
        let _ = now;
    }
}
