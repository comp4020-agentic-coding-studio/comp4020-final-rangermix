# Findings: review of slice 19, "The balcony ends with the café"

Brief: [slice-19-brief.md](slice-19-brief.md). Read cold on 2026-11-08,
reviewing `a6eea05..da7edd6` on `slice-19-balcony-ends`.

I built and ran code only in throwaway copies outside the repo
(`.claude/jobs/…/review19/`):

- `git archive da7edd6`, the slice;
- `git archive a6eea05`, `main` before it, for its client;
- two copies of the slice's client with `ends()` moved 0.3 tiles: one
  short of both walls, one past them.

Nothing in this checkout changed except this file. Nothing live was
touched: not the café, not Fly. The café ran on port 18930 with a fresh
`DATA_DIR`, seeded first with `CAFE_DEMO_PASSWORD=catppuccino cafe demo seed`.
It was stopped by its own PID each time I switched its `CLIENT_DIR`, and
at the end.

**Count:** 0 critical, 1 major, 3 minor, 3 nits.

## What was run

- **Server tests.** `cargo test` passed in the copy: 358 unit tests (1
  ignored), and the integration tests (5, 3, 4, 3, 1).
- **Client tests.** `vitest run` passed 382 tests in 29 files. Both
  typechecks (root and client) were clean, and so was `vite build`.
- **Browser checks.** The whole `spec/` ran against the copy's café, with
  `APP_URL=http://localhost:18930 APP_DEMO_PASSWORD=catppuccino`: 110
  passed, 1 skipped (15 files, 1 skipped). Three more runs of
  `spec/balcony.test.ts` used other clients:
  - against `main`'s client (`a6eea05`): fails at 2560×1080 and
    2560×540, passes at 1920×1080 and the click check;
  - against the client 0.3 tiles past the walls: fails at both wide
    windows;
  - against the client 0.3 tiles short of the walls: passes, all of it.
- **Mutations, unit tests.** I edited `client/src/backdrop.ts` in the copy
  and ran `backdrop.test.ts`, `render.test.ts` and `contrast.test.ts`
  against each change:
  - `ends()` run on 8 tiles, 0.1 and 0.2 tiles past, 0.1 and 0.3 tiles
    short;
  - the returns dropped, drawn after the terrace, or drawn solid;
  - `drawEnds` dropped;
  - the returns' posts set on the walls' lines (`GAP = 0`);
  - the returns' posts dropped, or their handrail dropped;
  - the windows' trim at the ends taken out.

  Every one failed at least one test, except the last (finding 5).
- **Scratch unit probes.** These were throwaway `test/zz-*.test.ts` files
  in the copy's client, deleted afterwards. They drive the real
  `backdrop()`:
  - crops of both ends rendered to PNG, by day and by night;
  - the same for other `[deck]` values: `rail = 0`; `storey = 0`; a bare
    deck; `out = 1.6` with `posts = 3`; `out = 4`, `rail = 32`,
    `posts = 0.5`; no `[deck]` at all;
  - every pixel the balcony draws, against the ends' lines, for each of
    those decks;
  - terrace things placed near and past each end;
  - 7,398 one-pixel spans along both ends, from scratch, at light 0, 0.5
    and 1, against a wide span;
  - `main`'s `backdrop.ts` against the branch's over 1920×1080's visible
    span;
  - the panels' contrast over every colour the backdrop really draws.
- **Playwright probes.** These were throwaway scripts against the copy's
  café, in Playwright's Chromium:
  - the street canvas against `backdropAt` at both ends, and the seam:
    - at 4×, 3×, 2× and 1×;
    - by day, at the evening's 0.5 and by night;
    - through a resize mid-visit;
  - layout B at 390×844, panned to each end by keyboard, by day and by
    night;
  - the dark edge down each end, to the window's foot, at 1× and 4×;
  - where the click check's points on the returns land;
  - the same 1920×1080 points against `main`'s client and the branch's;
  - long tasks on a light turn and a ten-step resize, with the CPU slowed
    4×, three runs each at 1920×1080 and 2560×1080.

## Findings

### 1. Major: both readers accept terrace things placed past the balcony's ends, and draw them standing on the street

**What's wrong.** The ends are now fixed:

- the left arm runs from y = 1 to the outer corner;
- the front arm runs from the outer corner to x = width.

Neither reader checks where a terrace thing stands along the deck's edge,
only how far out it is:

