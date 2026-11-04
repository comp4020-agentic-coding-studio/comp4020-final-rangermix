# Findings: review of slice 13, "A café on its street"

Brief: [slice-13-brief.md](slice-13-brief.md). Reviewed 2026-11-05, cold, by
an agent that didn't build the slice. Scope: `9877c81..e049217`. Line
numbers are at `e049217` (the checkout's `HEAD` moved on to slice 14 during
the review).

How: read the spec, ADRs 0018 and 0019, art-style.md 1, 1b and 3 with the
study's pictures and `study.html`, the plan and its log, and every file the
brief names. Built and ran only in a throwaway `git archive e049217` copy:
the client's tests, `cargo test`, fmt and clippy, and the café on port 18713
with a fresh `DATA_DIR`, with the spec pointed at it by `APP_URL`. Probes
were scratch vitest files and Playwright scripts in that copy, plus mutants
of `render.ts` and `shadows.ts`, each one built, run and put back. For a
baseline, slice 12's client (`9877c81`) was served from the same port, one
build at a time. Every server I started was stopped by its own PID. The
accounts were `agent_…` names on that local café only. The live café and Fly
weren't touched.

**Count:** 0 critical, 5 major, 8 minor.

---

## Major

### 1. The street's browser check passes with no street, only one flat colour

- **Where:** `spec/browser.test.ts:958-995`, mainly the poll at `:979` and
  the asserts at `:983` and `:994`.
- **Scenario:** the check reads one pixel, at (0.01, 0.02) of the canvas,
  and passes if that pixel is any of the light's nine street colours. Built
  with `drawStreet` swapped for one `fillRect` in `street[1]`, the café
  passed the check: "1 passed". Built with `drawStreet` drawing slice 12's
  flat backdrop `#1e1e2e`, it failed, but only by day: "the corner at 10:00
  is #1e1e2e". At night, slot 1 of the street *is* `#1e1e2e`
  (`scripts/palettes.ts:146`, Mocha's base). So the 22:00 half passes
  against slice 12's flat backdrop. The plan's log says as much. The unit
  test's title, "and leaves none of the old backdrop" (`render.test.ts:530`),
  claims what the test can't check at night.
- **Done-when line it fails to hold:** "The page draws the street by day at
  10:00 and by night at 22:00 | browser check". The unit test does catch a
  flat street: its "≥ 2 street colours in the top-left 60×60"
  (`render.test.ts:545`) failed under the flat mutant. So the street is
  held at 1× in jsdom, but the page isn't held in a browser, which is what
  the line names.
- **Caught by a test?** No; the check above is the one that should. The
  fix: read a block of the corner, as the unit test does, and require
  several street colours. Name the ones that only a street has (a tower
  and the sky by day; a star or a lit window by night). Then a flat fill,
  and the old backdrop at night, both fail.

### 2. The rug hides every shadow that falls on it

- **Where:** `render.ts:437-440`, where `drawShadows` runs before the paint
  loop, which draws the `under` pieces (the rug) first. Also
  `shadows.ts:43`.
- **Scenario:** a chair (or any piece) stands on the rug, which `under`
  allows. The mask puts its shadow and foot across the rug, but the rug
  is painted over the shaded floor, so on the rug neither shows. Measured:
  a chair at (5,4) on the rug at (4,4) adds 420 shaded pixels to the mask.
  178 of them show; the 242 on the rug are drawn as plain rug
  (`#b4befe`). With the same chair at (9,4), off the rug, all 420 show. The
  shadow stops at the rug's edge as if the rug were lit from below. By the
  same draw order, a rug moved toward the street wall would hide the
  panes' bars of light and the wall's shade wherever it lies. The study
  (`study.html:509-512`) darkens the flats (the rug) with the floor.
- **Done-when lines:** "A piece's cast shadow falls away from the windows,
  through the panes, and moves when the piece does". The story's "the
  windows' light falling across the floor" also fails, on the rug.
- **Caught by a test?** No. `shadows.test.ts:55` checks that the rug casts
  nothing, not what falls on it. The fix: draw the `under` pieces before
  `drawShadows`. Then darken whatever is under each shaded pixel, the
  rug's colour where the rug is, worked out and cached with the mask,
  since the rug is furniture. The test: a chair on the rug leaves a pixel
  of the rug that's in its shadow drawn in the rug's colour, darkened.

### 3. The board seams show only in shade: a shaded pixel isn't always what's under it, darkened

- **Where:** `render.ts:525-532` (`boardAt`) against `render.ts:480-485`
  (`drawFloor`). The test that holds it is `render.test.ts:465-508` (its
  `floorAt` at `:480-484`). The plan's log entry "A seam rule caught by
  measuring" makes the same claim.
- **Scenario:** `drawFloor` draws each row's diamonds, then each tile's
  seam strip from `y + 1` to `y + 1.06`. The next row's diamonds start at
  `y + 1`, are drawn after it, and cover it, so every seam is painted over
  except the last row's, which lies past the floor's front edge. Measured
  in an empty room: 21,129 lit pixels of the floor's interior, and none
  is the seam colour. `boardAt` returns the seam for the first 0.06 of
  each row, so the shadow paints a darkened seam there. Of 5,519 shaded
  pixels, 330 are a darkened seam that the floor never shows. With
  furniture, 360 shaded pixels aren't the floor under them, darkened.
  Every one sampled is the seam darkened over a pixel drawn as a board:
  at (207,64), the floor is `#c99980` (a light board), drawn as `#816962`
  (the seam darkened), where it should be `#a17a66`. So the answer to the
  brief's question is no. The result: thin diagonal lines that appear
  only in shaded floor, in the wall's shade under the windows and round
  every piece, in every frame. They show in
  `screens/slice-13/room-day.png`, while the lit boards between them have
  none. (Slice 10's soft floor showed its seams faintly, blended, in
  `screens/slice-10/room-10h.png`; crisp, they're gone from the lit
  floor.) The log says the rule was "measured"; the measurement must
  have read shaded pixels, so it measured the rule itself.
- **Caught by a test?** The test meant to catch it holds it in place: it
  compares each shaded pixel with a copy of `boardAt`'s rule, not with
  what's drawn. Taking the seam branch out of `boardAt` (which matches the
  lit floor) fails that test. The fix: either draw the seams in a second
  pass after all the diamonds (then `boardAt` is right as written, and the
  lit floor gets its seams), or drop the seam. Then test a shaded pixel
  against the same pixel in a draw with an empty mask.

