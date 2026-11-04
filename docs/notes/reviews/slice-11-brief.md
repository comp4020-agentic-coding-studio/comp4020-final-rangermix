# Brief: review of slice 11, "Cats you can tell apart"

By [ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 6057aea | tar -x -C <tmpdir>`), never in this
checkout. Run the café on port 18915 with a fresh `DATA_DIR`, from the
copy's root (it reads `content/` from its working directory), and point the
spec at it with `APP_URL`. Don't use ports 8080 or 18820 to 18825. Stop
only the servers you start, by their own process IDs. Don't touch the live
café or the Fly app.

Slice 11 is on branch `slice-11-wip`, merged with `main` (slices 12 to 14,
reviewed and live). Review what slice 11 adds: `git diff origin/main...6057aea`
(the three-dot diff, slice 11's own changes).

## What to read

- **The spec:** [`docs/slices/11-cats-you-can-tell-apart.md`](../../slices/11-cats-you-can-tell-apart.md),
  every "done when" line, its numbers (cats about 24 px, people 32 to 36,
  about 8 colours a coat) and its settled open questions (one cat first,
  judged by the user, then the rest).
- **Why:** [ADR 0017](../../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)
  (the agent draws PNGs that the client turns into palette slots) and
  [ADR 0018](../../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
  (32-px tiles kept; back views).
- **The record:** [`docs/notes/plan-slice-11-art.md`](../plan-slice-11-art.md)
  (a draft written before the user's judgement) and
  [`docs/notes/slice-11-art.md`](../slice-11-art.md) (where it stands, what
  was judged, and what departed from the plan); the sheets in
  `docs/notes/screens/slice-11/`.
- **`AGENTS.md`'s "What the app must keep"**, above all "cats change
  through `content/`, not code", "generated TypeScript is never edited by
  hand", and every action by keyboard, touch and mouse at 390×844 and
  1920×1080.
- **The code:** `scripts/cats.mjs`, `scripts/people.mjs`, `scripts/sprites.ts`
  (PNG decoding, the slot keys, the sheets); `content/sprites/png/`,
  `cat.txt`, `avatar.txt`, `furniture-models.json`; `content/cats/*.toml`
  (`build`); `server/src/cats.rs`, `protocol.rs`, `world/cat_life.rs`,
  `content.rs` (the build on the wire and the sprite checks);
  `client/src/protocol/CatView.ts` (regenerated); `client/src/sprites.ts`,
  `render.ts` (`catFrame`, sizes from the image, `spriteBox`, people,
  `drawCarried`), `pieces.ts` (`pieceParts`), `shadows.ts` (parts as
  shadow boxes), `stage.ts` (`FIGURE`); their tests (`sheets`, `sprites`,
  `render`, `shadows`, `stage`, `floating` and the fixtures given `build`)
  and `spec/browser.test.ts`'s changed aims.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold:

- **the pipeline:** does the sheet test fail on a hand edit and on a PNG
  changed without the script run? Can a stray colour, a semi-transparent
  pixel, a 16-bit or paletted PNG, or a wrong size slip through? Is "a new
  coat is a data change" still true, and "a new cat is a data file" (a new
  build needs its PNGs, from a script: is that data or code)?
- **the frames:** each pose the server sends and each reaction that has a
  pose picks its frame; what about `hide`, `knock` (no link from the
  server), a held cat, a cat on a lap or up on the window seat, a cat
  walking away; facing (every frame head right, mirrored by direction);
  the back views showing no face.
- **sizes:** 24-px cats and 32-px people placed, mirrored, picked and
  bubbled where they're drawn, at 1× to 5×; their emotes and the "you"
  marker; what they now hide that they didn't (a 32-px person covers the
  tiles behind them; a 24-px cat covers a small piece); the checks that
  aim at a sprite's middle.
- **the furniture's parts:** drawn back to front in the model's order,
  sorted against figures and other pieces, picked by the whole piece, and
  casting shadows from the parts (a raised part lets light under it); a
  toppled piece; a kind with no model; a model out of its footprint.
- **the protocol:** `build` validated, sent in every welcome and every
  cat message that carries a `CatView`, and the generated TypeScript
  unedited by hand.
- **the art against the spec:** "each cat is told apart from the others in
  every pose", "each piece reads as what it is, standing and knocked over,
  at both scales, day and night", and "nothing is drawn over what it
  shouldn't hide" are the user's judgements; say what the sheets and the
  café show you, and what you'd want the user to look at. The builder
  flagged: held and perched look alike, on a lap is close to asleep, and
  Tora's orange tabby coat blends with the peach wood floor by day.
- **the checks:** can any pass without the behaviour it names?

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-11-findings.md`.
