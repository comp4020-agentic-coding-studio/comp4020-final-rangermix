# Brief: review of slice 19, "The balcony ends with the café"

Slice 19, by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold.

**How to work:**
- Work read-only: change no file except the findings file below.
- Build and run code only in a throwaway copy
  (`git archive da7edd6 | tar -x -C <tmpdir>`, then link or install
  `node_modules`), never in this checkout.
- Don't use ports 8080, 8091, 18825, 18919 or 18921: other cafés run on
  them. Run yours on port 18930 with a fresh `DATA_DIR`, from the copy's
  root (it reads `content/` from the working directory), with
  `CLIENT_DIR` pointing at the copy's `client/dist`, and point the spec
  at it with `APP_URL`.
- The demo checks need the café seeded first. Run
  `CAFE_DEMO_PASSWORD=catppuccino cafe demo seed` with the same
  `DATA_DIR`, then start the café, and give the spec
  `APP_DEMO_PASSWORD=catppuccino` (CI's own local password).
- Stop only the servers you start, by their own process IDs (never
  `pkill` by name).
- Don't touch the live café or the Fly app.

Review what slice 19 adds: `a6eea05..da7edd6` on branch
`slice-19-balcony-ends` (the commits from "Approve and plan slice 19"
on).

## What to read

- **The spec:** [`docs/slices/19-the-balcony-ends-with-the-cafe.md`](../../slices/19-the-balcony-ends-with-the-cafe.md):
  every "done when" line and how it's held, its numbers, and what the
  user chose ("1A 2A 3A").
  - The balcony, its glass and the café's building under it end where
    the café's walls end: the street wall's line (y = 1) on the left,
    the plain wall's line (x = width) at the front, whatever the window.
  - The street shows beside them, as now.
  - The glass turns both ends back to the walls.

  Slice 18 had run them on to the window's edges, and the user found
  that wrong: "it should just show the cafe corner, like we don't show
  other part of the building".
- **Why:** the study, [`docs/notes/slice-19-study.md`](../slice-19-study.md),
  and its screens in `docs/notes/screens/slice-19-study/`.
- **What came before:** slice 18's spec, its review
  ([`slice-18-findings.md`](slice-18-findings.md)) and its plan. Several
  of slice 18's findings were about how far the balcony reached and
  whether a narrow span drew the same as a wide one. This slice removes
  that machinery.
- **The design:**
  - `docs/design.md`: "The room is a diorama on its street", "The café
    is upstairs, on a balcony", "Crisp, with outlines and shadows";
  - [ADR 0019](../../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md):
    every pixel one colour, no anti-aliased shapes;
  - `AGENTS.md`'s "What the app must keep".
- **The plan** and its execution log,
  [`docs/notes/plan-slice-19-balcony-ends.md`](../plan-slice-19-balcony-ends.md).
  It records where the build departed from the plan:
  - the wall posts set 0.07 tiles short of the walls' lines;
  - the deck-line samples in the browser check moved past the glass's
    returns;
  - 1920×1080 unable to tell the run-on from the ends;
  - the cost measured.
- **The code:**
  - `client/src/backdrop.ts`: `ends()` in place of `reach`, `drawEnds`,
    `drawReturns`, `foot`, and the windows kept inside the faces;
  - `content/street.toml`: a comment only;
  - `client/test/backdrop.test.ts`: the new "where the balcony ends"
    tests, and the changed `onFace`, one-pixel and terrace tests;
  - `spec/balcony.test.ts`: the turned first check, and the returns
    added to the click check.
- **The screenshots:** `docs/notes/screens/slice-19/` and the script that
  takes them.

## Out of scope

- The art of cats, people and furniture.
- Slice 18's balcony except as this slice changes it.
- The study's throwaway patch.
- Earlier work this slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **Every check that changed.** Were any changed to pass rather than to
  hold what they meant?
  - The browser check's thresholds: past-end points are required only
    above 1920 wide.
  - Its samples moved to 1.5 tiles past the ends.
  - The one-pixel test's far points.
  - The terrace planter moved inside the deck.
  - `onFace` bounded by the walls' lines.

  Would each fail if the balcony ran on again, or stopped short of a
  wall?
- **The ends themselves.**
  - Is anything of the deck, its slab and edge line, the glass, the
    rail's posts, the building, its windows, bands or shadow, drawn past
    either line?
  - Is anything cut short of the line, leaving a gap between the
    balcony and the wall?
  - Does the dark edge run the building's whole height on screen, at
    every scale and span?
  - Does the deck's corner (the outer corner where the arms meet) still
    look right?
- **The glass returns.**
  - Each pixel a per-pixel tint of what's behind it, with nothing
    behind it drawn after the glass.
  - The terrace's things in front of them, untinted.
  - Their posts and handrails short of the walls, never under the room
    (slice 18's render tests).
  - Do they meet the front glass at its corner posts without a gap or a
    doubled post?
  - At night, are they visible?
- **The two canvases agreeing.** The room's floor layer and the street's
  canvas draw the backdrop over different spans. Do they still agree to
  the pixel at every scale (4×, 3×, 2×, 1×), as layout B pans, on a
  resize, and at the light's turns? Is the cache still sound?
- **Crispness.** Every pixel one colour, no canvas path, and no
  `rgb(…)` colour given to something that reads only `#rrggbb`.
- **Content, not code.** A different `[deck]` (no rail, no building, a
  different reach out, a different post spacing) must still end cleanly
  at the walls, with the returns and posts sensible. A deck with
  `rail = 0` draws no returns. A street with no `[deck]` draws no
  balcony.
- **The phone:** both layouts at 390×844, and layout B panned to each
  end.
- **Cost:** the plan's measurements, and whether anything new is built
  per frame.

## Findings

Write them to [`slice-19-findings.md`](slice-19-findings.md), numbered,
most serious first. For each:
- what's wrong;
- where (file and line);
- how you saw it (a command, a check, a screenshot);
- what "fixed" would look like.

Say plainly what you checked and found sound, so a line that holds is
known to have been looked at. Leave the answers section for the builder.
