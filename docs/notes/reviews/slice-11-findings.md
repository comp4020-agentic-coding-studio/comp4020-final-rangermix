# Findings: review of slice 11, "Cats you can tell apart"

Reviewed cold, from [the brief](slice-11-brief.md), on `6057aea` (slice 11's own changes:
`git diff origin/main...6057aea`). Line numbers are at `6057aea`.

## How it was checked

- **A throwaway copy** of `6057aea` (`git archive`) in `/tmp`. Run there:
  `cargo fmt --check`, `cargo clippy --all-targets -D warnings` and `cargo test`
  (317 passed, 1 ignored); `pnpm -C client check` (typecheck, then 242
  passed); the root `pnpm typecheck`; and the whole spec (76 passed, 1
  skipped) against a café the copy built, on port 18915 with a fresh
  `DATA_DIR`, started from the copy's root.
- **A second copy for mutations.** Each change was undone after its run,
  and the copy was then deleted. The changes: hand-edited sheets, PNGs
  changed or removed without the script, odd PNG formats, a changed coat,
  an unknown build, a wrong-size frame, removed `catFrame` branches,
  16-px sizes and hit boxes, shadow changes, and a removed build check.
- **The café in Chromium**, through Playwright scripts in `/tmp`, at
  1920×1080 and 390×844, by day and by night. Some scenes were staged by
  rewriting only the page's own copy of the welcome: a face at the window,
  a held cat, a lap, a carried chair, a moved tower, knocked-over pieces,
  and a cat on the window seat. Pixels were measured in the client's test
  canvas (`client/test/pixels.ts`).
- **Housekeeping.** The local test accounts were `rv…`, `rs…`, `rt…` and
  `rp…`, all on the throwaway café. The live café and Fly were not touched.
  I stopped the three servers I started (PIDs 65046, 15003 and 16749) by
  PID. The Playwright MCP tool wrote two log files into the checkout's
  gitignored `.playwright-mcp/` on its first call. I deleted them at once
  and drove the browser from `/tmp` after that. `git status` on the
  checkout is as it was.

## Findings, most severe first

### 1. Major: furniture is still picked by its old single block, so a cat on the window seat beside the tower can't be clicked or tapped

