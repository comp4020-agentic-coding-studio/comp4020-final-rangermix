# Findings: review of slice 10, "Catppuccin by day and by night"

Brief: [slice-10-brief.md](slice-10-brief.md). Read cold at `d058076` (the
code from `0ae465f`). Built and run only in a throwaway copy
(`git archive d058076`), never in the repo. Nothing live was touched.

**Count:** 0 critical, 1 major, 5 minor.

## What was run

- `node scripts/palettes.ts` in the copy (Node 24.21.0, as `mise.toml`
  pins), then a diff against the committed `content/sprites/palettes.json`:
  byte for byte the same.
- `pnpm typecheck` and `pnpm -C client check`: 136 client tests, green.
  `cargo test`: 303 unit tests (1 ignored), then 5, 4, 3 and 1, all green,
  including both palette tests. `cargo fmt --check` and
  `cargo clippy --all-targets -- -D warnings` are clean.
- The spec against a local café (`PORT=18510`, fresh `DATA_DIR`): 68 passed,
  1 skipped (`restart.test.ts`, which needs `APP_RESTART`). All 25 browser
  checks passed, including the new theme check and both slice 07 waking
  checks.
- Mutations in the copy, one at a time, each restored afterwards:
  - `render.ts:371` (`sprites.light = light`) commented out;
  - `sprites.ts:144`'s cache key without the light;
  - `stage.ts:161` passing `canberraHour()` where `lightAt(canberraHour())`
    goes;
  - the dark theme's `--card` set to its `--paper`;
  - the board's backdrop closing on `pointerdown`, so the click goes
    through to the room.
- Browser probes against the local café. Each one only changes what a
  single page is shown, or its clock (`page.clock`):
  - the canvas's own pixels at 10:00, 18:00 and 22:00, and on one open page
    taken from 16:59:50 past 17:00 and on to 21:00;
  - computed styles: the placeholder, disabled buttons, the card;
  - screenshots of the board, the talk bar with its buttons disabled, and
    the sign-up card in each theme;
  - which element sits under the backdrop check's old and new points;
  - the scattered toys' pixels by day and by night.
- Contrast worked out separately, with a throwaway Node script using the
  WCAG formula, for every colour the page draws text or controls in, in the
  new themes and the old ones.

## Findings

### 1. Major: nothing holds that the page draws in the hour's light. Three one-line slips each leave every check green, and one paints the café in night colours all day

- Where: `client/src/stage.ts:161` (the only place that turns the hour into
  a light), `client/src/render.ts:366-371` (`draw` sets the frame's palette
  and `sprites.light`), `client/src/sprites.ts:144` (the cache key).
  Held by: `client/test/canberra.test.ts`, which tests `lightAt` and nothing
  past it, and `client/test/render.test.ts:168-196`, which sets
  `sprites.light = light` itself (line 184) before it calls `draw`.
- The spec's line (`docs/slices/10-catppuccin-by-day-and-by-night.md:46`) is
  "The palette **in use** at each hour follows 'Numbers to tune'", held by
  the `canberra` tests. Those hold `lightAt`'s table. Nothing holds that the
  page uses it. Each of these passes typecheck, all 136 client tests and the
  spec. I ran each one in the copy:
  1. `stage.ts:161` passing the hour, not the light:
     `draw(..., canberraHour())`. `draw` takes `light: number`, so it type
     checks. `paletteAt(hour)` is the night set for every hour from 1 to 23,
     and the day set only from midnight to 1:00. The café is in night
     colours all day.
  2. `render.ts:371` dropped. The stage's `Sprites` stays at light 0, so at
     22:00 the room sinks to night while every cat, person, face in the
     window and emote stays in day colours.
  3. `sprites.ts:144` keyed by name alone. A sprite keeps the first light
     it was drawn in for the whole visit. Someone who comes in at 16:00
     still sees day-coloured cats at 22:00.
- Today's code is right. My probe read the canvas's pixels: at 10:00, 18:00
  and 22:00 the floor, the glass and an avatar's slots were each in that
  light's set, and one page left open moved to the evening set at 17:00 and
  to the night set at 21:00 without a reload. Nothing in the repo holds
  that, though.
- Would a test catch it: none does now. Fixes, either or both:
  - Type `draw`'s last parameter as `ReturnType<typeof lightAt>` (or
    `0 | 0.5 | 1`), so slip 1 won't compile.
  - Have the render test leave `sprites.light` alone and assert that `draw`
    set it. Add a `Sprites` test that a sprite asked for at light 0, then at
    light 1, is coloured from each set: a stub `document.createElement`, or
    a spy on `toRgba`.
  - Best, since it catches all three: a browser check with `page.clock` at
    10:00 that reads the canvas for `palettes.day.room[0]` and a coat slot,
    then fast-forwards the same page to 22:00 and reads them again for the
    night set.

### 2. Minor: the talk box's placeholder is below 4.5:1 in both themes, and the contrast test can't see it

