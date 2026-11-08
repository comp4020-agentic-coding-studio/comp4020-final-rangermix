# Findings: review of slice 20, "Welcomed back by name, or someone else"

Brief: [slice-20-brief.md](slice-20-brief.md). Read cold on 2026-11-08,
reviewing `9650c20..55b3934` on `slice-20-welcome`.

Four reviewers each read the slice through one lens: the server, the
door, the form and the checks. Two skeptics then tried to refute each
finding, and each finding below survived both. The severity given is
the skeptics' where they set it lower than the reviewer did. Where two
lenses raised the same thing, it is one finding here.

All code was built and run only in throwaway copies outside the repo
(`.claude/jobs/…/review20/`), made with `git archive 55b3934`, and
`git archive 9650c20` for `main` before the slice. Each café ran with a
fresh `DATA_DIR` on its own port (18941 to 18944), and was stopped by its
own PID. Nothing in this checkout changed except this file. Nothing live
was touched: not the café, not Fly.

## What was run

- **Server tests.** `cargo test -p cafe` passed in the copy: 361 unit
  tests (1 ignored), and the integration tests (5, 3, 4, 3, 1). The ts-rs
  output for `client/src/protocol/CheckNameRequest.ts` matches the
  committed file byte for byte.
- **Mutations, server.** Nine mutations of `check_name` and `guard()`,
  run against
  `a_name_check_answers_what_sign_up_would_guarded_and_limited_as_it_is`.
  Six failed the test, as they should: the guard dropped, only the per-IP
  limit kept, the name logged on success or on a taken name, the IP in a
  success line, a success line with no name. Three passed it (findings 7
  and 14).
- **The name check by hand.** A release build on port 18941, probed with
  curl: a taken name gets 409 `nameTaken`, a free name 204, the sixth try
  at one name in a minute 429, a foreign `Origin` 403. The log holds no
  name or IP, and a success logs nothing. That log was then fed to
  `scripts/check-logs.ts` (finding 3).
- **Client tests.** `vitest run test/auth.test.ts test/door.test.ts`: 25
  passed. `door.test.ts` alone: 14 passed.
- **Browser checks.** The whole `spec/` against the slice's café, from
  fresh data each time, seeded with `cafe demo seed`:
  - run 1: 9 failed, 110 passed, 1 skipped;
  - run 2: 7 failed, 112 passed, 1 skipped;
  - every failure a 429 `rateLimited` (finding 4).

  The whole `spec/` at `9650c20` against `main`'s client on the same
  server binary: 110 passed, 1 skipped, no 429s.
  `spec/welcome.test.ts` against `main`'s client: all 9 failed.
- **Mutation, music.** A client with musicPanel's `hasBeenActive` guard
  removed. `spec/music.test.ts` still passed 11/11, on the branch and on
  `main` (finding 16).
- **Playwright probes.** Throwaway scripts against the copies' cafés:
  - A signs up through the page, says a line, types a draft, presses
    Leave, then "I'm not A". B logs in. What B sees at once and after
    30 s.
  - The café's own build reload, with the reload's `/api/me` answering
    401 once.
  - Whether the recovery code left in the page still works after
    "I'm not A".
  - Keyboard sign-up by Tab only: Tab order, arrow keys in both radio
    groups, focus rings, Enter on a radio, Enter from the name field.
  - Refusals: log-in refused, sign-up refused at the look step (server
    down, faked 429, a 4-emoji password), "I'm not name" failing (aborted,
    then a 500). Where focus goes after each.
  - The look, code and recovery steps through a 390×844 → 1920×1080 →
    390×844 resize, by touch.
  - What stays in the DOM after Leave and after "I'm not name".
  - The per-name limit after repeated I'm new and Back.
  - Whether a `page.evaluate` click gives user activation in Chromium.
  - Auth calls a minute, counted from the café logs of both suites.

**Count:** 0 critical, 4 major, 9 minor, 3 nits.

## Findings

### 1. Major: after "I'm not name", the last visitor's recovery code is still in the page, and the next person can take the account with it

**What's wrong.** `showCode` writes the recovery code into `#code-text`
(`client/src/auth.ts:125`). Nothing ever clears it. "I've saved it" only
hides the section (`auth.ts:133-136`). `showAuth` resets `#way-in` and
`#recover`, but not `#code-text` (`auth.ts:42-48`). "I'm not name"
(`client/src/door.ts:60-71`) calls `api.logOut`, then `showAuth`, with no
reload.

