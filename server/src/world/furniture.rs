//! Rearranging the café (design.md, "People"; plan-phase-2.md decisions 3 to
//! 8): grabbing a piece walks you over and lifts it, and everyone sees it in
//! your hands; putting it down walks you beside the spot. The world handles
//! one message at a time, so the first grab wins. Also sitting, which shares
//! the walk-then-act shape.
use super::{Out, Pending, To, World, error, walk_tile};
use crate::protocol::{ErrorCode, HeldView, ServerMsg, Tile};
use crate::room::{Piece, Placed, Saved, Walker, chebyshev};
use std::collections::HashMap;

/// A piece in someone's hands, and where it came from (none if it's new).
#[derive(Debug, Clone)]
pub(super) struct Held {
    pub by: u32,
    pub piece: Piece,
    pub from: Option<Tile>,
}

/// Furniture someone is walking over to pick up: the first grab wins.
pub(super) type Reserved = HashMap<u32, u32>;

/// Whether `at` is next to the piece and not on it.
fn beside(piece: &Piece, at: Tile) -> bool {
    !piece.covers(at) && piece.tiles().into_iter().any(|t| chebyshev(t, at) <= 1)
}

impl World {
    fn holding(&self, id: u32) -> Option<usize> {
        self.held.iter().position(|h| h.by == id)
    }

    fn name_of(&self, id: u32) -> String {
        self.person(id).map(|p| p.name.clone()).unwrap_or_else(|| "Someone".into())
    }

    /// Tiles people stand on or are heading to.
    /// Tiles people stand on, and every tile left on their way.
    fn occupied(&self, now: u64) -> Vec<Tile> {
        self.people
            .iter()
            .filter(|p| p.place == crate::protocol::Place::Inside)
            .flat_map(|p| match &p.walk {
                Some(w) => {
                    let here = walk_tile(w, now);
                    let from = w.path.iter().position(|&t| t == here).unwrap_or(0);
                    w.path[from..].to_vec()
                }
                None => vec![p.at],
            })
            .collect()
    }

    /// Calls off a grab or a sit on the way, so a new request starts clean
    /// and the piece is free for the next person to reach for.
    fn call_off(&mut self, id: u32) {
        self.reserved.retain(|_, by| *by != id);
        if let Some(p) = self.people.iter_mut().find(|p| p.id == id)
            && matches!(p.pending, Some(Pending::Grab(_) | Pending::Sit(_)))
        {
            p.pending = None;
        }
    }

    /// Gets someone up off their seat where they are, for everyone to see.
    fn stand_up(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        if self.person(id).is_some_and(|p| p.sitting.is_some())
            && let Some(here) = self.person_tile(id, now)
        {
            self.start_walk(now, id, here, vec![here], None, out);
        }
    }

    /// Whether `id` may make a furniture change now; spends nothing.
    fn furniture_ready(&self, id: u32, now: u64, out: &mut Vec<Out>) -> bool {
        let ready = self.person(id).is_some_and(|p| p.furniture.ready(now));
        if !ready {
            error(out, id, ErrorCode::RateLimited, "Slow down a little.");
        }
        ready
    }

    fn spend_furniture(&mut self, id: u32, now: u64) {
        if let Some(p) = self.people.iter_mut().find(|p| p.id == id) {
            p.furniture.take(now);
        }
    }

    /// Walks `id` to the nearest tile beside `piece` and does `then`, or does
    /// it at once if they're already there. False if there's no way there.
    fn go_beside(&mut self, now: u64, id: u32, piece: &Piece, then: Pending, out: &mut Vec<Out>) -> bool {
        let Some(here) = self.person_tile(id, now) else { return false };
        // Someone seated gets up first: the walk, even of no steps, stands them up.
        let busy = self.person(id).is_some_and(|p| p.walk.is_some() || p.sitting.is_some());
        if !busy && beside(piece, here) {
            self.arrived_with(now, id, then, out);
            return true;
        }
        let target = self.room.nearest(here, Walker::Person, |t| beside(piece, t));
        target.is_some_and(|t| self.approach(now, id, t, then, out))
    }

