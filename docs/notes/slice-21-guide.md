# Slice 21: the guide, where it stands

The spec is [21](../slices/21-told-how-the-cafe-works.md); the plan and its
execution log are [plan-slice-21-guide.md](plan-slice-21-guide.md).

## Checked locally

Against a café built from the branch on port 8091 with a fresh
`DATA_DIR` and the demo accounts seeded (port 8080 was another session's):

- `client/test/guide.test.ts`: the choice, the shrink's numbers, and the
  dialog in jsdom.
- `spec/guide.test.ts`: the eight browser checks, written first and seen
  failing (seven timed out waiting for a guide; the eighth, that the
  café's own reload brings none, passed with no guide to bring).
- `pnpm check`, the whole suite, with every other browser starting with
  the guide off. First run (at `d2d40f2`'s page): 462 client tests
  passed, and 130 of 133 spec checks, the two blocked-storage checks
  failing in their clean-up, behind a guide that rightly came back on
  Come back in (fixed by closing it; the review's finding 1). After the
  review's fixes (`b9fb6d0`): 472 client tests in 32 files, and 135 spec
  checks passed with 1 skipped (`spec/restart.test.ts`, which needs
  Docker's stop and start; CI runs it).
- `docs/notes/screens/slice-21/live.mjs`, the live check below, run
  first against the local café: in, the guide up over an inert café,
  closed into the ⓘ, opened from it, ticked on the phone, and Come back
  in brought it on the desktop (not ticked there) and not on the phone.

## Screens

`docs/notes/screens/slice-21/`, written by `spec/guide.test.ts`: the
guide at 1920×1080 and at 390×844, a demo account's, and the ⓘ in the
status bar on a desktop and in both phone layouts.

## Live

Merged onto `main` as a fast-forward to
[`167de32`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/167de32)
and deployed by CI run 42529585253 (check, rust and deploy all green; the
check job ran `spec/restart.test.ts` too, which the local runs skip).

Checked on the live café on 2026-11-09 at 09:30 AEDT with
`docs/notes/screens/slice-21/live.mjs`: one visitor, `agent_g8enw9m`,
with a fresh random password never written down, signed up through the
API and walked in through the door. `demo1` was inside at the time.
- **1920×1080, by mouse:** walked in, the guide up, the café inert;
  closed into the ⓘ at (1649, 8), just left of Add furniture at (1701,
  8); the ⓘ opened it again; not ticked, so Come back in brought it back.
- **390×844, by touch:** the same, the ⓘ at (193, 15) and Add furniture
  at (245, 15) in layout B; ticked "Got it, no pop-up next time" from the
  ⓘ; Come back in brought no guide.
- Left after each size; the visit lasted under a minute. The screens are
  `live-desktop-guide.png`, `live-desktop-closed.png`,
  `live-phone-guide.png` and `live-phone-closed.png`.

## Left for the user

- The spec's judged line: whether the words are right and short enough,
  and whether the shrink reads as going into the button, from the
  screens and the live café.
- The README's "For markers" doesn't mention the ⓘ; whether it should is
  the user's call.