- **Where:** `client/src/render.ts:326` (a piece's `hit`), `:227-241`
  (`blockOutline` and `onBlock`, from `pieceBox`), against `:635`
  (`drawPiece`, which now draws `pieceParts`).
- **Scenario.** A cat perches or naps on the window seat at (2,1). That is
  the room's only perch spot and the seat's nap spot (`Room::spots`, the
  seat's first pettable tile), next to the cat tower in the default room.
  The tower is now drawn as a base, a post and platforms, so 171 of the
  perched cat's 238 pixels show between them. But the tower is still picked by its old
  solid 44-px block, and that block is nearer the viewer. Of the 576
  points in the cat's 24×24 box, 564 pick the tower and 12 pick the cat.
  - In Chromium, a click at 1920×1080 and a tap at 390×844 on the cat's
    middle both open the **"Cat tower"** menu, not the cat's.
  - 1,729 canvas pixels of bare floor round the tower's post and under its
    platforms also pick the tower. A click there opens its menu instead of
    walking.
  - The window seat, table and chairs are the same in kind (152, 283 and
    135 pixels of bare floor that pick them).
- **The rule:** "Every action works by keyboard, touch and mouse". Only Tab
  reaches the cat. On `main` the cat at (2,1) was wholly hidden by the
  block (0 pixels), so slice 11 turns an invisible cat into a visible one
  that can't be clicked.
- **Would a test catch it?** No. "Furniture drawn as its parts" never
  calls `hitAt`. The spec's window-seat check uses (3,1), the seat's other
  tile, away from the tower (`spec/browser.test.ts:681`). A test would
  put a cat on (2,1) with the tower at (0,1), then hold that `hitAt` at
  the cat's middle picks the cat, and that a point between the tower's
  legs, with only floor showing, picks nothing.

### 2. Major: a figure is picked by its whole 32×32 or 24×24 square, over bare floor on the tiles behind it

- **Where:** `client/src/render.ts:249-259` (`spriteBox`), `:378` and
  `:397`.
- **Scenario.** Someone stands at (6,5). The tiles behind them have floor
  pixels that pick them although only floor shows there:
  - the tile straight behind, (7,4): 66;
  - up-left (6,4) and up-right (7,5): 113 of 128 each;
  - (7,3) and (8,4): 110 each.

  That is 638 of the 1,024 points that pick them. A click on the floor just
  behind someone opens their menu instead of walking there.
- **A napping cat:** 224 of the 232 points on the tile behind it pick it
  over bare floor. So a treat put down just behind a napping cat can't be
  tapped: the tap picks the cat.
- **design.md says** "a click or tap acts on what's drawn under it". The
  notes call the person's case "which is right"
  (`docs/notes/slice-11-art.md:96-99`), but it is right only where the
  sprite is drawn.
- **Checks moved round it:** the slice moved two checks away from the
  problem rather than fixing it (`client/test/render.test.ts:145-147`;
  `spec/browser.test.ts:484-489`, "nor near me, nor near the cat").
- **Would a test catch it?** No. A test would hold that a point on the
  tile behind a figure, outside its drawn pixels, picks that tile's own
  contents or nothing. Picking by the sprite's opaque pixels, or by a
  slimmer box round the drawn part, would fix it.

### 3. Major: what's up on a piece is lifted to the piece's tallest point, not to the part under it, so cats float over a moved cat tower

- **Where:** `client/src/render.ts:371` (a cat's `lift = HEIGHT[on.kind]`)
  and `:412-416` (`personLift`). Both read `content/sprites/heights.json`,
  which now holds each model's tallest part.
- **The cat tower (2×2):** the part under each tile's middle is 4 px (the
  base) at (0,0) and (1,1), 22 px (the low platform) at (0,1), and 44 px
  (the cubby) at (1,0). Every cat on it is drawn 44 px up.
- **The default room is right by luck.** The tower's nap and hide spot is
  its first pettable tile, (1,1) of the room, which is the cubby. The tower
  can be carried, though. Moved to open floor, its spot becomes its
  top-left tile (`server/src/room.rs:491-496`), and a cat there is drawn
  40 px above the base. A staged screenshot with the tower at (8,5) shows
  three cats hanging in the air over its platforms.
- **People:** on the sofa they are drawn at 12 px, 3 px above the 9-px
  seat, and on a chair at 10, above its 8-px seat.
- **Cats on the sofa:** drawn at 16 px, on the top of its back.
- **Would a test catch it?** No. The test "draws a cat napping on a piece
  … up on top of it" holds `lift` at 12 for the window seat only. The
  spec's tap check aims with the same `HEIGHTS` (`spec/browser.test.ts:938`).
  Lifting by the highest part under the tile's middle would fix it, with a
  test per tile of the tower.

### 4. Major: a carried piece hides its carrier's head

- **Where:** `client/src/render.ts:723` (`lift = PERSON - 4 + standing`).
- **Scenario.** Someone carries a chair. The block's lowest corner sits
  about 23 px above the tile's centre and its top about 47, while the
  32-px person's head runs from 30 to 21 px up. The block covers the head:
  - of the person's 38 hair pixels, 2 still show;
  - 12 of the face's 28 skin pixels are hidden.

  At 1920×1080 the box sits on their shoulders like a box for a head.
- **A regression.** On `main` the box rode 22 px up over a 14-px head,
  with about 3 px clear.
- **Would a test catch it?** No. "Carries a piece over its carrier's head
  at one place … (slice 12's review, finding 6)" holds only the offset
  frame by frame. Putting the lift back to its 16-px value (`16 + 6`)
  passes all 242 client tests. A test would hold that every hair pixel
  shows while carrying.

### 5. Major: the sign-up look picker shows only a quarter of each avatar

- **Where:** `client/src/auth.ts:96` (`{ width: 16, height: 16 }`) and
  `:120` (`clearRect(0, 0, 16, 16)`).
- **Scenario.** On the sign-up page each look is previewed by drawing a
  32×32 sprite into a 16×16 canvas. Only its top-left quarter shows: the
  left half of the head and a corner of the shirt, at 1920×1080 and at
  390×844. Every visitor chooses their look here.
- **Would a test catch it?** No: nothing draws the picker. The canvas
  should take the sprite's size; the CSS already scales it to 48 px.

### 6. Major: a face at the window is half a head

- **Where:** `client/src/render.ts:609` (`drawImage(img, 0, 0, TILE, 9, …)`).
- **Scenario.** Someone waits at the window. The pane shows the sprite's
  top-left 16×9 pixels, but on a 32-px sprite the head is in columns 10 to
  21. Everyone inside sees the left half of a head, cut down the middle
  (zoomed screenshot).
- **Would a test catch it?** No. The fix is to crop round the head (from
  x = 8, or columns 10 to 21), with a test that the face's eyes both show.

### 7. Major: knocking something over never shows its pose, and neither does eating from a hand

- **Where:** `client/src/render.ts:687-702` (`catFrame` has no path to
  `knock`), `server/src/world/furniture.rs:315` (`FurnitureToppled { by:
  None }`), and `server/src/world/handling.rs:162-168`.
- **Knocking over:** a cat knocks the plant over. The server poses it
  `Idle` and says only that the piece fell, so the client draws it
  sitting. The `knock` frame, drawn for all three builds, is never shown.
  The spec's line "Each behaviour shows its own pose" names "knocking
  something over", so it isn't held. The notes say so honestly (`:66-68`).
- **Eating from a hand:** someone offers a treat. The cat answers
  `Reaction::Eat` and is posed `Sit`, so it shows sitting with a heart.
  The `eat` frame only shows at the bowls.
- **Would a test catch it?** No: "The frame for what a cat is doing" has
  no knock case. A fix needs the server to name the cat, as a protocol
  change (a `cat` on `furnitureToppled`, or a `knock` reaction), with a
  `catFrame` test for it.

### 8. Major: two judged lines have nothing to be judged from

- **Where:** `docs/notes/screens/slice-11/` and the spec's "Done when".
- **"Each piece reads as what it is, standing and knocked over, at both
  scales, day and night"** is to be judged "from the sprite sheet". There
  is no furniture sheet. The people's sheet is at 4× only
  (`scripts/people.mjs`, `const s = 4`), not at the phone's 3× as well.
- **"Nothing is drawn over what it shouldn't hide"** is to be judged "from
  screenshots of laps, naps and carrying". There are none.
- **Why it matters:** those screenshots would have shown findings 3 and
  4, and 9 below.
- **Would a test catch it?** No: these are the user's judgements, and the
  material for them is missing.

### 9. Major: knocked-over pieces aren't drawn lying down, several kinds have no model, and the departures aren't recorded

- **Where:** `client/src/pieces.ts:49-56`,
  `content/sprites/furniture-models.json`, `docs/design.md:456` and
  `:515-516`, and `docs/notes/plan-slice-11-art.md:83-85`.
- **What the spec says:** its "In this slice" asks for "furniture at its
  footprint … each piece also lying down". ADR 0017 says "toppled pieces
  need a lying-down sprite".
- **What was built:**
  - Every piece knocked over is still slice 13's one bar in the kind's
    colour. The three that cats knock over (the plant, the lamp and the
    toys) each show as that bar, the toys with scattered yarn added.
  - The lamp, scratching post, box, toys and bowls have no model, so they
    stand as plain blocks.
  - Furniture is boxes in JSON, not PNGs. That is a sound choice, and
    still data.
- **What wasn't recorded:**
  - the plan's execution log is empty;
  - design.md still says "Until slice 11, furniture is shaded blocks"
    (`:456`) and "Sprites are grids … drawn by Claude as code" (`:515`);
  - "about 8 colours a coat" became 6 slots (no white, one shade).

  AGENTS.md asks for a settled decision's change to go into design.md in
  the same commit.
- **Would a test catch it?** No.

### 10. Major, for the user's judgement: in six poses the three builds share one outline

- **Where:** `content/sprites/png/cat/{round,slim,striped}/`, for nap,
  eat, play, lap, scratch and knock.
- **The story:** each cat is "recognisably themselves … by their faces,
  markings and shapes, not only their coats, in every pose".
- **Where they differ:** the builds do differ by outline sitting, walking,
  sitting away and greeting (Mochi against Burakku: 32 to 61 pixels).
- **Where they don't** (outline pixels that differ):

  | Pose | Mochi / Burakku | Mochi / Tora | Burakku / Tora |
  | --- | --- | --- | --- |
  | lap | 0 | 0 | 0 |
  | knock | 0 | 0 | 0 |
  | nap | 2 | 2 | 0 |
  | eat | 4 | 4 | 0 |
  | play | 1 | 0 | 1 |
  | scratch | 3 | 0 | 3 |

  In those poses Mochi and Burakku differ by 4 to 14 pixels' slots, so
  only their coats tell them apart.
- **The builder's flags, measured:**
  - **Held and perch** differ by 75 outline pixels, but both are an
    upright cat facing the viewer.
  - **On a lap and asleep** differ by 64.
  - **Tora's coat against the day floor:** his base is at 1.42 to 1.96:1
    contrast on the three floor shades (Mochi 1.74 to 2.40, Burakku 4.7
    to 6.5). His darker coat shade is lower still, at 1.32 to 1.82.
  - **Burakku at night** is at 2.3 to 2.7:1 on the floor.
- **What I'd ask the user to look at:** whether the builds read apart
  asleep, on a lap and eating; whether Tora by day and Burakku by night
  read against the floor.

### 11. Minor: a held cat covers its holder's face

- **Where:** `client/src/render.ts:401` (`lift + 6`).
- **Scenario.** Someone holds Mochi. The 24-px held frame is drawn 6 px up
  on a 32-px person, so the cat's face covers theirs: 34 of their 42 skin
  pixels are hidden, and only their hair shows above it.
- **Not new:** on `main`, a 16-px cat 6 px up covered most of a 16-px
  person too. The 6 is still the 16-px value, though, and a lift of about
  2 would hold the cat at the chest below the chin. This is the user's
  line, "nothing drawn over what it shouldn't hide".
- **Would a test catch it?** No.

### 12. Minor: the sofa's model draws its arms in the wrong order

- **Where:** `content/sprites/furniture-models.json:2-39`: back, the arm at
  x 0.02, seat, the arm at x 0.86.
- **Scenario.** Low x is nearer the viewer, so the near arm is drawn
  before the seat that should be behind it, and the far arm after the seat
  it should be behind. Against the order back, far arm, seat, near arm,
  261 pixels differ, and the far arm's face paints over the seat's top at
  the far end. The notes say the parts are "listed in the order they're
  drawn (back to front…)".
- **Would a test catch it?** No: the sofa test counts colours. A test
  using `iso.ts`'s own `behind` would catch it: for each model, no part
  listed after another may lie wholly behind it.

### 13. Minor: the slice's sizes and hit boxes are held by no check

- **Where:** `client/test/render.test.ts`, `client/test/stage.test.ts` and
  `spec/browser.test.ts` (`CAT_PX` aims).
- **Mutations that pass all 242 client tests:**
  - a cat sized from `TILE` instead of its image;
  - cats or people picked by a 16-px box;
  - a 24-px cat mirrored about 16 px, which would shift it 8 px left
    whenever it faces left;
  - the "you" marker at the old 16-px offsets;
  - a person placed at 16;
  - the held lift at 0;
  - the carried lift at 16 + 6.
- **The browser checks too:** with cats picked by a 16-px box again, all
  33 browser checks still pass against the running café. Their aims at "a
  24-px cat's middle" (`CAT_PX / 2 - 2`) fall inside both boxes. So "a cat
  is picked where its 24-px sprite is drawn" and "a person stands, is
  mirrored and is picked at 32 px" are held by nothing.
- **What would hold them:** tests at the sprite's edges (a point 10 px
  from the middle picks the cat; one 13 px out doesn't), and a mirrored
  frame drawn at the same place.

### 14. Minor: shadows cast from the parts are held by no test

- **Where:** `client/src/shadows.ts:54` and `:106`;
  `client/test/shadows.test.ts:109-113`.
- **Mutations that pass `shadows.test.ts` and `render.test.ts`:**
  - light never passes under a raised part (`lo = 0`);
  - every part darkens the floor at its foot;
  - shadows cast from the old single block.
- **Why:** the one changed expectation (3.24 → 3.26) is within `FOOT` of
  both the pot and the old block. The window-seat test imports
  `shadowMask` and only `void`s it.
- **What looks right:** in the screenshots, light does show under the
  window seat's board.

### 15. Minor: "no stray pixels" is held by nothing, and the spec's table names the wrong check

- **Where:** `scripts/sprites.ts:98-111` and the spec's table
  (`docs/slices/11-cats-you-can-tell-apart.md:48`).
- **Scenario.** A single outline-coloured pixel in an empty corner of
  `round/sit.png` passes the script, so it passes the sheet test once the
  sheet is regenerated. Only a colour outside the slots is refused.
- **Today's art is clean:** none of the 48 cat frames or 6 person frames
  has a detached pixel. The cleanliness is a property of the art, though,
  not of a check.
- **The table:** it says colours are held by "`cargo test` (the content
  loader)". The server reads only the sizes, and the colour check is the
  client's `sheets.test.ts`.
- **What would hold it:** a connected-pixels check in `sheets.test.ts`.

### 16. Minor: Mochi's day coat is the art's colour key, so changing her coat breaks every cat PNG

- **Where:** `scripts/sprites.ts:87-92` (`CAT_KEY` from
  `coats.white_grey`; `PERSON_KEY` from avatar 0) and
  `content/sprites/README.md`.
- **Scenario.** Change `white_grey`'s base in `coats.json`, which the
  README calls a data change, and run `scripts/palettes.ts`. The sheet
  test then fails on every frame ("round:sit at (10, 2): #cdd6f4 is not
  one of the coat's … slot colours") until `scripts/cats.mjs` redraws all
  48 PNGs.
  - A *new* coat is still a data change.
  - Changing skin 0, hair 0 or shirt 0 breaks the people's PNGs the same
    way.
- **The README is stale:** it still says the `*.txt` files are the
  sprites. It doesn't mention `png/`, `scripts/sprites.ts`, or that
  `cat.txt` and `avatar.txt` are written by the script.
- **Fix:** a fixed key of slot colours of its own, and the README
  brought up to date.

### 17. Minor: a `.DS_Store` beside the build folders stops the script and the sheet test

- **Where:** `scripts/sprites.ts:119`
  (`readdirSync(dir).sort()`, then `readdirSync` of each entry).
- **Scenario.** Open `content/sprites/png/cat/` in Finder. The script and
  `sheets.test.ts` then fail with `ENOTDIR … png/cat/.DS_Store`, so
  `pnpm check` fails on the user's Mac. Git ignores the file, so CI
  wouldn't see it.
- **Fix:** keep only directories.

### 18. Minor: a cat file naming an unknown build still starts the café

- **Where:** `server/src/cats.rs:73-78` and `client/src/sprites.ts:137-140`.
- **Scenario.** `build = "fluffy"` in `burakku.toml`:
  - the server starts and sends it;
  - the client falls back to the round build's frames without a word;
  - only `cargo test` (`every_sprite_the_client_draws_exists_at_its_size`)
    catches it.
- **The build check has no test of its own:** removing it passes every
  cargo test.
- **What holds:** "a new cat is a data file" holds for a cat of an
  existing build. A new build is PNGs, which is data, though here the
  agent draws them with code (`scripts/cats.mjs`'s `BUILDS`).

### 19. Minor: nothing holds that a cat's back view shows no face

- **Where:** `client/test/sprites.test.ts:100-135` and `:139`.
- **Scenario.** The facing test takes its "eyes" branch for any frame
  with eye pixels, back views included, and checks only that the eyes are
  right of the middle. The "no face on a back view" test covers people
  only.
- **Today's art is right:** every `back_` cat frame has 0 eye pixels.

### 20. Minor: the perched frame is keyed on the kind's name, not on the content's `perch` flag

- **Where:** `client/src/render.ts:699`
  (`standingOn(...)?.kind === "window_seat"`).
- **Scenario.** Mark another kind `perch = true` in
  `content/furniture.toml`. Cats perch there, but are drawn sitting.
  `FurnitureView` doesn't carry the flag, so the client can't know it.

### 21. Minor: the record

- **The judged sheet was overwritten.** The user approved Mochi at 03:53
  AEDT, from the sheet at commit `5afa641`. Her sit, nap, lap and greet
  frames were then mirrored (`aa87ae3`, 04:06), and
  `docs/notes/screens/slice-11/mochi-sheet.png` was overwritten. The
  sheet the notes show as "judged" is no longer the one judged.
  - They are exact mirrors, so only facing changed.
  - The notes do say the sitting and sleeping cats "were turned".
  - Keep the judged sheet under its own name.
- **A deleted script cited:** `docs/notes/slice-11-art.md:13` cites
  `screens/slice-11/scripts/mochi.mjs`, deleted in `8769104`.
- **A test's title overclaims:** `client/test/sheets.test.ts:23` loops
  only over `["round"]` while saying "every build". `sprites.test.ts` and
  cargo cover the other builds.

## What I checked and found sound

- **Builds and checks:** everything builds and every check passes, as
  above.
- **The protocol.**
  - `build` is required in `CatDef` and checked to be a lowercase name.
  - It is sent in `CatView`. The only message carrying a `CatView` is the
    welcome, and on the running café the welcome named `slim`, `round` and
    `striped`.
  - `client/src/protocol/CatView.ts` is unchanged after `cargo test`
    regenerates it.
  - `CatDef` isn't saved, so no save needs migrating.
- **The pipeline, by mutation.** The sheet test fails on:
  - a hand edit of `cat.txt`;
  - a PNG changed or deleted without the script run.

  The script refuses a semi-transparent pixel, a 16-bit PNG and a
  paletted PNG. A fully clear pixel of any colour reads as clear. A
  30-px frame is caught twice (`sprites.test.ts`, and cargo). `cats.mjs`,
  `people.mjs` and `sprites.ts` reproduce every committed PNG, sheet and
  text file byte for byte.
- **The frames.**
  - Removing the perch, lap or held branch, or drawing every cat sitting,
    each fails a `catFrame` test.
  - Scratch, greet and play-with show for 1.2 s on the server's clock.
  - Every frame faces right, and the mirroring follows the walk.
  - Back views show no eyes.
  - The shipped round frames are byte-identical to the judged
    `docs/notes/screens/slice-11/mochi/*.png`.
- **The drawing.**
  - The "you" marker and emotes sit over the middle of the sprite.
  - A lap cat is drawn over its sitter with the sitter's face showing
    (phase 3's finding 31).
  - The window seat stands on legs with floor under it, and the cushion is
    low.
  - The cat tower's parts draw in a sensible order.
  - A kind with no model, or knocked over, keeps its one block, and the
    block's hit stays consistent with it.