- `client/src/street.ts:144-148` checks `thing.out + 0.6 > deck.out`;
- `server/src/content.rs:314-319` checks `o + 0.6 <= out`.

So a `[[terrace]]` line both readers accept can draw a thing past an end:

- half off the deck;
- or wholly off it, standing in the street;
- with its shadow, in the deck's stone darkened, laid on the street.

Before this slice the deck ran on past the window, so any `along` was on
the deck. Fixing the ends added a bound that nothing holds. `docs/design.md`
says, at lines 657-659: "Both readers refuse a `[deck]` whose rail would rise
behind the floor's slab, or whose terrace would overhang it". That's no
longer so.

The build met this case. "Shows the terrace past the room's canvas"
(`client/test/backdrop.test.ts:95-99`) had placed its planter at
`along = FLOOR.width + 2`, two tiles past what is now the end. It was moved
to `FLOOR.width - 0.6`, which suits the test, but no rule came with it. Today's
`street.toml` is fine: every thing stands well inside.

**How I saw it.** A scratch probe parsed each line below with
`parseStreet` (accepted), then drew it. I counted what it drew over bare
street, where the backdrop without the thing shows only the street:

| Terrace line | Pixels over bare street | Of them, the deck's shadow |
| --- | --- | --- |
| planter, front, `along = 14.5`, `out = 1.5` | 744 | 34 |
| table, left, `along = -1`, `out = 1.5` | 542 | 134 |
| bench, left, `along = 0.5`, `out = 1.3` | 76 | 0 |
| planter, front, `along = 12.8`, `out = 1.5` | 55 | 0 |

The last two are inside the arms by their spot. They reach past the end
by their own length: the bench is 2.4 tiles long, the planter 0.9 wide.

Rendered, a planter at `along = 13.4` stands half past the front end. It
sits in front of the return's glass, with its other half and its shadow
over the street.

The server reader's own test builds its street with `along = 4.0`, and
nothing reads `along` again (`server/src/content.rs:329`).

**What "fixed" looks like.**

- Both readers refuse a terrace thing whose blocks or shadow reach past
  the deck along its edge:
  - by the left edge, `along` at least the thing's reach along y;
  - out front, `along` plus that reach at most `width`;
  - each kind's reach along its edge from `SHADOW_UNDER` and its blocks
    (the bench's is 1.3; the planter's 0.55).

  The far ends of the arms, where they meet at the outer corner, take the
  same rule. They were never held either.
- A reader test and a server test refuse a thing past each end, and
  accept one just inside.
- The terrace render test's planter stays where it now is, with the rule
  holding why.
- design.md's sentence is then true again.

### 2. Minor: the browser check passes with the balcony stopping 0.3 tiles short of both walls

**What's wrong.** The check's comment says neither a balcony running on
nor one "cut short of the wall can pass" (`spec/balcony.test.ts:97-100`).
The plan's decision 6 says the same: "one cut short of the wall would
fail the second" (`docs/notes/plan-slice-19-balcony-ends.md:94-100`).

The "inside" points stand 0.35 tiles in from each end's line:
- down the building, at lines 158 and 161;
- on the deck, 0.4 tiles in, at lines 172 and 173.

So a balcony that stops up to 0.35 tiles short of each wall still has
balcony at every inside point. That is 5.6 room px, 22 screen px at 4×.
Its "past" points are street either way, so it passes.

**How I saw it.** I built a client with `ends()` returning
`{ back: 1.3, right: FLOOR.width - 0.3 }` and served it from the same
café. `spec/balcony.test.ts -t "ends the balcony"` passed: 3 passed, 1
skipped (the click check, filtered out). The same client 0.3 tiles past
the walls failed at 2560×1080 and 2560×540.

At 2560×1080 the short client's front end shows the gap plainly. The
glass's wall post stands off the plain wall, with a wedge of street and
tower between them.

The unit tests do catch this, down to 0.1 tiles short:
- the dark-edge test;
- the returns' post test;
- slice 18's render tests of what the room covers.

So it's held, but not where the check and the plan say.

**What "fixed" looks like.** The inside points sit within a room pixel of
each line: for example 0.05 tiles in, at the deck's level and down the
building. Better, at a few heights, find where the street gives way to
the balcony along the line across each end, and hold that within a room
pixel of where the wall's line falls through `tileAt`. Then the check is
seen failing against the short client as well as `main`.

