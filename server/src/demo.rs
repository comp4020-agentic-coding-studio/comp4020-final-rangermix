//! The demo accounts markers log into (slice 17, ADR 0022), and
//! `cafe demo seed`, the operator's command that makes them: run over
//! `fly ssh console`, then a restart to load it. The seed is the one way a
//! cat's trust changes without a person's doing (AGENTS.md).
use crate::cats::CatDef;
use crate::store::{self, Store};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
pub struct Seed {
    #[serde(rename = "account")]
    pub accounts: Vec<SeedAccount>,
    /// Each cat's trust in every demo account, by the cat's id.
    pub trust: BTreeMap<String, f32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SeedAccount {
    pub name: String,
    pub avatar: u8,
    pub colour: u8,
}

/// Reads `demo.toml` from the content directory and checks it against the
/// café's cats.
pub fn read(dir: &Path, cats: &[CatDef]) -> anyhow::Result<Seed> {
    let seed: Seed = crate::content::read_toml(&dir.join("demo.toml"))?;
    check(&seed, cats)?;
    Ok(seed)
}

/// Every name the café's own and valid, every look on offer, every cat one
/// of the café's, and every trust 0 to 100.
fn check(seed: &Seed, cats: &[CatDef]) -> anyhow::Result<()> {
    for a in &seed.accounts {
        if !crate::auth::valid_username(&a.name) || !crate::auth::reserved_username(&a.name) {
            anyhow::bail!("demo.toml: {:?} isn't a demo account's name (demo and digits)", a.name);
        }
        if a.avatar >= crate::api::AVATARS || a.colour >= crate::api::COLOURS {
            anyhow::bail!("demo.toml: {}'s look isn't one on offer", a.name);
        }
    }
    for (cat, value) in &seed.trust {
        if !cats.iter().any(|c| &c.id == cat) {
            anyhow::bail!("demo.toml: there's no cat {cat:?} in the café");
        }
        if !(0.0..=100.0).contains(value) {
            anyhow::bail!("demo.toml: {cat}'s trust {value} isn't 0 to 100");
        }
    }
    Ok(())
}

/// Creates or resets each demo account with `password`, marks it, lifts its
/// bans, and sets each cat's trust in it, on the café's day at `now`. A name
/// a visitor already holds is refused before anything is written.
pub async fn seed(store: &Store, seed: &Seed, password: &str, now: u64) -> anyhow::Result<()> {
    // The slow part first, off the store's thread: the password once, and a
    // recovery code for each account that nobody is ever shown.
    let password = password.to_string();
    let count = seed.accounts.len();
    let (password_hash, recovery_hashes) = tokio::task::spawn_blocking(move || {
        let codes: Vec<String> = (0..count)
            .map(|_| crate::auth::hash_secret(&crate::auth::normalise_code(&crate::auth::new_recovery_code())))
            .collect();
        (crate::auth::hash_secret(&password), codes)
    })
    .await?;
    let accounts = seed.accounts.clone();
    let trust = seed.trust.clone();
    let today = crate::time::canberra_day(now);
    let made = store
        .call(move |c| {
            let tx = c.transaction()?;
            // Nobody's own account is touched: checked before anything is written.
            let mut found = Vec::new();
            for a in &accounts {
                let user = store::user_by_name(&tx, &a.name)?;
                if let Some(u) = &user
                    && !u.demo
                {
                    return Ok(Err(a.name.clone()));
                }
                found.push(user);
            }
            let mut made = Vec::new();
            for ((a, user), recovery_hash) in accounts.iter().zip(found).zip(&recovery_hashes) {
                let (id, created) = match user {
                    Some(u) => {
                        store::set_secrets(&tx, u.id, &password_hash, recovery_hash)?;
                        (u.id, false)
                    }
                    None => {
                        let id = store::insert_user(&tx, &a.name, &password_hash, recovery_hash, a.avatar, a.colour, now)?
                            .expect("checked above: the name is free");
                        (id, true)
                    }
                };
                store::set_demo(&tx, id, true)?;
                store::delete_bans_for(&tx, id)?;
                for (cat, value) in &trust {
                    let row = store::TrustRow {
                        cat_id: cat.clone(),
                        user_id: id,
                        value: *value,
                        day: today.clone(),
                        gained_today: 0.0,
                    };
                    store::put_trust(&tx, &row)?;
                }
                made.push((a.name.clone(), id, created));
            }
            tx.commit()?;
            Ok(Ok(made))
        })
        .await?;
    let made = made.map_err(|name| anyhow::anyhow!("{name} is a visitor's account, not a demo account: the seed won't touch it"))?;
    for (name, id, created) in made {
        tracing::info!(target: "operator", uid = id, who = %name, what = "demo_seed", created);
        for (cat, value) in &seed.trust {
            tracing::info!(target: "operator", uid = id, who = %name, what = "demo_trust", cat = %cat, trust = *value);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_logs::LogSink;

    const NOW: u64 = 1_793_000_000_000;

    fn store() -> (tempfile::TempDir, Store) {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("cafe.db")).unwrap();
        (dir, store)
    }

    fn a_seed(names: &[&str]) -> Seed {
        Seed {
            accounts: names
                .iter()
                .map(|n| SeedAccount {
                    name: n.to_string(),
                    avatar: 1,
                    colour: 3,
                })
                .collect(),
            trust: BTreeMap::from([("mochi".to_string(), 85.0), ("tora".to_string(), 55.0)]),
        }
    }

    async fn user(store: &Store, name: &'static str) -> Option<store::UserRow> {
        store.call(move |c| store::user_by_name(c, name)).await.unwrap()
    }

    async fn trust_of(store: &Store, id: i64) -> Vec<(String, f32, String, f32)> {
        let rows = store.call(|c| store::all_trust(c)).await.unwrap();
        let mut rows: Vec<_> = rows
            .into_iter()
            .filter(|r| r.user_id == id)
            .map(|r| (r.cat_id, r.value, r.day, r.gained_today))
            .collect();
        rows.sort_by(|a, b| a.0.cmp(&b.0));
        rows
    }

    #[tokio::test]
    async fn the_seed_makes_demo_accounts_that_cats_already_know() {
        let (_dir, store) = store();
        seed(&store, &a_seed(&["demo1", "demo2"]), "catppuccino", NOW).await.unwrap();
        let today = crate::time::canberra_day(NOW);
        for name in ["demo1", "demo2"] {
            let u = user(&store, if name == "demo1" { "demo1" } else { "demo2" }).await.unwrap();
            assert!(u.demo, "{name} is a demo account");
            assert!(crate::auth::verify_secret("catppuccino", &u.password_hash));
            assert_eq!((u.avatar, u.colour), (1, 3));
            assert_eq!(
                trust_of(&store, u.id).await,
                vec![
                    ("mochi".into(), 85.0, today.clone(), 0.0),
                    ("tora".into(), 55.0, today.clone(), 0.0)
                ]
            );
        }
    }

    #[tokio::test]
    async fn seeding_again_puts_the_trust_back_and_lifts_bans() {
        let (_dir, store) = store();
        seed(&store, &a_seed(&["demo1"]), "catppuccino", NOW).await.unwrap();
        let id = user(&store, "demo1").await.unwrap().id;
        // Someone was unkind to the regular's cats.
        store
            .call(move |c| {
                store::put_trust(
                    c,
                    &store::TrustRow {
                        cat_id: "tora".into(),
                        user_id: id,
                        value: 40.0,
                        day: "2026-11-06".into(),
                        gained_today: 0.0,
                    },
                )?;
                store::put_ban(
                    c,
                    &store::BanRow {
                        cat_id: "tora".into(),
                        user_id: id,
                        action: "pick_up".into(),
                        until: NOW + 3_600_000,
                    },
                )
            })
            .await
            .unwrap();
        seed(&store, &a_seed(&["demo1"]), "another one", NOW).await.unwrap();
        let u = user(&store, "demo1").await.unwrap();
        assert_eq!(u.id, id, "the same account");
        assert!(crate::auth::verify_secret("another one", &u.password_hash));
        assert!(!crate::auth::verify_secret("catppuccino", &u.password_hash));
        assert_eq!(trust_of(&store, id).await[1].1, 55.0, "Tora's trust is back");
        assert!(store.call(move |c| store::live_bans(c, NOW)).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn the_seed_never_takes_over_a_visitors_account() {
        let (_dir, store) = store();
        store
            .call(|c| store::insert_user(c, "demo1", "theirs", "their code", 0, 0, 1))
            .await
            .unwrap();
        let refused = seed(&store, &a_seed(&["demo2", "demo1"]), "catppuccino", NOW).await.unwrap_err();
        assert!(format!("{refused:#}").contains("demo1"), "{refused:#}");
        let theirs = user(&store, "demo1").await.unwrap();
        assert!(!theirs.demo);
        assert_eq!(theirs.password_hash, "theirs");
        assert!(trust_of(&store, theirs.id).await.is_empty());
        assert!(user(&store, "demo2").await.is_none(), "nothing written");
    }

    #[test]
    fn the_repos_seed_names_real_cats() {
        let content = crate::content::repo_content();
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../content");
        let seed = read(&dir, &content.cats).unwrap();
        let names: Vec<&str> = seed.accounts.iter().map(|a| a.name.as_str()).collect();
        assert_eq!(names, ["demo1", "demo2"]);
        assert_eq!(
            seed.trust,
            BTreeMap::from([("burakku".into(), 25.0), ("mochi".into(), 85.0), ("tora".into(), 55.0)])
        );
    }

    #[test]
    fn a_seed_that_isnt_the_cafes_is_refused() {
        let cats = crate::content::repo_content().cats;
        let mut unknown = a_seed(&["demo1"]);
        unknown.trust.insert("felix".into(), 10.0);
        let mut visitor = a_seed(&["sam"]);
        visitor.trust.clear();
        let mut too_much = a_seed(&["demo1"]);
        too_much.trust.insert("mochi".into(), 120.0);
        let mut bad_look = a_seed(&["demo1"]);
        bad_look.accounts[0].colour = 9;
        for (seed, why) in [(unknown, "felix"), (visitor, "sam"), (too_much, "120"), (bad_look, "look")] {
            let refused = check(&seed, &cats).unwrap_err();
            assert!(format!("{refused:#}").contains(why), "{refused:#}");
        }
    }

    #[tokio::test]
    async fn the_seed_never_logs_the_password() {
        let sink = LogSink::default();
        let _logging = sink.capture();
        let (_dir, store) = store();
        seed(&store, &a_seed(&["demo1", "demo2"]), "catppuccino", NOW).await.unwrap();
        let lines = sink.lines();
        assert!(lines.iter().all(|l| !l.to_string().contains("catppuccino")));
        let operator = lines.iter().filter(|l| l["target"] == "operator").count();
        assert_eq!(operator, 2 + 2 * 2, "one per account and one per account and cat");
    }
}
