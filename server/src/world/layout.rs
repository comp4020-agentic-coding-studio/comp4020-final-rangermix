//! A demo account lays out a furniture set (slice 17, part 2; ADR 0022):
//! one of the arrangements in `content/layouts/`, at once, for everyone,
//! without the furniture allowance. Each set passed every placement rule,
//! and landed whole when laid out, when the café started (content.rs).
use super::{Out, To, World, error, walk_tile};
use crate::protocol::{ErrorCode, LayoutName, Place, ServerMsg, Tile};
use crate::room::Walker;

impl World {
    /// The sets, as the demo bar offers them, for the welcome.
    pub(super) fn layout_names(&self) -> Vec<LayoutName> {
        self.layouts
            .iter()
            .map(|l| LayoutName {
                id: l.id.clone(),
                name: l.name.clone(),
            })
            .collect()
    }

    /// When, by the café's clock, a set can be laid out again: the demo
    /// password is public, and a set stops everyone's walks and errands, so
    /// the café lays out one at most every `layout_every_secs`, whoever asks
    /// (slice 17 part 2's review, finding 2).
    pub(super) fn next_layout_at(&self) -> u64 {
        self.last_layout.map_or(0, |at| at + self.tuning.layout_every_secs * 1000)
    }

    /// Lays out the set `set` for everyone. First what's carried goes and
    /// every errand on the way is called off (its walk planned round pieces
    /// about to move), walks end where they are, and everyone stands. Then
    /// each piece the set puts somewhere else is replaced, and a cat on one
    /// jumps off; a piece already where the set wants it stays, stood up.
    /// Every piece in the room is new for the cats to look at. Every page is
    /// told the room, then each person who stood or stopped, and anyone left
    /// where a blocking piece now stands walks to the nearest free floor.
    /// It's saved like any arrangement and spends nobody's furniture
    /// allowance.
    pub(super) fn lay_out(&mut self, now: u64, id: u32, set: &str, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(id, out) || !self.inside_or_refuse(id, out) {
            return;
        }
        let Some(layout) = self.layouts.iter().find(|l| l.id == set).cloned() else {
            return error(out, id, ErrorCode::CantPlace, "There's no such set.");
        };
        if now < self.next_layout_at() {
            let secs = self.next_layout_at().saturating_sub(now).div_ceil(1000).max(1);
            return error(
                out,
                id,
                ErrorCode::TooSoon,
                &format!("The furniture can be laid out again in {secs} s."),
            );
        }
        // Everyone's errands and hands, before anything moves.
        let ids: Vec<u32> = self.people.iter().map(|p| p.id).collect();
        let settled: Vec<u32> = ids.into_iter().filter(|&who| self.settle_for_layout(now, who, out)).collect();
        // The cats on what moves get off it.
        let gone = self.room.lay_out(&layout.pieces);
        self.cats_jump_off(now, id, &gone, out);
        // A fresh room: every piece new for the cats to look at.
        let fresh: Vec<(u32, Tile, u64)> = self
            .room
            .pieces
            .iter()
            .filter(|p| p.spec.movable)
            .map(|p| (p.id, Tile { x: p.x, y: p.y }, now))
            .collect();
        self.new_pieces = fresh;
        for c in &mut self.cats {
            c.investigated.clear();
        }
        self.last_layout = Some(now);
        let who = self.name_of(id);
        tracing::info!(target: "action", uid = id, who = %who, what = "lay_out", outcome = "ok", set = %layout.name);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::LaidOut {
                by: id,
                name: layout.name.clone(),
                furniture: self.room.pieces.iter().map(|p| p.view()).collect(),
                next: self.next_layout_at(),
            },
        });
        let stepped = self.step_off_new_pieces(now, out);
        // Whoever stood or stopped, and didn't step off, is told so: a walk
        // of no steps where they are (slice 17 part 2's review, finding 1).
        for who in settled.into_iter().filter(|w| !stepped.contains(w)) {
            if let Some(set_off) = self.person_set_off(who, now) {
                self.start_walk(now, who, set_off, vec![set_off.from], None, out);
            }
        }
        self.save_arrangement();
    }

    /// One person, before a set lands: what they carry goes, a walk ends on
    /// the tile it's on, an errand is called off, and they stand. True if
    /// they were walking or seated, so every page needs telling.
    fn settle_for_layout(&mut self, now: u64, id: u32, out: &mut Vec<Out>) -> bool {
        // Put back drops a carried piece (the set replaces it anyway) and
        // calls off a grab on the way.
        self.put_back(now, id, Some("laid_out"), out);
        self.reserved.retain(|_, by| *by != id);
        let Some(p) = self.people.iter_mut().find(|p| p.id == id) else {
            return false;
        };
        p.pending = None;
        let moved = p.sitting.take().is_some() | p.walk.is_some();
        if let Some(walk) = p.walk.take() {
            p.at = walk_tile(&walk, now);
        }
        moved && p.place == Place::Inside
    }

    /// Anyone inside now standing where a blocking piece stands walks to
    /// the nearest free floor no one else stands on or is heading to.
    /// Returns who stepped off.
    fn step_off_new_pieces(&mut self, now: u64, out: &mut Vec<Out>) -> Vec<u32> {
        let stuck: Vec<(u32, Tile)> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside && !self.room.walkable(p.at, Walker::Person))
            .map(|p| (p.id, p.at))
            .collect();
        let mut stepped = Vec::new();
        let mut heading: Vec<Tile> = Vec::new();
        for (id, at) in stuck {
            let taken: Vec<Tile> = self
                .people
                .iter()
                .filter(|p| p.id != id)
                .map(|p| p.at)
                .chain(heading.iter().copied())
                .collect();
            let free = self
                .room
                .nearest(at, Walker::Cat, |t| self.room.walkable(t, Walker::Person) && !taken.contains(&t));
            let Some(free) = free else { continue };
            let Some(set_off) = self.person_set_off(id, now) else {
                continue;
            };
            // Out from under the piece by a cat's path, since a person can't
            // route through what now stands there.
            let path = self.room.path(at, free, Walker::Cat).unwrap_or_else(|| vec![at, free]);
            heading.push(free);
            self.start_walk(now, id, set_off, path, None, out);
            stepped.push(id);
        }
        stepped
    }
}
