# Slice 18: the balcony, checked live

[Slice 18](../slices/18-a-balcony-under-the-terrace.md) was merged to
`main` and deployed by CI on 2026-11-07.

## The first deploy failed in CI

The first run on the merge failed and deployed nothing:

- `cargo fmt --check`: the new deck assertions weren't formatted;
- a client test's time limit: the one-pixel sweep built about 400 spans
  from scratch, 5.2 s on CI's machine.

Both were fixed in
[`12fc1d7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/12fc1d7),
after running every step CI runs locally (fmt, clippy, `cargo test`, the
protocol check, both typechecks, the client's tests, the evidence check).
That run passed and deployed: build `mw63yqy6`.

## The live check, 2026-11-07, about 18:25 AEDT

One short visit at 1920×1080 by mouse, as `agent_s180xuw` (a fresh,
random password, not kept), with
`.claude/jobs/…/s18/live/check.mjs`, a throwaway script. It was evening
at the café (light 0.5).

- **The café woke as it was.** The visitors' furniture arrangement was
  kept, and the room was at 4×, 1600×1056.
- **The balcony is there.** The deck, the glass rail and the café's
  building under it run to the window's edges by the left and right
  corners: [live-evening-1920x1080.png](screens/slice-18/live-evening-1920x1080.png).
- **The window's foot is the backdrop's.** At both edges (x 4 and 1915,
  y 1000 and 1070) and along the foot (x 100, 960, 1820, y 1076), with
  the panels and bars set aside, each pixel on screen equals
  `window.cafeRoom.backdropAt` there, and none is the street's.
- **Clicks on the balcony do nothing.** Four clicks: the deck by the left
  edge, the glass and the building at the bottom right, the building at
  the bottom left. They opened no menu and sent nothing but the café's
  "here".
- The visit left by the Leave button.