    pub(super) fn grab(&mut self, now: u64, id: u32, piece_id: u32, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        if self.holding(id).is_some() {
            return error(out, id, ErrorCode::CantPlace, "Put down what you're carrying first.");
        }
        if let Some(h) = self.held.iter().find(|h| h.piece.id == piece_id) {
            return error(out, id, ErrorCode::Taken, &format!("{} has it.", self.name_of(h.by)));
        }
        if let Some(&by) = self.reserved.get(&piece_id)
            && by != id
        {
            return error(out, id, ErrorCode::Taken, &format!("{} is getting it.", self.name_of(by)));
        }
        let Some(piece) = self.room.pieces.iter().find(|p| p.id == piece_id).cloned() else {
            return error(out, id, ErrorCode::CantPlace, "That isn't here any more.");
        };
        if let Err(why) = self.can_lift(&piece) {
            return error(out, id, ErrorCode::CantPlace, why);
        }
        self.reserved.insert(piece_id, id);
        if !self.go_beside(now, id, &piece, Pending::Grab(piece_id), out) {
            self.reserved.remove(&piece_id);
            error(out, id, ErrorCode::BadTile, "You can't get to that from here.");
        }
    }

    fn can_lift(&self, piece: &Piece) -> Result<(), &'static str> {
        if !piece.spec.movable {
            return Err("That doesn't move.");
        }
        if self.people.iter().any(|p| p.sitting == Some(piece.id)) {
            return Err("Someone's sitting on it.");
        }
        if self.room.has_something_on(piece.id) {
            return Err("Clear what's on it first.");
        }
        Ok(())
    }

    /// The grab's walk ended: lift it, if it's still there to lift.
    pub(super) fn pick_up(&mut self, now: u64, id: u32, piece_id: u32, out: &mut Vec<Out>) {
        // Only on their own reservation: one called off is someone else's to win.
        if self.reserved.get(&piece_id) != Some(&id) {
            return;
        }
        self.reserved.remove(&piece_id);
        if self.holding(id).is_some() {
            return error(out, id, ErrorCode::CantPlace, "Put down what you're carrying first.");
        }
        let Some(piece) = self.room.pieces.iter().find(|p| p.id == piece_id).cloned() else {
            return error(out, id, ErrorCode::CantPlace, "That isn't here any more.");
        };
        if let Err(why) = self.can_lift(&piece) {
            return error(out, id, ErrorCode::CantPlace, why);
        }
        let piece = self.room.lift(piece_id).expect("found above");
        self.cats_jump_off(now, id, &piece.tiles(), out);
        tracing::info!(target: "action", uid = id, who = %self.name_of(id), what = "grab", piece = %piece.kind);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::FurnitureHeld {
                piece: piece.view(),
                by: id,
            },
        });
        self.held.push(Held {
            by: id,
            from: Some(Tile { x: piece.x, y: piece.y }),
            piece,
        });
    }

    pub(super) fn take(&mut self, now: u64, id: u32, kind: &str, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        if self.holding(id).is_some() {
            return error(out, id, ErrorCode::CantPlace, "Put down what you're carrying first.");
        }
        if !self.room.kinds.get(kind).is_some_and(|k| k.movable) {
            return error(out, id, ErrorCode::CantPlace, "The catalogue doesn't have that.");
        }
        if self.room.movable_count() + self.held.len() >= self.tuning.furniture_max {
            return error(out, id, ErrorCode::Full, "The café can't fit any more furniture.");
        }
        if !self.furniture_ready(id, now, out) {
            return;
        }
        // Hands full now: no grab or sit still on its way, and nobody carries seated.
        self.call_off(id);
        self.stand_up(now, id, out);
        let door = self.room.door;
        let piece = self.room.new_piece(kind, door).expect("checked above");
        self.spend_furniture(id, now);
        tracing::info!(target: "action", uid = id, who = %self.name_of(id), what = "take", piece = %kind);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::FurnitureHeld {
                piece: piece.view(),
                by: id,
            },
        });
        self.held.push(Held { by: id, piece, from: None });
    }

    pub(super) fn place(&mut self, now: u64, id: u32, to: Tile, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        let Some(i) = self.holding(id) else {
            return error(out, id, ErrorCode::NotHolding, "You aren't carrying anything.");
        };
        let mut piece = self.held[i].piece.clone();
        (piece.x, piece.y) = (to.x, to.y);
        if let Err(why) = self.room.check_place(&piece, &self.occupied(now)) {
            return error(out, id, ErrorCode::CantPlace, why);
        }
        if !self.furniture_ready(id, now, out) {
            return;
        }
        if !self.go_beside(now, id, &piece, Pending::Place(to), out) {
            error(out, id, ErrorCode::BadTile, "You can't get there.");
        }
    }

    /// The place's walk ended: put it down, if the spot is still free.
    pub(super) fn put_down(&mut self, now: u64, id: u32, to: Tile, out: &mut Vec<Out>) {
        let Some(i) = self.holding(id) else { return };
        let mut piece = self.held[i].piece.clone();
        (piece.x, piece.y) = (to.x, to.y);
        if let Err(why) = self.room.check_place(&piece, &self.occupied(now)) {
            return error(out, id, ErrorCode::CantPlace, why);
        }
        if !self.furniture_ready(id, now, out) {
            return;
        }
        self.spend_furniture(id, now);
        self.held.remove(i);
        tracing::info!(target: "action", uid = id, who = %self.name_of(id), what = "place", piece = %piece.kind, x = to.x, y = to.y);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::FurniturePlaced {
                piece: piece.view(),
                by: id,
            },
        });
        self.room.put(piece);
        self.save_arrangement();
    }

    /// Puts back what `id` carries: where it was if that still fits, else the
    /// nearest spot that does; a new piece just goes.
    pub(super) fn put_back(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        self.call_off(id);
        let Some(i) = self.holding(id) else { return };
        let Held { piece, from, .. } = self.held.remove(i);
        let Some(from) = from else {
            out.push(Out {
                to: To::All,
                msg: ServerMsg::FurnitureRemoved { id: piece.id, by: id },
            });
            return;
        };
        let occupied = self.occupied(now);
        let fits = |p: &Piece, at: Tile| {
            let mut p = p.clone();
            (p.x, p.y) = (at.x, at.y);
            self.room.check_place(&p, &occupied).is_ok().then_some(p)
        };
        let spot = fits(&piece, from).or_else(|| {
            let at = self.room.nearest(from, Walker::Cat, |t| fits(&piece, t).is_some())?;
            fits(&piece, at)
        });
        match spot {
            Some(p) => {
                tracing::info!(target: "action", uid = id, who = %self.name_of(id), what = "put_back", piece = %p.kind);
                out.push(Out {
                    to: To::All,
                    msg: ServerMsg::FurniturePlaced { piece: p.view(), by: id },
                });
                self.room.put(p);
            }
            None => out.push(Out {
                to: To::All,
                msg: ServerMsg::FurnitureRemoved { id: piece.id, by: id },
            }),
        }
        self.save_arrangement();
    }

    pub(super) fn put_away(&mut self, now: u64, id: u32, out: &mut Vec<Out>) {
        let Some(i) = self.holding(id) else {
            return error(out, id, ErrorCode::NotHolding, "You aren't carrying anything.");
        };
        if !self.furniture_ready(id, now, out) {
            return;
        }
        self.spend_furniture(id, now);
        let Held { piece, .. } = self.held.remove(i);
        tracing::info!(target: "action", uid = id, who = %self.name_of(id), what = "put_away", piece = %piece.kind);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::FurnitureRemoved { id: piece.id, by: id },
        });
        self.save_arrangement();
    }

    pub(super) fn sit(&mut self, now: u64, id: u32, piece_id: u32, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        if self.holding(id).is_some() {
            return error(out, id, ErrorCode::CantPlace, "Put down what you're carrying first.");
        }
        let Some(piece) = self.room.pieces.iter().find(|p| p.id == piece_id).cloned() else {
            return error(out, id, ErrorCode::CantPlace, "That isn't here any more.");
        };
        if !piece.spec.seats {
            return error(out, id, ErrorCode::CantPlace, "That isn't for sitting on.");
        }
        if let Some(&by) = self.reserved.get(&piece_id)
            && by != id
        {
            return error(out, id, ErrorCode::Taken, &format!("{} is moving it.", self.name_of(by)));
        }
        if self.free_seat(&piece, id, Tile { x: piece.x, y: piece.y }).is_none() {
            return error(out, id, ErrorCode::Taken, "There's no room to sit.");
        }
        if !self.go_beside(now, id, &piece, Pending::Sit(piece_id), out) {
            error(out, id, ErrorCode::BadTile, "You can't get to that from here.");
        }
    }

    /// The seat on `piece` nearest `near` that nobody but `id` sits on.
    fn free_seat(&self, piece: &Piece, id: u32, near: Tile) -> Option<Tile> {
        piece
            .tiles()
            .into_iter()
            .filter(|&t| !self.people.iter().any(|p| p.id != id && p.sitting.is_some() && p.at == t))
            .min_by_key(|&t| chebyshev(t, near))
    }

    /// The sit's walk ended: take the nearest free seat, if there still is one.
    pub(super) fn sit_down(&mut self, now: u64, id: u32, piece_id: u32, out: &mut Vec<Out>) {
        let Some(piece) = self.room.pieces.iter().find(|p| p.id == piece_id).cloned() else {
            return error(out, id, ErrorCode::CantPlace, "That isn't here any more.");
        };
        let here = self.person_tile(id, now).unwrap_or(self.room.entry);
        let Some(seat) = self.free_seat(&piece, id, here) else {
            return error(out, id, ErrorCode::Taken, "There's no room to sit.");
        };
        let Some(p) = self.people.iter_mut().find(|p| p.id == id) else {
            return;
        };
        p.at = seat;
        p.walk = None;
        p.sitting = Some(piece_id);
        tracing::info!(target: "action", uid = id, who = %p.name, what = "sit", piece = %piece.kind);
        out.push(Out {
            to: To::All,
            msg: ServerMsg::PersonSat { id, at: seat },
        });
    }

    pub(super) fn held_views(&self) -> Vec<HeldView> {
        self.held
            .iter()
            .map(|h| HeldView {
                by: h.by,
                piece: h.piece.view(),
            })
            .collect()
    }

    /// Where the movable furniture stands, by kind, as JSON for the store; a
    /// piece in someone's hands counts where it came from.
    pub fn arrangement_json(&self) -> String {
        let mut saved = self.room.arrangement();
        saved.extend(self.held.iter().filter_map(|h| {
            h.from.map(|at| Saved {
                kind: h.piece.kind.clone(),
                x: at.x,
                y: at.y,
            })
        }));
        serde_json::to_string(&saved).expect("an arrangement serialises")
    }

    /// Puts back a saved arrangement; anything unreadable is ignored.
    pub fn restore_arrangement(&mut self, json: &str) {
        if let Ok(saved) = serde_json::from_str::<Vec<Saved>>(json) {
            self.room.restore(&saved);
        }
    }

    /// Phase 1's cushion-only save, keyed by list position.
    pub fn restore_legacy_arrangement(&mut self, json: &str) {
        if let Ok(saved) = serde_json::from_str::<Vec<Placed>>(json) {
            self.room.restore_legacy(&saved);
        }
    }

    fn save_arrangement(&self) {
        let Some(store) = &self.store else { return };
        let json = self.arrangement_json();
        store.fire(move |conn| crate::store::put_world(conn, "arrangement", &json));
    }
}