So the next person at a shared computer gets a page that still holds
the code. It's hidden, but the inspector shows it. With the name and
that code, `/api/recover` sets a new password and ends the owner's
sessions. The owner is locked out for good.

Before this slice, the client never called `api.logOut`. The same
leftover was reachable only when the server ended a session. "I'm not
name" makes it the normal hand-over, which is what the brief asks about:
"anything left in the page that the next person sees?"

It needs the same tab, not reloaded since the sign-up or recovery, and
someone opening DevTools. That's why it's major and not critical.

**How it was seen.** Two lenses found it on their own. Sign up through
the page, "I've saved it", Leave, "I'm not A". Then:
- `/api/me` is 401;
- `document.getElementById('code-text').textContent` is A's code;
- `POST /api/recover {name: A, code: <that>, password: 'taken over!'}`
  answers 200;
- A's own log-in with the old password then answers 401.

**What "fixed" looks like.** Clear `#code-text`, and reset the Copy
button, when "I've saved it" is pressed and whenever `showAuth` shows the
way in. Better, don't keep the code in the DOM once it's saved. A unit
test: after a sign-up, "I've saved it", then `showAuth` or "I'm not
name", `#code-text` is empty. Seen failing first.

### 2. Major: the next person after "I'm not name" sees the last visitor's speech bubble for good, and their unsent draft in the talk box

**What's wrong.** `stop()` (`client/src/main.ts:499-521`) disposes the
stage, the talk box and the rest. It never removes the bubble elements
in `#overlay`, never clears `#talk-input`, and never clears `#said`.

- `Bubbles` keeps its elements in a private map
  (`client/src/bubbles.ts:52`). It removes one only in `update()`, and it
  has no `dispose()`.
- Each `enter()` makes a new `Bubbles` with an empty map
  (`main.ts:149`). It never knows the old elements, and the old stage's
  frame hook is gone. So the old bubbles stay until a reload, long past
  their ttl.
- `Talk.dispose()` (`client/src/talk.ts:36-40`) doesn't clear the input.

So A's last bubble stays on B's screen. A's draft sits in B's talk box,
and B's first Enter sends it under B's name. A's lines stay in the said
list until B's first state arrives.

This breaks [ADR 0010](../../adr/0010-keep-speech-public-and-fleeting.md):
speech is fleeting. It also shows one visitor's words to another. The
same leftover meets A after Leave and "Come back in". Nothing is stored,
so it isn't critical.

**How it was seen.** A says "secret words from A" and types "an unsent
draft of A", then Leave, then "I'm not A". B logs in through the form.
Then:
- B's talk box holds "an unsent draft of A";
- the said list shows "A: secret words from A";
- 30 s later the bubble "secret words from A" is still in `#overlay`.

Screenshot at `tmp/review20/door/b-inside.png`.

**What "fixed" looks like.** In `stop()`, remove the bubbles (or give
`Bubbles` a `dispose()` that removes what it shows), clear `#talk-input`,
and clear `#said`, `#here` and `#your-cats`. A spec check: B, after
"I'm not A", sees no bubble, no draft and no said line of A's.

### 3. Major: CI's log check fails on every name-check refusal, so a merge to `main` won't deploy

**What's wrong.** `check_name` logs a refusal, on purpose, with no `who`
or `uid`: `{target:"action", what:"check_name", outcome:"refused", code}`
(`logged()`, `server/src/api.rs:56-64`, used near line 205).
`scripts/check-logs.ts:20` lets a refused action line go without a name
only when `what` is in `ACCOUNT` = {signup, login, logout, recover}.
`check_name` isn't there. So every name-check refusal is "doesn't say
who".

`spec/welcome.test.ts` presses I'm new with a taken name and with
`demo9` (lines 224-234). So every CI run logs `nameTaken` refusals. CI's
step "Check the app's own log lines" pipes `docker logs app` through
`check-logs.ts --wall`, and fails. The deploy job has
`needs: [check, rust]`, so it never runs.

The notes say the spec passed, but that run never piped the app's log
through the checker. `spec/check-logs.test.ts` has no `check_name` line,
and `scripts/check-logs.ts` wasn't touched in this slice.

No café rule is broken and nothing leaks. The fix is one line.

