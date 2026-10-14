# 02. What the night left behind

- **Status:** Approved 2026-10-14, with the proposed default for its open question (the board names people by username, only for what a cat did with them)
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-02-chalkboard.md`
- **Design:** The room ("Traces stay until someone tidies them", "The
  chalkboard"); The client (the readable chalkboard on desktop and phone);
  Persistence ("traces and chalkboard lines" kept); Checks ("an empty night
  leaves traces and chalkboard lines");
  [ADR 0002](../adr/0002-make-a-cat-cafe-where-company-forms-around-the-cats.md)

## Story

The first visitor in the morning reads the chalkboard by the door: "3:12am,
Burakku knocked over the fern", "Mochi slept on Sam's lap for 20 minutes". The
fern is still on its side and toys are strewn across the floor, and they stay
that way until someone tidies them, which regulars do for each other.

## In this slice

- Chalkboard lines written by the server from what the cats do (knocking
  something over, a long nap on a lap, perching at the window, a game with
  the toys). The plan picks the list from the `cat` log events phase 3 already
  has.
- A rolling 24 hours, with the latest 8 lines shown. Lines are saved, survive
  restarts, and drop off after 24 hours, live and in a replay.
- The readable chalkboard: on desktop, the panel left of the room; on the
  phone, tapping the chalkboard opens its copy. Both are reachable by keyboard
  and read by the screen reader.
- Night traces: toys a cat scatters stay where they land until someone puts
  them back. Toppled pieces already stay down until someone stands them up
  (phase 3). Tidying is moving furniture.

## Not in this slice

- People never write on the chalkboard, and no line carries anything anyone
  said.
- Art for the chalkboard beyond what exists is slice 05's.

## Done when

| What must be true | Held by |
| --- | --- |
| An empty night leaves chalkboard lines and traces, and the same seed leaves the same night | `cargo test`, seeded (with slice 01's replay) |
| Lines older than 24 hours drop off, live and in a replay | `cargo test` |
| No line ever carries bubble text | `cargo test` |
| A new line reaches every open chalkboard within a second | `spec/` |
| Lines and traces survive a restart | `spec/` |
| A tidied trace stays tidied | `cargo test` |
| The chalkboard is readable at 1920×1080 in its panel and at 390×844 by tapping it, by keyboard, touch and mouse | browser check |
| The board reads like the café's own story, worth reading on arrival | judged: by the user, reading the live board after a real night |

## Rules it touches

- **Never store or log what anyone says.** The board stores cats' doings
  only.
- **Every action works by keyboard, touch and mouse**, at both sizes.

## Numbers

- Chalkboard: rolling 24 hours, latest 8 lines shown.

## Open questions

- **Does the board name people?** The design's own example does ("Sam's
  lap"), and usernames are already public in the café. Proposed: yes, by
  username, only for what a cat did with them.