### 4. A thin piece casts the shadow of its whole tile, on the side toward the windows too

- **Where:** `shadows.ts:42-48` (`boxOf`, inset 0.06 for every kind)
  against `render.ts:69` (`INSET`: plant 0.28, lamp and scratching post
  0.3, toys 0.32, chair 0.2, bowls 0.18, box and cushion 0.15, cat bed
  0.12).
- **Scenario:** a lamp at (6,5) is drawn 0.4 tiles across, from 6.3 to
  6.7, but its shadow is worked out for a column 0.88 across, from 6.06 to
  6.94. The floor at (6.5, 5.12), between the lamp's back face and the
  windows, is in shadow, and so is (6.12, 5.5) beside it. For the toys,
  (3.5, 6.15) and (3.1, 6.5) likewise. Each thin piece stands on a dark
  patch nearly a tile wide that reaches round it toward the light, which
  reads as option 8's blob, not option 9's cast shadow. The occlusion
  ring is worked out from the same box, so it sits 0.14 to 0.22 tiles off
  a plant's or lamp's foot, not at it. Seen in the default room's plants,
  chairs, toys and bowls (`room-day.png`), and at 10× in a probe of the
  lamp and the toys.
- **Done-when line:** "A piece's cast shadow falls away from the windows".
  For seven of the fourteen kinds, it also falls toward them.
- **Caught by a test?** No. Every shadow test uses `cat_tower`, `sofa` or
  `box`, whose inset is close to 0.06. The fix: share `INSET`, and the
  toppled `along` rule, between `drawPiece` and `boxOf`. The test: a
  lamp's floor just behind its drawn back face is lit, and the floor just
  in front of it is in shadow.

### 5. Cats and people cast no shadow, and the slice says it's built

