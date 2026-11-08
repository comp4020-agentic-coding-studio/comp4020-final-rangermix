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
  the guide off. First run (at `d580206`'s page): 462 client tests
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

Not yet deployed.