### 3. Minor: at 1920×1080 the check holds nothing past the ends, though that window shows the street there

**What's wrong.** At 1920×1080 every "past" point the check takes is off
the window (`spec/balcony.test.ts:154-171`). So `seen.past` is empty there,
and the threshold lets that pass: `toBeGreaterThan(width > 1920 ? 20 : -1)`
(line 182).

The comment and the execution log give the reason
(`docs/notes/plan-slice-19-balcony-ends.md:174-175`): "At 1920×1080 each
end stands about 6 px past the window's edge, so that size can't tell the
run-on from the ends", and "only the glass's returns show there".

Only the ends' outer corners stand past the window's edge. Each end runs
back along its wall's line to the room's canvas. Between that line and
the window's edge, above the return's glass, is a strip:
- `main`'s run-on drew the deck there;
- the branch draws the street there.

The spec's line names 1920×1080 among the windows where "past each end
the street's canvas shows the street". At that size it is held only by
the seam and the inside points.

**How I saw it.**

- **The backdrop.** A scratch probe compared `main`'s `backdrop.ts`
  (`a6eea05`) with the branch's over the span 1920×1080 shows (40 room
  px either side of the room's canvas). 420 room pixels, off the room's
  canvas, are the street on the branch but the balcony on `main`, by day
  and by night. Examples: `(-24,157)` on the left, `(439,138)` on the
  right.
- **The page.** At grid spot (-0.2, -0.3) at the deck's level, screen
  (64, 641), the street canvas shows:
  - `#d9ced5`, the deck's stone, with `main`'s client;
  - `#9da3bd`, the street, with the branch's.
- **The check's own points.** A probe of the check's `look` points at
  1920×1080: 0 past either end, 39 and 43 inside.

**What "fixed" looks like.** Points on each side that 1920×1080 shows
past the end, clear of the return:
- on the left, the deck's level at y just under 1, x between the deck's
  middle and the floor's line, as (-0.2, -0.3);
- on the front, the same past x = width, above the return's top.

The threshold then asks for some at 1920×1080 too. The check should be
seen failing against `main`'s client at all three sizes, and the log's
sentence corrected.

### 4. Minor: the deck's two ends have no edge line where it meets what's behind it

**What's wrong.** ADR 0019 gives each piece a one-pixel line in its own
colour darkened, where it meets what's behind it. The deck has that
line along its outer edges (`edgeLine`, `client/src/backdrop.ts:142`).
The floor's slab foot line runs along its inner edges (line 123).

Its new ends have no line:
- along y = 1, from the outer edge to x = 0;
- along x = width, from y = height to the outer edge.

- **Today's deck.** The return's glass stands on each end. Its foot is
  where the stone meets the tinted street, with no line, where the front
  glass's foot has the deck's edge line under it.
- **`rail = 0`.** This is a `[deck]` both readers accept and the brief
  names. The stone ends bare against the street. It's the deck's only
  edge drawn that way, by day and by night.

**How I saw it.** A scratch probe sampled 8 points along each line, at
the slab's foot, for the deck's edge colour (`shade(edge, OUTLINE)`):

| Line | With today's rail | With `rail = 0` |
| --- | --- | --- |
| y = 1 | 0 of 8 | 0 of 8 |
| x = width | 0 of 8 | 0 of 8 |
| the outer left edge | 8 of 8 | 8 of 8 |

The crops of the left end with `rail = 0` show the stone's corner meeting
the pavement's band with no line. The inner edge, by contrast, carries
the slab's dark foot line.

**What "fixed" looks like.** `edgeLine`, or a short `outline`, along each
end at the deck's level, in the same colour as the outer edges. It's
drawn before the returns, so the glass tints it as it tints everything
behind it. Add a test of it at both ends, with the rail and without.
The user, judging the screens, may prefer it as it is, but that's then
their call, written down.

### 5. Nit: the windows' trim at the ends never fires, and nothing tests it

**What's wrong.** `drawBuilding` now bounds each window by `along[f]`, so
"its ends at the café's walls … trim one that would cross them"
(`client/src/backdrop.ts:187-194`). The execution log says one "is
trimmed inside the face" (`docs/notes/plan-slice-19-balcony-ends.md:153`).

