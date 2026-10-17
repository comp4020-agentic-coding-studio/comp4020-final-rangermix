# 05. The art pass

- **Status:** Proposed
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-05-art.md`
- **Design:** The client ("Sprites", "Drawing"); The room (the starting
  furniture); "Cats change through `content/`, not code";
  [ADR 0011](../adr/0011-drive-cats-with-data-defined-characters.md)

## Story

Everything in the café reads at a glance, on a phone at 2× and on a desktop
at 5×. Each cat is recognisably itself in every pose, every piece of furniture
looks like what it is, and the light moves from morning to night.

## In this slice

- A sheet of every sprite at both scales, to judge from.
- Redrawing what doesn't read. Already known: the window seat reads as a shelf
  and the cushion as a blue box (crit 8's first look, in
  `docs/notes/crit-8-mvp.md`), and a napping cat still peeks out from behind
  a person (phase 3's review).
- A pose for every behaviour the cats have: nap, eat, play, perch, held, on a
  lap, scratching, knocking something over.
- The day and night tint, looked at hour by hour.

## Not in this slice

- Sound. See the open question.

## Done when

| What must be true | Held by |
| --- | --- |
| Every sprite has the right size and palette, with no stray pixels | `cargo test` (the content loader) |
| All art is data in `content/sprites/`, not code | `cargo test` (the loader reads it) |
| Each cat is told apart from the others in every pose, and each piece reads as what it is, at 2× and 5× | judged: by the user, from the sprite sheet in `docs/notes/screens/` |
| Nothing is drawn over what it shouldn't hide | judged: by the user, from screenshots of laps, naps and carrying |

## Rules it touches

- **Cats change through `content/`, not code.**
- **Every action works at 390×844 and at 1920×1080.**

## Numbers

- Day and night: morning from 6:00, afternoon from 12:00, evening from 17:00,
  night from 21:00.
- Avatar looks: 4 avatars in 6 colours.

## Open questions

- **The look itself is open (2026-10-17).** The user asked whether the café
  should take Catppuccin's colours, denser pixel art and an angled camera.
  The judgement is in
  [notes/visual-direction.md](../notes/visual-direction.md): it suggests an
  isometric camera, 32-px tiles with 24-px cats, and Catppuccin-led day and
  night palettes. Any of these would redraw every sprite, so this slice
  waits for the user's choice and is rewritten to match.
- **The README promises soothing music, and the design has none.** Proposed
  options for the user: add a small slice for quiet background music, off
  until a visitor turns it on, or take the promise out of the README.
