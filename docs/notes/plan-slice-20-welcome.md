# Slice 20, "Welcomed back by name, or someone else": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed.

**Goal:** opening the café signed in shows a door that greets the visitor
by name and by the hour, and joins nothing until Walk in; the page after
Leave is the same door saying "Hi, *name*."; "I'm not *name*" signs out;
and the way in is one name and password form, Walk in to log in and
"I'm new" to sign up, the look a step after.

**Approved:** the user, 2026-11-08, with answers to the spec's
questions: "unify log in and sign up, show unified name / password form
with separate buttons"; the look a step after "I'm new"; the greeting by
the time of day, at 5, 12, 18 and 22; the avatar shown.

**Spec:** [`docs/slices/20-welcomed-back-by-name-or-someone-else.md`](../slices/20-welcomed-back-by-name-or-someone-else.md);
[ADR 0023](../adr/0023-greet-a-returning-visitor-at-the-door.md).
Written 2026-11-08 from `main` at `9650c20`, on the branch
`slice-20-welcome`, merged to `main` (which deploys) after the review.

## Where the code stands

- `client/src/main.ts`, `start()`: `api.me()`; signed in, `enter(me)`
  at once; otherwise `showAuth(enter)`. `showLeft(text)` shows the
  `#left-cafe` section (text and Come back in), after Leave and after
  `onWalkedOut`. `onSignedOut` (the server ended the session) shows the
  way in.
- `client/src/auth.ts`, `showAuth(enter)`: wires once (`wired`) the two
  tabs, `#signup` (name, password, look), `#login`, `#recover`, and the
  recovery code `#code`. Submits post to `/api/signup`, `/api/login`,
  `/api/recover`; the answer's recovery code, if any, shows before
  entering.
- `client/index.html`: `#auth` (the card, the tabs, the three forms, the
  code), `#cafe`, `#left-cafe`.
- `server/src/api.rs`: `guard()` (Origin, then the per-IP and per-name
  buckets), `signup_answer` (valid, reserved, password, look, insert or
  `NameTaken`), `logged()` (refusals by code, never the name).
  `server/src/http.rs` routes `/api/*`.
