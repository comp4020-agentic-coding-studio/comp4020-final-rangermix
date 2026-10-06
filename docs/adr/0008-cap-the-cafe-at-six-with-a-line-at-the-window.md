# 0008. Cap the café at six with a line at the window

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The café is for people who miss having a cat and for a small group of regulars
([ADR 0002](0002-make-a-cat-cafe-where-company-forms-around-the-cats.md)), but
the showcase brings a full room at once. On the 390×844 phone viewport a room
about twelve tiles wide fits at a readable pixel size. Real cat cafés cap their
visitors for the cats' sake, and the brief itself gives "a room capped at
twelve people" as an example of a checkable promise.

## Options

1. **A cap, with a window to watch from.** It protects the cats, keeps the
   room readable on a phone and keeps regulars recognisable, and waiting
   becomes visible and social. The cost: at the showcase most people wait,
   so the window has to be worth standing at.
2. **No cap, with the cats reacting to the crowd.** Everyone gets in, but forty
   avatars and their bubbles pile up on a phone screen and the cats are simply
   overwhelmed.
3. **Several cafés, each with its own cats.** It scales, but needs many more
   cats and splits the regulars, weakening "their café".
4. **One café with several capped rooms.** Room to grow, but more art and
   walking routes across rooms now.

## Decision

We will cap the café at six people inside, for now, and show everyone else as
avatars at the front window, seeing the same view and able only to talk, in a
first-come, first-served line.

## Consequences

- People waiting stand outside the street window where everyone inside sees
  their faces; a window seat lets cats go and look at them.
- The window shows as many waiting avatars as fit, and a count for the rest.
  When a seat frees, the first in line walks in through the door.
- The cap is enforced on the server and is a tunable number; six is a starting
  value.
- The data model leaves room for more rooms later (option 4), as the roster
  grows, without building them now.
- A cap needs a rule for seats held by people who have wandered off
  ([ADR 0009](0009-free-a-quiet-seat-only-when-someone-is-waiting.md)).
- The commits that carry it out will be linked here as they land.
