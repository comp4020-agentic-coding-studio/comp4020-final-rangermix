# Slice 20: the door, and one way in — notes

Working state for [slice 20](../slices/20-welcomed-back-by-name-or-someone-else.md),
[plan](plan-slice-20-welcome.md), [ADR 0023](../adr/0023-greet-a-returning-visitor-at-the-door.md).

## Where it stands

Built on the branch `slice-20-welcome`, tasks 1 to 5 done. Waiting on the
fresh review, then merged to `main` (which deploys) and checked live. The
judged line is the user's, from [the screens](screens/slice-20/).

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

## Not checked yet

- The fresh review.
- Live: the door, I'm not *name*, and the one way in on the deployed
  café, with an `agent_` account and `demo1`; and that a deploy no
  longer puts visitors inside out at the door (the café's own reload).
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
