//! Loads everything in content/: the tuning numbers, the room and its
//! furniture (and, from Task 7, the cats). A file that doesn't parse or
//! doesn't make sense stops the server at startup.
use crate::cats::CatDef;
use crate::room::{FurnitureFile, Room, RoomFile};
use crate::tuning::Tuning;
use anyhow::Context;
use serde::de::DeserializeOwned;
use std::path::Path;

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
        assert_eq!(c.room.pieces.len(), 13);
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
}
