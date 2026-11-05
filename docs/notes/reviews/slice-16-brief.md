# Brief: review of slice 16, "The café fills the window"

Slice 16, by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 244027f | tar -x -C <tmpdir>`, then link or
install `node_modules`), never in this checkout. Don't use ports 8080,
18825, 18915, 18916 or 18917 (other cafés run on them); run the café on
port 18918 with a fresh `DATA_DIR`, from the copy's root (it reads
`content/` from the working directory), with `CLIENT_DIR` pointing at the
copy's `client/dist`, and point the spec at it with `APP_URL`. Stop only
the servers you start, by their own process IDs (never `pkill` by name).
Don't touch the live café or the Fly app.

Review what slice 16 adds: `5a3a1df..244027f` on branch `slice-16-fill`
(the commits from "Approve slice 16" on).

## What to read

- **The spec:** [`docs/slices/16-the-cafe-fills-the-window.md`](../../slices/16-the-cafe-fills-the-window.md),
  every "done when" line and how it's held, its numbers, and what the user
  chose: a 13 by 12 floor at 32-px tiles, not a bigger tile; the bars
  floating; the terrace; cats and people as drawn; on the phone's whole
  room, the room centred and its side tips cut ("it's okay to hide a bit of
  the corner of the room for now"). The course marks at a 1920×1080
  *viewport*, not a screen.
- **Why:** [ADR 0021](../../adr/0021-grow-the-floor-and-float-the-bars.md)
  and the study behind it, [`docs/notes/slice-16-study.md`](../slice-16-study.md).
- **The design:** `docs/design.md` ("The room", "The client", "Drawing",
  "The look"), and `AGENTS.md`'s "What the app must keep", above all
  "every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use", "the server decides every
  outcome", "the door's walkway is never blocked" and "cats change
  through `content/`, not code".
- **The plan** and its execution log,
  [`docs/notes/plan-slice-16-fill.md`](../plan-slice-16-fill.md), which
  records where the build departed: the panels narrowed to 17rem, desktop
  menus kept between the bars, the music panel re-measured when its title
  wraps, the street drawn once per light and moved as the room pans, the
  saved-cat test made independent of a random draw.
- **The code:**
  - the server: `content/room.toml`, `server/src/room.rs` (`restore_saved`,
    `arrangement_json`, `read_arrangement`), `server/src/world/furniture.rs`,
    `server/src/content.rs`, their tests, `server/tests/long_gaps.rs`;
  - the client: `client/src/iso.ts` (the floor read from `room.toml`),
    `client/src/street.ts` (`streetRuns`, the terrace reader, `terraceAt`),
    `client/src/render.ts` (`drawTerrace`), `client/src/stage.ts` (the
    fit's margin, `paintStreet`, the phone's centring),
    `client/src/floating.ts` (the band between the bars, the music
    observer), `client/src/menu.ts`, `client/src/main.ts`
    (`window.cafeRoom.size`), `client/src/style.css` (the floating bars,
    the street canvas, the panels' width), `client/index.html`;
  - the content: `content/street.toml` (moved clouds, `[[terrace]]`);
  - the checks: `client/test/` (`iso`, `scale`, `stage`, `street`,
    `render`, `contrast`, `floating`), `spec/fill.test.ts`, and the
    changed checks in `spec/browser.test.ts` and `spec/music.test.ts`.
- **The screenshots:** `docs/notes/screens/slice-16/` and the script that
  takes them.

## Out of scope

The art of cats, people and furniture (slices 11 to 13); slices 14 and 15
except as this slice changes them. Earlier work this slice doesn't make
worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **The live café's save.** The live store holds an arrangement saved on
  the 12 by 10 floor, as a bare list. Does waking on 13 by 13 keep every
  piece, add the new strip's three once and never again, respect the
  furniture cap, and never put a piece on the walkway or over a cat? What
  about a save that's unreadable, or saved at some third size? Are saved
  cats on a tile now under a new piece moved?
- **Every check that held the old size.** Were any changed to pass rather
  than to hold what they meant? Look hardest at the street check in
  `spec/browser.test.ts` (it now finds its points), the slice 14 corner
  check, the low-menu check and the slice 13 rim test in
  `client/test/render.test.ts`.
- **The floating bars.** Every control in the status line and talk bar by
  keyboard, touch and mouse; their text at 4.5:1 over anything behind;
  what the status line shows when it wraps (carrying something, the café
  updated, a narrow 960 px window); the panels and menus kept clear of
  them; a resize across 960 px mid-use; layout B unchanged.
- **The street canvas.** Lined up with the room to the pixel at every
  scale (4×, 3×, 2×, 1×) and as layout B pans; redrawn when the light
  turns; its cost on a phone; nothing of the page showing at 1920×1080.
- **The terrace.** Data, not code, for a new thing of a known kind;
  nothing picks it; drawn in the hour's light; where it lands at other
  window sizes.
- **The phone's whole room.** Centred to a whole pixel at 390 and at
  other widths; every tile still reachable by touch; no sideways scroll.
- **Accessibility** of anything changed: focus order in the floating
  bars, the street canvas hidden from screen readers.

## Findings

Write them to [`slice-16-findings.md`](slice-16-findings.md), numbered,
most serious first. For each: what's wrong, where (file and line), how
you saw it (a command, a check, a screenshot), and what "fixed" would
look like. Say plainly what you checked and found sound, so a line that
holds is known to have been looked at. Leave the answers section for the
builder.