- Where: `client/src/style.css:43` (`input` sets no `::placeholder`
  colour); `client/index.html:105` ("Say something…");
  `client/test/contrast.test.ts:14-20` (it reads only the `:root` tokens).
- Scenario: any visitor, either size. Chrome draws the placeholder in its
  default `#757575`; the probe's computed style is `rgb(117, 117, 117)` in
  both themes. On Latte's base that is **4.07:1**, and on Mocha's base
  **3.56:1**. The spec's line is "Text and buttons on the page meet 4.5:1 ...
  in both themes" (`:47`). The slice made it a little worse: it was 4.28 on
  the old light paper and 3.80 on the old dark one.
- Nearby, for the same decision:
  - **Disabled buttons:** `style.css:40`'s `opacity: 0.6` puts a disabled
    label at about 3.0:1 in the light theme (2.7:1 on a primary button),
    down from 4.2:1 before. That covers the emotes while the café wakes,
    "Add furniture" with full arms, and the sign-up buttons while a request
    is out. WCAG 1.4.3 exempts inactive controls, but the spec makes no
    exception. Either say in the spec that it follows WCAG's exemption, or
    lift them.
  - **The trust bar:** the fill against its track (`style.css:137-138`,
    accent on line) is 2.98:1 in light, just under the 3:1 WCAG asks of a
    graphic that means something. It was 3.48 before. The words beside it
    give the level, so this is the least of the three.
  - **The theme check's "every control still shows"**
    (`spec/browser.test.ts:863-864`) asserts only that the talk box's text
    isn't the body's background colour. With the dark theme's `--card` set
    to its `--paper`, the contrast test still passed. The rule is held by
    the contrast test's pairs; this line adds little.
- Would a test catch it: no. `contrast.test.ts` reads tokens, and a colour
  the browser picks itself never goes through one. Fix: add
  `::placeholder { color: var(--muted); opacity: 1; }` (5.53:1 and 7.37:1),
  and a pair for it in the contrast test.

### 3. Minor: the scattered toys are drawn in fixed colours from the old palette, the same at noon and midnight