**How it was seen.** The release build on port 18941 was sent a taken
name, six tries at one name, and a foreign `Origin`. Its log through
`node scripts/check-logs.ts` printed `line 5 doesn't say who:
{..."what":"check_name","outcome":"refused","code":"nameTaken"...}`, the
same for the `rateLimited` and `forbidden` lines, and exited 1. Both
skeptics fed a single such line to the committed checker with `--wall`
and got the same.

**What "fixed" looks like.** Add `"check_name"` to `ACCOUNT`. Add a
`check_name` refused line to the passing set in
`spec/check-logs.test.ts`, seen failing first. Then pipe the café's log
through `check-logs.ts` after a whole `spec/` run, and record that it
passed in `docs/notes/slice-20-welcome.md`.

### 4. Major: the spec suite now runs past the per-IP auth limit, because each page sign-up spends two of its 60 a minute

**What's wrong.** A sign-up through the page now makes two guarded calls:
`/api/check-name`, then `/api/signup` (`client/src/auth.ts:62`;
`check_name_answer` calls `guard()` at `server/src/api.rs:209`). Each
takes from the per-IP bucket, 60 a minute (`content/tuning.toml:38`), and
the per-name bucket, 5. Free name checks log nothing, so the logs
under-count them.

The spec files run one after another against one café from one address
(`fileParallelism: false`). The extra calls, with the new welcome
checks' own sign-ups, push the suite past 60 a minute. Checks that then
sign up over the API get 429s, in whichever file the limit lands. So the
failures move from run to run. CI runs the same suite from one address,
so it's likely to fail or flake there. The notes' "119 passed" only shows
the suite sits at the edge.

The same cost reaches people. A venue on one address now gets about 30
page sign-ups a minute, not 60. The spec's Numbers section says the name
check "spends the sign-up's limits", but doesn't weigh this.

**How it was seen.**
- Run 1 from fresh data: 9 failed, in `furniture.test.ts` (2),
  `chalkboard.test.ts` (2), `cats.test.ts` (3) and `demo.test.ts` (2).
  All were `sign-up failed: 429 {"error":"rateLimited"...}` from
  `spec/helpers.ts:38`.
- Run 2 from fresh data: 7 failed. Among them was `accounts.test.ts`
  "lets a whole room on one network sign up at once" (ten 429s), and
  `cats.test.ts` (3).
- `main` at `9650c20` on the same server binary: 110 passed, no 429s.
- Peak logged auth calls in any 60 s: 66 on `main`; 97 and 81 on the
  branch, before the free name checks.

**What "fixed" looks like.** Make the cost a decision, and keep the
suite under the limit. For example, the name check spends the per-IP
bucket only on a refusal, or a sign-up right after a check of the same
name doesn't spend again. Record the choice in the spec and
`docs/design.md`. Then show the whole `spec/` passing twice in a row from
fresh data. Add a check that page sign-ups from one address still leave
room for the room-on-one-network case.

### 5. Minor: the password typed at the way in stays in the hidden form while the visitor is inside, and at the door after Leave

**What's wrong.** `finish()` (`client/src/auth.ts:38-41`) hides `#auth`
and enters. It doesn't reset the form. So the plaintext password stays in
`#way-in-password`, inside the café and at the door after Leave
(`main.ts:524`; `door.ts:41-80`). That's the screen someone walks away
from at a shared computer. It's cleared only by "I'm not name" or a
reload. `#code-text` stays too (finding 1).

It's older than this slice: `main`'s `done()` also only hid `#auth`. And
whoever sits at that door can already press "Come back in". But the new
door says it's safe to leave for whoever sits down next, and the password
may be one the visitor uses elsewhere.

**How it was seen.** Sign up with the password "my secret pw", walk in,
Leave. At the door, `#way-in-password`'s value is "my secret pw".

**What "fixed" looks like.** In `finish()`, reset `#way-in` and
`#recover` and clear `#code-text` before entering. A unit test: after a
log-in or sign-up, the way-in fields are empty.

### 6. Minor: the reload note outlives a reload that finds the visitor signed out, so a later opening skips the door

**What's wrong.** `start()` checks `if (me.ok && backInside())`
(`client/src/main.ts:34`). `&&` stops early, so `backInside()`, the only
thing that takes the note (`client/src/door.ts:103-111`), runs only when
`/api/me` answers ok. If the build reload's `/api/me` fails or answers
signed out, the page shows the way in and `cafe.backInside` stays in
`sessionStorage`.

Logging in through the form calls `enter()` and never reads the note.
So the next load of that tab with a session goes straight into the café,
past the door. That can be a reload after Leave, or the next person
reloading. That's what the slice exists to stop.

