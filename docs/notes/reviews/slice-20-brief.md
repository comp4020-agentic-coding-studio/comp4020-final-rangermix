# Brief: review of slice 20, "Welcomed back by name, or someone else"

Slice 20, by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
reviewers who didn't build the slice read it cold.

**How to work:**
- Work read-only: change no file in this checkout except your own
  findings file (named in your instructions).
- Build and run code only in a throwaway copy under your own scratch
  directory (`git archive 55b3934 | tar -x -C <dir>`, then symlink the
  checkout's `node_modules` and `client/node_modules` into it), never in
  this checkout.
- Don't use ports 8080, 8120 or 8121: other cafés run on them. Use the
  port in your instructions, with a fresh `DATA_DIR`, run from the copy's
  root (it reads `content/` from the working directory), with
  `CLIENT_DIR` pointing at the copy's built client (`pnpm -C client
  build`, or `npx vite build` in `client/`). Point the spec at it with
  `APP_URL`.
- The demo checks need the café seeded first:
  `CAFE_DEMO_PASSWORD=catppuccino cafe demo seed` with the same
  `DATA_DIR`, then start the café, and give the spec
  `APP_DEMO_PASSWORD=catppuccino` (a local password, not the live one).
- Stop only the servers you start, by their own process IDs (never
  `pkill` by name).
- Don't touch the live café or the Fly app.

Review what slice 20 adds: `9650c20..55b3934` on branch
`slice-20-welcome` (`git diff 9650c20 55b3934`, `git log
9650c20..55b3934`).

## What to read

- **The spec:** [`docs/slices/20-welcomed-back-by-name-or-someone-else.md`](../../slices/20-welcomed-back-by-name-or-someone-else.md):
  every "done when" line and how it's held, and what the user chose.
  The user's words, 2026-11-08: "after log out, show "hi <name>" above
  current text, give option to log in as another person "I'm not
  <name>", and do not log in directly when opening the cafe - it should
  show a similar come back or someone else page, with different text in
  welcoming way." Asked where "I'm not <name>" leads: "unify log in and
  sign up, show unified name / password form with separate buttons";
  the look a step after "I'm new"; the greeting by the time of day, at
  5, 12, 18 and 22; the avatar shown.
- **The decision:** [ADR 0023](../../adr/0023-greet-a-returning-visitor-at-the-door.md),
  and `docs/design.md`'s "Arriving", "Leaving" and "One way in".
- **The rules:** `AGENTS.md`'s "What the app must keep", and "Accounts
  and safety" in `docs/design.md` (rate limits per name and per IP,
  the Origin check, no IP addresses stored or logged, refusals logged
  by code and never the name).
- **The plan** and its execution log,
  [`docs/notes/plan-slice-20-welcome.md`](../plan-slice-20-welcome.md),
  and the notes, [`docs/notes/slice-20-welcome.md`](../slice-20-welcome.md).
  The log records three departures: the café's own reload for a new
  build now goes back in past the door; the keyboard check's Shift+Tab
  bound raised from 8 to 16; and a stale test binary.
- **The code:**
  - `server/src/api.rs`: `check_name`, `refused_name`, `name_taken`,
    and the test `a_name_check_answers_what_sign_up_would_guarded_and_limited_as_it_is`;
    `server/src/http.rs` (the route); `server/src/protocol.rs`
    (`CheckNameRequest`); `scripts/narrate.ts`.
  - `client/src/door.ts` (new), `client/src/auth.ts` (rewritten),
    `client/src/main.ts`, `client/src/cafe.ts` (`noteBackInside`),
    `client/src/api.ts`, `client/index.html`, `client/src/style.css`.
  - Tests: `client/test/door.test.ts`, `client/test/auth.test.ts`,
    `client/test/sprites.test.ts`, `spec/welcome.test.ts`, and every
    spec file changed to drive the new form and the door
    (`spec/helpers.ts`, `spec/browser.test.ts`, `spec/music.test.ts`,
    `spec/fill.test.ts`, `spec/balcony.test.ts`, `spec/narrate.test.ts`).
- **The screens:** `docs/notes/screens/slice-20/` and `shoot.mjs`.

## Out of scope

- The look of the room, cats and furniture.
- The second-tab page, and being signed out by the server, which the
  spec leaves as they were.
- Earlier work this slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold.

- **Changed checks.** Were any changed to pass rather than to hold what
  they meant? In particular: the music checks that now reach the café
  through the door (`walkInUnpressed`, a script's click, standing in for
  "a reload straight into the café"), the keyboard check's Shift+Tab
  bound, and the sign-up helper's keyboard path (which focuses
  `#sign-up` directly rather than tabbing to it).
- **The door joins nothing.** Before Walk in: no WebSocket, no seat, no
  line, nothing on the board or in who's here. Is any part of the
  café (the music, timers, listeners) started before Walk in, or left
  running after "I'm not *name*"?
- **"I'm not *name*".** Is the session ended on the server? Anything
  left in the page (the music's storage, panel positions, the old name
  in a field, a cached `me`) that the next person sees?
- **The café's own reload.** `noteBackInside()` / `backInside()`: can
  the note outlive its purpose, so a later ordinary opening skips the
  door? Can it be set by anything but the build reload? What if the
  reload's `api.me()` says signed out?
- **The name check.** Does it tell anyone more, or faster, than sign-up
  does? Does it share sign-up's per-name and per-IP limits, and does a
  sign-up now spend two of each, and does that matter (a venue sharing
  one address, the spec suite)? Are its refusals logged without the
  name, and is a success logged at all? Does sign-up still decide?
- **The one form.** Enter logs in (Walk in is first). Password rules
  for "I'm new" before the round trip. Errors when the look step's
  sign-up is refused (taken, bad input, rate limited, server down).
  Back keeps the fields. Recovery. Shown again after "I'm not *name*",
  it's empty and wired once, so a press isn't answered twice. Browser
  password managers: `autocomplete` on the one password field.
- **Every action by keyboard, touch and mouse** at 390×844 and
  1920×1080, through a resize. Focus order on the door and the form.
  Screen readers: the door's heading, the avatar, `role="alert"`, the
  form's name.
- **Text as text.** The name never set as markup, anywhere it shows.
- **The greeting.** By the device's Canberra hour, at 5, 12, 18 and 22.
- **Content, not code**, and **generated TypeScript never edited by
  hand**: is `client/src/protocol/CheckNameRequest.ts` exactly what
  ts-rs makes?

## Findings

Write them to your findings file, numbered, most serious first. For
each:
- what's wrong;
- where (file and line);
- how you saw it (a command, a check, a screenshot);
- what "fixed" would look like.

Say what you ran, and what you didn't.
