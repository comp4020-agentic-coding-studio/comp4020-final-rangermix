# Findings: review of slice 12, "Walking where you look"

Brief: [slice-12-brief.md](slice-12-brief.md). Read cold at `2bebc92` (the
code from `42958ec`). Built and run only in throwaway copies
(`git archive 2bebc92`, and `git archive 42958ec` for comparison), never in
the repo. Nothing live was touched.

**Count:** 0 critical, 3 major, 6 minor.

## What was run

- `pnpm typecheck` and `pnpm -C client check`: 164 client tests, green.
  `cargo test`: 303 unit tests (1 ignored), then 5, 4, 3 and 1, all green.
  `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings`: clean.
- The spec against a local café (`PORT=18612`, fresh `DATA_DIR`): 69 passed,
  1 skipped (`restart.test.ts`, which needs `APP_RESTART`). All 26 browser
  checks passed. A second café on `PORT=18613` served `42958ec`'s client, for
  before-and-after comparisons. Every server was stopped by its own PID.
- Mutations in the copy, one at a time, each restored afterwards (diffed
  against a saved original):
  - A. `drawFlipped` mirroring when it shouldn't (`if (mirror)`);
  - A2. `drawFlipped` never mirroring (`if (true || !mirror)`);
  - B. `stage.ts`'s `pan` following room pixels, not screen pixels;
  - C. `personMoved` without its `keepFacing` call;
  - D. `onScreen` rounding to room pixels again;
  - E. `stage.ts` not passing its scale to `draw` (client tests, then the
    whole browser spec on a client built with it);
  - F. `render.ts` not setting `sprites.light` (the browser light check).
- Browser probes against the local café, each changing only what one page
  is shown (`routeWebSocket`), or patching `drawImage` to log where sprites
  land:
  - three cats pinned on slow walks up-right, up-left and down-right, each
    one cropped from a real frame;
  - layout B with the followed walker's sprite logged on screen every frame:
    390×844, 393×852, 412×852, 375×852, 844×390 and 844×391, on the new
    build and the old one;
  - desktop sizes giving 1×, 2×, 3×, 5× and 7×: the backing store, the time
    each frame's callbacks took, and a click on a pinned cat's drawn middle;
  - a resize mid-walk from 5× to 3×, back to 5×, then to 1×;
  - the same corner of the room cropped from both builds;
  - four visitors joining over WebSockets, with each one's walk in from the
    door.
- Unit probes in the copy, deleted afterwards: a reconnect after a replaced
  walk; a carried piece against its carrier, on both builds; a one-tile walk
  after a walk; the steps between frames at 1×, 2×, 3× and 5× for 3 and 2
  tiles a second.
- The slice's frames drawn as an 8× sheet from `cat.txt` and `avatar.txt`.

## Findings

### 1. Major: a cat walking away walks tail first, on both of the directions that show its back

- Where: `content/sprites/cat.txt:91-125` (`back_walk_a`, `back_walk_b`),
  drawn by `client/src/render.ts:548-560` (`drawCat`) and `:534-546`
  (`drawFlipped`). The rule they break is `client/src/motion.ts:16`: "the
  sprite, drawn facing right, is flipped to face left".