But the ends are the walls' lines, whole tiles: `back = 1` and
`right = FLOOR.width`. A window spans `g + 0.15` to `g + 0.85` in its own
tile, so none ever crosses an end:
- at the left, `w0 = max(1.15, 1.1)`;
- at the front, `w1 = min(12.85, 12.9)`.

Only the corner's trim does anything, as before.

**How I saw it.** Mutation: the bounds put back to slice 18's
`[-Infinity, yo]` and `[xo, Infinity]`. All 133 tests in the three files
pass.

**What "fixed" looks like.** Either:
- the comment says the corner trims a window, and the ends, being whole
  tiles, never need to;
- or a test with a non-whole end holds the trim, if it's meant to stay
  general.

### 6. Nit: the click check's points on the left return, at 1920×1080, land on the "Your cats" panel

**What's wrong.** The click check adds six points on the returns
(`spec/balcony.test.ts:259-274`).

- **Where they land.** At 1920×1080, by mouse and by touch, the three on
  the left return all hit `#cats-panel`: (102,669), (64,688) and
  (26,707). The three on the front return hit `#stage`.
- **Why the check passes anyway.** The line it holds is true by
  construction:
  - the returns lie wholly outside the room's canvas at any size, at
    room x −40.3 to 0 and 400 to 440.3;
  - the street's canvas takes no pointer events (`client/src/style.css:193`);
  - so nothing can reach the café through a return.

The comment says "whatever a click reaches there". That's accurate, but a
reader would take these for clicks on glass.

**How I saw it.** A Playwright probe ran the check's own point formula
and `document.elementFromPoint` at 1920×1080.

**What "fixed" looks like.** Say in the comment why no click can reach
the café there: the street canvas's `pointer-events: none`, and the
returns' position outside the room's canvas. Or set the panels aside
before clicking, as the ends check does.

### 7. Nit: loose ends in the docs and the code

- **`design.md` came last, not with the change.** The root `CLAUDE.md`
  says to edit `docs/design.md` "in the same commit as the work that
  follows from it". The plan's decision 7 says the same ("design.md's
  entry is edited in the same commit as the change"). The entry was
  edited in `da7edd6`, the last task. For four commits (`297a253` to
  `5799862`) it said the balcony runs on to the window's edges while the
  code ended it.
- **The prompt log has no entry yet** for "1A 2A 3A" or the build. Its
  last entry is the study and proposal. Slice 18's review found the same
  (its finding 9), answered as coming with the merge.
- **Two unused parameters.** `drawDeck` and `drawRail` still take `span`
  and no longer use it, now that `reach(span, deck)` has gone
  (`client/src/backdrop.ts:102`, `:239`).
- **Stray line breaks.** The new sentence in `content/street.toml`'s
  comment leaves "Its" alone at a line's end (line 37). The design.md
  entry has "Without" alone on a line (line 647).

## What I checked and found sound

- **The ends' lines.** `ends()` returns `{ back: 1, right: FLOOR.width }`,
  the same for every span. The building, the deck, the end edges, the
  returns and the front glass all take their ends from it, and
  `REACH_STEP` and the span-corner sums are gone.
  - For today's deck and five other `[deck]` values, nothing is drawn
    past the ends' vertical lines on screen: 0 pixels by day and by
    night. The other decks: `rail = 0`; `storey = 0`; a bare deck;
    `out = 1.6` with `posts = 3`; `out = 4`, `rail = 32`, `posts = 0.5`.
  - With no `[deck]`, no balcony is drawn: the terrace stands on the
    street, as before slice 18.
- **Nothing cut short.** The deck, slab, building and glass reach each
  wall's line. The wall posts stand 0.07 tiles short, by design, and in
  the 2560×1080 screen they meet the walls' edges with no gap. The
  mutations at 0.1 and 0.3 tiles short each fail several unit tests.
- **The dark edge.** It runs from the deck's top down through the slab
  and the building to the window's foot, at both ends:
  - at 1× (2560×540): 204 and 212 rows, every one;
  - at 4× (2560×1080), by day and by night: 70 and 78 rows, every one.

  It's drawn only over the slab and the building, never over bare street,
  for all four combinations of rail and storey.
- **The corner.** The outer corner keeps its single corner post and slab
  edges.
  - The left return starts at the left arm's first post, at
    (xo + 0.08, 1).
  - The front return ends at the front's first post, at
    (width, yo − 0.08).

  So each return meets the front glass at a post that already stands
  there, with no gap and no doubled post. That holds for `posts = 2`,
  `3` and `0.5`. Post positions for today's deck are unchanged from
  slice 18.
