# 14. Panels over the room

- **Status:** Proposed
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-14-panels.md`
- **Design:** The client ("Desktop (1920×1080)");
  [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md),
  from [notes/art-style.md](../notes/art-style.md), section 3 (D)

## Story

On a desktop the café fills the window. The chalkboard, your cats and
who's here float over the room's empty corners, half see-through, so the
room is a third bigger than it was. Someone who wants the chalkboard
somewhere else drags it there; someone who's put it where they like pins
it, and from then on it stays put and their clicks go straight through it
to the café. A panel nobody's looked at for a while fades back, so the
room shows through.

## In this slice

- **The desktop layout**: the panels leave their columns and float over
  the stage. By default the chalkboard and your cats sit in the room's
  top-left and bottom-left corners and who's here in the top-right, where
  the room's diamond leaves space. The room fits at 4× at 1920×1080.
- **Half see-through**: a panel's background lets the café show through;
  its text stays at 4.5:1 against what it sits on, whatever is behind.
- **Dragging**: an unpinned panel moves by dragging its title with a mouse
  or a finger, and by the keyboard. It stays inside the window, and a
  resize keeps it there.
- **Pinning**: each panel has a Pin button. A pinned panel can't be moved
  or selected; a click, tap or hover on it reaches the café under it, as
  if the panel weren't there. Its only control is Unpin, which stays
  clickable.
- **Dimming**: an unpinned panel whose content hasn't changed for a few
  seconds dims and grows more see-through, and comes back when its
  content changes or the pointer comes over it.
- **Remembered** per device, as the phone's layout is: where each panel
  is, and which are pinned.

## Not in this slice

- The phone's layouts. Below 960 px the panels stay as they are: in
  layout A under the room, in layout B in the drawer.
- New panels, or panels for anything that isn't a panel now.
- Hiding a panel altogether.

## Done when

| What must be true | Held by |
| --- | --- |
| At 1920×1080 the room fits at 4× | client unit tests (`scale`, `layout`) |
| A click on a pinned panel, anywhere but Unpin, acts on the café under it: walking to a tile, or the menu of a cat | browser check at 1920×1080 |
| A pinned panel can't be dragged or its text selected | browser check |
| An unpinned panel moves by mouse drag, touch drag and keyboard, stays inside the window, and stays inside it after a resize | browser check |
| An unpinned panel dims after a few seconds unchanged and comes back when it changes | client unit tests (fake timers) and a browser check |
| Panel text is 4.5:1 or better over the brightest and darkest the room and street can be behind it, dimmed or not | client unit tests (`contrast`, computed from the CSS and palettes) |
| Positions and pins are remembered on reload, and a blocked storage keeps them for the visit | browser check, as the layout switch's |
| Every action still works by keyboard, touch and mouse at 1920×1080 and 390×844 | `spec/` (the existing checks pass) |
| The panels sit comfortably over the room and nothing important hides under them by default | judged: by the user, from screenshots at 1920×1080, with each panel pinned and unpinned |

## Rules it touches

- **Every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use.** Panels over the room are the
  first thing that can sit over what you want to click; pinning's
  click-through is what keeps every action reachable.
- **The server decides every outcome:** none of this reaches the server.

## Numbers

- Dimming after: 4 seconds unchanged (*tunable*).
- See-through: about 50% normally, about 20% dimmed (*tunable*).

## Open questions

- **"Put a treat down" is a button inside Your cats.** Pinning leaves
  only Unpin clickable, so a pinned Your cats can't put a treat down.
  Proposed default: the treat button moves out to the talk bar beside the
  emotes, so pinning costs nothing.
- **Where do the panels start?** Proposed default: the corners above,
  each unpinned, so the first visit shows what can be done.
- **The keyboard and a pinned panel.** Tab skips a pinned panel's text
  but still reaches Unpin, and the chalkboard's copy stays for a screen
  reader. Proposed default: as said.
