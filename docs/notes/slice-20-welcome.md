# Slice 20: the door, and one way in — notes

Working state for [slice 20](../slices/20-welcomed-back-by-name-or-someone-else.md),
[plan](plan-slice-20-welcome.md), [ADR 0023](../adr/0023-greet-a-returning-visitor-at-the-door.md).

## Where it stands

Built on the branch `slice-20-welcome` and reviewed: 16 findings
([findings](reviews/slice-20-findings.md)), every one fixed, most test
first. Merged to `main` ([`b7f2586`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b7f2586)),
deployed by CI (run 42449178470: check, rust and deploy all green), and
checked live. The judged line is the user's, from
[the screens](screens/slice-20/).

## Checked

- **`cargo test`:** 377 passed, 0 failed, among them the name check's
  test (`a_name_check_answers_what_sign_up_would_guarded_and_limited_as_it_is`),
  seen failing first (405, no route).
- **`pnpm -C client test`:** 410 passed: `door.test.ts` (14) and
  `auth.test.ts` (11), new and each seen failing first, and the look
  picker's previews check, moved onto the page itself.
- **`spec/`** against a café built from the branch, on a spare port
  (8120), with the demo accounts seeded: 119 passed, 1 skipped (the
  restart check, which needs CI's `APP_RESTART`). `spec/welcome.test.ts`
  (9 checks) was also run against a café built from `main` at `9650c20`
  on another port (8121), and every check failed there.
- **The screens:** [screens/slice-20/](screens/slice-20/), from
  [shoot.mjs](screens/slice-20/shoot.mjs), against the branch's café:
  the door (morning in Latte, evening in Mocha, "Still up" at 23:15),
  the door after Leave, the way in with a refused log-in's words, and
  the look step, at 390×844 and 1920×1080. Looked at by the agent: the
  name wraps whole on a phone, the buttons stay on screen, the avatar
  sits inside its ring; the shots use short names, as visitors' are.
- **Contrast:** the door and the form use only the token pairs
  `client/test/contrast.test.ts` holds at 4.5:1 in both themes (ink,
  muted, accent and error on the card; ink on the page for I'm new).

## After the review

- **`cargo test`:** 378 passed, 0 failed, three runs in a row (one
  earlier run caught the new limit test racing the bucket's refill;
  reordered in `6957eec`).
- **`pnpm -C client test`:** 421 passed.
- **`spec/`**, twice in a row, each from a freshly seeded database:
  123 passed, 1 skipped, no 429. Each run's café log passed
  `scripts/check-logs.ts --wall` with CI's words (590 and 586 lines).

## Checked live, 2026-11-08 16:12 AEDT

One `agent_` account, `agent_d6d1f`, its password made for the visit and
never written down, and `demo1`. A Playwright script, kept out of the
repo since it made the password. The visit lasted about two seconds
inside.

- **The way in**, at 390×844 by touch: no tabs. I'm new with `demo1`
  says "That name is the café's own." A fresh name reaches "Choose your
  look, agent_d6d1f", the password marked `new-password`. Walk in, the
  recovery code, and in: "1/6 inside", the password field and the code
  then empty.
- **The door:** a reload shows "Good afternoon, agent_d6d1f." and "The
  cats are about. Come in when you're ready.", and no WebSocket opens
  in 1.5 s. Walk in: inside.
  ([live-door-390x844.png](screens/slice-20/live-door-390x844.png))
- **Leave:** "Hi, agent_d6d1f.", "You've left the café. The cats will
  remember you.", Come back in, "I'm not agent_d6d1f".
  ([live-left-390x844.png](screens/slice-20/live-left-390x844.png))
- **I'm not *name*:** the way in, the name field empty, and `/api/me`
  401.
- **`demo1`** at 1920×1080, logging in by Enter from the password:
  inside, the demo bar showing. A reload shows "Good afternoon, demo1."
  ([live-door-demo1-1920x1080.png](screens/slice-20/live-door-demo1-1920x1080.png))
- **The logs:** the `check_name` refusal says `nameTaken` and nothing
  else (no name, no address); then the account's `signup`, `arrive`,
  `leave` and `logout`, one line each. The machine runs `main`'s
  build (version 123), started.

## Not checked yet

- That a deploy no longer puts visitors inside out at the door (the
  café's own reload): held by `spec/welcome.test.ts` with a faked
  build, not seen live, since nobody was inside during this deploy.
- A real phone's keyboard on the one form (Enter on the password field
  logs in on a desktop and in Playwright's phone).

## Found while building

- **The café's own reload for a new build** would have put everyone
  inside out at the door after every deploy. Fixed in task 4, held by
  `door.test.ts` and `spec/welcome.test.ts` (plan, execution log).
- **The keyboard check's 8 Shift+Tabs to Leave** ran short once the
  chalkboard overflowed, since a scrolling box is a Tab stop in Chrome.
  Not the door's doing; the bound is 16 (plan, execution log).
- **A stale `clock` test binary** pointed at a removed worktree's
  `content/`; a rebuild fixed it (plan, execution log).