It needs the build reload and a failed `/api/me` on that one load. It
skips the door once, in one tab, and breaks no server rule. Hence minor.

**How it was seen.** The welcome's build was rewritten so the tab
reloaded once, with the second `/api/me` answering 401. After the reload
the way in showed, and `cafe.backInside` was `"1"`. Log in through the
form, Leave (door shown), reload: no door, the café shown, "1/6 inside".

**What "fixed" looks like.** Take the note before branching:
`const back = backInside(); if (me.ok && back) …`. Optionally tie it to
the build it was set for. A door or spec check: the reload's `/api/me`
answers signed out, and a later opening still meets the door.

### 7. Minor: the name check's test doesn't hold the per-IP limit, or that the buckets are sign-up's own

**What's wrong.** `docs/design.md`,
[ADR 0023](../../adr/0023-greet-a-returning-visitor-at-the-door.md) and the spec's Rules all say the name check
shares sign-up's per-name and per-IP buckets, so it can't be used to
test names faster. The code does: `check_name_answer`
(`server/src/api.rs:209-220`) calls the same `guard()` (`api.rs:87-112`).

The test only fires six checks of one name and expects five 204s and a
429 (`api.rs:512-519`). That holds a per-name limit of 5. It doesn't
spend the per-IP budget across names. It doesn't mix sign-up or log-in
calls with checks of one name. A `check_name` with its own buckets would
pass it, and would let a name be probed twice as fast.

The done-when row names only "the per-name limit", so it's met as
written. The gap is in the property the ADR calls the point.

**How it was seen.** Two mutations passed the test (`1 passed`):
- `check_name` with the `Origin` check and the per-name take only, no
  per-IP take;
- `check_name` with a private 5-a-minute bucket in place of
  `app.auth_limits`.

**What "fixed" looks like.** Extend the test:
- spend a name's tries through `/api/signup` or `/api/login`, then show
  `/api/check-name` for that name is 429 at once, and the reverse;
- spend the per-IP budget across distinct names from one address (60, or
  a lowered tuning in the test app), then show a fresh name is refused.

See each part fail against both mutations.

### 8. Minor: each I'm new spends one of the name's 5 tries, so a few Backs lock the real sign-up out

**What's wrong.** The form calls the name check on every I'm new press
(`client/src/auth.ts:61`), even when the name hasn't changed since its
last 204. Back keeps the fields, so that's the usual case. The check
spends sign-up's per-name bucket: 5, refilling one every 12 s. So I'm new
and Back four times, I'm new once more, and the look step's Walk in is
refused: "Too many tries". Nothing warns the visitor.

The look step stays up, and Walk in works again about 12 s later.
Nothing is lost.

**How it was seen.** At 390×844 by touch: one name, I'm new then Back
four times, I'm new a fifth time. Each reached the look step. Walk in
was then refused with "Too many tries. Wait a minute and try again."

**What "fixed" looks like.** Skip the check when the name is unchanged
since its last 204 in this showing. A check: Back, I'm new, then sign-up,
within the limit.

### 9. Minor: keyboard focus falls to the page after a refusal on the form, and after a failed "I'm not name"

**What's wrong.** `busy()` (`client/src/auth.ts:33`) disables every
button in the form, including the one just pressed. Chromium then moves
focus to `<body>`, and re-enabling doesn't bring it back. Nothing
refocuses after:
- a log-in refusal (`auth.ts:74-77`);
- a sign-up refused at the look step other than `nameTaken` or
  `badInput`, such as server down or rate limited (`auth.ts:88-96`);
- a recovery refusal (`auth.ts:113-116`);
- a failed "I'm not name" (`client/src/door.ts:60-69`), which disables
  both buttons and re-enables them without focus. The spec says a failed
  sign-out "leaves the door as it was", and that door had focus on a
  button.

`role="alert"` still reads the error out. But a keyboard user starts
again from the top. Only the name-check and short-password refusals
refocus (`auth.ts:56`, `:66`). Pressing Enter inside the password field
keeps focus there, so the plain log-in path is fine.

**How it was seen.**
- Wrong password, Enter on Walk in: focus on `BODY`.
- Sign-up aborted at the look step: focus on `BODY`.
- `/api/logout` routed to a 500, Tab to `#not-me`, Enter: the error
  "The café answered 500." shows, focus is on `BODY`, and the next Tab
  still lands on `BODY` before Walk in.

