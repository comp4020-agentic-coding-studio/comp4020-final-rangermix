# Findings: the sitting pose's review fixes

Read cold, 2026-11-09, against the brief
([sitting-pose-fixes-brief.md](sitting-pose-fixes-brief.md)). Reviewed the
unstaged diff (`git diff`) against the staged change (`git diff --cached`).

Fixes 2 and 3 are right. Fix 1 is right for a viewer who stays connected,
but a viewer who reconnects can still see the old bug (finding 1). Fix 7's
account names and password are right, but the script no longer runs
against the café as it stands (finding 3). No finding breaks anything in
`CLAUDE.md`'s "What the app must keep".

## How it was checked

- `pnpm -C client check`: the typecheck is clean and all 435 tests pass.
- **The new tests fail without their fixes.** The working tree's tests were
  run against a copy of the staged source in `/tmp`:
  - render, "stands a sitter up where they sit…": `expected 'back' to be 'stand'`.
  - render, "naps a lap cat on the seat's top…": `expected 13 to be 9`.
  - state, "keeps the front…" and "…through a reconnect…": `back` against `front`.
  - state, "keeps the side they walked up with when nothing under them
    seats anyone" passes before and after the fix. That is right: it checks
    that the fix doesn't apply where it shouldn't.
- **The cleanup moved no pixel.** The staged `render.ts`/`state.ts` and the
  working tree's were loaded side by side and compared on 34 states:
  - The states: on each of the sofa, a chair, the window seat and the
    cushion, someone seated; seated with a lap cat; seated holding a cat;
    standing in front of it; up on it without sitting; a cat napping on it
    alone; walking several steps off it, sampled at six times. Also someone
    marked as sitting on a table, and a walker crossing the room.
  - What was compared: every `drawImage` (frame, position, mirror), every
    `fillRect`, `drawOrder` (label, lift, footprint, layer), `personLift`,
    and `hitAt` on a 3 px grid over 400×300.
  - The results: everything is identical except a lap cat on a toppled seat
    (four cases). There the cat's lift goes from 8 to 0, as fix 2 intends.
  - Seated lifts are unchanged. The lap row is 19 in both frames,
    `FIGURE` is 30 (the constant `stage.ts` had before), so the
    speech-bubble anchor is unchanged too.
- **The paths the brief names:**
  - `personJoined` only adds people coming in from the door.
  - `personPlaced` moves someone from the window to inside, also from the
    door.
  - A walk of several steps off a seat shows the walk's own direction while
    the walk is held, and `keepFacing` keeps its last step afterwards.
  - A seat can't be toppled today: only the plant, the toys and the lamp
    have `knocks` in `content/furniture.toml`.
  - A seat can't be moved while someone sits on it: `can_lift` refuses with
    "Someone's sitting on it", and `check_place` counts the tiles people
    stand on. Furniture sets aren't built yet.
- **A second source of a one-tile walk:** someone seated on the cushion who
  walks to their own tile. `room.path` gives `[from]` when `from == to`.
  The fix covers this in-session, since `seatUnder` counts the cushion.

## Findings

### 1. A viewer who reconnects still sees a sitter, stood up where they sat, with their back to the room

**Severity: low.** The effect is only visual, and the sitter turns as soon
as they next walk. The timing is narrow too: the viewer's connection has to
drop while a sitter stands up where they sit. But this is the bug fix 1 was
for, on a path the brief named (reconnects through `fromWelcome`).

**Where:** `client/src/state.ts:267-276` (`personMoved`),
`client/src/state.ts:278-282` (`personSat`) and
`client/src/state.ts:124-127` (`fromWelcome`).

**What's wrong:** "front" is written into `state.facing` only when this
client sees the stand-up's `personMoved`. Until then, `facing` holds the
side the sitter walked up with: `personSat`'s `keepFacing` records it, and
the drawing just overrides it while they sit. If the viewer misses the
`personMoved`, the next welcome shows the sitter standing on the seat, no
longer sitting, with no walk. `fromWelcome` keeps the old `facing` map, so
they are drawn from the walk-up side.

**Scenario** (seen failing in a scratch test outside the repo):
1. Viewer 1 sees sam (id 2) walk up the screen to a sofa at (4,6):
   `personMoved` with path (2,6) → (3,6) → (4,6).
2. Viewer 1 sees `personSat` at (4,6). Sam is drawn sitting, facing front.
   `facing.p2` is `back`.
3. Viewer 1's connection drops. Sam takes a piece from the catalogue, and
   `furniture.rs`'s `stand_up` sends a one-tile walk, which the server ends
   on its next tick.
4. Viewer 1 reconnects. The welcome has sam at (4,6) with `sitting: false`
   and `walk: null`.
5. `facing.p2` is still `{ view: "back" }`, so sam is drawn standing on the
   sofa with their back to the room.

