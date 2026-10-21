//! Loads everything in content/: the tuning numbers, the room and its
//! furniture (and, from Task 7, the cats). A file that doesn't parse or
//! doesn't make sense stops the server at startup.
use crate::cats::CatDef;
use crate::room::{FurnitureFile, Room, RoomFile};
use crate::tuning::Tuning;
use anyhow::Context;
use serde::de::DeserializeOwned;
use std::path::Path;

#[derive(Clone)]
pub struct Content {
    pub tuning: Tuning,
    pub room: Room,
    pub cats: Vec<CatDef>,
}

pub fn load(dir: &Path) -> anyhow::Result<Content> {
    let tuning = Tuning::load(&dir.join("tuning.toml")).context("reading content/tuning.toml")?;
    let kinds: FurnitureFile = read_toml(&dir.join("furniture.toml"))?;
    let room_file: RoomFile = read_toml(&dir.join("room.toml"))?;
    let room = Room::build(&room_file, &kinds.kinds)?;
    let cats = load_cats(&dir.join("cats"))?;
    Ok(Content { tuning, room, cats })
}

/// Every cat file, in file-name order, each validated; ids must be unique.
fn load_cats(dir: &Path) -> anyhow::Result<Vec<CatDef>> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .with_context(|| format!("reading {}", dir.display()))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().is_some_and(|x| x == "toml"))
        .collect();
    files.sort();
    let mut cats: Vec<CatDef> = Vec::new();
    for file in files {
        let cat: CatDef = read_toml(&file)?;
        cat.validate()?;
        anyhow::ensure!(!cats.iter().any(|c| c.id == cat.id), "two cats are called {:?}", cat.id);
        cats.push(cat);
    }
    anyhow::ensure!(!cats.is_empty(), "content/cats has no cats");
    Ok(cats)
}

pub fn read_toml<T: DeserializeOwned>(path: &Path) -> anyhow::Result<T> {
    let text = std::fs::read_to_string(path).with_context(|| format!("reading {}", path.display()))?;
    toml::from_str(&text).with_context(|| format!("parsing {}", path.display()))
}