- Every other cat frame (`sit`, `walk_a`, `walk_b`, `nap`, `back_sit`) has
  its head on the right, columns 8 to 15, and its tail on the left. Both
  back walking frames have it the other way round: the head and ears at
  columns 1 to 7 and the tail straight up at column 11. The plan's log says
  so ("the tail straight up at the near end, with the back of the head and
  its ears at the far end"), but `stepView` mirrors those frames on the
  same rule as the rest:
  - a cat walking along +x, up and to the right, gets `back_walk_*`
    unmirrored: head on the left, so it goes right tail first;
  - a cat walking toward the street wall (−y), up and to the left, gets
    `back_walk_*` mirrored: head on the right, so it goes left tail first.
- Seen in a real frame: three cats pinned on slow walks through the real
  client. The one walking up-right shows its head on the left and its
  raised tail on the right. The one walking up-left shows its head on the
  right. The one walking toward the viewer is right. It is the moonwalk the
  slice was written to end (`art-style.md` section 2, "walkers moonwalk on
  two of the four directions"), now on the two directions that show a back.
  The spec's first line, "left and right mirror as the path turns on
  screen", isn't met for cats walking away.
- A cat that stops after walking away sits as `back_sit`, which faces the
  other way from `back_walk_*`. Every time a cat stops walking away, it
  flips round.
- People are symmetric, so it doesn't show on them. Slice 11 redraws every
  sprite, but it starts from these frames and from the same mirroring rule.
- Would a test catch it: none does. `motion.test.ts` holds `stepView`'s
  answer, and `render.test.ts:235-298` holds which frame is asked for, never
  which way that frame faces. No test holds the mirroring in drawing
  either. Mutation A2 (never mirror) passed all 164 client tests. Mutation A
  (mirror the wrong way) failed only the evenness test, and only because
  that test's stub context ignores `translate`, so a mirrored sprite reads
  as placed at (0, 0). Fix: redraw both frames head on the
  right, as `back_sit` is. Add a `sprites` test that every cat frame faces
  the same way. In rows 3 to 8, the mean column of the drawn pixels is 9.9 to
  11.0 for every frame except these two, which are 6.9, so a bound such as
  "> 8 for every cat frame" tells them apart.

### 2. Major: the phone-camera test (`layout`) doesn't use the stage's or the renderer's code, so it passes whatever they do

- Where: `client/test/layout.test.ts:138-158`, holding the spec's line "In
  layout B the walker the camera follows stays within a pixel of the
  screen's middle". The code it stands in for is `client/src/stage.ts:170-196`
  (`pan`) and `client/src/render.ts:144-147` (`onScreen`).
- The test rebuilds both sides from scratch. It writes its own
  `panOffset({ x: at.x * scale, ... })` and its own
  `Math.round((at.x - 8) * scale) / scale` for the sprite, then holds that
  the two agree. It calls `panOffset` and `toCanvas` and nothing from
  `stage.ts` or `render.ts`:
  - mutation D (`onScreen` back to room pixels) leaves it green; only
    `render.test.ts`'s evenness test fails;
  - mutation B (`pan` following room pixels) leaves every client test green.
    That is the camera this slice's line is about.
- The plan's log says the test "fails on the old placement", and it would,
  but only if someone edited the test to match. It holds an arithmetic fact
  about rounding, not the café.
- What the café does today is right, from a browser probe that logged the
  followed walker's sprite on screen every frame of a pinned walk in layout
  B:
  - at 390×844 and 412×852, one screen x for the whole walk (171, and 182),
    where `42958ec` spread it over 170 to 173;
  - with a mirrored walker, also one x (219).
- Would a test catch it: none does. Fix: drive the real `Stage` in jsdom
  (stub `getContext` with the recording proxy `render.test.ts` already
  uses, and stub `getBoundingClientRect` for the box and the bars). Step
  `Date.now` through a walk, and read `canvas.style.left` and the sprite's
  `drawImage` together.

### 3. Major: after any reconnect, someone who walked one way and was then sent another stands facing the way of the walk that was replaced

- Where: `client/src/state.ts:123` (`facing: previous?.facing ?? new
  Map()`), `client/src/render.ts:258-262` (`facingOf`), and the server's
  `server/src/world/people.rs:321` (`p.walk = None` when a walk ends, with no
  message).
- The `facing` map is only written when a walk is replaced or cleared by a
  message (`keepFacing`). A walk that just ends is never recorded: the
  server ends it silently, and the client keeps it and reads it in
  `facingOf`. That is the build's own bug fix (plan, execution log, "A bug
  the screenshots caught"). On a reconnect the welcome's snapshot carries
  `walk: null` for everyone whose walk has ended, and the kept map still
  holds whatever was written before:
  1. Sam walks toward the viewer, so a `front` is stored when the next walk
     replaces it.
  2. Sam is sent toward the street wall and arrives: correctly drawn as
     `back`, from the finished walk.
  3. The connection drops and comes back. The welcome has Sam's walk as
     null, `facingOf` falls through to the map, and Sam turns to face the
     viewer.
  Every walk that stops without a sit, a pose or a pick-up (the plain
  click-to-walk) leaves the map stale.
- A welcome with the old state kept comes on every reconnect, and after the
  café wakes (`cafe.ts:157`, `this.state ?? this.parked`). A phone that
  sleeps and wakes turns some of the room round.
- My unit probe: this sequence, then `fromWelcome(..., previous)`. It
  expected `person 1 back` and got `person 1 stand`. A reconnect with
  nothing in the map turns everyone to the front, which is at least the
  settled default for someone who hasn't walked.
- Would a test catch it: none does. Fix, test first with that sequence:
  before a welcome replaces the state, record each walker's side from any
  walk the old state still holds, finished or not, then copy the map. Or
  record the side in `facingOf` whenever a held walk decides it, so the
  map is always current.

### 4. Minor: the settled default "someone who arrives faces into the room" isn't met: half the arrivals stand with their back to the room

- Where: `client/src/motion.ts:34-45` (`positionAt` faces a finished walk
  by its last step) and the server's `entering_walk`
  (`server/src/world/people.rs:164-195`). The default is in the spec's
  status line and its open question (`docs/slices/12-walking-where-you-look.md:3, 68`),
  and in `docs/design.md:469-470`.
- Four visitors joining a fresh café walked in like this, read through the
  client's own `stepView`:
  1. (7,0)→(7,1): `front`.
  2. (7,0)→(7,1)→(8,1): `back`.
  3. (7,0)→(7,1)→(6,1): `front`, mirrored.
  4. (7,0)→(7,1)→(8,1)→(9,1): `back`.
  Each stands where it arrives until it walks again, so half of the
  newcomers stand looking at the street wall.
- Only the "nobody has walked yet" case is tested
  (`render.test.ts:281`, a welcome with no walks), which is a different
  case. The design reads as if the default were built.
- Would a test catch it: none does. Fix: either treat a walk that starts at
  the door as an arrival and face it `front` once it ends (a test: a walk
  (7,0)→(7,1)→(8,1) ends `front`), or change the settled default in the
  spec and `design.md`, with the user, to "the way their walk in went".

### 5. Minor: the room's own polygons, outlines and blocks are now drawn into a canvas 3× finer, so its edges changed, and the spec says the room "is drawn as now"

- Where: `client/src/render.ts:98-105` (`poly`), `:129-137` (`outline`),
  and `:393` (`setTransform(scale, …)`). The spec says "the room behind it is
  drawn as now" (`docs/slices/12-walking-where-you-look.md:27`), and the plan
  "everything drawn in room pixels draws exactly as now, scaled"
  (`plan-slice-12-walking.md:22-23`).
- `poly` rounds its points to whole room pixels, but the canvas fills them
  at the backing store's resolution. Diagonal edges that used to be 3×3
  staircases, blended at 1× and scaled up pixelated, are now smooth lines
  blended at 3×. The same corner of the sofa, cropped from both builds,
  shows it: soft blocky steps before, a fine anti-aliased edge now. The
  whole canvas went from 666 to 844 distinct colours, with the same pinned
  cats and the same visitor.
- Not a regression in what anyone wanted. ADR 0019 asked for crisp edges,
  and slice 13 redraws the room. But it is an unstated change to how the
  whole room looks, at both sizes, and the design's "the largest
  whole-number scale, so pixels stay crisp" (`docs/design.md:428`) is now
  only true of sprites. Anything that reads the room's pixels at
  backing-store resolution sees a different picture.
- Would a test catch it: no test reads the room's edges. Answer: say it in
  the spec's line or the plan's log, since slice 13 builds on it.

### 6. Minor: a carried piece wobbles against its carrier, more now than before

- Where: `client/src/render.ts:568-579` (`drawCarried`), drawn at the
  person's fractional `spot` in room pixels through `block` → `poly`
  (`:98-105`, `Math.round` to whole room pixels), next to a sprite placed by
  `onScreen` to screen pixels.
- My probe walked someone carrying a box down a diagonal at 3× and 60
  frames a second, logging the box's first corner against the sprite's
  top-left each frame:
  - this build: five offsets, from (−6,−24) to (−4,−23) screen pixels;
  - `42958ec`: two, (−6,−24) and (−3,−24).
  The sprite now glides by screen pixels and the box still jumps by room
  pixels, so the box slides about over the head.
- The brief asks whether `onScreen` covers carried pieces. It doesn't. The
  held cat does (it goes through `drawCat`), as do the "you" marker and the
  emotes (`drawPerson`'s `x` and `y`).
- Would a test catch it: no. Fix: give `drawCarried` the sprite's placed
  top-left, or `ctx.translate` by the rounding difference before `block`.
  A test can hold one offset along a walk, as my probe does.

### 7. Minor: the camera holds a walker on one screen pixel only at even widths; at odd widths it alternates between two

- Where: `client/src/layout.ts:48-52` (`axis` rounds `you - view / 2`).
  The claim is in `plan-slice-12-walking.md:191-196` ("a walker it follows
  holds one screen position across").
- `view / 2` is a half at an odd view width, and `Math.round` turns the
  half one way or the other depending on the walker's own fraction. Logged
  on screen over a whole walk:
  - 390 and 412 wide: one x;
  - 393 (an iPhone 15's width) and 375 (an iPhone SE's): two adjacent x's,
    for about a third of the frames each;
  - a landscape phone (844×390), where the camera also follows vertically:
    two y's 3 px apart, while x steps evenly whenever the camera is held at
    an edge.
- It is within the spec's "within a pixel", so the line is met. But the
  plan's claim is only true at even widths, and the probe walked only
  390×844.
- Would a test catch it: the one test (`layout.test.ts:138`) uses 390 only,
  and doesn't reach the stage (finding 2). Fix or answer: round `view / 2`
  down once in `axis` (`Math.floor(view / 2)`), and test at 393.

### 8. Minor: the spec's corrected line is honest, but it weakens what the user chose and was only shown in the build's commits, not to the user

- Where: `docs/slices/12-walking-where-you-look.md:49` (the line), `:14`
  (the story, unchanged: "one screen pixel at a time"); the plan's decision
  1 (`plan-slice-12-walking.md:63-73`); ADR 0018's option 3, "where it
  stands moves one screen pixel at a time".
- The correction is right. A step along the grid is 16 room pixels across
  and 8 down, so 3 tiles a second is 48 room pixels a second across and 24
  down. At 3× and 60 frames a second, that's 2.4 screen pixels a frame
  across and 1.2 down. No smooth walk meets "at most one pixel a frame". My
  measurements of what is built:
  - 2×, 3× and 5×: no frame stands still, and steps differ by at most a
    pixel, for people and for cats (2 tiles a second);
  - 1× (layout A on a phone, a small window): 12 of 59 frames stand still,
    which is the limit of whole pixels there.
  The new wording isn't a way round the line: the "even, never standing
  still then jumping" it holds is the shake the user asked to fix.
- Two things to settle with the user:
  - The new line drops the bound on how far a frame moves, so a walk at any
    speed that moves every frame by an even amount passes. With the stated
    speeds that's fine, but the line now holds evenness, not "one screen
    pixel at a time". The spec's story still says the latter.
  - The spec was `Approved`, and a done-when line was changed by the agent
    building it. The plan says why; the prompt log at `9877c81` doesn't
    mention it, and the user hasn't seen the change.
  - The plan's review focus asks "no stall and no jump at 1× to 5×", but the
    test holds 3× only, and at 1× there are stalls.
- Would a test catch it: n/a. Answer: tell the user in the prompt log
  entry. Bring the story's sentence in line ("evenly, by screen pixels").
  Have the evenness test loop over 2×, 3× and 5×, and say in the line that
  1× is excluded.

### 9. Minor: two screenshots are byte-for-byte copies of two others, so "back while walking away" was never shown

- Where: `docs/notes/screens/slice-12/stopped-away-1920x1080.png` and
  `away-1920x1080.png` share MD5 `d0e35299…`, as do the two 390×844 ones
  (`f04233e6…`). The script, `docs/notes/screens/slice-12/shoot.mjs:41-58`,
  waits 500 ms after the click to shoot "away", then 3 s, then
  "stopped-away".
- The "away" click comes straight after the "toward" shot, with no wait.
  At that shot the walker is 500 ms into a four-tile walk from (3,2) to
  (3,6), about 1.5 tiles along. The server starts the new walk from the
  tile it's on (`walk_tile` floors to (3,3)), so the walk away is one tile:
  0.33 s. By the "away" shot, 500 ms later, it's over, and the walker
  stands at (3,2). So both pictures show someone standing, back turned.
  "Back while walking away" was never shown. The slice's judged line
  ("walks read as walking, not shaking") rests on the user watching it
  live, and these screens are what the slice offers until then.
- The plan's log says "A bug the screenshots caught", so they did their job
  once. Whatever they show now, they're not two states.
- Would a test catch it: n/a. Fix: let the "toward" walk end before
  sending the walk away, so it's the full four tiles. Take "away" while the
  walker is still moving: wait on the page's own state, not a timer. Check
  that the two files differ before committing.

## What was checked and found sound

- **Facing, the four steps:** `stepView` matches `iso.ts`: +x is up-right
  and `back`, −x down-left `front` mirrored, +y down-right `front`, −y
  up-left `back` mirrored. A path that turns takes the side of the step
  it's on. A walk of one tile (`path.length < 2`) falls through to the kept
  side, so someone who arrives and reaches for what's beside them keeps
  facing the way they came. My probe held this, and fails under mutation C.
- **A walk replaced mid-step:** the kept side is the replaced walk's side
  at that moment, and the new walk decides as soon as it is held. The
  finished-walk fix (`facingOf` preferring any held walk) is right while
  connected. Finding 3 is the reconnect case.
- **Sitting, posing, held and napping:** `personSat`, `catPosed` and
  `catHeld` record the side before clearing the walk. A napping cat always
  draws `nap`, which has no back, so no missing frame is asked for. A held
  cat draws with `moving: false` and its holder's view. A cat held while
  its holder walks away shows `back_sit`, which exists. `personLeft`
  deletes the person's entry; a cat's entry stays, which is right for a
  cat.
- **No missing frame:** every frame name `drawCat` and `drawPerson` can
  build is in the sheets. `cargo test` and `sprites.test.ts` hold all 13 at
  16×16, and the type unions match. The face windows in `drawWalls` and the
  sign-up card's previews (`auth.ts`) use `stand` on their own 16×16
  canvases. They're unaffected by the transform.
- **Everything drawn after the transform:** `draw` sets the transform at
  its top, before any fill, and `drawOrder`'s paints run inside it.
  `drawFlipped`'s mirror translates to the rounded `x + TILE` and scales
  −1 about it, so a mirrored sprite lands on the same whole screen pixels as
  an unmirrored one. The "you" marker and emotes use the same rounded `x`
  and `y`. The face in the window rounds to room pixels, which is fine:
  it doesn't move.
- **Resize and refit:** `paint` refits when the backing store's width
  doesn't match the scale, before `draw`, and `draw` takes `this.scale` in
  the same call. A resize mid-walk from 5× to 3× to 5× to 1× kept the
  transform's scale equal to the backing store's on every frame, with the
  walker inside the canvas.
- **Picking at every scale:** `hitAt`, `cssToTile` and `whatsDrawnAt` divide
  CSS pixels by `this.scale` and never read the backing store, so they're
  unchanged. A click at a pinned cat's drawn middle opened its menu at 1×,
  2×, 3×, 5× and 7×. All the browser checks that click a tile or a figure
  pass at both sizes.
- **Memory and frame time:** the backing store is 1680×1160 at 5× (about
  7.8 MB of pixels) and 2352×1624 at 7× (about 15 MB). That's one
  allocation per refit, not per frame. Each frame's callbacks took a median
  of 0.2 to 0.8 ms at every scale in headless Chromium.
- **The light check** (`spec/browser.test.ts:899-920`) still fails when it
  should. With `sprites.light` dropped (mutation F), it failed on "night
  coat". With the stage not passing its scale (mutation E), it failed on
  "day floor", and it was the only check in the whole spec to fail. Its
  sums are right at any `devicePixelRatio`: `perCss` is 1 here, and
  `roomScale × perCss` gives canvas pixels per room pixel.
- **The placement tests** (`render.test.ts:301-351`) read the transform the
  same way the code does, so on their own they can't catch a stage passing
  the wrong scale (mutation E passed every client test). But the light
  check catches it, as above.
- **The kept rules:** the server, the protocol and every rule about who is
  inside are untouched. The back views are data in `content/sprites/`, and
  no cat is named in code. Nothing new is stored or logged. My probe
  accounts were made only on my local café.

## Answers

To be added by the builder.
