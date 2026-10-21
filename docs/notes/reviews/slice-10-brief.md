# Brief: review of slice 10, "Catppuccin by day and by night"

Slice 10, Task 5 ([plan-slice-10-palette.md](../plan-slice-10-palette.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive d058076 | tar -x -C <tmpdir>`), never in this
checkout. Don't use ports 8080, 18490 or 18491; run the café on another
port with a fresh `DATA_DIR`, and point the spec at it with `APP_URL`.
Stop only the servers you start, by their own process IDs (never
`pkill` by name: other cafés run on this machine).

## What to read

- **The spec:** [`docs/slices/10-catppuccin-by-day-and-by-night.md`](../../slices/10-catppuccin-by-day-and-by-night.md),
  every "done when" line and how it's held.
- **Why:** [ADR 0017](../../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)
  and [visual-direction.md](../visual-direction.md) (the Catppuccin-led
  mix the day palette follows).
- **The design:** `docs/design.md` ("The client", "Numbers to tune"),
  and `AGENTS.md`'s "What the app must keep", especially "cats change
  through `content/`, not code" and "every action works ... at 390×844 and
  at 1920×1080".
- **The plan**, its decisions, review focus and execution log.
- **The code:** from `0ae465f` to `d058076`: `scripts/palettes.ts`,
  `content/sprites/palettes.json`, `content/sprites/CREDITS.md`,
  `client/src/canberra.ts`, `sprites.ts`, `render.ts`, `stage.ts`,
  `style.css`; their tests in `client/test/` (`canberra`, `sprites`,
  `render`, `contrast`); `server/src/content.rs`'s palette tests; and
  `spec/browser.test.ts`'s theme check and the backdrop check's moved
  point.
- **The screenshots:** `docs/notes/screens/slice-10/`.

Context: slice 09 (the room at an angle) is live, and on 2026-10-22 it was
turned 90° at the user's asking (`f02e67d`), so the street wall stands on
the left. That turn is not this slice's work, but this slice builds on it.

## Out of scope

The sprites themselves (slice 11), and whether the colours look good,
which is the user's to judge. Earlier work this slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **the palettes:** does `scripts/palettes.ts` write exactly what's
  committed (run it in the copy and diff)? Are the Catppuccin values right
  and credited as the licence asks? Does every slot the sprite sheets use
  exist in both sets? Is the night set's window really the glass slot that
  `render.ts` draws?
- **the light:** `lightAt` against "Numbers to tune" at every hour,
  including 0, 5, 6, 11, 12, 16, 17, 20, 21 and 23; the Canberra hour
  across daylight saving; what happens to a frame drawn as the hour turns.
- **blending and caching:** `paletteAt` for the evening, slot by slot;
  the sprite cache with the light in its key: can a sprite be drawn in the
  wrong light, or the cache grow without end? `render.ts`'s module-level
  palette set by `draw`: anything drawn outside `draw` (the sign-up card's
  avatar previews, `auth.ts`) in the wrong colours?
- **the page:** the contrast test parses `style.css`; can it pass while a
  real text colour on the page is below 4.5:1 (colours written in place,
  not through the tokens; buttons, the board dialog, bubbles, the ring's
  buttons, disabled states, placeholders)? Is anything unreadable in
  either theme at either size?
- **the checks:** can any pass without the behaviour it names? The theme
  check reads the body's background; does it hold that the page follows
  the setting, or only one colour?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-10-findings.md`.