- Checks that drive the old page: `spec/browser.test.ts` (`visit()`
  signs up by keyboard; the demo visit logs in by `#tab-login`; reloads
  at 417, 569, 954; Leave and Come back in at 298 and 454),
  `spec/music.test.ts` (sign-up at 88; reloads at 336, 354, 385, 410,
  494; log-in by tab at ~399; Leave and Come back in at 223, 364, 599),
  `spec/fill.test.ts` (sign-ups at 64, 442, 484, 534),
  `spec/balcony.test.ts` (58), `client/test/sprites.test.ts` (the look
  picker's previews, with the old ids).

## Interfaces

- **Server:** `POST /api/check-name`, body `CheckNameRequest { name }`
  (new in `protocol.rs`, exported by ts-rs). `guard()` first; then the
  sign-up's own name checks, in its order and words: invalid → 400
  `badInput` "A name is 3 to 20 letters, digits, _ or -."; reserved →
  409 `nameTaken` "That name is the café's own."; taken → 409
  `nameTaken` "That name is taken."; free → 204. Wrapped in
  `logged("check_name", …)`. Success logs nothing: no account acted.
- **Client, `client/src/door.ts`:**
  - `greeting(hour: number, name: string): string`: "Good morning,
    *name*." for 5–11, "Good afternoon, *name*." for 12–17, "Good
    evening, *name*." for 18–21, "Still up, *name*?" for 22–4.
  - `type DoorMood = { kind: "arrive" } | { kind: "left"; text: string }`.
  - `showDoor(me, mood, { enter, signedOut }, hour = canberraHour())`:
    hides `#auth` and `#cafe`, shows `#door`: the avatar on
    `#door-avatar`, the greeting (`greeting()` or "Hi, *name*.") in
    `#door-greeting`, the text in `#door-text` ("The cats are about.
    Come in when you're ready." or the mood's), `#door-in` labelled
    Walk in or Come back in and focused, `#not-me` labelled "I'm not
    *name*". All by `textContent`. `#door-in` calls `enter`; `#not-me`
    calls `api.logOut()`, and on success `signedOut()`, on failure
    puts the reason in `#door-error` and stays.
- **Client, `client/src/auth.ts`:** `showAuth(enter, { clear } = {})`
  shows the first step, `#way-in`; `clear` empties its fields. The
  first step: `name`, `password`, submit buttons `#log-in` ("Walk in",
  first, so Enter logs in) and `#im-new` ("I'm new"), and
  `#show-recover`. Which was pressed comes from the submit event's
  `submitter`. `#log-in` → `/api/login`; a `badLogin` refusal adds "New
  here? Press I'm new." `#im-new` → `/api/check-name`; refused, the
  reason, staying; free, the look step `#look-step` with
  `#look-heading` "Choose your look, *name*", the picker, `#sign-up`
  ("Walk in") and `#look-back` ("Back"). `#sign-up` → `/api/signup`
  with the first step's name and password; a `nameTaken` refusal goes
  back to the first step with the reason. Recovery and the code as now.
- **`client/index.html`:** `#auth` holds `#way-in`, `#look-step`,
  `#recover` and `#code`, without the tabs; `#left-cafe` gives way to
  `#door`.
- **`spec/helpers.ts`:** `signUpThroughPage(page, name, { keyboard })`
  and `walkIn(page)` (waits for the door and presses Walk in), so the
  checks share one way through the new page.

## Tasks

Each task: the test written and seen failing, then the code, then the
whole of its suite, then a commit and push.

1. **The name check, server.** Test in `server/src/api.rs`: 204 for a
   free name; 409 `nameTaken` for a taken name and for `demo9`; 400 for
   `x`; 403 for another Origin; 429 at the sixth try of one name in a
   minute; refusals logged as `check_name` with their code and no name.
   Then `CheckNameRequest`, the handler, the route, the generated
   TypeScript, and `check_name` in `scripts/narrate.ts`'s verbs with a
   line in `spec/narrate.test.ts`.
2. **The door, client.** `client/test/door.test.ts`: the greeting at
   4, 5, 11, 12, 17, 18, 21, 22 and 23; the arrive mood (greeting,
   text, Walk in focused, "I'm not *name*"); the left mood ("Hi,
   *name*.", the left text, Come back in, the walked-out text too); a
   name with `<b>` shown as characters; Walk in calls `enter`; "I'm not
   *name*" posts `/api/logout` and calls `signedOut`; a failed one
   shows the reason and stays, `signedOut` not called. Loads
   `client/index.html`'s body. Then `door.ts`, the markup, the styles.
3. **One way in, client.** `client/test/auth.test.ts`, on
   `client/index.html`'s body with `fetch` stubbed: Walk in posts
   `/api/login` and enters; `badLogin` shows the reason and "New here?
   Press I'm new."; I'm new posts `/api/check-name`, a refusal stays on
   the first step with its reason; free, the look step names the name,
   Back returns with the fields kept, Walk in posts `/api/signup` with
   the chosen look and shows the code, whose button enters; a
   `nameTaken` from sign-up goes back to the first step; recovery posts
   `/api/recover`; `{ clear: true }` empties the fields. The look
   picker's previews check in `sprites.test.ts` moves onto the new ids.
   Then `auth.ts`, the markup, the styles.
4. **`main.ts` through the door,** and the browser checks:
   `spec/welcome.test.ts` (new) holds the door, Walk in by keyboard,
   touch and mouse, Leave and the left door, "I'm not *name*" and
   someone else logging in, the name check's refusals, the resize, and
   the faked hour; the existing checks turn to `signUpThroughPage` and
   `walkIn`, the music's reloads to press Walk in (one by a script's
   click, which isn't a press, so the wait for the first press stays
   held). The whole `spec/` against a local café built from the branch.
5. **Screens** for the judged line: `docs/notes/screens/slice-20/`,
   the door arriving and after Leave, the way in, and the look step, at
   390×844 and 1920×1080, Latte and Mocha; notes in
   `docs/notes/slice-20-welcome.md`; `design.md`, the spec's status and
   the root plan.
6. **Review** by a fresh agent, brief and findings in
   `docs/notes/reviews/slice-20-*.md`; every finding fixed test first
   or answered. Then merged to `main`, deployed by CI, and checked live
   with an `agent_` account and `demo1`.

## Execution log

Where the build departed from this plan, added as it happens.

- **Task 1:** the clock tests in `server/tests/clock.rs` failed at first,
  on `main` too: their binary had been built from a worktree since
  removed, so it looked for `content/` there. A rebuild fixed it; nothing
  in the code.
- **Task 4, the café's own reload for a new build:** the whole `spec/`
  turned up one failure, `spec/fill.test.ts`'s status line check, which
  fakes a newer build. The café reloads a tab itself when the server
  runs a build it doesn't, and with the door that reload put everyone
  inside out at the door after every deploy. It isn't the visitor
  opening the café, so the café now notes it in session storage just
  before reloading (`noteBackInside()`), and `start()` takes the note
  once (`backInside()`) and goes straight in. Held by
  `client/test/door.test.ts` (once only, and no note where storage
  refuses) and `spec/welcome.test.ts` (a faked build: two loads, back
  inside, and the next reload meets the door), seen failing first.
- **Task 4, red first:** `spec/welcome.test.ts` was written after the
  door's code, so it was run against a café built from `main` at
  `9650c20` (its own client build and server, on a spare port): all 8
  failed, and "an open tab takes no place" was turned to fail there
  for its own reason (the tab took a seat), not for waiting on a door
  `main` doesn't have.
- **Task 4, the keyboard check's reach to Leave:** on a second whole run
  `spec/browser.test.ts`'s keyboard check failed every time at "back
  past the panels to Leave", which allowed 8 Shift+Tabs. The chalkboard
  had filled with the run's first meetings and overflowed, and Chrome
  makes a scrolling box a Tab stop, so Leave was 9 back. Not the door's
  doing; the bound is now 16, and Leave is still reached by keyboard.
- **Task 6, the review:** 16 findings, 4 major
  ([findings](reviews/slice-20-findings.md)), all fixed. The one that
  changed a decision was finding 4: the name check and its sign-up spent
  two tries of the address each, so a check that finds a name free now
  pays for the sign-up after it. The spec's Numbers, `design.md` and
  ADR 0023's consequences say so. Finding 16's music check, first
  written, passed against a mutant, and was made to count from the
  reload's own load.
