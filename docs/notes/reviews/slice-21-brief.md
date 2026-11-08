# Brief: review of slice 21, "Told how the café works, on the way in"

Slice 21, by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold.

**How to work:**
- Work read-only: change no file in this checkout except your own
  findings file, `docs/notes/reviews/slice-21-findings.md`.
- Build and run code only in a throwaway copy under your own scratch
  directory (`git archive d580206 | tar -x -C <dir>`, then symlink the
  checkout's `node_modules` and `client/node_modules` into it), never in
  this checkout.
- Don't use ports 8080 or 8091: other cafés run on them. Use port 8131,
  with a fresh `DATA_DIR`, run from the copy's root (it reads `content/`
  from the working directory), with `CLIENT_DIR` pointing at the copy's
  built client (`npx vite build` in `client/`). The server reads the
  client's build id once, as it starts: **build the client first, then
  start the server, and restart it after any rebuild**, or every page
  reloads itself as for a new build (and that reload, by design, brings
  no guide). A server binary is already built from this source at
  `/Volumes/External/Users/rangermix/.claude/jobs/4a44851d/tmp/target/debug/cafe`
  (the slice changes no Rust). Point the spec at it with `APP_URL`.
- The demo checks need the café seeded first:
  `CAFE_DEMO_PASSWORD=catppuccino cafe demo seed` with the same
  `DATA_DIR`, then start the café, and give the spec
  `APP_DEMO_PASSWORD=catppuccino` (a local password, not the live one).
- Stop only the servers you start, by their own process IDs (never
  `pkill` by name).
- Don't touch the live café or the Fly app.

Review what slice 21 adds: `fa7ee7b..d580206` on branch
`worktree-slice-21-guide` (`git diff fa7ee7b d580206`, `git log
fa7ee7b..d580206`).

## What to read

- **The spec:** [`docs/slices/21-told-how-the-cafe-works.md`](../../slices/21-told-how-the-cafe-works.md):
  every "done when" line and how it's held, the guide's words, and the
  user's five answers. The user's words, 2026-11-09: "add an information
  button top right, left to "Add furniture". The button should show an
  overlay when clicked, explain the basics of the game, like how control
  work with mouse or keyboard, cat and time machenism, floating panel,
  etc. keep it simple. the overlay shows on entering the cafe by default.
  a "got it, no pop-up next time" checkbox at the end of the information
  overlay stops it being pop-up automatically again. on closing the
  overlay, animate it to shrink to the top right info button."
- **The design:** `docs/design.md`, "The client", the bullet "The guide".
- **The rules:** `AGENTS.md`'s "What the app must keep".
- **The plan** and its execution log,
  [`docs/notes/plan-slice-21-guide.md`](../plan-slice-21-guide.md).
- **The code:**
  - `client/src/guide.ts` (new), `client/src/main.ts` (`enter`'s
    `reload`, the guide built, opened, closed before the nudge and in
    `stop()`), `client/index.html` (the ⓘ, the guide's markup and
    words), `client/src/style.css`.
  - Tests: `client/test/guide.test.ts`, `spec/guide.test.ts`,
    `spec/helpers.ts` (`guideOff`), and every spec file changed to start
    its browsers with the guide off (`spec/balcony.test.ts`,
    `spec/browser.test.ts`, `spec/fill.test.ts`, `spec/music.test.ts`,
    `spec/welcome.test.ts`).
- **The screens:** `docs/notes/screens/slice-21/` (written by
  `spec/guide.test.ts`).

## Out of scope

- The look of the room, the cats and the furniture.
- The README, which is the user's.
- Earlier work this slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold.

- **Changed checks.** Every existing browser check now starts with
  `cafe.guide` set to `"off"`. Does that hide a real regression a
  visitor would meet (a check that would now fail for a newcomer for a
  reason other than the guide being in the way)? The two blocked-storage
  checks close the guide first: right?
- **The modal.** While it's open: is anything of the café reachable by
  Tab, click, tap, or a key the café listens for on `document` (the
  drawer's Escape, the music's first press, the presence ping)? Can it
  be left open over a café that's gone (Leave, walked out, signed out,
  the second-tab page, the café waking, an outdated build)? The "Still
  there?" nudge must be seen.
- **The shrink.** Does it land on the ⓘ wherever the ⓘ is (both phone
  layouts, a status bar that wraps, a resize mid-shrink, the demo bar)?
  What if it's opened again mid-shrink, or closed mid-grow? Are clicks
  during the shrink harmless? Reduced motion.
- **When it pops up.** Every entry but the café's own reload, until
  ticked; the tick saved as it changes; storage blocked. Could the
  reload note make a real entry skip it, or the reverse?
- **Every action by keyboard, touch and mouse** at 390×844 and
  1920×1080, through a resize. Focus on open and on close. Screen
  readers: the dialog's name, the hidden lines really hidden, the ⓘ's
  name, the checkbox's label.
- **The words.** True to what the café does now (check them against
  the code: the menus' labels, the layouts' button names, the panels'
  behaviour), and free of any cat's name or any number from `content/`.
- **Contrast** of the guide's text and controls in both themes.
- **The status bar** at 390 px in both layouts, with and without the
  demo bar, now that it holds one more button.

## What to write

`docs/notes/reviews/slice-21-findings.md`: what you ran, then each
finding with a severity (critical, major, minor, nit), where it is, what
goes wrong and how you showed it, and what would hold it. Say plainly
when a line of the spec is held as claimed.
