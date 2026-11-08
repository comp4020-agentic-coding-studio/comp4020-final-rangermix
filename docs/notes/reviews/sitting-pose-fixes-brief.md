# Review brief: the sitting pose's review fixes

You're reading this cold. Review the **unstaged** changes in the working tree
(`git diff`, not `git diff --cached`) against the staged sitting-pose change
(`git diff --cached`; context in `docs/notes/sitting-pose.md`).

The staged change draws seated people sitting. A review of it found these,
which the unstaged diff answers:

1. **A sitter stood up in place turned their back to the room.** Sitting
   forced a front-facing view only while drawing; `state.facing` kept the
   side they walked up with. The server's `stand_up`
   (`server/src/world/furniture.rs`) sends a walk of one tile, so
   `facingOf` fell back to the kept side. Fix: `apply`'s `personMoved` in
   `client/src/state.ts` keeps "front" for anyone drawn seated (a seat under
   them, `seatUnder`) before the walk replaces theirs.
2. **A lap cat could float over a standing figure.** `lapLift` assumed its
   sitter was drawn seated; when `lapOf` named a sitter but no seat was
   under them, the cat was lifted 8 px above the piece's top. Fix: the lap
   cat's lift is `seat top - LAP_DRAPE` when the sitter has a seat, else
   the piece's top, as for any cat.
3. Cleanup: no repeated seat/position work per frame (`seatTop`, `liftOn`);
   `LAP_ROW` read from the art per seated frame rather than hard-coded 19;
   one `FIGURE` constant in `render.ts`, built from `PERSON` and `feetAt`'s
   `FEET`, which `stage.ts` now imports; `seatOf` returning only the top.
7. `docs/notes/screens/sitting-pose/shoot.mjs` signed up non-`agent_`
   accounts with a published password. Now `agent_…` names and a per-run
   random password.

## What to check

- Is each fix right, and complete? Look for any path that still shows the
  old bug (reconnects via `fromWelcome`, `personJoined`, `personPlaced`, a
  sitter whose seat is toppled or moved, a walk of several steps from a seat).
- Did the cleanup change any drawn pixel or lift for anyone, sitting or
  standing, the speech-bubble anchor (`personLift`, `stage.figureToCss`),
  or clicks (`hitAt`)? Seated lifts should be unchanged: the art's lap row
  is 19 in both frames.
- Do the new tests (`client/test/render.test.ts`, "the sitting pose's
  review"; `client/test/state.test.ts`, "a sitter stood up where they sit")
  test the behaviour, and would they fail without the fix?
- Anything in `CLAUDE.md`'s "What the app must keep" the change breaks.

Run `pnpm -C client check` if useful. Don't edit any file but your findings.

## Output

Write findings to `docs/notes/reviews/sitting-pose-fixes-findings.md`:
numbered, each with file:line, what's wrong, a concrete failing scenario,
and severity. Say plainly if you found nothing. Your final message only
needs to say the file is written.
