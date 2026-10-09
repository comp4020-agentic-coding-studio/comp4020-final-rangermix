//! All durable state in one SQLite file at /data/cafe.db, owned by one thread
//! (ADR 0005). Async callers wait for a reply with `call`; the world sends
//! writes it doesn't wait for with `fire`. Jobs that queue up together run in
//! one transaction. Nothing said in a bubble is ever written here (AGENTS.md).
use rusqlite::{Connection, OptionalExtension, params};
use std::path::Path;
use std::sync::mpsc;
use tokio::sync::oneshot;

type Job = Box<dyn FnOnce(&mut Connection) + Send>;

#[derive(Clone)]
pub struct Store {
    tx: mpsc::Sender<Job>,
}

/// Numbered migrations; `PRAGMA user_version` records how many have run.
const MIGRATIONS: &[&str] = &["CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        recovery_hash TEXT NOT NULL,
        avatar INTEGER NOT NULL,
        colour INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );
    CREATE TABLE trust (
        cat_id TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value REAL NOT NULL,
        day TEXT NOT NULL,
        gained_today REAL NOT NULL,
        PRIMARY KEY (cat_id, user_id)
    );
    CREATE TABLE cat_state (
        cat_id TEXT PRIMARY KEY,
        state TEXT NOT NULL,
        saved_at INTEGER NOT NULL
    );
    CREATE TABLE world (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );"];

impl Store {
    /// Opens (or creates) the database, runs any new migrations, and starts
    /// the store thread. Fails loudly: a café that can't open its database
    /// mustn't serve an empty one.
    pub fn open(path: &Path) -> anyhow::Result<Store> {
        let mut conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;")?;
        migrate(&mut conn)?;
        let (tx, rx) = mpsc::channel::<Job>();
        std::thread::Builder::new().name("store".into()).spawn(move || run(conn, rx))?;
        Ok(Store { tx })
    }

    pub async fn call<T, F>(&self, f: F) -> anyhow::Result<T>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> rusqlite::Result<T> + Send + 'static,
    {
        let (reply, answer) = oneshot::channel();
        self.tx
            .send(Box::new(move |conn| {
                let _ = reply.send(f(conn));
            }))
            .map_err(|_| anyhow::anyhow!("the store thread has stopped"))?;
        Ok(answer.await.map_err(|_| anyhow::anyhow!("the store thread dropped a reply"))??)
    }

    pub fn fire<F>(&self, f: F)
    where
        F: FnOnce(&mut Connection) -> rusqlite::Result<()> + Send + 'static,
    {
        let _ = self.tx.send(Box::new(move |conn| {
            if let Err(e) = f(conn) {
                tracing::error!(target: "store", error = %e, "a write failed");
            }
        }));
    }

    /// Waits until every job sent before this call has run.
    pub async fn flush(&self) -> anyhow::Result<()> {
        self.call(|_| Ok(())).await
    }
}

fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let done: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(done as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.execute_batch(&format!("PRAGMA user_version = {}", i + 1))?;
        tx.commit()?;
    }
    Ok(())
}

fn run(mut conn: Connection, rx: mpsc::Receiver<Job>) {
    while let Ok(first) = rx.recv() {
        let mut jobs = vec![first];
        while let Ok(more) = rx.try_recv() {
            jobs.push(more);
        }
        let batched = jobs.len() > 1 && conn.execute_batch("BEGIN").is_ok();
        for job in jobs {
            job(&mut conn);
        }
        if batched && let Err(e) = conn.execute_batch("COMMIT") {
            tracing::error!(target: "store", error = %e, "a commit failed");
        }
    }
}