**Fix:** write "front" when the sitter is first drawn seated, not only when
they stand:
- in `personSat`, when `seatUnder` finds a seat at `msg.at`;
- in `fromWelcome`, for anyone the snapshot shows seated on a seat. This
  covers a viewer who reconnects while someone sits and then misses the
  stand-up.

Once both are in, the special case in `personMoved` is redundant but
harmless. The `personSat` change was tried in a copy: the scenario above
passes, and so do all 119 tests in `state.test.ts` and `render.test.ts`.

One case is left either way, and that's fine: if a viewer is disconnected
across both the sit and the stand-up, they never saw the sitter sit. Keeping
the walk-up side for them matches what they last saw.

### 2. No test checks `seatUnder`'s toppled condition, though one test is named for it

**Severity: low.** It can't happen today, since no kind of seat can be
knocked over.

**Where:** `client/test/render.test.ts:1674-1676` and
`client/src/state.ts:112`.

**What's wrong:** "naps a lap cat on the seat's top when its sitter isn't
drawn seated" runs once with `toppled` false and once with `toppled` true,
and labels the second "the sofa toppled". But both runs also set
`seats: false`, so the sofa never seats anyone and the toppled check never
decides the result.

**Scenario:** a copy of the working tree with `!f.toppled` deleted from
`seatUnder` still passes every test that loads. The six test files that
couldn't load in the copy (auth, door, palettes, sheets, sprites, street)
don't mention seats, sitting or toppling. So if a seat could ever be
knocked over, a sitter would be drawn seated on the fallen piece and no
test would catch it.

**Fix:** in the toppled run, keep `seats: true` so the toppled check is
what makes the sitter stand.

### 3. `shoot.mjs` can't run against the café since slice 20

**Severity: low.** The app isn't affected; only the record's way to
reproduce the screenshots is.

**Where:** `docs/notes/screens/sitting-pose/shoot.mjs:125-128`.

**What's wrong:** the browser step fills `#signup input[name=name]` and
clicks `#signup button[type=submit]`. Slice 20 (merged as `b7f2586`, in
`HEAD`) replaced that form with `#way-in`, `#im-new`, `#look-step` and
`#sign-up`, and put the door (`#door-in`) in front of the café.
`client/index.html` no longer has a `#signup` form.

The screenshots in `docs/notes/sitting-pose.md` came from builds on
`8482519`, from before slice 20, so they don't show this change on today's
client either.

**Scenario:** run the script against a café built from `HEAD`. The four
WebSocket visitors sign up and sit, then `shoot()` times out at the first
locator. The script throws before its `leave` loop, so if `APP_URL` is the
live café, the four `agent_` visitors stay seated until the process exits,
and for the 30 s grace period after that.

**Fix:** drive the current way in in `shoot.mjs`: name and password, I'm
new, a look, Walk in, the recovery code, then the door's Walk in. Send
`leave` from a `finally` block. If the shots are retaken on `HEAD`, say so
in the notes.

### 4. The first review's findings aren't in the repo, and the numbering doesn't match

**Severity: low** (the process record).

**Where:**
- `docs/notes/reviews/` (no findings file for the first review);
- `docs/notes/sitting-pose.md:96-133`;
- `docs/notes/screens/sitting-pose/shoot.mjs:26`.

**What's wrong:** `CLAUDE.md` says a review's brief and findings are files
in `docs/notes/reviews/`. Only this round's brief is there.

The code and this brief cite the first review's findings as 1, 2, 3 and 7
(`shoot.mjs:26` says "finding 7"). The notes list four, numbered 1 to 4,
and say "All four were fixed". Probably findings 3 to 6 are the four
tidy-ups, but nothing in the repo says so. A reader, or `PROCESS.md`,
can't check that every finding was fixed or answered.

**Fix:** add the first review's findings file, or number the notes'
review section as the review did, with 3 to 6 listed under the tidy-ups.

### 5. Nits

- **`lapRow` doesn't check what its comment says**
  (`client/src/render.ts:775-787`). The comment says it finds the first
  trousers row "below the shirt's hem". The code takes the first row with
  slot 4 in the middle column anywhere in the frame, while the tests' own
  helper (`render.test.ts`, `LAP`) checks only rows below 16. A redrawn
  frame with a trousers-coloured pixel higher up in that column would
  quietly move every seated lift. Adding the same `y > 16` check, or the
  shirt's hem, would match the comment. Throwing on a missing lap when the
  module loads is fine: the sheet tests would fail loudly.
- **The notes still name `seatOf` and `lapLift`, which are gone**
  (`docs/notes/sitting-pose.md:32, 46, 60`). The review section says
  `seatOf` became `seatTop`. It never says plainly that `lapLift` was
  removed, and that the lap cat's lift is now worked out in `drawOrder`.

## Not part of these fixes

The working tree also has unstaged changes to `README.md` and
`docs/prompts-result.md` (session 22's entry). `CLAUDE.md` says the README
is the user's. Whoever stages these fixes should pick their files rather
than stage everything.
