//! The café floor (design.md, "The room"): ground tiles, furniture, who can
//! stand where, and shortest paths. People can't walk through furniture that
//! blocks; cats walk and jump over all of it; nobody walks through a wall.
use crate::protocol::{FurnitureView, RoomView, Tile};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ground {
    Floor,
    Wall,
    Window,
    Door,
    Board,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FurnitureKind {
    pub w: u8,
    pub h: u8,
    #[serde(default)]
    pub blocks: bool,
    #[serde(default)]
    pub nap: bool,
    #[serde(default)]
    pub hide: bool,
    // Read once cats perch at the window (phase 3).
    #[serde(default)]
    #[allow(dead_code)]
    pub perch: bool,
    /// People can pick it up and put it somewhere else.
    #[serde(default)]
    pub movable: bool,
}

#[derive(Debug, Deserialize)]
pub struct FurnitureFile {
    pub kinds: HashMap<String, FurnitureKind>,
}

#[derive(Debug, Deserialize)]
pub struct RoomFile {
    pub width: u8,
    pub height: u8,
    pub tiles: Vec<String>,
    pub entry: Tile,
    pub walkway: Vec<Tile>,
    #[serde(default)]
    pub furniture: Vec<PieceFile>,
}

#[derive(Debug, Deserialize)]
pub struct PieceFile {
    pub kind: String,
    pub x: u8,
    pub y: u8,
}

/// Where a movable piece stands, as saved between runs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Placed {
    pub id: u32,
    pub kind: String,
    pub x: u8,
    pub y: u8,
}

#[derive(Debug, Clone)]
pub struct Piece {
    pub id: u32,
    pub kind: String,
    pub x: u8,
    pub y: u8,
    pub spec: FurnitureKind,
}

impl Piece {
    pub fn covers(&self, t: Tile) -> bool {
        t.x >= self.x && t.x < self.x + self.spec.w && t.y >= self.y && t.y < self.y + self.spec.h
    }

