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
    // Each build is a folder of drawings beside the cats (slice 11's review, finding 18).
    let builds = dir.parent().map(|c| c.join("sprites/png/cat")).unwrap_or_default();
    for file in files {
        let cat: CatDef = read_toml(&file)?;
        cat.validate()?;
        anyhow::ensure!(
            builds.join(&cat.build).is_dir(),
            "{}: its build {:?} has no drawings in {}",
            cat.id,
            cat.build,
            builds.display()
        );
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
        // Fourteen, and three on the floor slice 16 added.
        assert_eq!(c.room.pieces.len(), 17);
    }

    #[test]
    fn cat_ids_are_unique() {
        let c = repo_content();
        let mut ids: Vec<&str> = c.cats.iter().map(|cat| cat.id.as_str()).collect();
        ids.dedup();
        assert_eq!(ids.len(), c.cats.len());
    }

    /// A cat names a build the sprites have (slice 11's review, finding 18):
    /// one with no drawings stops the café at once, naming it, as a bad cat
    /// file does, rather than drawing the cat as another build.
    #[test]
    fn a_cat_naming_a_build_with_no_drawings_stops_the_cafe() {
        let dir = tempfile::tempdir().unwrap();
        let cats = dir.path().join("cats");
        std::fs::create_dir_all(&cats).unwrap();
        std::fs::create_dir_all(dir.path().join("sprites/png/cat/round")).unwrap();
        let mochi = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("../content/cats/mochi.toml")).unwrap();
        std::fs::write(cats.join("mochi.toml"), &mochi).unwrap();
        assert!(load_cats(&cats).is_ok(), "a known build loads");
        std::fs::write(cats.join("mochi.toml"), mochi.replace("build = \"round\"", "build = \"fluffy\"")).unwrap();
        let err = load_cats(&cats).expect_err("an unknown build").to_string();
        assert!(err.contains("fluffy"), "{err}");
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
        // Every cat's build has every frame, at 24 px (slice 11), with back
        // views for walking away (slice 12).
        let cat = sprite_sizes("cat.txt");
        for c in &c.cats {
            for frame in [
                "sit",
                "walk_a",
                "walk_b",
                "back_sit",
                "back_walk_a",
                "back_walk_b",
                "nap",
                "eat",
                "play_a",
                "play_b",
                "perch",
                "held",
                "lap",
                "scratch",
                "knock",
                "greet",
            ] {
                let name = format!("{}:{frame}", c.build);
                assert_eq!(cat.get(&name), Some(&(24, 24)), "{}'s build has {name}", c.id);
            }
        }
        let avatar = sprite_sizes("avatar.txt");
        // People at 32 px (slice 11), with back views (slice 12).
        for frame in ["stand", "walk_a", "walk_b", "back", "back_walk_a", "back_walk_b"] {
            assert_eq!(avatar.get(frame), Some(&(32, 32)), "{frame}");
        }
        let emotes = sprite_sizes("emotes.txt");
        for emote in ["heart", "question", "dots", "zzz", "sniff"] {
            assert_eq!(emotes[emote], (8, 8), "{emote}");
        }
    }

    /// The street behind the café (slice 13) is data the client draws: its
    /// shape in content/street.toml, its colours in palettes.json by day and
    /// by night, one per slot the client draws.
    #[test]
    fn the_street_is_data_with_colours_by_day_and_night() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content");
        let street: toml::Value = read_toml(&dir.join("street.toml")).expect("content/street.toml");
        let horizon = street["horizon"]
            .as_float()
            .expect("horizon, how far down the backdrop the street's skyline stands");
        assert!((0.3..=0.9).contains(&horizon), "horizon {horizon}");
        let towers = street["towers"].as_array().expect("towers");
        assert!(towers.len() >= 4, "at least four towers");
        for t in towers {
            let w = t["width"].as_integer().expect("a tower's width in pixels");
            let h = t["height"].as_float().expect("a tower's height, as a share of the sky");
            assert!(w >= 4 && (0.05..=1.0).contains(&h), "tower {t}");
        }
        // The windows: whole pixels, smaller than their spacing, and how
        // many in ten are lit (slice 13's review, finding 11).
        let windows = street["windows"].as_table().expect("[windows]");
        let every = windows["every"].as_integer().expect("windows.every, in whole pixels");
        let size = windows["size"].as_integer().expect("windows.size, in whole pixels");
        let lit = windows["lit"].as_integer().expect("windows.lit, how many in ten are lit");
        assert!(every >= 2 && size >= 1 && size < every, "windows every {every}, size {size}");
        assert!((0..=10).contains(&lit), "windows lit {lit} in ten");
        // The clouds (the user, 2026-11-05): each where it floats, in room
        // pixels at 1x on the room's backdrop, and how wide. The backdrop is
        // the room's canvas, (w + d) × 16 by (w + d) × 8 + 64 for a floor w
        // wide and d deep (slice 16): 400 by 264 for 13 by 12.
        let room = repo_content().room;
        let across = (room.width as i64 + room.height as i64 - 1) * 16;
        let down = (room.width as i64 + room.height as i64 - 1) * 8 + 64;
        let clouds = street["clouds"].as_array().expect("[[clouds]]");
        assert!(!clouds.is_empty(), "at least one cloud");
        for c in clouds {
            let x = c["x"].as_integer().expect("a cloud's x, in whole pixels");
            let y = c["y"].as_integer().expect("a cloud's y, in whole pixels");
            let w = c["width"].as_integer().expect("a cloud's width, in whole pixels");
            assert!(
                (0..across).contains(&x) && (0..down).contains(&y) && (6..=80).contains(&w),
                "cloud {c}"
            );
        }
        let glow = street["glow"]
            .as_float()
            .expect("glow, how far up the sky the warm band reaches, a share of the sky");
        assert!((0.0..=0.6).contains(&glow), "glow {glow}");
        let palettes: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(dir.join("sprites/palettes.json")).unwrap()).unwrap();
        for light in ["day", "night"] {
            let colours = palettes[light]["street"]
                .as_array()
                .unwrap_or_else(|| panic!("no {light} street colours"));
            // Sky top, sky bottom, tower, tower's other side, window lit, window
            // dark, star, kerb, pavement, then (the user, 2026-11-05) cloud,
            // cloud's underside, and the warm sky low by the skyline.
            assert_eq!(colours.len(), 12, "{light}");
        }
    }

    /// The balcony under the terrace (slice 18) is data too: a `[deck]`
    /// table in street.toml, how far out the deck reaches, its slab, the
    /// glass rail's height and its posts, how much the glass tints, the
    /// building's storey under it and how many of its windows are lit; and
    /// its colours in palettes.json, a "balcony" list by day and by night.
    #[test]
    fn the_balcony_is_data_with_colours_by_day_and_night() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content");
        let street: toml::Value = read_toml(&dir.join("street.toml")).expect("content/street.toml");
        check_balcony(&street);
        let palettes: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(dir.join("sprites/palettes.json")).unwrap()).unwrap();
        for light in ["day", "night"] {
            let colours = palettes[light]["balcony"]
                .as_array()
                .unwrap_or_else(|| panic!("no {light} balcony colours"));
            // Two stones, the slab's edge, the glass, the rail's metal, a
            // window dark and a window lit.
            assert_eq!(colours.len(), 7, "{light}");
        }
    }

    /// The street's balcony, if it has one. Without a [deck] there's no
    /// balcony, as before slice 18: the client reads that, so the file may
    /// leave it out (slice 18's review, finding 3).
    fn check_balcony(street: &toml::Value) {
        if let Some(deck) = street.get("deck") {
            check_deck(deck.as_table().expect("[deck] is a table"), street);
        }
    }

    /// The balcony's values (slice 18), each in its range, and two rules
    /// between them (slice 18's review, finding 3): the glass rail low
    /// enough for the deck's reach that it never rises behind the floor's
    /// slab, where the room is drawn over it; and each terrace thing far
    /// enough in that its blocks and shadow stay on the deck's stone.
    fn check_deck(deck: &toml::map::Map<String, toml::Value>, street: &toml::Value) {
        let num = |key: &str| {
            deck.get(key)
                .and_then(|v| v.as_float().or_else(|| v.as_integer().map(|i| i as f64)))
                .unwrap_or_else(|| panic!("deck.{key}"))
        };
        let out = num("out");
        assert!((1.0..=4.0).contains(&out), "deck.out {out} tiles");
        let slab = num("slab");
        assert!((0.0..=12.0).contains(&slab) && slab.fract() == 0.0, "deck.slab {slab} px");
        let rail = num("rail");
        assert!((0.0..=32.0).contains(&rail) && rail.fract() == 0.0, "deck.rail {rail} px, under a person's height");
        let posts = num("posts");
        assert!((0.5..=6.0).contains(&posts), "deck.posts every {posts} tiles");
        let glass = num("glass");
        assert!((0.0..=1.0).contains(&glass), "deck.glass {glass}");
        let storey = num("storey");
        assert!(storey == 0.0 || (32.0..=96.0).contains(&storey) && storey.fract() == 0.0, "deck.storey {storey} px");
        let lit = num("lit");
        assert!((0.0..=10.0).contains(&lit) && lit.fract() == 0.0, "deck.lit {lit} in ten");
        // The rail's top clears the floor's slab on screen: a tile out is 8
        // px lower, the rail stands 0.08 in from the edge, and the slab and
        // its foot line take 3 px (measured: the client's render test).
        assert!(rail <= (out - 0.2) * 16.0 - 3.0, "deck.rail {rail} px rises behind the floor's slab at deck.out {out}");
        // Every terrace thing stands on the deck, its blocks and shadow too:
        // the widest reaches 0.6 tiles across from its spot.
        for t in street["terrace"].as_array().expect("[[terrace]]") {
            let o = t["out"].as_float().expect("a terrace thing's out");
            assert!(o + 0.6 <= out, "{t} reaches past the deck's edge ({out} tiles out)");
        }
    }

    /// A [deck] that would draw the glass behind the floor's slab, or a
    /// terrace thing reaching past the deck's edge, is refused; one that
    /// fits isn't (slice 18's review, finding 3).
    #[test]
    fn a_deck_whose_rail_rises_behind_the_slab_or_whose_terrace_overhangs_is_refused() {
        let street = |out: f64, rail: i64, thing_out: f64| -> toml::Value {
            toml::from_str(&format!(
                "[deck]\nout = {out}\nslab = 4\nrail = {rail}\nposts = 2\nglass = 0.3\nstorey = 56\nlit = 4\n\n[[terrace]]\nkind = \"planter\"\nside = \"left\"\nalong = 4.0\nout = {thing_out}\n"
            ))
            .unwrap()
        };
        let check = |s: toml::Value| std::panic::catch_unwind(|| check_deck(s["deck"].as_table().unwrap(), &s)).is_ok();
        assert!(check(street(2.6, 18, 1.8)), "today's deck");
        assert!(check(street(2.4, 32, 1.5)), "a tall rail far enough out");
        assert!(!check(street(1.0, 18, 0.3)), "an 18-px rail one tile out rises behind the slab");
        assert!(!check(street(2.0, 32, 1.3)), "a 32-px rail two tiles out rises behind the slab");
        assert!(!check(street(2.0, 12, 1.8)), "a planter whose shadow overhangs the deck");
    }

    /// Without a [deck], no balcony: the server's content test accepts it
    /// as the client does (slice 18's review, finding 3).
    #[test]
    fn a_street_without_a_deck_is_still_a_street() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content");
        let text = std::fs::read_to_string(dir.join("street.toml")).unwrap();
        let start = text.find("\n[deck]\n").expect("today's [deck]");
        let end = text[start + 1..].find("\n\n").map(|i| start + 1 + i).unwrap();
        let without: toml::Value = toml::from_str(&format!("{}{}", &text[..start], &text[end..])).unwrap();
        assert!(without.get("deck").is_none());
        check_balcony(&without);
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
        assert_eq!(
            day.iter().map(|(k, _)| k).collect::<Vec<_>>(),
            night.iter().map(|(k, _)| k).collect::<Vec<_>>()
        );
        for ((at, d), (_, n)) in day.iter().zip(&night) {
            assert_eq!(d.len(), n.len(), "{at} has {} colours by day and {} by night", d.len(), n.len());
            for c in d.iter().chain(n.iter()) {
                let hex = c.as_str().unwrap_or_else(|| panic!("{at}: {c} isn't a colour"));
                assert!(
                    hex.len() == 7 && hex.starts_with('#') && hex[1..].chars().all(|ch| ch.is_ascii_hexdigit()),
                    "{at}: {hex} isn't #rrggbb"
                );
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
