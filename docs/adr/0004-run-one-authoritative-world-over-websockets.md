# 0004. Run one authoritative world over WebSockets

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

Real-time, by the brief's definition, means one person's change reaches every
other open session within about a second, with no reload, and the mechanism has
to be explained. The user fixed two things up front: the server is the source
of truth for everything live (cat movement and actions, furniture, people's
actions), and the transport is a WebSocket in both directions.

The cats act continuously, people's actions can collide (two people grabbing
the same sofa), and markers test a slow connection and a session resumed the
next day. At most six people are inside, with a line watching from the window
([ADR 0008](0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)).

## Options

1. **One world task that owns everything.** Connections send intents over a
   channel; the task handles them one at a time and steps the simulation ten
   times a second. A client gets a snapshot on connect, then ordered events.
   Walks are sent as paths (start time and speed) and animated locally. A
   connection that falls too far behind is dropped and reconnects to a fresh
   snapshot. It gives no locks, one order of events everyone agrees on, few
   messages, smooth motion on slow links, and simple recovery. It costs that
   everything passes through one task (ample at six seats), that clients must
   interpolate, and that the snapshot must be complete.
2. **Broadcast every position at the tick rate.** The simplest client, but ten
   messages a second per client whatever is happening, jitter on slow links,
   and far more bandwidth.
3. **Shared state behind locks**, mutated by many tasks. Parallelism this
   café doesn't need, at the price of lock-ordering bugs and outcomes that
   depend on timing.
4. **Server-sent events down, plain requests up, or polling.** Simpler
   infrastructure, but two channels to keep in step or polling's latency, and
   the user chose WebSockets.

## Decision

We will run a single world task that owns the café and decides every outcome,
and stream a snapshot followed by ordered events over one WebSocket per tab, as
JSON messages whose types are generated from Rust
([ADR 0003](0003-use-a-rust-server-and-a-typescript-canvas-client.md)).

## Consequences

- "First grab wins" for furniture comes free: commands are handled in arrival
  order.
- Rate limits (token buckets per connection) sit in front of the world task,
  so a flood never reaches it.
- Client and server are stamped with the same build id, checked on connect, so
  a tab left open across a deploy reloads instead of speaking an old protocol.
- People at the window receive the same stream but may only send speech.
- Reconnects heal by snapshot rather than replaying missed events, so there is
  no replay logic to get wrong.
- Revisit if one task can't keep up, which isn't expected at six seats.
- The commits that carry it out will be linked here as they land:
  [`77dbe99`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/77dbe99) (first grab wins, from the one order of events).