- **The returns.** Each pixel is what's behind it tinted by `deck.glass`.
  - **Order.** The returns are drawn before the terrace, and nothing
    behind them comes after. The order mutation fails the "terrace thing
    in front" test.
  - **Glass behind glass.** Where the front glass stands in front of a
    return on screen, 226 pixels are tinted twice. That's glass seen
    through glass, as it should be, and each is still one solid colour.
  - **At night.** Visible by their lighter handrail and the glass's lift
    over the street.
  - **The room.** The posts and handrails stay off what the room covers:
    slice 18's two render tests pass, and fail with `GAP = 0`.
  - **No rail.** `rail = 0` draws no returns.
- **The two canvases agree.** At both ends the street canvas equals
  `backdropAt` everywhere sampled, and the seam agrees:
  - 2,395 to 4,576 points at the ends per case;
  - 399 to 1,616 seam points.

  The cases:
  - 4×, 3×, 2× and 1×;
  - light 0, 0.5 and 1;
  - after resizing a 3000×1100 window to 2100×700, then 2700×1000;
  - layout B panned fully left and right, by day and by night.

  The 7,398 one-pixel spans along both ends, built from scratch, equal
  the wide span, at all three lights. The cache key, the cut from a wider
  span and the cache's order are unchanged and still hold.
- **Crispness.** Every run of the backdrop is `#rrggbb` (the crisp test
  passes with the returns drawn). The returns fill by `spans()` and
  `fillRect` only, and `darken` reads only `#rrggbb` (the face colours).
  `shade`'s `rgb(…)` goes only to `poly`, `outline` and `block`, which
  the raster's `fillStyle` normalises.
- **Contrast.** The backdrop draws 260 distinct colours at light 0, 0.5
  and 1, the twice-tinted glass included. Through the panels' glass, in
  both themes, normally and dimmed, the worst text contrast is 5.10:1.
  The contrast test's own colour set models one tint, but the real set
  passes too.
- **The click check's other points.** The 30-plus balcony points on the
  room's canvas still take no click or tap, and send nothing.
- **The phone.**
  - **Layout A.** As before: the ends lie just past the screen's edges.
  - **Layout B.** Panned by keyboard to each end, the room's canvas sits
    at 0 and −810. The ends stay off-screen (the left corner at −125, the
    front corner at 515 on a 390-wide screen), as the study said. The
    slice's screens show the same.
- **Cost.** Measured as slice 18 was: Chromium, the CPU slowed 4×, a
  light turn from 16:59:35 into the evening, and ten 10-px resize steps.
  - At 1920×1080: a light turn takes 103–105 ms, and the resize has no
    long task.
  - At 2560×1080: 143–144 ms, and one resize task of 73–75 ms.

  Both match the plan's figures and are within the spec's bound.
  `ends()` is called only when a backdrop is built. Nothing new runs per
  frame.
- **The checks that changed.**
  - The new "where the balcony ends" tests fail on every misplaced end I
    tried, from 0.1 tiles past or short to 8 tiles run on.
  - `onFace` bounded by the walls' lines fails a building drawn past
    either end.
  - The one-pixel test's far points now hold the street's own pixel, and
    fail on a run-on.
  - The deck-line samples at 1.5 tiles and more past the ends are right
    to clear the returns, which reach 1.22 tiles past on screen.
  - The terrace planter's move is sound in itself (finding 1 is about
    the rule behind it).
- **The screens.** All ten are from the slice's code, at the sizes the
  spec names, by day and by night: 2560×1080, 1920×1080, both ends close,
  and the phone's layouts. The panned phone screens say why they show no
  end.
- **The kept rules.** Nothing here touches speech, storage, the server,
  the cap, the walkway or trust. The balcony stays scenery: the street
  canvas takes no pointer events, and no click on it sends anything.
  Cats are untouched.

## Also noticed (not counted)

In layout B, opening a ring by the room's left edge slides the room
right to fit the ring (`stage.shiftBy`, from `4e54ca4`). Layout B's
street canvas has no side margin (`streetMargin` gives `x: 0` when the
room is wider than the screen), so a 68-px strip of bare page shows
beside the room until the ring closes. I saw it while walking to the left
end by taps. It's older than this slice and doesn't change with it.

