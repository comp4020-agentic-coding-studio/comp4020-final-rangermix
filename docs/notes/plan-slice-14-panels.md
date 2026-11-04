# Slice 14, "Panels over the room": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why:
> [ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)
> (corners, option D) and [art-style.md](art-style.md), section 3.

**Goal:** on a desktop the room fills the window at 4×, and the
chalkboard, your cats and who's here float over its empty corners, half
see-through, each draggable by mouse, finger and keyboard, and pinnable:
a pinned panel stays put and lets every click through to the café but
its Unpin. A panel left unchanged fades back. "Put a treat down" moves
to the talk bar beside the emotes, at every size.

**Architecture:** all in the client: the page's HTML and CSS, one new
module for the floating panels, and pure geometry and storage in
`layout.ts`. The server and protocol don't change.

- **Three panels, not two columns.** `index.html`'s two `aside`s become
  three, each a `.panel` with a bar (its title, a Move grip, a Pin
  button) and a body: `#chalkboard` (the chalkboard), `#cats-panel`
  (your cats) and `#here-panel` (who's here and what was said). Below
  960 px they stay as they are now: in layout A under the room, in
  layout B in the drawer, the chalkboard's copy out of sight but read;
  the bars' buttons don't show there.
- **The desktop's grid** loses its side columns: status, stage, talk.
  The panels are `position: fixed`, kept inside the stage's box (between
  the status bar and the talk bar), placed by the new module
  `client/src/floating.ts`.
- **Where a panel is** is kept as offsets from the stage's nearest sides
  (`{h: left|right, x, v: top|bottom, y}`), so a panel in the top-right
  corner stays there when the window widens, and is clamped inside the
  stage on every resize. Saved per device in `localStorage`
  (`cafe.panels`), or for the visit if storage is blocked, as the
  phone's layout is.
- **Pinned** is a class: `pointer-events: none` and `user-select: none`
  on the panel, `pointer-events: auto` on its Unpin. The Move grip is
  hidden, so Tab reaches only Unpin.
- **Dimming** is a class set by a timer per unpinned panel: after 4 s
  with no change to its body's markup, no pointer over it and no focus
  in it, it dims; a change, the pointer or the focus brings it back.
- **The glass:** a panel's background is its card colour at 50% (20%
  dimmed), over a `backdrop-filter` that fades the room behind toward
  the panel's own end of the scale, so its text holds 4.5:1 over
  anything from black to white (decision 3).

**Spec:** [`docs/slices/14-panels-over-the-room.md`](../slices/14-panels-over-the-room.md).
Written 2026-11-05 from the code at `cef890a`, on branch `slice-14-panels`
from `slice-13-street` (its layout is built on slice 13's room and
street), merged to `main` after slices 12 and 13 and once reviewed.

## What the code does now

- `client/index.html`: `.cafe` holds the status bar, `aside.panel.left`
  (`#chalkboard` and `#your-cats`), `#stage` (canvas, overlay, waking),
  `aside.panel.right` (`#here`, `#said`) and the talk form (talk-to,
  input, Say, `#emotes`).
- `client/src/style.css`: the desktop grid is `17rem | 1fr | 19rem`, so
  at 1920×1080 the stage is 1296 wide and the room fits at 3×. Phone
  rules (`max-width: 959px`) stack the panels under the room (A) or
  hide them in a drawer (B, `.layout-b`, `.drawer-open`). Menus are
  `z-index: 2`, the waking cover `1`.
- `client/src/panels.ts`: `renderYourCats` builds the cats' rows, the
  treats left, the "Put a treat down" button and the bowls, updated in
  place so the button keeps its focus; `renderHere`, `renderSaid` (which
  scrolls its `.panel`), `renderChalkboard`.
- `client/src/main.ts`: wires the panels on every café change, the
  layout switch and the drawer.
- `client/test/contrast.test.ts` reads `style.css`'s tokens for each
  theme and holds every text pair at 4.5:1.

## Global constraints

- AGENTS.md's rules hold. Every action works by keyboard, touch and mouse
  at 390×844 and 1920×1080, and survives a resize mid-use. The server
  decides every outcome; none of this reaches it.