**What "fixed" looks like.** After a refusal, focus the field to correct
(the password for `badLogin`) or the button that was pressed. At the
door, refocus `#not-me` after a failed sign-out. Unit tests that
`document.activeElement` isn't `body` after each refusal.

### 10. Minor: I'm new counts the password in UTF-16 units, not characters, so a short one reaches the look step

**What's wrong.** The client checks `password.value.length`
(`client/src/auth.ts:53`). The server counts characters,
`chars().count()` (`server/src/auth.rs:28-30`). "😺😺😺😺" is 8 UTF-16
units but 4 characters. So it passes I'm new, the name check answers
204, and the visitor picks a look. Sign-up is then refused with
`badInput`. The look step goes back to the way in with "A password is 8
to 128 characters." and focus on the name, not the password
(`auth.ts:93-96`). The spec says "Password rules for I'm new before the
round trip".

The field's `maxlength="128"` counts UTF-16 units too, so a password of
more than 64 emoji is cut short though the server would take it.

The server still refuses rightly. Only emoji-like passwords are hit.

**How it was seen.** Password "😺😺😺😺": I'm new showed the look step with
no error. Walk in then showed the way in, with the message and focus on
`way-in-name`.

**What "fixed" looks like.** Count with `[...password.value].length`, as
the server does. When the look step's `badInput` is about the password,
focus the password field.

### 11. Minor: the one password field says `current-password`, for sign-up too

**What's wrong.** The way in has one password field, for Walk in and
I'm new. It's marked `autocomplete="current-password"`
(`client/index.html:24`), and nothing changes it. Before this slice,
sign-up's field was `new-password`. The look step, which makes the
account, has no name or password field. So a password manager gets no
sign to offer a strong password, or to save the new one. The recovery
form keeps `new-password`. Neither the spec nor ADR 0023 weighs this.

**How it was seen.** Read `index.html` at `55b3934` and at `9650c20`. No
`autocomplete` or `new-password` in `client/src`. Not tried with a real
password manager.

**What "fixed" looks like.** Set the field to `new-password` when I'm new
is pressed. Or put a hidden name field (`autocomplete="username"`) and
the password in the look-step form, so the submit that makes the account
carries them.

### 12. Minor: "spec/welcome.test.ts at one faked hour" isn't held: the test fakes no hour

**What's wrong.** The spec's done-when table says the greeting by the
hour is held by `client/test/door.test.ts` and by `spec/welcome.test.ts`
"at one faked hour" (`docs/slices/20-welcomed-back-by-name-or-someone-else.md:120`).
`welcome.test.ts` installs no clock. `greetingNow()` (lines 57-63) reads
the real Canberra hour and copies `door.ts`'s if-chain branch for branch.
Line 80 compares against that.

So the browser check tests only the hour the suite runs at. A wrong
boundary in `door.ts` would be copied into the expectation. A run across
the hour can differ by one and fail.

`door.test.ts` still holds the boundaries, so nothing the visitor sees is
unheld.

**How it was seen.** `grep -n clock spec/welcome.test.ts` finds nothing.
`greetingNow()` matches `door.ts`'s `greeting()` (lines 27-32).

**What "fixed" looks like.** Install the page clock at a fixed Canberra
time before `page.goto`, as `music.test.ts` and `balcony.test.ts` do
(say `2026-11-05T19:30+11:00`). Assert the literal "Good evening,
<name>."

### 13. Minor: the keyboard sign-up check focuses Walk in by script, not by Tab

**What's wrong.** `signUpThroughPage`'s keyboard path
(`spec/helpers.ts:48-66`) calls `page.locator("#sign-up").focus()` on the
look step (line 61). The comment above says "Tab past the colours to Walk
in", but no Tab is pressed. It also focuses `#way-in-name` by script
(line 51), as the old helper did; only the `#sign-up` focus is new.

`welcome.test.ts:215-221`, "signs up by keyboard…", relies wholly on this
helper. No other check tabs into the look step. If `#sign-up` left the Tab
order, every check would pass.

The order is right today, so it's a gap in the check, not a bug.

**How it was seen.** Tab only from the look step, at 1920×1080: avatar →
colour → `#sign-up` → `#look-back`. Arrow keys move within each group,
and the swatch shows a 3px focus ring. Enter on a radio also submits.

**What "fixed" looks like.** From the focused avatar, press Tab until
`#sign-up` has focus, within a small bound (say 4), and assert it gets
there. Then Enter. Press ArrowRight once in each group, so the arrow keys
are held too. Optionally Tab from the page's start to the name field.

