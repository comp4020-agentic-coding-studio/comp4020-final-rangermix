# 11. Cats you can tell apart

- **Status:** Approved 2026-10-21, with the proposed defaults for its open questions (one cat first; the README's music promise comes out)
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-11-art.md`
- **Design:** The client ("Sprites", "The look"); The room (the starting
  furniture); "Cats change through `content/`, not code";
  [ADR 0011](../adr/0011-drive-cats-with-data-defined-characters.md),
  [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md).
  Replaces [slice 05](05-the-art-pass.md).

## Story

Mochi, Burakku and Tora are each recognisably themselves at a glance, by
their faces, markings and shapes, not only their coats, in every pose: a
nap, eating, playing, perched on the window seat, held, on a lap, scratching,
knocking something over. People look like people, and every piece of
furniture looks like what it is, standing or knocked over.

## In this slice

- **PNG sprites in `content/sprites/`**, drawn by the agent at the new
  density: cats about 24 px, people about 32 to 36 px tall, furniture at its
  footprint for the isometric camera, each piece also lying down. Each PNG
  uses only its palette's colours, and the client turns it into palette
  slots, so coats and night colours still swap.
- **A pose for every behaviour** the cats have: nap, eat, play, perch, held,
  on a lap, scratching, knocking something over, with walking frames.
- **A cat's look stays data**: its coat, pattern and eyes in its file in
  `content/cats/`, on a shared base drawn once.
- **A sprite sheet** of every sprite, day and night, at the desktop's and
  the phone's scales, rendered into `docs/notes/screens/` to judge from.
- **What crit 8 and phase 3 found**: the window seat no longer reads as a
  shelf, nor the cushion as a box, and a napping cat doesn't peek out from
  behind a person.
- **The README's credits**, if any reference or pack is drawn from.

## Not in this slice

- Sound. The README's promise of soothing music is a separate question
  (below).
- Furniture facing the other way, and new kinds of furniture.
- Animation beyond the walking and playing frames there are now.

## Done when

| What must be true | Held by |
| --- | --- |
| Every sprite the client draws exists, at its size, using only its palette's colours, with no stray pixels | `cargo test` (the content loader) |
| All art is data in `content/sprites/`, not code, and a new coat is a data change | `cargo test` (the loader reads it) |
| Each behaviour shows its own pose | client unit tests (the frame chosen for each pose) |
| Each cat is told apart from the others in every pose, and each piece reads as what it is, standing and knocked over, at both scales, day and night | judged: by the user, from the sprite sheet in `docs/notes/screens/` |
| Nothing is drawn over what it shouldn't hide | judged: by the user, from screenshots of laps, naps and carrying |

## Rules it touches

- **Cats change through `content/`, not code.**
- **Every action works at 390×844 and at 1920×1080.**

## Numbers

- Cats about 24 px, people about 32 to 36 px tall, on 32×16 tiles.
- About 8 colours a coat: an outline, two shades, a base, a light, eyes,
  pink and white.
- Avatar looks: 4 avatars in 6 colours.

## Open questions

- **The README promises soothing music, and the design has none** (carried
  from slice 05). Settled 2026-10-21, the default: take the promise out of
  the README, which is the user's file, so the edit is offered to them;
  quiet music, off until a visitor turns it on, can be a small slice of its
  own if wanted.
- **Cat by cat, or all at once?** Settled 2026-10-21, the default: one cat
  first, judged, then the rest in its style, so a miss costs one cat's
  drawing.