- `pnpm -C client check`, `pnpm typecheck`, the spec against a fresh local
  café, `cargo fmt --check`, clippy and `cargo test` pass before each
  push.

## Decisions made in this plan

1. **4× at a 1920×1080 viewport, with little to spare.** The room at 4×
   is 1344×928. With the side columns gone the stage is about 1896 wide,
   and the viewport less the page's padding, the status bar and the talk
   bar leaves about 930 px of height: it fits, by a few pixels, so the
   desktop's padding and gaps go from 12 to 8 px. A 1920×1080 *screen*,
   whose browser bars take a hundred pixels or more, gives a smaller
   viewport, where the room shows at 3× with the panels beside it;
   floating the status and talk bars over the room too would get 4×
   there, which the spec doesn't ask for. Noted for the user, not built.
2. **Panels are kept inside the stage, not just the window,** so no
   panel can cover the status bar's Leave or the talk box. That is
   stricter than the spec's "inside the window" and keeps it.
3. **The glass's numbers.** WCAG's 4.5:1 against what a panel's text
   sits on, whatever is behind, can't hold with a plain half-see-through
   colour: over the room's darkest and brightest the background swings
   too far. A `backdrop-filter` first squeezes what's behind into a band
   at the panel's end of the scale, then the card colour goes over it at
   50% (20% dimmed), the spec's numbers. Solved for the worst of ink and
   muted text over black and white with a margin for 8-bit rounding
   (`/tmp` arithmetic, checked against Chrome's output): Latte,
   `contrast(0.45) brightness(3.09)` over white glass, 5.3:1 normally,
   4.75:1 dimmed; Mocha, `contrast(0.97) brightness(0.26)` over surface0,
   5.1:1 and 4.8:1. Where a browser has no `backdrop-filter`, the panel
   is opaque. The test computes it from `style.css` over black, white
   and every palette colour.
4. **Bubbles and menus stay over the panels.** Panels sit at
   `z-index: 1`, after the stage in paint order; menus stay at 2 and
   bubbles go to 2, so a word said or a menu opened under a panel is
   never hidden by it. The board, the nudge and the drawer stay above.
5. **The panels come before the room in the page's order,** as they do
   on screen from the top left, so Shift+Tab from the room passes their
   grips and pins to the status bar, and Tab from the room goes to the
   talk box as now (layout B's check that Tab reaches only what's on
   screen holds, since the bars' buttons don't show on a phone).
6. **Moving by keyboard** is a Move grip, a button with the panel's name
   ("Move the chalkboard"): arrows move it 16 px, Shift+arrows 64 px.
   The title is a drag handle too. A pinned panel's grip is hidden.
7. **What counts as a change** for dimming is the body's markup, not a
   mutation: `renderHere` and `renderSaid` rebuild on every message with
   the same markup, which mustn't keep a panel bright.
8. **Pinned panels don't dim:** the spec dims an unpinned one, and the
   pointer can't come over a pinned one to bring it back.
9. **The treat button** is `#put-treat` in the talk form, after
   `#emotes`, outside that group (whose buttons are all emotes). The
   treats left and the bowls stay in Your cats. It's disabled while the
   café wakes, as the emotes are.

## Review focus

1. **Click-through:** every action reachable under a pinned panel, by
   mouse and touch; nothing under an unpinned one is lost (it can be
   moved).
2. **Contrast:** the test's model of the glass against what Chrome draws.
3. **Phone layouts unchanged:** A, B, the drawer, the chalkboard's copy.
4. **Resizes:** across 960 px both ways, mid-drag, and from a big window
   to a small one with panels saved at the far side.

## Tasks

### Task 1: The treat button beside the emotes

Files: `client/index.html`, `client/src/panels.ts`, `client/src/main.ts`,
`client/src/style.css`, `client/test/panels.test.ts`,
`spec/browser.test.ts`.

- Tests first: Your cats shows the treats left and the bowls and holds no
  button; `showTreats(button, state)` hides the button at none left and
  keeps the same node. The spec's treat check moves: the button is in
  the talk bar, right of the emotes, and puts a treat down by mouse at
  1920×1080 and by touch at 390×844 (layout B); the focus check holds.
- Then the code.

### Task 2: Three panels over a full-width stage, the room at 4×

Files: `client/index.html`, `client/src/style.css`, `client/src/panels.ts`,
`client/src/main.ts`, `client/test/scale.test.ts`, `spec/browser.test.ts`.

- Tests first: `fitScale` gives 4 for the full-width stage at 1920×1080;
  the browser check finds the room 1344 px wide at 1920×1080, the three
  panels in their corners (chalkboard top-left, your cats bottom-left,
  who's here top-right) inside the stage, and the existing checks at
  390×844 pass unchanged. The keyboard check's widths and its Shift+Tab
  walk to Leave change with the layout.
- Then the HTML, the CSS, and `floating.ts` placing each panel at its
  default.

### Task 3: The glass

Files: `client/src/style.css`, `client/test/contrast.test.ts`.

- Tests first: for each theme, ink and muted text over the glass, normal
  and dimmed, over black, white and every palette colour, at 4.5:1 or
  better; the panel's CSS uses the tokens, and falls back to opaque
  without `backdrop-filter`.
- Then the tokens and rules.

### Task 4: Dragging, inside the stage, remembered

Files: `client/src/layout.ts`, `client/src/floating.ts`,
`client/test/layout.test.ts`, `spec/browser.test.ts`.

- Tests first: the geometry (a spot clamped inside the stage, a panel
  bigger than the stage at 0, the nearest sides after a drop, the CSS
  for a spot); the storage (round trip, rubbish ignored, blocked storage
  kept for the visit). Browser: a mouse drag, a touch drag (CDP touch
  events) and the keyboard each move a panel; a drag far past the edge
  leaves it inside; a resize to 1280×720 and to a phone and back leaves
  it inside and in its corner; a reload keeps where it was; with storage
  blocked, a move holds through a resize.
- Then the code.

### Task 5: Pinning

Files: `client/src/floating.ts`, `client/src/style.css`,
`spec/browser.test.ts`.

- Tests first, in the browser at 1920×1080: a panel dragged over the
  room and pinned; a click on it over a bare tile walks there, and over
  a cat (held still by the page's socket, as the window-seat check does)
  opens its menu; a drag on its title doesn't move it and a drag across
  its text selects nothing; Tab reaches its Unpin and not its grip; the
  pin is remembered through a reload; Unpin gives it back.
- Then the code.

### Task 6: Dimming

Files: `client/src/floating.ts`, `client/test/floating.test.ts`,
`spec/browser.test.ts`.

- Tests first, fake timers: dims at 4 s and not before; a change to the
  body's markup brings it back and restarts the wait; the same markup
  rebuilt doesn't; the pointer over it or the focus in it keeps it
  bright; a pinned panel never dims. Browser: a panel left unchanged
  dims (the page's clock moved on), its background at the dimmed glass,
  and someone arriving brings who's here back.
- Then the code.

### Task 7: Screens, review, deploy

- Screenshots at 1920×1080, light and dark: the panels in their corners,
  one dragged over the room, pinned, and dimmed, into
  `docs/notes/screens/slice-14/`; and 390×844 to show the phone
  unchanged.
- `docs/design.md`, the spec's status. Review brief and findings in
  `docs/notes/reviews/`; merged to `main`; deployed and checked live.

## Execution log

Where the build departed from this plan, as it happened.

- **Task 1: who's here gets its own heading.** The panel's title is now
  "Who's here", in its bar, so the count under it reads "Inside (1/6)"
  rather than repeating "Here". On a phone the emotes and the treat
  button share a row under the talk box.
- **Task 2: the chalkboard's hidden copy stopped being a Tab stop.** On a
  phone the chalkboard is clipped to a pixel for a screen reader; once
  its list scrolled by itself (`.panel-body`), Chrome made the list a Tab
  stop, and the layout B check that Tab reaches only what's on screen
  caught it. The hidden copy's list doesn't scroll. The two slice 07
  waking checks failed on the long-running local café again and passed
  on a fresh one (`/tmp` data, port 18820): spec 71 passed, 1 skipped.
- **Task 3: the glass checked against Chrome.** The real stylesheet's
  panel over black and over white, read from a screenshot, against the
  test's arithmetic: Latte normally `#ececec`/`#ffffff` (the model says
  the same), dimmed `#e1e1e1` (model `#e0e0e0`); Mocha normally
  `#191922`/`#393942` (model `#393a43`), dimmed `#0b0b0f`/`#3e3e42`
  (model `#0b0b0e`/`#3e3e42`). Within one step of 255 everywhere. The
  test checks text and muted text, not links: a panel holds none, and
  its buttons have their own opaque card.
- **Task 4: the reload check read the panels mid-placement.** It failed
  2 runs in 10. A probe logging each placement showed why: after a
  reload a panel is placed while still empty (54 px tall), then its lines
  come in and a resize observer places it again, before the next paint.
  The check could read the box between the two, a state never on screen,
  and found the chalkboard at the bottom where an empty one would sit. It
  now polls until the panels settle (8 runs in 8 pass), and still fails
  with the save switched off. The drag acts by pointer capture on the
  title or grip, so a drag over the room walks nobody, which the check
  holds.
- **Task 5: "can't be selected" needed a second probe.** A mouse drag
  across a pinned panel's text starts on the room behind it
  (`pointer-events: none`), so it selected nothing even with
  `user-select` taken out: the first check couldn't fail. A select-all of
  the page now has to leave the pinned panel's text out, which fails
  without `user-select: none` and passes with it. The pinned panel's Unpin
  carries `aria-pressed`, and its grip is hidden, so Tab reaches Unpin
  only.
- **Task 6: dimming looks once a second and on every café change.** A
  `Dimmer` per panel compares the body's markup, so who's here, rebuilt
  the same on every message, still dims. The browser check moves the
  page's clock on rather than waiting, and reads the dimmed glass's alpha
  from the computed colour, which Chrome reports as `oklab(… / 0.2)` for a
  relative colour; it polls past the 0.4 s fade. Without the dimming code
  it fails; with it, 3 runs in 3 pass.
- **Task 7: what the glass shows by day, measured.** In the screenshots
  (`docs/notes/screens/slice-14/`, from `shoot.mjs` against a fresh local
  café), a pixel of who's here over the sky and over a tower is pure white
  by day both normally and dimmed: the light glass squeezes everything
  above about mid-grey to white, and the day's street and walls are all
  above it. So by day a panel looks solid and dimming shows little; only
  the room's darker parts (the counter's shade, the floor's seams) show
  through. By night the dimmed panel goes from about `#1d1d28` to
  `#111118` and the room shows faintly. That's what holding text at 4.5:1
  over anything the café can show costs; loosening it (contrast checked
  over the colours actually behind each panel's spot, or a lighter
  squeeze with bolder text) is the user's call, raised with the
  screenshots, not built.
- **More translucent, at the user's asking (2026-11-05).** "The panel
  background should be more translucent, frosty glass is good." Solved
  first for thinner glass alone: under 4.5:1 over anything, the filter,
  not the glass, decides how much of the room shows, so a quarter-thick
  glass showed little more (10% of the room's range in Latte, from 7.5%).
  What moved it: a 3-px blur in the frost, and the panels' own text a
  shade darker in Latte (`#3c3f55`, muted too) and Mocha's bright text
  for muted in the dark, which let the filter open to 26% (Latte) and 28%
  (Mocha). Chrome's colours matched the model within a step of 255. In
  the dark theme it reads as glass; in the light theme it shows the room
  as white, and not only by day, as first written: the page's theme is
  the device's, not the hour's, and the screens had paired day with light
  and night with dark, which hid it (slice 14's review, finding 1; the
  screens now take all four pairings). Only a dark panel tint in the light
  theme would change it: asked of the user, not built. The dimming check now reads the glass's
  alphas from the page's tokens.
