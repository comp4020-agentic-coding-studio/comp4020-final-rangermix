# 0003. Use a Rust server and a TypeScript canvas client

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The course fixes the shape, not the stack: one `shared-cpu-1x` machine with
256 MB of memory, one volume at `/data`, and HTTP on `0.0.0.0:$PORT`.
`PROCESS.md` has to justify the stack and its trade-offs.

The server runs a simulation that never stops as far as anyone can tell
([ADR 0006](0006-fast-forward-the-world-when-the-server-wakes.md)): it steps
the cats ten times a second while people are there and replays hours of
downtime when it wakes. The client is a pixel-art room, but markers also do a
keyboard-only pass, use a 390×844 phone viewport, resize mid-use and try a slow
connection, which is text input, focus and layout work more than drawing.

The user proposed a compiled server language, Rust, knowing its benefits and
costs.

## Options

1. **A Rust server and a TypeScript client.** The server uses tokio and axum;
   the client draws the room on a plain Canvas 2D, with the browser's own HTML
   for bubbles, menus, the talk box and a screen-reader announcer. Message
   types are defined once in Rust and their TypeScript is generated with
   ts-rs. It gives tiny memory use, a fast deterministic simulation for
   fast-forwarding, and a strict compiler that catches a class of agent
   mistakes before any test runs, while leaving text and accessibility to the
   browser. It costs two languages, slow Rust builds (twice per push once CI
   deploys: CI's test image, then Fly's remote build), and a generation step
   between them.
2. **TypeScript everywhere**, with a Node server and the same client. One
   language, types shared with no generation step, fast builds, and the repo's
   harness is already TypeScript; Node fits in 256 MB at this scale. It gives
   up the user's lean and Rust's guarantees, and fast-forward is slower,
   though fine at these numbers.
3. **Rust everywhere**, compiling the client to WebAssembly with an engine
   such as macroquad or Bevy. One language, and the client could reuse the
   simulation. But a canvas-only engine fights the browser on exactly what
   markers test (keyboard focus, text input on a phone, screen readers), the
   downloads are bigger, and iteration is slower.

## Decision

We will write the server in Rust (tokio and axum) and the client in TypeScript
drawing on a plain Canvas 2D, with HTML for text, menus and announcements, and
share message types by generating TypeScript from the Rust definitions with
ts-rs.

## Consequences

- Two toolchains (cargo and pnpm). The Dockerfile becomes three stages: build
  the client, build the server, copy both into a slim image.
- Rust build time slows each deploy; dependency caching in the Docker build
  keeps it bearable.
- ts-rs (version 12) is a derive macro, the mechanism serde uses: it builds
  each TypeScript declaration from the Rust type and honours serde's
  attributes, so the TypeScript describes exactly the JSON on the wire, and
  `cargo test` writes the files. It maps 64-bit integers to `bigint` by
  default while `JSON.parse` yields numbers, so `TS_RS_LARGE_INT` is set to
  `number`. Checked against the ts-rs README on 2026-10-07.
- Generated TypeScript is never edited by hand, and a check fails if it drifts
  from the Rust types.
- Revisit if build times make iteration painful, or ts-rs can't express a
  message the protocol needs.
- The commits that carry it out will be linked here as they land.