#[derive(Debug, Clone)]
pub struct UserRow {
    pub id: i64,
    pub name: String,
    pub password_hash: String,
    pub recovery_hash: String,
    pub avatar: u8,
    pub colour: u8,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TrustRow {
    pub cat_id: String,
    pub user_id: i64,
    pub value: f32,
    pub day: String,
    pub gained_today: f32,
}

const USER_COLUMNS: &str = "id, name, password_hash, recovery_hash, avatar, colour";

fn user_from(row: &rusqlite::Row) -> rusqlite::Result<UserRow> {
    Ok(UserRow {
        id: row.get(0)?,
        name: row.get(1)?,
        password_hash: row.get(2)?,
        recovery_hash: row.get(3)?,
        avatar: row.get(4)?,
        colour: row.get(5)?,
    })
}

/// Adds a user, or returns None when the name is taken, whatever its case.
pub fn insert_user(
    conn: &Connection,
    name: &str,
    password_hash: &str,
    recovery_hash: &str,
    avatar: u8,
    colour: u8,
    now: u64,
) -> rusqlite::Result<Option<i64>> {
    let res = conn.execute(
        "INSERT INTO users (name, name_key, password_hash, recovery_hash, avatar, colour, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![name, name.to_lowercase(), password_hash, recovery_hash, avatar, colour, now as i64],
    );
    match res {
        Ok(_) => Ok(Some(conn.last_insert_rowid())),
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == rusqlite::ErrorCode::ConstraintViolation => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn user_by_name(conn: &Connection, name: &str) -> rusqlite::Result<Option<UserRow>> {
    conn.query_row(
        &format!("SELECT {USER_COLUMNS} FROM users WHERE name_key = ?1"),
        params![name.to_lowercase()],
        user_from,
    )
    .optional()
}

pub fn user_by_id(conn: &Connection, id: i64) -> rusqlite::Result<Option<UserRow>> {
    conn.query_row(&format!("SELECT {USER_COLUMNS} FROM users WHERE id = ?1"), params![id], user_from)
        .optional()
}

pub fn set_secrets(conn: &Connection, id: i64, password_hash: &str, recovery_hash: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE users SET password_hash = ?1, recovery_hash = ?2 WHERE id = ?3",
        params![password_hash, recovery_hash, id],
    )?;
    Ok(())
}

pub fn insert_session(conn: &Connection, token_hash: &str, user_id: i64, expires_at: u64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)",
        params![token_hash, user_id, expires_at as i64],
    )?;
    Ok(())
}

/// Deletes sessions that have run out, returning how many.
pub fn purge_sessions(conn: &Connection, now: u64) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?1", params![now as i64])
}

pub fn session_user(conn: &Connection, token_hash: &str, now: u64) -> rusqlite::Result<Option<i64>> {
    conn.query_row(
        "SELECT user_id FROM sessions WHERE token_hash = ?1 AND expires_at > ?2",
        params![token_hash, now as i64],
        |r| r.get(0),
    )
    .optional()
}

pub fn extend_session(conn: &Connection, token_hash: &str, expires_at: u64) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE sessions SET expires_at = ?2 WHERE token_hash = ?1",
        params![token_hash, expires_at as i64],
    )?;
    Ok(())
}

pub fn delete_session(conn: &Connection, token_hash: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM sessions WHERE token_hash = ?1", params![token_hash])?;
    Ok(())
}

pub fn delete_sessions_for(conn: &Connection, user_id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM sessions WHERE user_id = ?1", params![user_id])?;
    Ok(())
}