### 14. Nit: no test holds that an IP address never reaches a log line on the auth path

**What's wrong.** The new test sends its requests from `10.0.0.9`. Its
privacy check looks only for the four names in non-sign-up lines
(`server/src/api.rs:529-535`). Nothing anywhere checks that an address is
absent. If `guard()` (`api.rs:88-112`) logged the IP on a refusal, every
check would pass. The rule "Never store email addresses or IP
addresses" has no test behind it.

`guard()` logs no IP today, and this slice only added callers.

**How it was seen.** Mutation: `tracing::info!(target: "api", ip = %ip,
"limited")` in `guard()`'s refusal branch. The test passed. `grep -rn
"10.0.0" server/src` finds no such assertion.

**What "fixed" looks like.** In the same test, after the rate-limited and
forbidden calls, assert `!sink.text().contains("10.0.0.9")`.

### 15. Nit: the open-tab check passes on a page that never reached the door

**What's wrong.** "An open tab takes no place in the line until Walk in"
(`spec/welcome.test.ts:168-178`) opens a signed-in page, waits 2 s, and
asserts the watcher's snapshot doesn't hold the account. It never checks
that the door showed, or that no WebSocket opened. A page that failed to
load, threw in `start()`, or showed the way in would pass too.

It does fail against `main`, where the tab took a place. It would catch a
page that joined the line, since `snapshot.people` holds people at the
window (`world/mod.rs:473`). The first door test already checks the door
and the WebSocket.

**How it was seen.** Against `main`'s client, this test failed on its own
assertion (`expected true to be false`) while the other eight timed out.
Its body has no door assertion.

**What "fixed" looks like.** Wait for `#door` before the 2 s wait. Assert
the sockets list is empty, as the first door test does.

### 16. Nit: `walkInUnpressed`'s comment is wrong about the browser

**What's wrong.** The comment says a script's click is "not a press, so a
browser that won't play before one still won't"
(`spec/music.test.ts:93-101`). The same file's `autoplayRule` comment
(lines 103-113) says the opposite, and is right. In Chromium a
`page.evaluate` click gives user activation. So musicPanel's guard
(`navigator.userActivation.hasBeenActive === false`,
`client/src/musicPanel.ts:188`) never fires on this path. The checks hold
only because `autoplayRule` makes `play()` refuse, and the refusal
unloads the element.

So the guard has no check behind it, on the branch or on `main`. After
the door, the only real way in without a press is the café's own build
reload (`backInside()`), and no music check covers it.

**How it was seen.** A probe: after `page.evaluate(() => b.click())`, the
handler read `hasBeenActive === true`. A client with the guard replaced by
`if (false)` passed `music.test.ts` 11/11, on the branch and on `main`.

**What "fixed" looks like.** Correct the comment: the script click stands
for a press-less entry only under `autoplayRule`. Optionally add a music
check for the build reload: music remembered on, a faked newer build
reloads the café, and nothing plays or is fetched before the first press.

## What was checked and found sound

- **The name check itself.** It answers as sign-up would, through the
  same guard, in about 0.4 ms for a taken name. That timing doesn't speed
  up guessing names, since the shared limits bound how many tries there
  are. It logs no name and no IP, and nothing on a success.
- **The door.** Before Walk in, no WebSocket opens, and no music, timer or
  document listener starts. `enter()` is the only place they start, and
  only `start()` runs at load.
- **The greeting's edges** (5, 12, 18, 22) are right.
- **Names.** Every name is set with `textContent`, the look step's heading
  included.
- **Leaving.** Walking out (stop, then the door says hi) and being signed
  out (stop, then the way in) both work.
- **One answer per press.** The door's handlers are assigned, not added.
- **Resize and touch.** The look, code and recovery steps survive a
  390×844 → 1920×1080 → 390×844 resize by touch. The avatar and colour
  swatches take a tap.
- **Speech.** The spoken text was in no server log.

## Not checked

- The live café and the Fly app.
- A real phone, a real screen reader, and a real password manager.
- The CI pipeline itself (finding 3 was shown with the CI step's own
  checker on a local log).
- The client's whole vitest suite, beyond `auth.test.ts` and
  `door.test.ts`.

## Raised and set aside

None. Every finding raised survived both skeptics. Where two lenses raised
the same thing, it was merged: the recovery code (door and form), the
lost focus (door and form), and the keyboard check (form and checks).