- **Where:** `docs/slices/13-a-cafe-on-its-street.md:37` ("Cats and people
  cast a small shadow away from the windows"), against `render.ts`
  (`drawCat`, `drawPerson`) and `shadows.ts`, where nothing draws one.
- **Scenario:** a cat or person stands on the open floor, with nothing
  under them. The study had these shadows (`spriteShadows`,
  `study.html:513`, `:603-605`). The spec lists them in "In this slice";
  the plan neither plans them nor records dropping them; the spec's status
  says "Built". AGENTS.md says don't shrink the scope; when something is
  left out, say so and record where the work stands.
- **Caught by a test?** No; no "done when" line names it, so nothing
  checks it. Either build it (a small patch, cast away from the windows
  and drawn after the floor's shadows, so it moves every frame and
  outside the cached mask), or record it as dropped in the plan's log and
  the spec, with the user's say.

## Minor

### 6. A frame costs about 7× slice 12's, enough to drop frames on a slower phone

- **Where:** `render.ts:77-98` (`drawStreet`) and `render.ts:497-518`
  (`drawShadows`). The plan's review focus 4 asked for this.
- **Measured** in Chrome (Playwright), as the `requestAnimationFrame`
  callback's own time, against the same café, served first with slice 13's
  client and then with slice 12's:

  | | slice 12 | slice 13 | slice 13, street one colour |
  | --- | --- | --- | --- |
  | 5× (2600×1500), no throttle | 0.3 ms | 2.0 ms | |
  | layout B 3×, CPU ×4 | | 7.0 ms, 220 frames in 4 s | |
  | 5×, CPU ×4 | | 7.5 ms, 188 frames | |
  | layout B 3×, CPU ×6 | 0.6 ms, 240 frames | 10.8 ms, 143 frames | 5.1 ms, 241 frames |
  | 5×, CPU ×6 | 0.7 ms, 241 frames | 11.8 ms, 122 frames | 6.1 ms, 232 frames |

  A frame makes about 20,200 `fillRect` calls and 14,000 `fillStyle` sets:
  about 12,200 runs of the street, which is "cached" only in that its
  runs aren't worked out again; about 1,500 runs of shadow (the log says
  "a few hundred"); and the shapes. On a mid-range phone (CPU ×4) walks
  run at 47-55 frames a second, not 60. Smooth walking was slice 12's
  point.
- **Fix:** draw the street once per light into an offscreen canvas at 1×,
  and `drawImage` it at (0,0). At a whole-number scale with smoothing off,
  that blends nothing. The log's reason for not caching an image ("a
  cached canvas is invisible to the pixel tests") holds for the shadows,
  not the street: `streetSlot` is tested on its own, and the tests could
  read the offscreen canvas. Record the measurement in the plan's log.
- **Caught by a test?** No.

### 7. The blocks are shaded against the light the shadows come from