#[cfg(test)]
pub fn repo_content() -> Content {
    load(&Path::new(env!("CARGO_MANIFEST_DIR")).join("../content")).expect("the repo's content loads")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_repo_content_loads() {
        let c = repo_content();
        assert_eq!(c.tuning.cap, 6);
        assert_eq!(c.room.pieces.len(), 14);
    }

    #[test]
    fn cat_ids_are_unique() {
        let c = repo_content();
        let mut ids: Vec<&str> = c.cats.iter().map(|cat| cat.id.as_str()).collect();
        ids.dedup();
        assert_eq!(ids.len(), c.cats.len());
    }

    #[test]
    fn a_missing_file_names_itself() {
        let dir = tempfile::tempdir().unwrap();
        let err = load(dir.path()).err().expect("an error").to_string();
        assert!(err.contains("tuning.toml"), "{err}");
    }

    /// Each sprite in a sheet, by name, as (width, height); every row the same width.
    fn sprite_sizes(file: &str) -> std::collections::HashMap<String, (usize, usize)> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/sprites").join(file);
        let text = std::fs::read_to_string(path).unwrap();
        let mut sizes = std::collections::HashMap::new();
        let mut current: Option<(String, Vec<usize>)> = None;
        let mut finish = |sprite: Option<(String, Vec<usize>)>| {
            if let Some((name, rows)) = sprite {
                assert!(rows.iter().all(|&w| w == rows[0]), "{file}: {name} has rows of different widths");
                sizes.insert(name, (rows[0], rows.len()));
            }
        };
        for line in text.lines().map(str::trim_end) {
            if let Some(name) = line.strip_prefix("== ") {
                finish(current.take());
                current = Some((name.trim().to_string(), Vec::new()));
            } else if !line.is_empty()
                && let Some((_, rows)) = current.as_mut()
            {
                rows.push(line.chars().count());
            }
        }
        finish(current);
        sizes
    }

    #[test]
    fn every_sprite_the_client_draws_exists_at_its_size() {
        let c = repo_content();
        let furniture = sprite_sizes("furniture.txt");
        for piece in &c.room.pieces {
            let size = furniture.get(&piece.kind).unwrap_or_else(|| panic!("no sprite for {}", piece.kind));
            assert_eq!(*size, (piece.spec.w as usize * 16, piece.spec.h as usize * 16), "{}", piece.kind);
        }
        let room = sprite_sizes("room.txt");
        for tile in ["floor", "wall", "window", "door", "board"] {
            assert_eq!(room[tile], (16, 16), "{tile}");
        }
        let cat = sprite_sizes("cat.txt");
        for frame in ["sit", "walk_a", "walk_b", "nap"] {
            assert_eq!(cat[frame], (16, 16), "{frame}");
        }
        let avatar = sprite_sizes("avatar.txt");
        for frame in ["stand", "walk_a", "walk_b"] {
            assert_eq!(avatar[frame], (16, 16), "{frame}");
        }
        let emotes = sprite_sizes("emotes.txt");
        for emote in ["heart", "question", "dots", "zzz", "sniff"] {
            assert_eq!(emotes[emote], (8, 8), "{emote}");
        }
    }

    #[test]
    fn every_cat_coat_has_a_palette() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/sprites/palettes.json");
        let palettes: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        // By day and by night (slice 10).
        for light in ["day", "night"] {
            for cat in repo_content().cats {
                let coat = palettes[light]["coats"][&cat.coat]
                    .as_array()
                    .unwrap_or_else(|| panic!("no {light} palette for {}'s coat {}", cat.id, cat.coat));
                assert!(coat.len() >= 6, "{light} {}", cat.coat);
            }
        }
    }

    /// The day and night palettes are blended slot by slot (slice 10), so
    /// every list in one has as many colours as the same list in the other,
    /// and every colour is a six-digit hex.
    #[test]
    fn the_day_and_night_palettes_match_slot_for_slot() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/sprites/palettes.json");
        let palettes: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
        fn lists<'a>(v: &'a serde_json::Value, at: String, out: &mut Vec<(String, &'a Vec<serde_json::Value>)>) {
            match v {
                serde_json::Value::Array(a) => out.push((at, a)),
                serde_json::Value::Object(o) => o.iter().for_each(|(k, v)| lists(v, format!("{at}.{k}"), out)),
                _ => panic!("{at} isn't a list or a set of lists"),
            }
        }
        let (mut day, mut night) = (Vec::new(), Vec::new());
        lists(&palettes["day"], "".into(), &mut day);
        lists(&palettes["night"], "".into(), &mut night);
        assert!(!day.is_empty(), "no day palette");
        assert_eq!(day.iter().map(|(k, _)| k).collect::<Vec<_>>(), night.iter().map(|(k, _)| k).collect::<Vec<_>>());
        for ((at, d), (_, n)) in day.iter().zip(&night) {
            assert_eq!(d.len(), n.len(), "{at} has {} colours by day and {} by night", d.len(), n.len());
            for c in d.iter().chain(n.iter()) {
                let hex = c.as_str().unwrap_or_else(|| panic!("{at}: {c} isn't a colour"));
                assert!(hex.len() == 7 && hex.starts_with('#') && hex[1..].chars().all(|ch| ch.is_ascii_hexdigit()), "{at}: {hex} isn't #rrggbb");
            }
        }
    }

    /// The room at an angle draws each piece as a block this tall until its
    /// art comes (slice 09): every kind, in the room or the catalogue, has one.
    #[test]
    fn every_kind_of_furniture_has_a_height_to_draw_at() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/sprites/heights.json");
        let heights: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(path).expect("content/sprites/heights.json")).unwrap();
        for kind in repo_content().room.kinds.keys() {
            let h = heights[kind].as_u64().unwrap_or_else(|| panic!("no height for {kind}"));
            assert!((1..=64).contains(&h), "{kind}'s height {h} isn't between 1 and 64 pixels");
        }
    }
}
