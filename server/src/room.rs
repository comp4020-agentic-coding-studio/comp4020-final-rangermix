//! The café floor (design.md, "The room"): ground tiles, furniture, who can
//! stand where, and shortest paths. People can't walk through furniture that
//! blocks; cats walk and jump over all of it; nobody walks through a wall.
use crate::protocol::{FurnitureView, KindView, RoomView, Tile};
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
    /// Where cats perch to watch the line at the window.
    #[serde(default)]
    pub perch: bool,
    /// Small enough for a cat to knock over.
    #[serde(default)]
    pub knocks: bool,
    /// People can pick it up and put it somewhere else; the catalogue offers it.
    #[serde(default)]
    pub movable: bool,
    /// Other pieces can stand on it, as on a rug.
    #[serde(default)]
    pub under: bool,
    /// People can sit on it, one to a tile.
    #[serde(default)]
    pub seats: bool,
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

/// A movable piece as saved between runs: its kind and where it stands, not
/// its place in `room.toml`'s list.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Saved {
    pub kind: String,
    pub x: u8,
    pub y: u8,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub toppled: bool,
}

/// The cushion-only arrangement phase 1 saved, keyed by list position.
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
    /// Knocked over by a cat, until someone stands it back up.
    pub toppled: bool,
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
    /// Every kind of furniture there is, for the catalogue.
    pub kinds: HashMap<String, FurnitureKind>,
    next_id: u32,
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
            kinds: kinds.clone(),
            next_id: file.furniture.len() as u32 + 1,
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
            let piece = Piece {
                id: i as u32 + 1,
                kind: p.kind.clone(),
                x: p.x,
                y: p.y,
                spec,
                toppled: false,
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
                    room.pieces
                        .iter()
                        .all(|other| !other.covers(t) || other.spec.under != piece.spec.under),
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

    /// Why `piece`, with its top-left where it says, can't stand there, or
    /// Ok. On the floor only; never on the door's walkway (AGENTS.md); never
    /// over another piece, except on a rug. A piece that blocks also may not
    /// cover anyone in `occupied` (where people stand or are heading), cut any
    /// floor off from the door, or leave a cat's nap or hide spot where nobody
    /// can reach it. The piece itself, if it's on the floor, doesn't count.
    pub fn check_place(&self, piece: &Piece, occupied: &[Tile]) -> Result<(), &'static str> {
        let spec = &piece.spec;
        if piece.x as u16 + spec.w as u16 > self.width as u16 || piece.y as u16 + spec.h as u16 > self.height as u16 {
            return Err("That's not on the floor.");
        }
        for t in piece.tiles() {
            if self.ground(t) != Ground::Floor {
                return Err("That's not on the floor.");
            }
            if self.walkway.contains(&t) {
                return Err("The way in from the door stays clear.");
            }
            if self
                .pieces
                .iter()
                .any(|p| p.id != piece.id && p.covers(t) && p.spec.under == spec.under)
            {
                return Err("Something's already there.");
            }
        }
        if spec.blocks {
            if piece.tiles().iter().any(|t| occupied.contains(t)) {
                return Err("Someone's in the way.");
            }
            let mut after = self.clone();
            after.pieces.retain(|p| p.id != piece.id);
            after.pieces.push(piece.clone());
            if !after.all_reachable() {
                return Err("That would cut part of the café off.");
            }
            if !after.cat_spots_reachable() {
                return Err("A cat there couldn't be reached.");
            }
        }
        Ok(())
    }

    /// Whether every floor tile someone can stand on is reachable from the door.
    fn all_reachable(&self) -> bool {
        let floor = self.floor(Walker::Person);
        let mut seen = std::collections::HashSet::from([self.entry]);
        let mut queue = VecDeque::from([self.entry]);
        while let Some(t) = queue.pop_front() {
            for n in self.neighbours(t, false) {
                if self.walkable(n, Walker::Person) && seen.insert(n) {
                    queue.push_back(n);
                }
            }
        }
        floor.iter().all(|t| seen.contains(t))
    }

    /// Whether every piece a cat naps or hides on has a tile someone could pet it on.
    fn cat_spots_reachable(&self) -> bool {
        self.pieces
            .iter()
            .filter(|p| p.spec.nap || p.spec.hide)
            .all(|p| p.tiles().into_iter().any(|t| self.pettable(t)))
    }

    /// Moves a piece on the floor so its top-left is at `to`, or says why not.
    pub fn place(&mut self, id: u32, to: Tile) -> Result<(), &'static str> {
        let i = self.pieces.iter().position(|p| p.id == id).ok_or("That isn't here any more.")?;
        if !self.pieces[i].spec.movable {
            return Err("That doesn't move.");
        }
        let mut moved = self.pieces[i].clone();
        (moved.x, moved.y) = (to.x, to.y);
        self.check_place(&moved, &[])?;
        self.pieces[i] = moved;
        Ok(())
    }

    /// Takes a piece off the floor, to be carried.
    pub fn lift(&mut self, id: u32) -> Option<Piece> {
        let i = self.pieces.iter().position(|p| p.id == id)?;
        Some(self.pieces.remove(i))
    }

    /// Puts a piece on the floor; callers check it fits first.
    pub fn put(&mut self, piece: Piece) {
        self.pieces.push(piece);
    }

    /// A new piece of a movable kind, from the catalogue, not yet on the floor.
    pub fn new_piece(&mut self, kind: &str, at: Tile) -> Option<Piece> {
        let spec = self.kinds.get(kind).filter(|k| k.movable)?.clone();
        let id = self.next_id;
        self.next_id += 1;
        Some(Piece {
            id,
            kind: kind.to_string(),
            x: at.x,
            y: at.y,
            spec,
            toppled: false,
        })
    }

    /// Whether anything stands on this piece (a rug with a chair on it).
    pub fn has_something_on(&self, id: u32) -> bool {
        let Some(piece) = self.pieces.iter().find(|p| p.id == id) else {
            return false;
        };
        piece.spec.under && self.pieces.iter().any(|p| p.id != id && piece.tiles().iter().any(|&t| p.covers(t)))
    }

    /// How many movable pieces are on the floor.
    pub fn movable_count(&self) -> usize {
        self.pieces.iter().filter(|p| p.spec.movable).count()
    }

    /// Where each movable piece stands, by kind, for saving.
    pub fn arrangement(&self) -> Vec<Saved> {
        self.pieces
            .iter()
            .filter(|p| p.spec.movable)
            .map(|p| Saved {
                kind: p.kind.clone(),
                x: p.x,
                y: p.y,
                toppled: p.toppled,
            })
            .collect()
    }

    /// Replaces every movable piece with a saved arrangement, rugs first so
    /// what stood on them fits again; a piece whose kind is gone, or that no
    /// longer fits, is dropped.
    pub fn restore(&mut self, saved: &[Saved]) {
        self.pieces.retain(|p| !p.spec.movable);
        let mut order: Vec<&Saved> = saved.iter().collect();
        order.sort_by_key(|s| !self.kinds.get(&s.kind).is_some_and(|k| k.under));
        for s in order {
            let Some(mut piece) = self.new_piece(&s.kind, Tile { x: s.x, y: s.y }) else {
                continue;
            };
            piece.toppled = s.toppled;
            if self.check_place(&piece, &[]).is_ok() {
                self.pieces.push(piece);
            }
        }
    }

    /// Phase 1's cushion-only save: moves pieces by their place in the list,
    /// skipping any that no longer match.
    pub fn restore_legacy(&mut self, saved: &[Placed]) {
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

    /// What stands on a tile: a piece on a rug before the rug.
    pub fn piece_at(&self, t: Tile) -> Option<&Piece> {
        self.pieces.iter().filter(|p| p.covers(t)).min_by_key(|p| p.spec.under)
    }

    pub fn walkable(&self, t: Tile, who: Walker) -> bool {
        match self.ground(t) {
            Ground::Door => true,
            Ground::Floor => who == Walker::Cat || !self.pieces.iter().any(|p| p.covers(t) && p.spec.blocks),
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

    /// The tile nearest `from`, in steps `who` can walk, that passes `accept`;
    /// `from` itself if it does.
    pub fn nearest(&self, from: Tile, who: Walker, accept: impl Fn(Tile) -> bool) -> Option<Tile> {
        let mut seen = std::collections::HashSet::from([from]);
        let mut queue = VecDeque::from([from]);
        while let Some(t) = queue.pop_front() {
            if self.ground(t) == Ground::Floor && self.walkable(t, who) && accept(t) {
                return Some(t);
            }
            for n in self.neighbours(t, false) {
                if self.walkable(n, who) && seen.insert(n) {
                    queue.push_back(n);
                }
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
            walkway: self.walkway.clone(),
            furniture: self.pieces.iter().map(Piece::view).collect(),
            catalogue: {
                let mut kinds: Vec<KindView> = self
                    .kinds
                    .iter()
                    .filter(|(_, k)| k.movable)
                    .map(|(name, k)| KindView {
                        kind: name.clone(),
                        w: k.w,
                        h: k.h,
                        blocks: k.blocks,
                        under: k.under,
                        seats: k.seats,
                    })
                    .collect();
                kinds.sort_by(|a, b| a.kind.cmp(&b.kind));
                kinds
            },
        }
    }
}

impl Piece {
    pub fn view(&self) -> FurnitureView {
        FurnitureView {
            id: self.id,
            kind: self.kind.clone(),
            x: self.x,
            y: self.y,
            w: self.spec.w,
            h: self.spec.h,
            movable: self.spec.movable,
            blocks: self.spec.blocks,
            under: self.spec.under,
            seats: self.spec.seats,
            toppled: self.toppled,
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
                under: false,
                seats: false,
                knocks: false,
            },
        )]);
        let err = Room::build(&file, &kinds).unwrap_err().to_string();
        assert!(err.contains("walkway"), "{err}");
    }

    fn kind(blocks: bool, nap: bool) -> FurnitureKind {
        FurnitureKind {
            w: 1,
            h: 1,
            blocks,
            nap,
            hide: false,
            perch: false,
            movable: true,
            under: false,
            seats: false,
            knocks: false,
        }
    }

    /// A 5 by 3 room, door at the top: crates at (0, 1) and (1, 1), a cat bed at (0, 2).
    ///   W W D W W
    ///   c c . . .
    ///   b . . . .
    fn small_room(with_bed: bool) -> Room {
        let mut furniture = vec![
            PieceFile {
                kind: "crate".into(),
                x: 0,
                y: 1,
            },
            PieceFile {
                kind: "crate".into(),
                x: 1,
                y: 1,
            },
        ];
        if with_bed {
            furniture.push(PieceFile {
                kind: "bed".into(),
                x: 0,
                y: 2,
            });
        }
        let file = RoomFile {
            width: 5,
            height: 3,
            tiles: vec!["WWDWW".into(), ".....".into(), ".....".into()],
            entry: t(2, 1),
            walkway: vec![t(2, 1)],
            furniture,
        };
        let kinds = HashMap::from([("crate".to_string(), kind(true, false)), ("bed".to_string(), kind(true, true))]);
        Room::build(&file, &kinds).unwrap()
    }

    fn crate_at(r: &mut Room, x: u8, y: u8) -> Piece {
        r.new_piece("crate", t(x, y)).unwrap()
    }

    #[test]
    fn a_blocking_piece_may_not_cut_part_of_the_cafe_off() {
        let mut r = small_room(false);
        let c = crate_at(&mut r, 1, 2);
        assert_eq!(
            r.check_place(&c, &[]),
            Err("That would cut part of the café off."),
            "(0, 2) would be shut in"
        );
        let c = crate_at(&mut r, 3, 2);
        assert_eq!(r.check_place(&c, &[]), Ok(()));
    }

    #[test]
    fn a_blocking_piece_may_not_land_on_anyone() {
        let mut r = small_room(false);
        let c = crate_at(&mut r, 3, 2);
        assert_eq!(r.check_place(&c, &[t(3, 2)]), Err("Someone's in the way."));
    }

    #[test]
    fn a_cats_bed_must_keep_somewhere_to_stand_beside_it() {
        let mut r = small_room(true);
        let c = crate_at(&mut r, 1, 2);
        assert_eq!(r.check_place(&c, &[]), Err("A cat there couldn't be reached."));
    }

    #[test]
    fn the_door_walkway_stays_clear_of_blocking_pieces_too() {
        let mut r = small_room(false);
        let c = crate_at(&mut r, 2, 1);
        assert_eq!(r.check_place(&c, &[]), Err("The way in from the door stays clear."));
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
        assert_eq!(r.place(id, t(5, 5)), Ok(()), "a cushion can go on the rug");
    }

    #[test]
    fn a_blocking_piece_on_the_rug_still_blocks_and_is_what_stands_there() {
        let mut r = room();
        let chair = r.pieces.iter().find(|p| p.kind == "chair").unwrap().id;
        r.place(chair, t(5, 5)).unwrap();
        for r in [r.clone(), {
            let mut fresh = room();
            fresh.restore(&r.arrangement());
            fresh
        }] {
            assert!(!r.walkable(t(5, 5), Walker::Person), "nobody walks through the chair");
            assert!(r.walkable(t(5, 5), Walker::Cat));
            assert_eq!(r.piece_at(t(5, 5)).map(|p| p.kind.as_str()), Some("chair"));
            assert_eq!(r.piece_at(t(6, 5)).map(|p| p.kind.as_str()), Some("rug"));
            let path = r.path(t(4, 5), t(6, 5), Walker::Person).unwrap();
            assert!(!path.contains(&t(5, 5)), "the way goes round it");
        }
    }

    #[test]
    fn a_rug_with_something_on_it_says_so() {
        let mut r = room();
        let rug = r.pieces.iter().find(|p| p.kind == "rug").unwrap().id;
        assert!(!r.has_something_on(rug));
        r.place(cushion(&r), t(5, 5)).unwrap();
        assert!(r.has_something_on(rug));
    }

    #[test]
    fn the_sofa_moves_now_but_the_bowls_stay() {
        let mut r = room();
        let id = sofa(&r);
        assert_eq!(r.place(id, t(4, 2)), Ok(()));
        let bowls = r.pieces.iter().find(|p| p.kind == "bowls").unwrap().id;
        assert!(r.place(bowls, t(3, 8)).is_err());
        assert!(r.place(999, t(3, 8)).is_err());
        assert!(!r.view().catalogue.iter().any(|k| k.kind == "bowls"));
        assert!(r.view().catalogue.iter().any(|k| k.kind == "lamp"));
    }

    #[test]
    fn the_arrangement_is_saved_by_kind_and_comes_back_whole() {
        let mut r = room();
        r.place(sofa(&r), t(4, 2)).unwrap();
        r.place(cushion(&r), t(5, 5)).unwrap();
        let mut saved = r.arrangement();
        let mut fresh = room();
        fresh.restore(&saved);
        let mut back = fresh.arrangement();
        saved.sort();
        back.sort();
        assert_eq!(back, saved);
    }

    #[test]
    fn a_saved_piece_that_no_longer_fits_is_dropped() {
        let mut stale = room().arrangement();
        let cushion = stale.iter_mut().find(|s| s.kind == "cushion").unwrap();
        (cushion.x, cushion.y) = (7, 2); // the walkway: content changed since it was saved
        stale.push(Saved {
            kind: "no_such_thing".into(),
            x: 3,
            y: 8,
            toppled: false,
        });
        let mut r = room();
        r.restore(&stale);
        assert!(!r.pieces.iter().any(|p| p.kind == "cushion" || p.kind == "no_such_thing"));
        assert_eq!(r.pieces.len(), room().pieces.len() - 1);
    }

    #[test]
    fn phase_ones_cushion_save_still_moves_the_cushion() {
        let mut r = room();
        let id = cushion(&r);
        r.restore_legacy(&[Placed {
            id,
            kind: "cushion".into(),
            x: 3,
            y: 8,
        }]);
        let p = r.pieces.iter().find(|p| p.id == id).unwrap();
        assert_eq!((p.x, p.y), (3, 8));
    }

    #[test]
    fn the_view_lists_every_piece() {
        let r = room();
        let v = r.view();
        assert_eq!(v.furniture.len(), r.pieces.len());
        assert_eq!(v.tiles[0], "WWGGGGWDCWWW");
    }
}
