# Walking onto the rug

The user's ask, 2026-11-05: "currently clicking on the rug show the
interaction menu but prevent user standing on it. for some kind of
interactable items user should be able to walk to / on it, like rugs."

## What was wrong

The server already lets people stand on the rug: `Room::walkable` refuses
only pieces that block, and `content/furniture.toml` gives the rug and the
cushion no `blocks`. The client was the problem. `targetsAt` in
`client/src/input.ts` counts every movable piece as a target, so a click on
any of the rug's twelve tiles opened its menu, and the menu only offers
"Move the rug". No walk was ever sent. With a cat or a piece in your arms
the menu came up empty, and the click did nothing at all. The cushion did
the same.

## What changed

- `clickOn` in `client/src/input.ts` decides what a click or tap does. If
  everything on the tile is a standing piece people walk over (`blocks`
  false, not toppled), the click walks you there, unless it's the tile you
  stand on or your walk already ends at, where it opens that piece's menu.
  Anything alive on the tile, a piece that blocks, or a toppled one opens
  the menu wherever you are, as before.
- It reads `blocks` from the data, so it names no kind: a new piece that
  people walk over behaves the same with no code change.
- Enter on the keyboard's pointer still opens the menu at once, and Tab
  still reaches the rug, so "Move the rug" stays a keystroke away. Carrying
  a piece, a click still puts it down first, as before.
- Nothing on the server changed.

## Checked

- `client/test/input.test.ts`, "walks onto a rug or a cushion clicked, and
  opens its menu from where you stand": written first, seen failing
  (`clickOn is not a function`), then passing. All 207 client tests pass.
- `spec/browser.test.ts`, "walks onto the rug by a click or tap, and opens
  its menu from there, at both sizes": at 1920×1080 by mouse and at
  390×844 by touch, a click on a bare rug tile sends a walk there that the
  café accepts, with no menu; once there, the same tile opens the rug's
  menu, "Move the rug". Run against a local café serving `origin/main`'s
  client, it failed at the walk (none was sent); against the fixed client
  it passed, as did all 71 of `spec/` (restart skipped, as it is without
  Docker).
- `cargo test`: all pass.
- Not yet checked on the live café: that waits on a merge to `main` and its
  deploy.
