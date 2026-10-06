//! Moving furniture (design.md, "People": rearranging), cut down for now to
//! movable pieces people can walk over, put down at once wherever the room
//! allows. The arrangement is saved as it changes and restored on start.
use super::{Out, To, World, error};
use crate::protocol::{ErrorCode, ServerMsg, Tile};
use crate::room::Placed;

impl World {
    pub(super) fn move_furniture(&mut self, id: u32, piece: u32, to: Tile, out: &mut Vec<Out>) {
        if !self.inside_or_refuse(id, out) {
            return;
        }
        if let Err(why) = self.room.place(piece, to) {
            return error(out, id, ErrorCode::CantPlace, why);
        }
        let who = self.person(id).map(|p| p.name.clone()).unwrap_or_default();
        let kind = self
            .room
            .pieces
            .iter()
            .find(|p| p.id == piece)
            .map(|p| p.kind.clone())
            .unwrap_or_default();
        tracing::info!(target: "action", uid = id, who = %who, what = "move", piece = %kind, x = to.x, y = to.y);
        self.save_arrangement();
        out.push(Out {
            to: To::All,
            msg: ServerMsg::FurnitureMoved { id: piece, at: to, by: id },
        });
    }

    /// Where the movable furniture stands, as JSON for the store.
    pub fn arrangement_json(&self) -> String {
        serde_json::to_string(&self.room.arrangement()).expect("an arrangement serialises")
    }

    /// Puts back a saved arrangement; anything unreadable or stale is ignored.
    pub fn restore_arrangement(&mut self, json: &str) {
        if let Ok(saved) = serde_json::from_str::<Vec<Placed>>(json) {
            self.room.restore(&saved);
        }
    }

    fn save_arrangement(&self) {
        let Some(store) = &self.store else { return };
        let json = self.arrangement_json();
        store.fire(move |conn| crate::store::put_world(conn, "furniture", &json));
    }
}

#[cfg(test)]
mod tests {
    use super::super::people::tests::{join, world};
    use super::super::*;
    use crate::protocol::{ClientMsg, ErrorCode, ServerMsg, Tile};

    fn cushion(w: &World) -> u32 {
        w.room.pieces.iter().find(|p| p.kind == "cushion").expect("a cushion").id
    }

    fn move_it(w: &mut World, who: u32, piece: u32, x: u8, y: u8) -> Vec<Out> {
        w.handle(
            2_000,
            Input::Msg {
                id: who,
                msg: ClientMsg::MoveFurniture {
                    id: piece,
                    to: Tile { x, y },
                },
            },
        )
    }

    fn moves(outs: &[Out]) -> Vec<(To, u32, Tile, u32)> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::FurnitureMoved { id, at, by } => Some((o.to, *id, *at, *by)),
                _ => None,
            })
            .collect()
    }

    fn errors(outs: &[Out]) -> Vec<(To, ErrorCode)> {
        outs.iter()
            .filter_map(|o| match &o.msg {
                ServerMsg::Error { code, .. } => Some((o.to, *code)),
                _ => None,
            })
            .collect()
    }

    fn cushion_in_snapshot(w: &World, for_id: u32) -> (u8, u8) {
        let id = cushion(w);
        let f = w
            .snapshot_for(for_id, 2_000)
            .room
            .furniture
            .into_iter()
            .find(|f| f.id == id)
            .unwrap();
        (f.x, f.y)
    }

    #[test]
    fn moving_the_cushion_shows_everyone_where_and_who() {
        let mut w = world();
        join(&mut w, 1, 0);
        join(&mut w, 2, 0);
        let id = cushion(&w);
        let outs = move_it(&mut w, 1, id, 3, 8);
        assert_eq!(moves(&outs), vec![(To::All, id, Tile { x: 3, y: 8 }, 1)]);
        assert_eq!(cushion_in_snapshot(&w, 2), (3, 8));
    }

    #[test]
    fn a_move_onto_the_walkway_is_refused_and_only_the_mover_hears() {
        let mut w = world();
        join(&mut w, 1, 0);
        let id = cushion(&w);
        let before = cushion_in_snapshot(&w, 1);
        let outs = move_it(&mut w, 1, id, 7, 2);
        assert!(moves(&outs).is_empty());
        assert_eq!(errors(&outs), vec![(To::One(1), ErrorCode::CantPlace)]);
        assert_eq!(cushion_in_snapshot(&w, 1), before);
    }

    #[test]
    fn someone_waiting_at_the_window_cant_move_furniture() {
        let mut w = world();
        for id in 1..=7 {
            join(&mut w, id, 0);
        }
        let id = cushion(&w);
        let outs = move_it(&mut w, 7, id, 3, 8);
        assert!(moves(&outs).is_empty());
        assert_eq!(errors(&outs), vec![(To::One(7), ErrorCode::NotFromWindow)]);
    }

    #[test]
    fn the_arrangement_comes_back_after_a_restart() {
        let mut w = world();
        join(&mut w, 1, 0);
        let id = cushion(&w);
        move_it(&mut w, 1, id, 3, 8);
        let saved = w.arrangement_json();
        let mut again = world();
        again.restore_arrangement(&saved);
        assert_eq!(cushion_in_snapshot(&again, 1), (3, 8));
        let mut garbled = world();
        garbled.restore_arrangement("not json");
        assert_eq!(cushion_in_snapshot(&garbled, 1), cushion_in_snapshot(&world(), 1));
    }
}
