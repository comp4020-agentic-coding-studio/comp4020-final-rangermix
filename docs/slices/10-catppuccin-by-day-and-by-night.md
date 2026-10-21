# 10. Catppuccin by day and by night

- **Status:** Built 2026-10-22, waiting for its review (approved 2026-10-21, with the proposed default for its open question: the afternoon keeps the day's palette)
- **Plan:** [`docs/notes/plan-slice-10-palette.md`](../notes/plan-slice-10-palette.md)
- **Design:** The café ("It keeps Canberra time"); The client ("Drawing",
  "The look"); Numbers to tune ("Day and night");
  [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md),
  from [notes/visual-direction.md](../notes/visual-direction.md)

## Story

The café is Catppuccino, and now it looks it: warm wood under Catppuccin's
soft pastels by day, and at night the room sinks toward Mocha's deep blue
while the window glows with the street's lamplight. The evening steps
between the two. The page around the room follows the visitor's light or
dark setting, in Latte or Mocha.

## In this slice

- **A day palette and a night palette** in `content/sprites/palettes.json`,
  Catppuccin-led as in the study: Mocha's darks for outlines and shadows,
  its pastels for cloth, cats, plants and shirts, and browns mixed from its
  peach and rosewater toward its surfaces. The night palette keeps each
  colour's lightness pulled toward Mocha's base and lavender; the window's
  glass is lit yellow.
- **Steps between them by the Canberra hour**, at the times already in
  "Numbers to tune", replacing `nightTint`'s wash. Recoloured sprites are
  cached per palette, as they are per coat now.
- **The page's colours** in `client/src/style.css`: Latte for
  `prefers-color-scheme: light`, Mocha for dark, with Latte's mauve for
  links and buttons in the light theme.
- **The palettes' sources credited**: Catppuccin is MIT-licensed, credited
  in `/readme/` and the README's sources.

## Not in this slice

- Redrawing sprites: slice 11. This recolours whatever sprites there are.
- A switch for the page's theme. It follows the device's setting.
- Lights that move or flicker. The window is lit, nothing more.

## Done when

| What must be true | Held by |
| --- | --- |
| Every sprite colours without a missing slot in every palette, day and night | `cargo test` (the content loader) and client unit tests (`sprites`) |
| The palette in use at each hour follows "Numbers to tune": day from 6:00, the evening's step from 17:00, night from 21:00 | client unit tests (`canberra`) |
| Text and buttons on the page meet 4.5:1 against their background in both themes, a box's placeholder too, and the trust bar 3:1 against its track; a disabled button is dimmed, as WCAG 1.4.3 allows an inactive control, since the dimming is what says it's inactive | client unit tests, computed from the CSS colours |
| The page follows the device's light or dark setting at both sizes | browser check (`emulateMedia`) |
| The room reads as Catppuccino by day, and as lamplit, not greyed, at night | judged: by the user, from screenshots at 10:00, 18:00 and 22:00 in `docs/notes/screens/` |

## Rules it touches

- **Cats change through `content/`, not code.** Palettes are data.
- **Every action works at 390×844 and at 1920×1080**: the page's colours
  must keep every control visible in both themes.

## Numbers

- Day and night: morning from 6:00, afternoon from 12:00, evening from
  17:00, night from 21:00.
- Contrast: at least 4.5:1 for text and controls.

## Open questions

- **Does the afternoon get its own palette,** or stay the day's? Settled
  2026-10-21, the default: the day's, with the evening as a single step
  halfway to night.