- **Where:** `render.ts:145-146` (the `x` face `shade 0.3`, the front `y`
  face `0.14`), against `render.ts:472-478` (the slab "lit on the left,
  toward the windows, darker on the right, as the pieces are") and
  `study.html:252-254` ("the left face (x) is the mid tone and the right
  face (y) the darkest": `shadeSide 0.12`, `shadeFront 0.28`).
- **Scenario:** with the light toward (0.2, −0.6, 0.78), the front face
  (`+y`, on screen's right) faces away from it most (−0.6), and the `−x`
  face (on screen's left) only a little (−0.2). The blocks have it the
  other way round: the cat tower's left face is `(175,125,95)` and its
  right `(215,154,116)`. The slab and the study have it right, so the
  slab's comment is wrong about the pieces. This shading is slice 09's,
  but this slice adds the light that contradicts it. Every frame shows
  it, against the shadows falling down and to the right.
- **Caught by a test?** No. A fix swaps the two factors (or uses the
  study's 0.12 and 0.28); `render.test.ts`'s self-outline test reads the
  top only, so it holds either way.

### 8. The light comes through the plain wall

- **Where:** `shadows.ts:70-80` (`wallShades` models only the street
  wall).
- **Scenario:** the light leans toward `+x` (0.256 tiles per tile risen),
  and the plain wall at `x = 12` is 2.86 tiles tall. So for a floor point
  within about 0.73 tiles of it, the ray to the light leaves through the
  plain wall before it reaches the street wall. At `gy = 6`, the floor at
  `gx` 11.8, 11.5 and 11.3 is lit; only 11.95, the occlusion line, is
  dark. The brief asks for light "not through the plain wall". The study
  casts from both walls (`study.html:403-406`, `:500`).
- **Caught by a test?** No. Fix: in `shadowMask`, shade a point whose ray
  reaches `x = W` below the wall's top before it reaches `y = 1`. Test:
  the floor at (11.5, 6) is in shadow.

### 9. The self outline: most of its pixels pick the tile behind, and it runs along the base too

- **Where:** `render.ts:150`, `:160-162` (`silhouette`) and `crisp.ts:62-64`
  (`Math.floor` of points on the edge), against `render.ts:234-247`
  (`blockOutline`, the polygon picking tests).
- **Scenario:** a sofa at (4,5) has 156 rim pixels, and for 96 of them
  `hitAt` returns null, so a click there falls through to the floor's
  tile under the pointer (`whatsDrawnAt`'s fallback). Along the top's
  back edges, that's the tile behind the sofa, not the sofa. At 3× that's
  a band 3 screen pixels wide round the back of every piece. The plan's decision 2 says picking "still
  agrees" with what's drawn. Separately, the silhouette includes the
  front base edges, so the outline also runs where the piece meets the
  floor in front of it, which isn't behind it. The study's rule
  (`study.html:532-545`) outlines only where a nearer thing meets a
  farther one, so its pieces have no line along the base. That's for the
  user to judge, since nothing tests "only where it meets what's behind
  it".
- **Caught by a test?** No. Test: every pixel drawn in a piece's outline
  colour picks the piece (`hitAt`).

### 10. "A click on the street does nothing" is checked at one point, at one size

- **Where:** `spec/browser.test.ts:985-990`.
- **Scenario:** one click, at the top-left corner, at 1920×1080. AGENTS.md
  asks for every action at both sizes, and on the phone (layout B, panned)
  the street lies above the wall and below the floor. My probes held:
  seven clicks on the street at 1920×1080, and six taps on it at 390×844
  in layout B, sent nothing and opened nothing. One tap that sent `walkTo`
  turned out to be on the café's own lit window (wall tile (5,0)), which
  at night shares the street's lit-window colour `#f9e2af`. That's
  right. The behaviour holds; the check covers a fraction of it.
- **Caught by a test?** Only the one point. Add a tap at 390×844 on the
  street below the floor's front corner, and a click beside the floor's
  tips.

### 11. `street.toml`: valid TOML that `cargo test` passes can stop the client loading, and `[windows]` is checked by neither reader

- **Where:** `client/src/street.ts:27-39`, `:48`, `:89-92`;
  `server/src/content.rs:139-162`.
- **Scenario:** the client's parser throws on TOML that's valid and that
  `cargo test` accepts: an inline table, a dotted key (`windows.lit = 4`),
  `[ windows ]` with spaces, `2_2`, `5.5e-1`, `+0.55`, any other table, a
  string value. It throws while the module loads, so the whole client
  fails to start. CI catches it, because the client's unit tests import
  `render.ts`, which reads the real file, but nothing points from the
  failure to the parser. Silently, `cargo test` never reads `[windows]`:
  `every = 0`, a missing table or `lit = 11` passes both, and the client
  draws towers with no windows, or every one lit, without an error.
  Where the two readers disagree otherwise (`height = 1`, `width = 22.5`,
  `1.2.3`, a missing key), `cargo test` fails, which is safe.
- **Caught by a test?** Partly, as above. Fix: have `cargo test` check
  `[windows]` (whole numbers, `size < every`, `lit` 0 to 10), and say in
  `street.toml`'s header which TOML the client reads.

### 12. The software canvas can't see a blended `drawImage`

- **Where:** `client/test/pixels.ts:78` (`drawImage() {}`), and its plain
  properties.
- **Scenario:** `drawImage` at a fractional device position or scale, or
  under `globalAlpha < 1`, or a `shadowBlur`, `filter`,
  `globalCompositeOperation` or `imageSmoothingEnabled = true`, would
  blend and pass "asks the canvas for no shape it would anti-alias". None
  does today: sprites go through `onScreen`, and the window's face is
  rounded at a whole-number transform. The hiding cat's 0.55 alpha is on a
  `drawImage`, so the stub never sees it; the plan keeps that on purpose.
  `rect`, `arc`, `ellipse` and `fillText` aren't defined, so calling them
  throws, which is good.
- **Caught by a test?** No. Fix: record `drawImage`'s device rectangle
  and alpha as `fillRect`'s are, and allow the hiding cat by name.

### 13. The street's evening blend is held by a test any off-palette colour passes

- **Where:** `client/test/render.test.ts:549-555`; `sprites.test.ts:47-57`
  checks the blend slot by slot for `room` only.
- **Scenario:** the done-when line "blended as the room's are" names the
  `sprites` and `canberra` tests, but neither looks at `street`. The
  render test only checks that the evening's corner is in neither set, so
  a fixed off-palette colour passes. It's right today, since `blendAll`
  blends every list: at 18:00 the browser showed `#4d638b`, halfway
  between `#89b4fa` and `#11111b`.
- **Caught by a test?** No. Add `street` to the slot-by-slot blend test.

---

## Checked and found sound

- **The gates at `e049217`:** 184 client tests, `cargo test`'s street test,
  both typechecks, `cargo fmt --check`, clippy `-D warnings`, and the full
  spec against a fresh café on 18713: 70 passed, 1 skipped (restart),
  matching the log.
- **No blended pixel, in a real browser:** read from Chrome's canvas at 3×
  (1920×1080) at 10:00, 18:00 and 22:00, none of the 77,952 room-pixel
  blocks holds more than one colour, in 71 to 81 colours a frame. In the
  software canvas at 1× to 5× in all three lights, with a toppled lamp, a
  carried box, a hiding cat, the keyboard's pointer on the floor and on
  the wall, and a ghost, the only blended call is the ghost's alpha 0.55,
  as the plan intends. No `fill`, `stroke` or path is left in
  `client/src`.
- **The spans:** against a brute-force centre test on 3,000 random
  polygons (a third of them with vertices on pixel centres and halves),
  one pixel differs, a centre exactly on an edge. Convex quads split on a
  diagonal leave no gap and no overlap in 2,000 cases. The 108 floor
  diamonds tile the floor exactly (27,648 pixels). Zero-height shapes
  make no span; a vertex on a centre's row is counted once.
- **Outlines:** the slab's line stays open (and tested); silhouettes,
  ghost and pointer close as they should. Each outline is the piece's own
  colour times 0.55.
- **Shadow direction and panes:** `TOWARD` matches the study's light and
  `iso.ts`'s camera: shadows fall toward the viewer and down-right on
  screen. The panes' rows (22 to 48 px, inset 0.1) match the glass
  `drawWalls` draws; the door and the chalkboard shade. Mutants: light
  from the other side fails 5 tests; no self outline fails 1; a mask
  never reused fails 1.
- **The cache key:** covers each piece's kind, place, size and whether
  it's toppled, plus the room's size and row 0. It leaves out heights,
  `under` and the rows below 0, but none of those change while the page
  runs (heights are a static import) and the mask reads nothing else. It
  holds one entry and is rebuilt only when a piece moves, falls, or is
  added or taken away, at about 3 to 7 ms a rebuild. A different order of
  the same pieces rebuilds it too, which costs a rebuild but is never
  stale.
- **The street's cache:** kept per light (night or not), never rebuilt per
  frame, and never stale. The layout doesn't depend on the colours, and
  the evening uses the day's layout in blended colours, which is right,
  since stars show only at night. In the browser: 10:00 `#89b4fa`, 18:00
  `#4d638b`, 22:00 `#11111b`, 06:30 `#89b4fa`.
- **Input and resize:** clicks and taps on the street at both sizes do
  nothing (finding 10). Resized mid-visit from 1920×1080 to 1200×800 and
  back, the room went from 3× to 1× and back with the street in its
  corners each time. On the phone the street is drawn into the canvas,
  so it pans with the room, as settled; the corners are filled in layout
  B.
- **The data:** `palettes.json` is what `scripts/palettes.ts` writes, with
  nine street slots in each light. The Dockerfile copies `content/`
  before building the client, so the `?raw` import works in the image.
  The street is data: the shapes are in `street.toml`, the colours in
  palettes.
- **Kept rules:** nothing here reaches the server, the protocol, speech,
  logs or storage; generated TypeScript is untouched.

---

## Answers

By the builder, 2026-11-05, on `slice-13-street`. Each fix was tested
first: the new test was seen failing on the old code, or on a mutant put
back to the old behaviour, before the code changed.

| # | Severity | Answer | Commit |
| --- | --- | --- | --- |
| 1 | major | Fixed. The browser check reads a block of the corner and needs colours only a street has: by day the sky, a tower's lit face and its shaded side; by night Mocha's crust, a star or a lit window, and three of the night's slots. It failed on a flat street (one slot), on slice 12's backdrop `#1e1e2e` all day, and on that backdrop at night only. The unit test's title no longer claims what it can't see. | [`9389131`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/9389131) |
| 2 | major | Fixed. The rug is drawn into the floor's layer with the street, slab, boards and seams, and the shadows darken whatever the layer holds there, rug included. The test: a chair on the rug, and every rug pixel in its shadow is the rug's colour darkened. It failed with the rug left out of the layer. | [`e757043`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e757043) |
| 3 | major | Fixed the first way: the seams are drawn in a second pass over all the boards, so the lit floor shows them too, and the shadows darken the pixel that's there rather than a copy of a rule. The test compares every shaded pixel with the same pixel of the layer drawn with no shadow, darkened, and a second test needs seams on the lit floor. Both failed with the seams back in the boards' loop. | [`e757043`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e757043) |
| 4 | major | Fixed. The block a piece is drawn as (`pieces.ts`, its inset and the toppled rule) is the box its shadow and foot are worked out from, and its picking polygon. Tests: a lamp's floor behind and beside it lit, a strip in front of it in shadow, and past the strip lit; a plant's foot darkened and a ring 0.18 out from it not; a fallen plant's shadow short. They failed on the old boxes. | [`b2d5659`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b2d5659) |
| 5 | major | Built. A small oval under each cat and person on the floor, a little away from the windows, darkening the floor layer under it each frame; nobody up on a piece, on a lap or in someone's arms casts one. The test failed before the code. | [`0850082`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0850082) |
| 6 | minor | Fixed with 2 and 3: the street, floor, seams and rug are one layer, worked out when the light or the furniture changes and laid on in one `drawImage` in a browser (as runs in the tests' software canvas). Measured as the review did, the `requestAnimationFrame` callback at CPU ×6: 5× (2600×1500) 2.4 ms median, 3.6 ms at the 95th percentile, 239 frames in 4 s; layout B 3×, 2.0 ms and 239 frames. The review's figures were 11.8 ms and 122 frames, and 10.8 ms and 143. | [`e757043`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e757043) |
| 7 | minor | Fixed. The left face is shaded 0.12 and the front 0.28, as the study, so the face turned from the windows is the darker. The test failed on the old factors. | [`38b969e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/38b969e) |
| 8 | minor | Fixed. A floor point whose ray to the light leaves through the plain wall below its top is in shade. The test (11.5, 6) and (11.3, 6) in shadow, (8, 6) lit failed before. | [`b2d5659`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b2d5659) |
| 9 | minor | Fixed the picking: a piece is found within a room pixel of its block, all round, where the outline is traced. The test needs every pixel of a sofa's, box's and lamp's outline colour to pick that piece; it failed first at the sofa's top rim, then at its front-right base corner. The outline along the front base is left for the user's judgement, as the review suggests, with the screenshots. | [`d9856c9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/d9856c9) |
| 10 | minor | Fixed. Seven clicks on the street at 1920×1080, each point read first to be sure it's the street (corners, and beside the floor's three tips), and taps on the phone in layout B at points found by the street's colours as the room is panned. A first try tapped by position and hit the room in a full run; reading the colour holds. | [`9389131`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/9389131), [`26134e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/26134e4) |
| 11 | minor | Fixed. `cargo test` checks `[windows]`: whole numbers, `size < every`, `lit` 0 to 10 (`every = 1` failed it). `street.toml`'s header says which TOML the client's own reader takes. | [`47bf3ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/47bf3ae) |
| 12 | minor | Fixed. The software canvas records an image drawn off the device grid or with smoothing on as blended, and one under alpha as see-through (the hiding cat, on purpose). The anti-alias test now has someone mid-walk; with `onScreen` not rounding, it failed at 1× and 3×. | [`47bf3ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/47bf3ae) |
| 13 | minor | Fixed. The evening's blend test checks the street slot by slot, and that each slot that differs by day and night is blended. With `street` left out of the blend, it failed. | [`47bf3ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/47bf3ae) |

Gates after the fixes, on `26134e4`: 193 client tests, both typechecks,
`cargo fmt --check`, clippy `-D warnings`, 317 `cargo test`s, and the
spec against a fresh café serving this build: 70 passed, 1 skipped
(restart, which needs Docker).
