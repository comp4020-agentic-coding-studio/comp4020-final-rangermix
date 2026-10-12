# 06. The accessibility pass

- **Status:** Proposed
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-06-access.md`
- **Design:** The client ("HTML over the canvas", the live region,
  reduced motion); Checks ("Browser checks"); the marking viewports and the
  keyboard-only pass in `docs/notes/brief-and-crits.md`

## Story

A visitor who uses only a keyboard, or a screen reader, or only a phone, can
do everything anyone else can: come in, talk, pet, feed, carry and pass a cat,
rearrange, mute, and read the chalkboard. A marker doing the keyboard-only pass
at either size never gets stuck.

## In this slice

- Going through every action in the café by keyboard alone, by touch alone,
  and with a screen reader, at both sizes, with a resize mid-use, and fixing
  what's found.
- Visible focus, a sensible focus order in every menu, labels on every
  control, and enough contrast in the HTML text.
- Reduced motion honoured everywhere something moves.
- Browser checks for every action, by keyboard and by touch.

## Not in this slice

- New actions. This slice makes the existing ones reachable.

## Done when

| What must be true | Held by |
| --- | --- |
| Every action has a browser check by keyboard and by touch, at both sizes | browser checks |
| An automated scan finds no serious accessibility issue on the log-in card or in the café, at both sizes | browser check, with axe-core |
| With reduced motion set, nothing pans, bounces or flashes | browser check, with emulated media |
| A whole visit by keyboard alone, and one with VoiceOver, go through without getting stuck | judged: by the user, by hand, what was tried recorded in `docs/notes/` |

## Rules it touches

- **Every action works by keyboard, touch and mouse**, at 390×844 and at
  1920×1080, and survives a resize mid-use.

## Numbers

None of its own.

## Open questions

- **Add axe-core as a test dependency?** Proposed: yes, for the browser checks
  only. It doesn't ship in the app.
