# Slice 10: Catppuccin by day and by night

[Slice 10](../slices/10-catppuccin-by-day-and-by-night.md),
[plan](plan-slice-10-palette.md),
[findings](reviews/slice-10-findings.md).

## The README's credit: for the user to add

`README.md` is the user's (AGENTS.md), so the agent doesn't write it. The
licence's own ask, the copyright line and the licence text, is met in
`content/sprites/CREDITS.md`. `/readme/` serves `README.md`, which links
Catppuccin for the café's name but says nothing yet of its colours. A line
the user could add to the README's sources, as proposed:

> The café's colours, and the page's light and dark themes, are from
> [Catppuccin](https://catppuccin.com/) (MIT licence, © 2021 Catppuccin):
> its Mocha flavour for the room, mixed into browns for the wood and pulled
> toward its base at night, and its Latte and Mocha flavours for the page.
> See `content/sprites/CREDITS.md`.

## Deployed and checked live (2026-10-22, about 07:00 AEDT)

CI run 39670502960 (`9ac95e1`) passed rust, check and deploy; the live café
serves the slice's client (`index-DfJqYI2S.js`, `index-_QpG49Il.css`). One
short visit by `agent_ca0997`, a fresh password never written down
(ADR 0015):

- It went inside (2 of 6: a real visitor was in).
- In a light setting the page's background is Latte's base,
  `rgb(239, 241, 245)`; in a dark one, Mocha's, `rgb(30, 30, 46)`
  ([screenshot](screens/slice-10/live-dark-1920x1080.png)).
- At 07:00 Canberra time, day, the floor's own pixels at (9,8) are
  `#c99980`, the day set's floor.
- No errors in the page.

Left: the judged line, "the room reads as Catppuccino by day, and as
lamplit, not greyed, at night", is the user's, from
[the screenshots](screens/slice-10/) at 10:00, 18:00 and 22:00. The
reviewer flagged the evening's window glass, a mint green halfway between
day's sky and night's lamplight, as one to weigh. The README's credit is
the user's too (above).
