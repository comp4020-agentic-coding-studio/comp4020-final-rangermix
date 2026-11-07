# Brief: review of slice 18, "A balcony under the terrace"

Slice 18, by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 3a19fb8 | tar -x -C <tmpdir>`, then link or
install `node_modules`), never in this checkout. Don't use ports 8080,
8091, 18825 or 18918 (other cafés run on them); run the café on port 18919
with a fresh `DATA_DIR`, from the copy's root (it reads `content/` from
the working directory), with `CLIENT_DIR` pointing at the copy's
`client/dist`, and point the spec at it with `APP_URL`. The demo checks
need the café seeded first: `CAFE_DEMO_PASSWORD=catppuccino cafe demo
seed` with the same `DATA_DIR`, then start it, and give the spec
`APP_DEMO_PASSWORD=catppuccino` (CI's own local password). Stop only the
servers you start, by their own process IDs (never `pkill` by name).
Don't touch the live café or the Fly app.

Review what slice 18 adds: `25f0c64..3a19fb8` on branch `slice-18-balcony`
(the commits from "Approve slice 18" on).

## What to read

- **The spec:** [`docs/slices/18-a-balcony-under-the-terrace.md`](../../slices/18-a-balcony-under-the-terrace.md),
  every "done when" line and how it's held, its numbers, and what the user
  chose: the terrace stands on a balcony deck with a glass balustrade 18
  px high, and under it the café's own building carries on down ("D").
  The terrace had looked like it was floating.
- **Why:** the study, [`docs/notes/slice-18-study.md`](../slice-18-study.md)
  and its screens in `docs/notes/screens/slice-18-study/`.
- **The design:** `docs/design.md` ("The room is a diorama on its street",
  "The café is upstairs, on a balcony", "Crisp, with outlines and
  shadows"), [ADR 0019](../../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)
  (every pixel one colour, no anti-aliased shapes), and `AGENTS.md`'s
  "What the app must keep", above all "every action works by keyboard,
  touch and mouse, at 390×844 and at 1920×1080, and survives a resize
  mid-use" and "cats change through `content/`, not code".
- **The plan** and its execution log,
  [`docs/notes/plan-slice-18-balcony.md`](../plan-slice-18-balcony.md),
  which records where the build departed, above all one change to what was
  approved: the balcony and building run on past both ends of the room to
  the window's edges, not ending at the floor's corners.
- **The code:**
  - the content: `content/street.toml` (`[deck]`), `scripts/palettes.ts`
    and the `balcony` list it writes into `content/sprites/palettes.json`;
    `server/src/content.rs` (its new test);
  - the client: `client/src/backdrop.ts` (new: the street, terrace, deck,
    building and glass as one raster over any span; `reach`, `edgeLine`,
    `backdropColours`), `client/src/shapes.ts` (helpers moved out of
    `render.ts`), `client/src/layer.ts` (`Raster`'s origin and `copy`),
    `client/src/render.ts` (the floor layer from the backdrop; the
    terrace no longer drawn per frame), `client/src/stage.ts`
    (`paintStreet` from the backdrop), `client/src/street.ts` (the `[deck]`
    reader), `client/src/main.ts` (`window.cafeRoom.backdropColours`);
  - the checks: `client/test/backdrop.test.ts` (new), the changed tests in
    `client/test/render.test.ts`, `street.test.ts`, `palettes.test.ts` and
    `contrast.test.ts`; `spec/balcony.test.ts` (new), and the changed
    checks in `spec/fill.test.ts` and `spec/browser.test.ts`.
- **The screenshots:** `docs/notes/screens/slice-18/` and the script that
  takes them.

## Out of scope

The art of cats, people and furniture; slices 16 and 17 except as this
slice changes them; the study's throwaway patch. Earlier work this slice
doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **Every check that changed.** Were any changed to pass rather than to
  hold what they meant? Look hardest at slice 16's "nothing of the
  terrace over the floor" test (it moved from the drawn room to the
  backdrop), slice 13's corner test, the two browser checks that now
  read `window.cafeRoom.backdropColours()` instead of the street's
  colours, and whether those still fail when the page's own background
  shows.
- **The two canvases agreeing.** The room's floor layer and the street's
  canvas draw the backdrop over different spans. Do they agree to the
  pixel at every scale (4×, 3×, 2×, 1×), as layout B pans, on a resize,
  at the light's turns (day, evening, night)? Does `reach` reach past
  every span a stage can ask for? Does the cache (four spans) thrash or
  go stale, e.g. when the light changes but the span doesn't?
- **Crispness.** Every pixel one colour; the glass a per-pixel tint of
  what's behind it, with nothing behind it drawn after the glass; no
  canvas path; no `rgb(…)` colour given to something that reads only
  `#rrggbb` (the first build drew a black band that way).
- **Cost.** The backdrop is a raster of strings over the stage's span
  plus margins; is building it (on a light turn, a resize) a long task on
  a phone, or at 2560×1440? Is the street canvas's draw from `runs()`
  slower than before?
- **The terrace and the room.** Nothing of the balcony on the floor, the
  walls, or a figure's column; the terrace's things all standing on the
  deck; the floor's slab and shadows unchanged; clicks on the balcony
  doing nothing; the room's own drawing (figures, furniture, the pointer,
  the ghost) unchanged now the terrace isn't drawn per frame.
- **Content, not code.** A different `[deck]` (no rail, no building, a
  different reach) draws sensibly; a bad one is refused by both readers
  with a clear message.
- **The phone**: both layouts at 390×844, layout B panned to every edge,
  layout A's cut corners.

## Findings

Write them to [`slice-18-findings.md`](slice-18-findings.md), numbered,
most serious first. For each: what's wrong, where (file and line), how
you saw it (a command, a check, a screenshot), and what "fixed" would
look like. Say plainly what you checked and found sound, so a line that
holds is known to have been looked at. Leave the answers section for the
builder.