pub fn all_trust(conn: &Connection) -> rusqlite::Result<Vec<TrustRow>> {
    let mut stmt = conn.prepare("SELECT cat_id, user_id, value, day, gained_today FROM trust ORDER BY cat_id, user_id")?;
    let rows = stmt.query_map([], |r| {
        Ok(TrustRow {
            cat_id: r.get(0)?,
            user_id: r.get(1)?,
            value: r.get(2)?,
            day: r.get(3)?,
            gained_today: r.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn put_trust(conn: &Connection, row: &TrustRow) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO trust (cat_id, user_id, value, day, gained_today) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (cat_id, user_id) DO UPDATE SET value = excluded.value, day = excluded.day, gained_today = excluded.gained_today",
        params![row.cat_id, row.user_id, row.value, row.day, row.gained_today],
    )?;
    Ok(())
}

pub fn all_cat_states(conn: &Connection) -> rusqlite::Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT cat_id, state FROM cat_state ORDER BY cat_id")?;
    let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

pub fn put_cat_state(conn: &Connection, cat_id: &str, state: &str, now: u64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO cat_state (cat_id, state, saved_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (cat_id) DO UPDATE SET state = excluded.state, saved_at = excluded.saved_at",
        params![cat_id, state, now as i64],
    )?;
    Ok(())
}

pub fn get_world(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM world WHERE key = ?1", params![key], |r| r.get(0))
        .optional()
}

pub fn put_world(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO world (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let mut conn = Connection::open(dir.path().join("t.db")).unwrap();
        migrate(&mut conn).unwrap();
        (dir, conn)
    }

    #[test]
    fn names_are_unique_whatever_their_case() {
        let (_d, c) = db();
        let id = insert_user(&c, "Sam", "ph", "rh", 1, 2, 10).unwrap();
        assert!(id.is_some());
        assert_eq!(insert_user(&c, "sam", "ph", "rh", 0, 0, 11).unwrap(), None);
        let found = user_by_name(&c, "SAM").unwrap().unwrap();
        assert_eq!((found.name.as_str(), found.avatar, found.colour), ("Sam", 1, 2));
        assert_eq!(user_by_id(&c, found.id).unwrap().unwrap().name, "Sam");
    }

    #[test]
    fn secrets_can_be_replaced() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "old-p", "old-r", 0, 0, 1).unwrap().unwrap();
        set_secrets(&c, id, "new-p", "new-r").unwrap();
        let u = user_by_id(&c, id).unwrap().unwrap();
        assert_eq!((u.password_hash.as_str(), u.recovery_hash.as_str()), ("new-p", "new-r"));
    }

    #[test]
    fn sessions_expire_and_can_be_ended() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap().unwrap();
        insert_session(&c, "h1", id, 1000).unwrap();
        assert_eq!(session_user(&c, "h1", 999).unwrap(), Some(id));
        assert_eq!(session_user(&c, "h1", 1000).unwrap(), None);
        extend_session(&c, "h1", 5000).unwrap();
        assert_eq!(session_user(&c, "h1", 1000).unwrap(), Some(id));
        insert_session(&c, "h2", id, 5000).unwrap();
        delete_session(&c, "h1").unwrap();
        assert_eq!(session_user(&c, "h1", 1).unwrap(), None);
        delete_sessions_for(&c, id).unwrap();
        assert_eq!(session_user(&c, "h2", 1).unwrap(), None);
    }

    #[test]
    fn expired_sessions_are_cleared_out() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap().unwrap();
        insert_session(&c, "old", id, 1000).unwrap();
        insert_session(&c, "live", id, 9000).unwrap();
        assert_eq!(purge_sessions(&c, 5000).unwrap(), 1);
        let left: i64 = c.query_row("SELECT COUNT(*) FROM sessions", [], |r| r.get(0)).unwrap();
        assert_eq!(left, 1);
        assert_eq!(session_user(&c, "live", 5000).unwrap(), Some(id));
    }

    #[test]
    fn trust_rows_are_replaced_not_duplicated() {
        let (_d, c) = db();
        let id = insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap().unwrap();
        let mut row = TrustRow {
            cat_id: "mochi".into(),
            user_id: id,
            value: 2.0,
            day: "2026-10-07".into(),
            gained_today: 2.0,
        };
        put_trust(&c, &row).unwrap();
        row.value = 3.5;
        put_trust(&c, &row).unwrap();
        assert_eq!(all_trust(&c).unwrap(), vec![row]);
    }

    #[test]
    fn cat_states_and_world_values_are_replaced_not_duplicated() {
        let (_d, c) = db();
        put_cat_state(&c, "mochi", "{\"a\":1}", 1).unwrap();
        put_cat_state(&c, "mochi", "{\"a\":2}", 2).unwrap();
        assert_eq!(all_cat_states(&c).unwrap(), vec![("mochi".to_string(), "{\"a\":2}".to_string())]);
        assert_eq!(get_world(&c, "saved_at").unwrap(), None);
        put_world(&c, "saved_at", "1").unwrap();
        put_world(&c, "saved_at", "2").unwrap();
        assert_eq!(get_world(&c, "saved_at").unwrap().as_deref(), Some("2"));
    }

    #[test]
    fn reopening_keeps_the_data_and_the_schema_version() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("t.db");
        {
            let mut c = Connection::open(&path).unwrap();
            migrate(&mut c).unwrap();
            insert_user(&c, "sam", "p", "r", 0, 0, 1).unwrap();
        }
        let mut c = Connection::open(&path).unwrap();
        migrate(&mut c).unwrap();
        assert!(user_by_name(&c, "sam").unwrap().is_some());
        let version: i64 = c.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version as usize, MIGRATIONS.len());
    }

    #[tokio::test]
    async fn the_store_thread_runs_writes_in_order_before_a_later_call() {
        let dir = tempfile::tempdir().unwrap();
        let store = Store::open(&dir.path().join("cafe.db")).unwrap();
        store.fire(|c| put_world(c, "k", "first"));
        store.fire(|c| put_world(c, "k", "second"));
        let value = store.call(|c| get_world(c, "k")).await.unwrap();
        assert_eq!(value.as_deref(), Some("second"));
        store.flush().await.unwrap();
    }
}
