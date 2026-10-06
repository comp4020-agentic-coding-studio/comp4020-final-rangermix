# 0005. Keep all state in SQLite on the volume

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The course setup gives one 1 GB volume at `/data`, the only storage that
survives a restart or a redeploy, and no separate database server. The café
keeps accounts, sessions, each cat's trust in each person, bans, mutes,
furniture, treats used, traces and chalkboard lines, each cat's state, and the
world clock and random-generator state. Writes are small and frequent, and the
machine can be stopped at any idle moment with about five seconds' grace.

## Options

1. **SQLite in WAL mode, written by one thread**, with numbered migrations
   compiled into the binary. It gives transactions, durability, real queries
   for log-in and recovery, mature tools for inspecting the data, and a single
   file. It costs keeping a blocking API off the async runtime (hence the
   writer thread) and maintaining migrations.
2. **Snapshot files** (JSON or a binary encoding) written periodically.
   Trivial to start, but no transactions, a crash mid-write can corrupt a
   file, every save rewrites everything, and looking up an account is awkward.
3. **An embedded key-value store** such as redb or sled. Rust-native, but
   indexes and queries are hand-rolled and there's less tooling for looking
   inside.
4. **A managed Postgres beside the app.** Ruled out: another Fly app is outside
   the course setup, which fixes one machine and one volume.

## Decision

We will keep all durable state in one SQLite database at `/data/cafe.db` in WAL
mode, written by a single writer thread, with numbered migrations compiled into
the binary.

## Consequences

- People's changes are batched into transactions and written within a fraction
  of a second; the cats' state, the world clock and the random state are saved
  every 5 seconds and on the stop signal. A crash loses at most seconds of cat
  wandering, never a trust gain or a moved sofa.
- Fly takes daily snapshots of every volume and keeps them for 5 days by
  default (checked in Fly's volume documentation on 2026-10-07); that is the
  backup.
- If the database can't be opened at startup, the server fails loudly rather
  than serving an empty café.
- The world task never touches the disk directly, so a slow write can't stall
  the simulation.
- The commits that carry it out will be linked here as they land.
