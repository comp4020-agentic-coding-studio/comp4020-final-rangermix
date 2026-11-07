# Slice 19: the balcony's ends, checked live

[Slice 19](../slices/19-the-balcony-ends-with-the-cafe.md) was merged to
`main` (a fast-forward to `b0b48d4`) and deployed by CI on 2026-11-08: build
`mw6w6ahc`. CI's run passed every job (the Rust checks, the client and
`spec/` against the built image, and the deploy) at the first try.

## The live check, 2026-11-08, about 08:05 AEDT

One short visit as `agent_s19841d`, by mouse, at 2560×1080: the wide
window, where the ends show most. Its password was fresh and random, and
is not kept. The script was a throwaway, `.claude/jobs/…/s19/live/check.mjs`.
It was day at the café (light 0), and the room was at 4×, 1600×1056.

- **The café's corner.** The balcony, its glass and the building under it
  end at the street wall's line and the plain wall's. The glass turns
  back to each wall, and the street shows past each end:
  [live-day-2560x1080.png](screens/slice-19/live-day-2560x1080.png).
- **Each end, from both sides.** The panels and bars were set aside, and
  each point was found from the floor's corners through `tileAt`, 0.08
  tiles either side of each end's line, at four heights down the building.
  - Past each end, all six points on screen are the street's own pixel:
    the kerb `#7f849c` and the pavement `#9da3bd`.
  - Inside each end, all six are the building's wall and windows.
  - Every point equals `window.cafeRoom.backdropAt` there.
- **Clicks on the ends do nothing.** Four clicks: on each glass return and
  on the building just inside each end. They opened no menu and sent
  nothing but the café's "here".
- The visit left by the Leave button.

The café's visitors' arrangement was kept, as it was.
