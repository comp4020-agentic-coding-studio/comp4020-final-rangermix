# Brief: review of slice 14, "Panels over the room"

Slice 14, Task 7 ([plan-slice-14-panels.md](../plan-slice-14-panels.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive af42d30 | tar -x -C <tmpdir>`), never in this
checkout. Don't use ports 8080, 18612, 18713, 18820 or 18821 (other cafés
run on them); run the café on port 18914 with a fresh `DATA_DIR`, and
point the spec at it with `APP_URL`. Stop only the servers you start, by
their own process IDs (never `pkill` by name). Don't touch the live café
or the Fly app.

Slice 14 is built on slice 13 (branch `slice-13-street`, up to `cef890a`),
which is built on slice 12; both are under review separately. Review only
what slice 14 adds: `cef890a..af42d30`.

## What to read

- **The spec:** [`docs/slices/14-panels-over-the-room.md`](../../slices/14-panels-over-the-room.md),
  every "done when" line and how it's held, its numbers (dim after 4 s;
  about 50% see-through, 20% dimmed) and its settled open questions (the
  treat button beside the emotes; panels start in the corners, unpinned;
  Tab reaches only a pinned panel's Unpin).
- **Why:** [ADR 0018](../../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
  (corners, option D) and [art-style.md](../art-style.md), section 3,
  with the study's picture `docs/notes/screens/art-style/3-corners.png`
  (its last panel, D) that the user chose from.
- **The design:** `docs/design.md` ("The client": "Desktop" and "Phone"),
  and `AGENTS.md`'s "What the app must keep", above all "every action
  works by keyboard, touch and mouse, at 390×844 and at 1920×1080, and
  survives a resize mid-use" and "the server decides every outcome".
- **The plan**, its decisions (especially 1, 4× at a 1080-px viewport;
  3, the glass; 5, the page order and Tab), review focus and execution
  log, which records a measured cost of the glass by day that is raised
  with the user rather than built.
- **The code:** `client/index.html` (three `.panel` sections with bars,
  the treat button in the talk form), `client/src/style.css` (the desktop
  grid, the fixed panels, the glass tokens and `@supports` block, pinned
  and dim, the phone rules for A, B and the drawer), `client/src/floating.ts`
  (`Floating`: placing, dragging, keyboard moving, pinning; `Dimmer`),
  `client/src/layout.ts` (`panelAt`, `spotFor`, `savedPanels`,
  `savePanels`), `client/src/panels.ts` (`renderYourCats` without its
  button, `showTreatButton`, `renderHere`'s headings), `client/src/main.ts`;
  their tests (`client/test/layout`, `floating`, `contrast`, `panels`,
  `scale`) and `spec/browser.test.ts`'s new and changed checks (the
  keyboard pass, the treat button, the corners, moving, storage blocked,
  pinning, dimming).
- **The screenshots:** `docs/notes/screens/slice-14/`, and the script that
  takes them.

## Out of scope

The room's drawing (slice 13) and walking (slice 12), the sprites (slice
11). Earlier work this slice doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **click-through:** every action under a pinned panel, by mouse, touch
  and the keyboard: walking, a cat's or a person's menu, a piece, the
  chalkboard's tile on the wall, placing carried furniture, the hover
  ghost of a piece being placed, a ring or menu opened from under a
  panel. Do menus, bubbles, toasts and the board open over the panels or
  under them? Can a pinned panel ever take a click (its padding, its
  scrollbar, its bar)? Can anything under an unpinned panel become
  unreachable (a panel dragged over the door, the chalkboard's tile, the
  talk box)?
- **dragging:** a drag that starts on the title and ends off the window;
  pointer capture lost (`pointercancel`, a second finger, the window
  losing focus mid-drag); a drag on a pinned panel; dragging while a menu
  or the board is open; the keyboard on the grip at the stage's edge;
  touch scrolling of a panel's own content against dragging it.
- **placing and resizes:** every size from 960 to 2560 wide and 600 to
  1440 tall; across 960 both ways, mid-drag; a panel saved far right or
  low on a big screen, then a small one; a panel taller than the stage;
  panels overlapping each other or the room's middle after a resize; the
  saved value tampered with in `localStorage`; storage blocked.
- **the glass:** whether the contrast test's model is what browsers draw
  (Chrome was measured; Safari and Firefox weren't), whether "anything
  behind" is truly covered (bubbles, menus and toasts pass behind a
  panel? the room's own colours at every blend of the hour?), and what a
  browser without `backdrop-filter` or relative colour syntax (`rgb(from
  …)`) shows. Is the spec's "about 50%, 20% dimmed" honestly met, given
  that the frost makes the day's room show as white?
- **dimming:** the 4 s on a page left alone; a change that only reorders
  or rebuilds; who's here when someone speaks (the said list changes);
  the pointer over a dimmed panel, the focus in it, a touch device with
  no hover; the timer and observers after leaving and coming back
  (`dispose`), and on a phone where panels don't float.
- **the keyboard and screen readers:** the page order (panels before the
  room); Shift+Tab from the room; a pinned panel reached by Tab only at
  Unpin; the grip's name and what a screen reader hears when it moves
  (is the move announced?); the chalkboard's hidden copy on a phone,
  which mustn't be a Tab stop; headings (`h2` per panel, `h3` inside).
- **the phone:** layouts A and B and the drawer as before, the treat
  button beside the emotes in both, no grips or pins showing, nothing
  floating.
- **the checks:** can any pass without the behaviour it names? The plan
  log records two that couldn't fail at first (the reload check's timing
  and the select-all); look for others.

## The answer's form

Each finding, most severe first: severity (critical, major, minor),
`file:line`, the failure scenario (input, then wrong behaviour), and whether
a test would catch it and which. Say briefly what you checked and found
sound. Write it all to `docs/notes/reviews/slice-14-findings.md`.
