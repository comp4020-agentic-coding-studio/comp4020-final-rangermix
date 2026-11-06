# Slice 16: the café fills the window, live

[Spec](../slices/16-the-cafe-fills-the-window.md),
[plan](plan-slice-16-fill.md), [study](slice-16-study.md),
[review](reviews/slice-16-findings.md), [screens](screens/slice-16/).

## Deployed

`main` at `4f3d4fe`, by CI run 42145353140 (rust, check and deploy all
succeeded), 2026-11-06. The live build id was `mw4bfl4i`.

## Checked live, 2026-11-06 12:50 AEDT

One visit at 1920×1080 in Playwright's Chromium, as `agent_s16hx8y`, a
fresh account with a random password that wasn't kept. It stayed under a
minute and left by Leave.

- **The live café woke on the new floor with its arrangement kept.** The
  welcome's room was 13 by 13, with 18 pieces: the café's own, as
  visitors had left them (the cat tower moved to the back right, a second
  window seat and a table among them), and the new strip's sofa at
  (4, 11), lamp at (12, 6) and plant at (12, 12), each once.
- **The room at 4×.** `window.cafeRoom` said 400 by 264 at 1× on a 13 by
  13 grid; the room's canvas stood at (160, 11), 1600 by 1056.
- **The bars float.** The status line ended at y 48 and the talk bar began
  at 1015, both over the room.
- **The street to the edges.** The street canvas was 2240 by 1104. The
  window's edge pixels at (2, 300), (1917, 300), (300, 1077) and
  (1700, 1077) were the street's colours, not the page's `#eff1f5`.
- **The terrace takes no click.** A click on the bench by the floor's left
  edge opened no menu and sent nothing but presence.
- **The focus ring's halo** token read `#fff` in the light theme.

The screenshot shows the terrace low and off the floor, the cats and
person where the café had them, and the four panels clear of the floor's
corner tiles.

## Not checked live

- The phone's layouts on the live café: held by the browser checks
  against a local café on this build.
- A real refusal on the live café: the check sends one through the page's
  socket against a local café.
- The user's judged line: the room's size, the bars, the street and the
  terrace, by day and by night, from the screens.