- Where: `client/src/render.ts:486-500` (`SCATTERED`'s `#c96f6f` and
  `#7a9cc6`, and the yarn's `#4a3426`). These are the old `palettes.json`'s
  `furniture[1]`, `[9]` and `[0]`, written into the code.
- Scenario: a cat scatters the toys at night. The knocked-over block goes
  to the night set, but the balls of yarn beside it stay in pre-Catppuccin
  red, blue and brown at full day brightness. The probe counted the same
  16, 8 and 3 pixels of those exact colours at 10:00 and at 22:00. The
  plan says "`render.ts` takes its room and furniture colours from the same
  palette", and design.md says "nothing laid over it", so these are the
  room's last colours left outside the light.
- Would a test catch it: no. Fix: take them from `FURNITURE` (slots 1, 9
  and 0), and add a toppled-toys case to the render test's fills.

### 4. Minor: the backdrop check's new point is bare floor, so its "no menu opened behind the board" can't fail

- Where: `spec/browser.test.ts:712-719` (the point moved from the chair at
  (9,4) to (3,8)).
- Scenario: a click that gets through the backdrop to the room. At (3,8)
  there's nothing to open a menu for, so it walks, and nothing checks that
  you didn't walk. I made the backdrop close on `pointerdown`, so the click
  lands on the room. The check still failed, but only because the focus
  ended on the body, not the room. Its named assertion passed. The same
  leaky build with the point at the window seat (2,1) failed on "no menu
  opened behind the board: expected 1 to be +0". On the real build, (2,1)
  passes: at 1920×1080 the probe found (2,1) on the backdrop and clear of
  the board in both themes. (9,4) and (10,4) are under the board, as the
  log says.
- Would a test catch it: this is the test. Fix: use (2,1), the window
  seat's left tile, close to slice 02's finding 1 scenario at (3,1). Or
  also assert that no `personMoved` for you followed the click.

### 5. Minor: the README credit the spec lists isn't done, and the proposal the plan's log points to isn't anywhere

- Where: `docs/slices/10-catppuccin-by-day-and-by-night.md:32-33` ("credited
  in `/readme/` and the README's sources"), and
  `docs/notes/plan-slice-10-palette.md:173-175` ("the line is proposed in
  the slice's notes").
- What I found: `content/sprites/CREDITS.md` has MIT's full text with the
  right copyright line, which is what the licence asks, and
  `scripts/palettes.ts` names the source too. But `/readme/` serves only
  `README.md`, which links Catppuccin for the name and says nothing of its
  colours or licence. And no "slice's notes" file exists:
  `docs/notes/slice-10-palette.md` is in neither `d058076` nor `e8a6a6e`, so
  the proposed line is nowhere for the user to read. The spec says "Built"
  with one item in it still open.
- Would a test catch it: no, it's a judgement. Fix: write the proposed line
  into `docs/notes/slice-10-palette.md` (the file Task 5 records the live
  check in anyway). Then either keep the spec's item open until the user
  adds it, or reword it to say the credit is in `CREDITS.md` and the README
  line is the user's.

### 6. Minor: `palettes.json` is now generated, but nothing beside it says so, and nothing holds that it matches the script

- Where: `scripts/palettes.ts:99-103` (the coats, in code) and `:129-131`
  (it overwrites the whole file); `content/sprites/palettes.json`;
  `docs/design.md:435-445`.
- Scenario: someone adds a cat with a new coat the way it was done before,
  as a key in `palettes.json` (now in `day` and in `night`). The Rust tests
  pass. The next time anyone changes the mix and runs
  `node scripts/palettes.ts`, the new coat is silently dropped, and only
  `every_cat_coat_has_a_palette` notices. The other way to add a coat is to
  edit a `.ts` file and run it, which leans against "cats change through
  `content/`, not code". The plan's own constraint, "a coat is still a key
  in it", is true of the output only. Either way, nothing holds that the
  committed file is what the script writes: I checked by hand, and today it
  is.
- Would a test catch it: no. Fix: a client unit test that imports the
  script's `day` and `night` and compares them with `palettes.json`, so a
  hand edit or a forgotten run fails `pnpm -C client check`. Also a line in
  design.md (or a `_comment` key the loader skips) saying the file is
  generated and how a coat is added. Better still for the rule: the script
  reads each coat's day colours from data, and only derives the night ones.

## Not counted: for the user's judgement

- At 18:00 the window's glass is `#c1dfcd`, a mint green. It's halfway
  between day's sky (`#89dceb`) and night's lamplight yellow (`#f9e2af`) in
  sRGB, a hue neither set has. `room-18h.png` shows it, so the judged line
  can weigh it. If it reads wrong, the evening could take night's glass
  slot as it is, rather than the blend.
- Control borders against what they sit on are 1.6 to 1.8:1 in both themes
  (`--line`). That's no worse than before (1.3 to 1.4), and every button
  has a text label, so it isn't a finding.

## Checked and found sound

- **The palettes:** the script writes exactly what's committed. All 26
  Mocha values in it, and the page's Latte and Mocha tokens, match
  `@catppuccin/palette`'s `css/catppuccin.css`. The day set is exactly the
  study's "led" mix in
  `docs/notes/screens/visual-direction/scripts/gen_palettes.mjs`.
- **Every slot the sheets use is in both sets:** room uses 0–6 and 8–12 of
  13, furniture 0–15 of 16, cats 0–5 of 6, avatars 0–5 of the 7 built,
  emotes 0–4 of 5. The Rust test compares the two sets' key paths and
  lengths, and the client test colours every sheet at 0, 0.5 and 1,
  including all 24 avatar looks.
- **The night window:** `night.room[8]` is Mocha's yellow, and
  `render.ts:438` draws `ROOM[8]` as the glass. The probe found all 1,040
  glass pixels in it at 22:00. The two yellow pixels by day are the door's
  knob (`day.room[10]`), the same colour.
- **The light:** `lightAt` gives 1 at 0 and 5, 0 at 6, 11, 12 and 16, 0.5
  at 17 and 20, and 1 at 21 and 23, as "Numbers to tune" asks, with the
  afternoon kept as day per the spec's settled question. `canberraHour`
  reads `Australia/Sydney` (Canberra's clock) in `h23`. At the daylight
  saving changes the skipped or repeated hour is 2:00, night either way.
- **A frame as the hour turns:** `draw` sets the palette and the sprites'
  light once, at the top of one synchronous call, so a frame can't mix
  lights. An open page changes at 17:00 and 21:00 on its own.
- **Blending and caching:** `blendAll` walks every list, so the evening is
  blended slot by slot. Only 0.5 ever reaches the `blended` map, and the
  sprite cache holds at most three lights of a bounded set of names, so
  neither grows without end. `auth.ts`'s own `Sprites` stays at light 0, so
  the sign-up card's avatar previews are in day colours, which match its
  day swatches. `ROOM` and `FURNITURE` are read only inside `draw`'s call
  tree, and nothing calls a `paint` outside it.
- **The page:** the contrast test's nine pairs work out the same in my own
  sums: 7.06, 5.53 and 5.41 for ink, muted and links in light, and 11.34,
  7.37 and 7.10 in dark. The colours written in place clear 4.5:1: bubble
  text 15.0, the bubble's "to" 5.75, the board 10.4 and its hints 8.0, and
  the board's Close button 5.41 in light and 9.27 in dark. The screenshots
  and probes show nothing unreadable at either size apart from finding 2.
- **The theme check** holds that the page follows the setting, not just one
  colour: it expects Latte's base under `light` and Mocha's under `dark` at
  both sizes, so losing the dark media query fails it. A dark theme missing
  a token fails the contrast test ("a token is missing").
- **No wash:** the render test fails if anything fills at under full
  strength, and `nightTint` is gone from code and design.md.