    pub fn tiles(&self) -> Vec<Tile> {
        (self.y..self.y + self.spec.h)
            .flat_map(|y| (self.x..self.x + self.spec.w).map(move |x| Tile { x, y }))
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Walker {
    Person,
    Cat,
}

#[derive(Debug, Clone)]
pub struct Room {
    pub width: u8,
    pub height: u8,
    rows: Vec<String>,
    ground: Vec<Ground>,
    pub door: Tile,
    pub entry: Tile,
    pub walkway: Vec<Tile>,
    pub pieces: Vec<Piece>,
}

impl Room {
    pub fn build(file: &RoomFile, kinds: &HashMap<String, FurnitureKind>) -> anyhow::Result<Room> {
        anyhow::ensure!(
            file.tiles.len() == file.height as usize,
            "room.toml: {} rows of tiles for a height of {}",
            file.tiles.len(),
            file.height
        );
        let mut ground = Vec::with_capacity(file.width as usize * file.height as usize);
        let mut door = None;
        for (y, row) in file.tiles.iter().enumerate() {
            anyhow::ensure!(
                row.chars().count() == file.width as usize,
                "room.toml: row {y} isn't {} tiles wide",
                file.width
            );
            for (x, c) in row.chars().enumerate() {
                let g = match c {
                    '.' => Ground::Floor,
                    'W' => Ground::Wall,
                    'G' => Ground::Window,
                    'D' => Ground::Door,
                    'C' => Ground::Board,
                    other => anyhow::bail!("room.toml: unknown tile {other:?} at ({x}, {y})"),
                };
                if g == Ground::Door {
                    anyhow::ensure!(door.is_none(), "room.toml: more than one door");
                    door = Some(Tile { x: x as u8, y: y as u8 });
                }
                ground.push(g);
            }
        }
        let door = door.ok_or_else(|| anyhow::anyhow!("room.toml: no door"))?;
        let mut room = Room {
            width: file.width,
            height: file.height,
            rows: file.tiles.clone(),
            ground,
            door,
            entry: file.entry,
            walkway: file.walkway.clone(),
            pieces: Vec::new(),
        };
        anyhow::ensure!(
            room.ground(room.entry) == Ground::Floor && manhattan(room.entry, door) == 1,
            "room.toml: the entry must be the floor tile just inside the door"
        );
        for &w in &room.walkway {
            anyhow::ensure!(room.ground(w) == Ground::Floor, "room.toml: the walkway must be floor");
        }
        for (i, p) in file.furniture.iter().enumerate() {
            let spec = kinds
                .get(&p.kind)
                .ok_or_else(|| anyhow::anyhow!("room.toml: unknown furniture kind {:?}", p.kind))?
                .clone();
            // Moving a piece that blocks needs checks this cut doesn't have yet:
            // that it cuts nobody off, and that nobody is standing there.
            anyhow::ensure!(
                !(spec.movable && spec.blocks),
                "furniture.toml: {} is movable and blocks; for now only pieces people can walk over move",
                p.kind
            );
            let piece = Piece {
                id: i as u32 + 1,
                kind: p.kind.clone(),
                x: p.x,
                y: p.y,
                spec,
            };
            for t in piece.tiles() {
                anyhow::ensure!(
                    room.in_bounds(t) && room.ground(t) == Ground::Floor,
                    "room.toml: the {} at ({}, {}) leaves the floor",
                    p.kind,
                    p.x,
                    p.y
                );
                anyhow::ensure!(
                    room.piece_at(t).is_none(),
                    "room.toml: the {} at ({}, {}) overlaps another piece",
                    p.kind,
                    p.x,
                    p.y
                );
                anyhow::ensure!(
                    !room.walkway.contains(&t),
                    "room.toml: the {} at ({}, {}) blocks the door's walkway",
                    p.kind,
                    p.x,
                    p.y
                );
            }
            room.pieces.push(piece);
        }
        Ok(room)
    }

    /// Moves a movable piece so its top-left is at `to`, or says why not. The
    /// floor only: never over another piece, and never on the door's walkway
    /// (AGENTS.md).
    pub fn place(&mut self, id: u32, to: Tile) -> Result<(), &'static str> {
        let i = self.pieces.iter().position(|p| p.id == id).ok_or("That isn't here any more.")?;
        let spec = &self.pieces[i].spec;
        if !spec.movable {
            return Err("That doesn't move.");
        }
        if to.x as u16 + spec.w as u16 > self.width as u16 || to.y as u16 + spec.h as u16 > self.height as u16 {
            return Err("That's not on the floor.");
        }
        let mut moved = self.pieces[i].clone();
        (moved.x, moved.y) = (to.x, to.y);
        for t in moved.tiles() {
            if self.ground(t) != Ground::Floor {
                return Err("That's not on the floor.");
            }
            if self.walkway.contains(&t) {
                return Err("The way in from the door stays clear.");
            }
            if self.pieces.iter().any(|p| p.id != id && p.covers(t)) {
                return Err("Something's already there.");
            }
        }
        self.pieces[i] = moved;
        Ok(())
    }

    /// Where each movable piece stands, for saving.
    pub fn arrangement(&self) -> Vec<Placed> {
        self.pieces
            .iter()
            .filter(|p| p.spec.movable)
            .map(|p| Placed {
                id: p.id,
                kind: p.kind.clone(),
                x: p.x,
                y: p.y,
            })
            .collect()
    }

    /// Puts back a saved arrangement, skipping any piece that no longer
    /// matches the content or no longer fits where it was.
    pub fn restore(&mut self, saved: &[Placed]) {
        for s in saved {
            if self.pieces.iter().any(|p| p.id == s.id && p.kind == s.kind) {
                let _ = self.place(s.id, Tile { x: s.x, y: s.y });
            }
        }
    }

    pub fn in_bounds(&self, t: Tile) -> bool {
        t.x < self.width && t.y < self.height
    }

    pub fn ground(&self, t: Tile) -> Ground {
        if self.in_bounds(t) {
            self.ground[t.y as usize * self.width as usize + t.x as usize]
        } else {
            Ground::Wall
        }
    }

    pub fn piece_at(&self, t: Tile) -> Option<&Piece> {
        self.pieces.iter().find(|p| p.covers(t))
    }

    pub fn walkable(&self, t: Tile, who: Walker) -> bool {
        match self.ground(t) {
            Ground::Door => true,
            Ground::Floor => who == Walker::Cat || self.piece_at(t).is_none_or(|p| !p.spec.blocks),
            _ => false,
        }
    }

    fn neighbours(&self, t: Tile, diagonals: bool) -> Vec<Tile> {
        let steps: &[(i16, i16)] = if diagonals {
            &[(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
        } else {
            &[(0, -1), (1, 0), (0, 1), (-1, 0)]
        };
        steps
            .iter()
            .map(|(dx, dy)| (t.x as i16 + dx, t.y as i16 + dy))
            .filter(|&(x, y)| x >= 0 && y >= 0)
            .map(|(x, y)| Tile { x: x as u8, y: y as u8 })
            .filter(|&n| self.in_bounds(n))
            .collect()
    }

    /// The shortest four-way path from `from` to `to`, both included.
    pub fn path(&self, from: Tile, to: Tile, who: Walker) -> Option<Vec<Tile>> {
        if !self.walkable(to, who) {
            return None;
        }
        if from == to {
            return Some(vec![from]);
        }
        let mut came: HashMap<Tile, Tile> = HashMap::from([(from, from)]);
        let mut queue = VecDeque::from([from]);
        while let Some(t) = queue.pop_front() {
            for n in self.neighbours(t, false) {
                if came.contains_key(&n) || !self.walkable(n, who) {
                    continue;
                }
                came.insert(n, t);
                if n == to {
                    let mut path = vec![to];
                    let mut cur = to;
                    while cur != from {
                        cur = came[&cur];
                        path.push(cur);
                    }
                    path.reverse();
                    return Some(path);
                }
                queue.push_back(n);
            }
        }
        None
    }

    /// The tiles touching `t`, diagonals included, that `who` can stand on.
    pub fn around(&self, t: Tile, who: Walker) -> Vec<Tile> {
        self.neighbours(t, true)
            .into_iter()
            .filter(|&n| self.ground(n) == Ground::Floor && self.walkable(n, who))
            .collect()
    }

    /// Whether someone could stand next to `t`, so a cat there can be petted.
    pub fn pettable(&self, t: Tile) -> bool {
        !self.around(t, Walker::Person).is_empty()
    }

    /// For each piece whose kind passes `keep`, the first of its tiles that
    /// someone could stand next to (its top-left if none).
    pub fn spots(&self, keep: impl Fn(&FurnitureKind) -> bool) -> Vec<Tile> {
        self.pieces
            .iter()
            .filter(|p| keep(&p.spec))
            .map(|p| p.tiles().into_iter().find(|&t| self.pettable(t)).unwrap_or(Tile { x: p.x, y: p.y }))
            .collect()
    }

    /// Every floor tile `who` can stand on.
    pub fn floor(&self, who: Walker) -> Vec<Tile> {
        (0..self.height)
            .flat_map(|y| (0..self.width).map(move |x| Tile { x, y }))
            .filter(|&t| self.ground(t) == Ground::Floor && self.walkable(t, who))
            .collect()
    }

    pub fn view(&self) -> RoomView {
        RoomView {
            width: self.width,
            height: self.height,
            tiles: self.rows.clone(),
            door: self.door,
            furniture: self
                .pieces
                .iter()
                .map(|p| FurnitureView {
                    id: p.id,
                    kind: p.kind.clone(),
                    x: p.x,
                    y: p.y,
                    w: p.spec.w,
                    h: p.spec.h,
                    movable: p.spec.movable,
                })
                .collect(),
        }
    }
}

pub fn manhattan(a: Tile, b: Tile) -> u32 {
    a.x.abs_diff(b.x) as u32 + a.y.abs_diff(b.y) as u32
}

pub fn chebyshev(a: Tile, b: Tile) -> u32 {
    a.x.abs_diff(b.x).max(a.y.abs_diff(b.y)) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn room() -> Room {
        crate::content::repo_content().room
    }

    fn t(x: u8, y: u8) -> Tile {
        Tile { x, y }
    }

    #[test]
    fn the_door_and_entry_come_from_the_floor_plan() {
        let r = room();
        assert_eq!((r.door, r.entry), (t(7, 0), t(7, 1)));
        assert_eq!(r.ground(t(3, 0)), Ground::Window);
        assert_eq!(r.ground(t(8, 0)), Ground::Board);
    }

    #[test]
    fn walls_and_windows_are_never_walkable() {
        let r = room();
        for who in [Walker::Person, Walker::Cat] {
            assert!(!r.walkable(t(0, 0), who));
            assert!(!r.walkable(t(3, 0), who));
            assert!(r.walkable(r.door, who));
        }
    }

    #[test]
    fn people_walk_around_furniture_that_blocks() {
        let r = room();
        let path = r.path(r.entry, t(1, 8), Walker::Person).expect("a path");
        assert_eq!((path[0], *path.last().unwrap()), (r.entry, t(1, 8)));
        assert!(path.iter().all(|&s| r.walkable(s, Walker::Person)));
        assert!(path.windows(2).all(|w| manhattan(w[0], w[1]) == 1));
    }

    #[test]
    fn cats_reach_the_sofa_but_people_cannot_stand_on_it() {
        let r = room();
        assert!(r.path(r.entry, t(1, 5), Walker::Cat).is_some());
        assert!(r.path(r.entry, t(1, 5), Walker::Person).is_none());
        assert!(r.path(r.entry, t(5, 5), Walker::Person).is_some(), "the rug doesn't block");
    }

    #[test]
    fn every_tile_a_person_can_stand_on_is_reachable_from_the_entry() {
        let r = room();
        for tile in r.floor(Walker::Person) {
            assert!(
                r.path(r.entry, tile, Walker::Person).is_some(),
                "({}, {}) is cut off",
                tile.x,
                tile.y
            );
        }
    }

    #[test]
    fn nap_and_hide_spots_come_from_the_furniture() {
        let r = room();
        assert!(r.spots(|k| k.hide).contains(&t(1, 9)), "the box");
        assert!(r.spots(|k| k.nap).contains(&t(0, 5)), "the sofa");
    }

    #[test]
    fn every_nap_and_hide_spot_has_somewhere_beside_it_to_stand() {
        let r = room();
        for spot in r.spots(|k| k.nap || k.hide) {
            assert!(
                !r.around(spot, Walker::Person).is_empty(),
                "nobody can reach a cat at ({}, {})",
                spot.x,
                spot.y
            );
        }
    }

    #[test]
    fn around_lists_only_tiles_you_can_stand_on() {
        let r = room();
        let near_sofa = r.around(t(1, 5), Walker::Person);
        assert!(!near_sofa.is_empty());
        assert!(
            near_sofa
                .iter()
                .all(|&n| r.walkable(n, Walker::Person) && chebyshev(n, t(1, 5)) == 1)
        );
    }

    #[test]
    fn furniture_on_the_walkway_is_refused() {
        let file = RoomFile {
            width: 3,
            height: 3,
            tiles: vec!["WDW".into(), "...".into(), "...".into()],
            entry: t(1, 1),
            walkway: vec![t(1, 1), t(1, 2)],
            furniture: vec![PieceFile {
                kind: "box".into(),
                x: 1,
                y: 2,
            }],
        };
        let kinds = HashMap::from([(
            "box".to_string(),
            FurnitureKind {
                w: 1,
                h: 1,
                blocks: true,
                nap: false,
                hide: false,
                perch: false,
                movable: false,
            },
        )]);
        let err = Room::build(&file, &kinds).unwrap_err().to_string();
        assert!(err.contains("walkway"), "{err}");
    }

    fn cushion(r: &Room) -> u32 {
        r.pieces.iter().find(|p| p.kind == "cushion").expect("the room has a cushion").id
    }

    fn sofa(r: &Room) -> u32 {
        r.pieces.iter().find(|p| p.kind == "sofa").unwrap().id
    }

    #[test]
    fn the_cushion_moves_to_free_floor() {
        let mut r = room();
        let id = cushion(&r);
        assert_eq!(r.place(id, t(3, 8)), Ok(()));
        let p = r.pieces.iter().find(|p| p.id == id).unwrap();
        assert_eq!((p.x, p.y), (3, 8));
        assert!(r.view().furniture.iter().any(|f| f.id == id && f.movable && (f.x, f.y) == (3, 8)));
    }

    #[test]
    fn nothing_is_ever_put_on_the_doors_walkway() {
        let mut r = room();
        let id = cushion(&r);
        for w in r.walkway.clone() {
            assert!(r.place(id, w).is_err(), "({}, {}) is the walkway", w.x, w.y);
        }
    }

    #[test]
    fn pieces_stay_on_the_floor_and_never_overlap() {
        let mut r = room();
        let id = cushion(&r);
        assert!(r.place(id, t(3, 0)).is_err(), "the window");
        assert!(r.place(id, t(12, 5)).is_err(), "past the edge");
        assert!(r.place(id, t(255, 255)).is_err(), "far past the edge");
        assert!(r.place(id, t(1, 5)).is_err(), "the sofa");
        assert!(r.place(id, t(5, 5)).is_err(), "the rug");
    }

    #[test]
    fn only_movable_pieces_move() {
        let mut r = room();
        let id = sofa(&r);
        assert!(r.place(id, t(3, 8)).is_err());
        assert!(r.place(999, t(3, 8)).is_err());
        assert!(!r.view().furniture.iter().any(|f| f.id == id && f.movable));
    }

    #[test]
    fn a_saved_arrangement_comes_back_and_a_stale_one_is_ignored() {
        let mut r = room();
        let id = cushion(&r);
        r.place(id, t(3, 8)).unwrap();
        let saved = r.arrangement();
        let mut fresh = room();
        fresh.restore(&saved);
        assert_eq!(fresh.arrangement(), saved);
        let mut stale = saved.clone();
        stale[0].x = 7;
        stale[0].y = 2; // the walkway: content changed since it was saved
        let mut again = room();
        again.restore(&stale);
        assert_eq!(again.arrangement(), room().arrangement());
    }

    #[test]
    fn a_movable_piece_that_blocks_is_refused_for_now() {
        let file = RoomFile {
            width: 3,
            height: 3,
            tiles: vec!["WDW".into(), "...".into(), "...".into()],
            entry: t(1, 1),
            walkway: vec![t(1, 1)],
            furniture: vec![PieceFile {
                kind: "crate".into(),
                x: 0,
                y: 2,
            }],
        };
        let kinds = HashMap::from([(
            "crate".to_string(),
            FurnitureKind {
                w: 1,
                h: 1,
                blocks: true,
                nap: false,
                hide: false,
                perch: false,
                movable: true,
            },
        )]);
        let err = Room::build(&file, &kinds).unwrap_err().to_string();
        assert!(err.contains("movable"), "{err}");
    }

    #[test]
    fn the_view_lists_every_piece() {
        let r = room();
        let v = r.view();
        assert_eq!(v.furniture.len(), r.pieces.len());
        assert_eq!(v.tiles[0], "WWGGGGWDCWWW");
    }
}
