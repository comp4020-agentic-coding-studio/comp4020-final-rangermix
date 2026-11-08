# The flaky edge check on a phone

The browser check "carries the street past the room's edges in the phone's
bigger room as it pans to each side" (`spec/fill.test.ts`, slice 16) failed
twice in CI while slice 17 part 2 merged. It turned `main` red and skipped
the deploy, the second time on a push that changed only docs. Investigated
and fixed on 9 November 2026, in session `09a2c48d`, continuing the
furniture sets' session `cb735744`, which found the cause before its budget
ran out.

**Status:** fixed in the check. The café was right and the check was wrong.

## What failed

| Run | Commit | Panned | Point | Colour |
|---|---|---|---|---|
| 42512326708, attempt 1, 9 Nov 06:03 AEDT | `2714714`, "Merge slice 17, part 2: three furniture sets a demo account lays out" | right | (387, 522) | `#1e1e2e` |
| 42515669553, 9 Nov 06:41 AEDT | `8a59266`, "Record slice 17 part 2 checked on the live café, and log it" (docs only) | down | (2, 602) | `#1e1e2e` |

Both passed locally every time the furniture sets' session tried them (on
their own five times, in CI's file order, with the café's clock at 05:59). It
read them as a slow runner sampling the screen 400 ms after the last arrow
key, which was wrong.

## Why

The check pans the 390×844 phone's room to each side, then samples the
screen's edges every 40 px, 2 px in, and failed on any colour in
`["#eff1f5", "#1e1e2e"]`: the page's background in the light theme and in
the dark.

- The check runs at 10:00 in Playwright's default light theme, where the
  page's background (`--paper` in `client/src/style.css`) is `#eff1f5`.
  So `#1e1e2e` at an edge could never be the page.
- By day, the only `#1e1e2e` the café draws is Burakku's coat
  (`day.coats.black[1]` in `content/sprites/palettes.json`). By night the
  street uses it too.
- The room on a phone is wider than the screen, so a cat at the room's side
  can stand on the screen's edge. When Burakku stood on a sampled point, the
  check failed. Where the cats wander is random, so it failed now and then.

Reproduced locally, against a café built from `8a59266`: a throwaway probe
panned left and ran both rules. The colour list flagged (387, 322) as
`#1e1e2e`, where a crop showed a dark shape cut off by the screen's right
edge beside the table, while the canvases drew every edge point.

## The fix

`bareEdges` reads the room's and the street's canvases' own alpha at each
edge point. A point is bare, the page showing, only where neither canvas
draws anything. A colour drawn by the café can't pass for the page, or the
page for it.

- With the street's canvas hidden, the page shows past the room's corners,
  and the check sees more than 10 bare points. This is the failure slice 16
  guards against, and it fails the check.
- The count of points looked at (more than 80 across the four pans) comes
  from the same pass, so the check still fails if it looks at nothing.
- The whole spec passed against a fresh local café from this tree: 124
  passed, `restart.test.ts` skipped as before.

The desktop check beside it compares each edge pixel with what the backdrop
draws there (`cafeRoom.backdropAt`), not with a list. On 1920×1080 the room
doesn't reach the window's edges, so no cat can stand on one.
