//! A demo account moves the café's clock on (slice 17, ADR 0022): the café
//! lives the hours between by the replay a sleep uses, and the clock never
//! goes back.
use super::{Out, World};

impl World {
    pub(super) fn ask_jump(&mut self, now: u64, id: u32, minute: Option<u32>, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(id, out) {
            return;
        }
        let _ = (now, minute);
    }

    /// When, by the café's clock, it can move on again.
    pub(super) fn next_jump_at(&self) -> u64 {
        0
    }
}
