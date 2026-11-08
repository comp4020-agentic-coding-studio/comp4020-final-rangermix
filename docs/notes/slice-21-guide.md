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
  the guide off.

## Screens

`docs/notes/screens/slice-21/`, written by `spec/guide.test.ts`: the
guide at 1920×1080 and at 390×844, a demo account's, and the ⓘ in the
status bar on a desktop and in both phone layouts.

## Live

Not yet deployed.
