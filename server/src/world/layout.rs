//! A demo account lays out a furniture set (slice 17, part 2; ADR 0022):
//! one of the arrangements in `content/layouts/`, at once, for everyone,
//! without the rate limit. Each set passed every placement rule when the
//! café started (content.rs); here it replaces every movable piece.
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

    /// Lays out the set `set` for everyone. First what's carried goes and
    /// every errand on the way is called off (its walk planned round pieces
    /// about to move), walks end where they are, and everyone stands; a cat
    /// on a piece that moves jumps off. Then every movable piece is replaced
    /// by the set's, standing, toys gathered, and new to the cats; anyone
    /// left where a blocking piece now stands walks to the nearest free
    /// floor; and it's saved like any arrangement. It spends nobody's
    /// furniture allowance.
    pub(super) fn lay_out(&mut self, now: u64, id: u32, set: &str, out: &mut Vec<Out>) {
        if !self.demo_or_refuse(id, out) || !self.inside_or_refuse(id, out) {
            return;
        }
        let Some(layout) = self.layouts.iter().find(|l| l.id == set).cloned() else {
            return error(out, id, ErrorCode::CantPlace, "There's no such set.");
        };
        // Everyone's errands and hands, before anything moves.
        let ids: Vec<u32> = self.people.iter().map(|p| p.id).collect();
        for who in ids {
            self.settle_for_layout(now, who, out);
        }
        // The cats on what moves get off it.
        let old: Vec<Tile> = self.room.pieces.iter().filter(|p| p.spec.movable).flat_map(|p| p.tiles()).collect();
        self.room.restore(&layout.pieces);
        self.cats_jump_off(now, id, &old, out);
        // A fresh room: every piece new for the cats to look at.
        let fresh: Vec<(u32, Tile, u64)> = self
            .room
            .pieces
            .iter()
            .filter(|p| p.spec.movable)
            .map(|p| (p.id, Tile { x: p.x, y: p.y }, now))
            .collect();
        self.new_pieces = fresh;
        let who = self.name_of(id);
        tracing::info!(target: "action", uid = id, who = %who, what = "lay_out", outcome = "ok", set = %layout.name);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::LaidOut {
                by: id,
                name: layout.name.clone(),
                furniture: self.room.pieces.iter().map(|p| p.view()).collect(),
            },
        });
        self.step_off_new_pieces(now, out);
        self.save_arrangement();
    }

    /// One person, before a set lands: what they carry goes, a walk ends on
    /// the tile it's on, an errand is called off, and they stand.
    fn settle_for_layout(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        // Put back drops a carried piece (the set replaces it anyway) and
        // calls off a grab on the way.
        self.put_back(now, id, Some("laid_out"), out);
        self.reserved.retain(|_, by| *by != id);
        let Some(p) = self.people.iter_mut().find(|p| p.id == id) else {
            return;
        };
        p.pending = None;
        p.sitting = None;
        if let Some(walk) = p.walk.take() {
            p.at = walk_tile(&walk, now);
        }
    }

    /// Anyone inside now standing where a blocking piece stands walks to
    /// the nearest free floor.
    fn step_off_new_pieces(&mut self, now: u64, out: &mut Vec<Out>) {
        let stuck: Vec<(u32, Tile)> = self
            .people
            .iter()
            .filter(|p| p.place == Place::Inside && !self.room.walkable(p.at, Walker::Person))
            .map(|p| (p.id, p.at))
            .collect();
        for (id, at) in stuck {
            let taken: Vec<Tile> = self.people.iter().filter(|p| p.id != id).map(|p| p.at).collect();
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
            self.start_walk(now, id, set_off, path, None, out);
        }
    }
}