## Not checked

- The live café and the Fly app (the brief's bar).
- The slice's `shoot.mjs`, which wasn't run again; I read its screens.
- The phone's light-turn cost at 6×, and `main`'s cost again (the
  plan's figures for `main` were taken as given).

## Answers

By the builder, 2026-11-08. Each fix was test first, seen failing before
its code.

1. **Fixed** ([`38b647d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/38b647d)). Each terrace kind's reach round its spot,
   blocks and shadow, is now one table, `TERRACE_REACH` in
   `client/src/street.ts`. The deck's shadows are drawn from it at the same
   sizes as before. Both readers hold every thing inside the arms by it:
   - by the left edge, `along` from 0 (the street wall's line) to the outer
     corner, `height − 1 + out`;
   - out front, from the outer corner, `−out`, to the plain wall's line,
     `width`.

   The server's content test mirrors the table in Rust, and a client test
   reads the server's source and holds the two equal (seen failing with
   the chair's value changed there). Tests first in both readers: the
   review's four lines and two past the outer corner refused, three just
   inside accepted. Seen failing on both before the rule. The terrace
   render test's planter stays where it was moved, and the rule now holds
   why. design.md's sentence on what the readers refuse is true again,
   and names this.
2. **Fixed** ([`c784ffc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c784ffc)). The browser check's points now stand 0.08
   tiles either side of each end's line down the building (1.3 room px,
   clear of the dark edge on the line), as well as 0.35 tiles off it. The
   reviewer's client 0.3 tiles short of both walls, built again here, now
   fails at 2560×1080 and 2560×540 ("the street inside the balcony's
   ends"), and the branch passes. At 1920×1080 the ends' lines stand past
   the window's edges, so a short balcony there is held by the unit tests
   the review names (the end edges, the returns' posts, what the room
   covers). The check's comment now says so rather than claiming it.
3. **Fixed** ([`c784ffc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c784ffc)). Six points on the deck's level just past
   each end, at room x −38 to −30 and 427 to 434: inside what 1920×1080
   shows, 6 to 12 room px above the glass's return there. They're the
   street on the branch and the run-on deck on `main`. At 1920×1080 the
   check now asks for more than five points past the ends (it finds six),
   and fails against `main`'s client at all three sizes. The execution
   log's sentence is corrected below.
4. **Fixed** ([`18e493c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/18e493c)). The deck's edge line now runs along both
   ends, the street wall's line from the outer edge to the wall and the
   plain wall's from the wall to the outer edge, tile by tile as the outer
   edges are. It's drawn before the slab's foot line, which keeps the
   corner where they meet: drawn after, the end line's last pixel fell
   under the room's slab, which slice 18's render test found. The glass's
   returns tint it. Test first, with the rail and without, at points
   clear of the wall posts and the front glass, which stand in front of it
   on screen. Seen failing with no line. The new screens show it faintly
   along each return's foot; whether it stays is the user's call when
   judging them.
5. **Answered** ([`8c1cb94`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8c1cb94)). The trim stays general, but the comment
   now says only the corner trims a window, since the ends are whole
   tiles and no window crosses one. Nothing is meant to rely on it.
6. **Answered** ([`8c1cb94`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8c1cb94)). The click check's comment now says why
   no click on a return can reach the café: the returns lie wholly
   outside the room's canvas, over the street's, which takes no pointer
   events. It also says that at 1920×1080 the left return's points land on
   the "Your cats" panel. The check holds that nothing reaches the café
   from them, which is the line in the spec.
7. **Answered.**
   - design.md came last: true, and the CLAUDE.md rule was broken for four
     commits. It's written down here and in the execution log. The prompt
     log's entry comes with the merge, as slice 18's did.
   - The unused `span` parameters of `drawDeck` and `drawRail` are gone,
     and the lines left alone in `street.toml`'s and design.md's
     paragraphs are rejoined ([`8c1cb94`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8c1cb94)).

**Also noticed:** the bare strip beside layout B's room while a ring is
open by its left edge is older than this slice (`stage.shiftBy`, from
`4e54ca4`). It's recorded in the execution log as a follow-up, not
fixed here.

After the answers:
- the client's 385 tests and both typechecks pass;
- `cargo test`'s content tests, `cargo fmt` and clippy pass;
- the whole `spec/` runs against a café built from the branch;
- slice 19's screens were shot again with the ends' lines.
