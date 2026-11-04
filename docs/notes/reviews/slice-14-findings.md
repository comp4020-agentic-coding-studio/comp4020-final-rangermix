# Findings: review of slice 14, "Panels over the room"

Brief: [slice-14-brief.md](slice-14-brief.md). Read cold at `af42d30`,
reviewing `cef890a..af42d30` only. Built and run only in a throwaway copy
(`git archive af42d30` under `/tmp`), never in the repo. Nothing live was
touched.

**Count:** 0 critical, 4 major, 7 minor.

## What was run

- `pnpm -C client check`: typecheck clean, 200 client tests green.
  `pnpm typecheck` clean. `pnpm -C client build` clean.
- The café from the copy on `PORT=18914` with a fresh `DATA_DIR`, and
  `spec/browser.test.ts` against it: 32 passed. The server was stopped by
  its own PID each time it was restarted.
- Mutations, each in a separate copy of the client, served from the same
  café through `CLIENT_DIR` and then put back to the real build:
  - M1: `savePanels` without `panelsThisVisit = panels`;
  - M2: `Floating`'s `Dimmer` built with `() => this.phone.matches`, so
    pinned panels dim.
- Playwright probes against that café (Chromium; WebKit for the glass), with
  `routeWebSocket` changing only what one page was shown (eight long chalk
  lines, twenty said lines, a café still waking): sizes from 960×600 to
  2560×1440; drags whose capture or button-up goes missing; a resize across
  960 mid-drag; pinning mid-drag; touch through a pinned panel; scrolling a
  pinned panel by wheel and by finger; Tab order with panels pinned; leaving
  and coming back in; storage blocked; light and dark at 10:00 and 22:00,
  read pixel by pixel from screenshots.
- The glass on a bare page (the built stylesheet over black, white and
  grey) in Chromium and WebKit. Firefox wouldn't start in this sandbox
  ("Could not find profile folder"), so it wasn't measured.

## Findings

### 1. Major: in the light theme the glass isn't see-through at any hour, and dimming changes nothing on screen; design.md and the plan say this happens only "by day"

- Where: `client/src/style.css:22` (`--glass-filter: contrast(0.45)
  brightness(3.09)`), `:132-133`. The record is `docs/design.md:403-408`
  ("by day that leaves the bright sky and walls showing as white") and
  `docs/notes/plan-slice-14-panels.md:278-288`. The screens come from
  `docs/notes/screens/slice-14/shoot.mjs:29`.
- What the filter does: `((v − 0.5) × 0.45 + 0.5) × 3.09` reaches 1 for
  any channel at or above 28/255. So any colour with all three channels at
  28 or more comes out pure white. That covers 48 of the 49 day palette
  colours and 65 of the 67 night ones in `palettes.json`. White glass at
  50% or 20% over pure white is still white.
- What a light-theme visitor sees:
  - at 22:00 (night sky, lit windows), Your cats pinned over the room's
    middle: 114 of 114 sampled pixels are `#ffffff`, both normally and
    dimmed;
  - who's here over the night sky: 58 of 58 `#ffffff`, both states;
  - the chalkboard over the room, normal and then dimmed: the largest
    channel change is 0 at both 10:00 and 22:00. In the dark theme it is
    12 to 13.
- So in the light theme the spec's "about 50% see-through, about 20%
  dimmed" isn't met, and the "dims ... and comes back" line has no visible
  effect.
- Why the record says "by day": the page's theme follows the device's
  setting (`style.css:27`), not the café's hour. `shoot.mjs` only pairs day
  with light and night with dark. The user was shown, and told about, the
  two pairs that hide this. A light-setting device at night is ordinary.
  So the judged line ("from screenshots ... pinned and unpinned") was judged
  without the case that matters most.
- Would a test catch it: none does. `client/test/contrast.test.ts:150-156`
  ("is half see-through normally and about a fifth dimmed") reads only the
  two alpha tokens. It passes whatever the filter does to what's behind.
  The browser dimming check (`spec/browser.test.ts:519-556`) reads the
  `dim` class and the computed alpha, both of which change while the pixels
  don't. Needed:
  - correct design.md and the plan log ("in the light theme", not "by
    day");
  - add light-at-night and dark-by-day screens;
  - take the trade-off back to the user, since 4.5:1 over pure black and
    white is what forces the squeeze;
  - make the see-through test compute how far what's behind still shows
    (for example, the spread of `through()` over the palette), not read the
    alpha tokens.

### 2. Major: a pinned panel that overflows can't be scrolled by mouse or touch, and its body is still a Tab stop; panels overflow at common sizes

- Where: `client/src/style.css:118` (`.panel-body { overflow: auto }`),
  `:114` (`.panel.pinned { pointer-events: none }`) and `:123-125` (the
  max-heights); `client/src/panels.ts:98-99` (`renderSaid` scrolls the
  body to the bottom). The settled answer it breaks is
  `docs/slices/14-panels-over-the-room.md:86-88`: Tab reaches only a
  pinned panel's Unpin.
- Panels overflow in their default state:
  - **Your cats** (295 px of content) gets a body of 271 px on a real
    1920×1080 screen's viewport (1920×953), 235 at 1536×864, 210 at
    1280×800, 197 at 1366×768 and 178 at 1280×720. "Treats today" or the
    bowls are below the fold at all of them.
  - **The chalkboard**, with its eight lines (`chalk_shown`), runs 392 px
    in a 291 px body at 1366×768 and a 265 px body at 1280×720. The lines
    are oldest first, so the newest one is the one hidden.
  - **Who's here** at 1920×1080 after twenty said lines: `renderSaid`
    scrolls its body to the bottom, so "Inside (1/6)" and the names are
    out of view.
- Pin any of these:
  - A mouse wheel or a finger swipe over the body goes through to the room.
    Its scroll position stays at 0 (or at 140 for who's here). Unpinned,
    the same swipe scrolls 98 px.
  - Tab from Leave reaches "Unpin the chalkboard", then `#chalk-lines`, at
    1280×720. With Your cats pinned it reaches "Unpin your cats", then
    `#your-cats`. Chrome makes a scrolling box a Tab stop, which the build
    already met on the phone (plan log, task 2).
  - Once focused, the keyboard can scroll it (End scrolled 98 px). The
    keyboard can read what the mouse and finger can't, the reverse of what
    pinning promises.
- Even unpinned, who's here snaps back to the bottom on the next café
  message (scroll 0, then 327 within 3 s). The mechanism predates the slice
  (the old `renderSaid` scrolled the right column), but the box is now
  capped at 60% of the height and the headings scroll with the said lines.
- Would a test catch it: none does. The pinned check runs at 1920×1080 with
  short content. Its Tab step (`spec/browser.test.ts:497-506`) asserts
  `toContain("Unpin your cats")` and `not.toContain("Move your cats")`, so
  a body that's also reached passes. Ways to fix it:
  - size panels to their content and let the clamp handle the rest;
  - give the said list its own scroller under fixed headings;
  - make a pinned body neither scroll nor take focus.

  Then a check at 1366×768: pin each panel, assert that Unpin is its only
  Tab stop, and that the treats line can be read.

### 3. Major: after Leave and "Come back in", the Pin button is named "Unpin Unpin your cats", and then "Pin Unpin your cats" for the rest of the visit

- Where: `client/src/floating.ts:149`. The name comes from the button's
  current `aria-label`, with `/^Pin /` stripped. `:154` writes it back.
  `client/src/main.ts:365`: "Come back in" calls `enter()` again over the
  same DOM, so a new `Floating` reads the label the last one left.
- Steps:
  1. Pin Your cats. The label is "Unpin your cats".
  2. Leave, then Come back in. The label is now "Unpin Unpin your cats",
     since `^Pin ` doesn't match.
  3. Unpin it. The label is "Pin Unpin your cats", and it stays that way
     through every later leave and return.
- A screen reader reads "Pin Unpin your cats, toggle button, not pressed".
  That is the only control a pinned panel has. The same happens after a
  sign-out and sign-in in one tab (`onSignedOut` calls `showAuth(enter)`).
- Would a test catch it: none does, and the spec couldn't as written.
  Playwright's `getByRole("button", { name: "Unpin your cats" })` matches a
  substring, so "Unpin Unpin your cats" passes (`spec/browser.test.ts:455`,
  `:506-511`). Fix: take the name from the panel's heading, or from a
  `data-` attribute, never from the label being rewritten. Add a check that
  leaves, comes back and matches the name with `exact: true`.

### 4. Major (needs a real Safari and Firefox check): the 4.5:1 glass is shown only for Chrome, and its "opaque where it can't" fallback is keyed on parsing, not drawing

- Where: `client/src/style.css:131-134`; the model in
  `client/test/contrast.test.ts:104-108` and `:158-165`.
- Chrome matches the model, as the plan logged:
  - light theme: `#ececec` over black, `#ffffff` over white, `#e1e1e1`
    dimmed;
  - dark theme: `#191922` over black, `#393942` over white.
- WebKit (Playwright's build, headless on macOS) passes `CSS.supports`
  for both `backdrop-filter` and `rgb(from …)`, so the glass rules apply,
  but it draws no backdrop filter. The panel is the bare 50% or 20% card
  over the unfiltered room. The text contrast on WebKit's own pixels:

  | Theme and state | Over | Panel | Ink | Muted |
  | --- | --- | --- | --- | --- |
  | Light, normal | black | `#808080` | 2.02:1 | 1.58:1 |
  | Dark, normal | white | `#9898a1` | 1.98:1 | 1.28:1 |
  | Dark, dimmed | white | `#d6d6da` | 1.00:1 | |

  The same build drew nothing for `blur(20px)` or `invert(1)` on a plain
  page either. This is likely the headless build not compositing backdrop
  filters into screenshots, and isn't evidence that Safari fails. But
  nothing shows Safari passes, and this is exactly the case `@supports`
  can't detect: a browser that parses the property and doesn't draw it.
  Safari on an iPad in landscape (1024 px and up) gets the desktop layout.
- A browser with `backdrop-filter` but no relative colour syntax (roughly Chrome
  76 to 118, Firefox 103 to 127, Safari before 16.4) passes the
  `@supports` test. It then finds
  `rgb(from var(--card) …)` invalid at computed-value time, so the
  background becomes transparent (confirmed in Chrome: an unparseable
  colour function behind `var()` computes to `rgba(0, 0, 0, 0)`). The glass
  is then the filter alone:
  - the light theme's muted text over black is 4.42:1;
  - normal and dimmed look the same.
- Would a test catch it: no. The unit test models Chrome's filter. Fix:
  - precompute the two glass colours as plain `rgb(… / 0.5)` tokens (or add
    `color: rgb(from red r g b)` to the `@supports` condition);
  - add a judged check in real Safari and Firefox: a panel over black and
    over white, in light and dark, normal and dimmed, read from a
    screenshot as the plan did for Chrome.

### 5. Minor: the blocked-storage browser check passes without the visit fallback it names

- Where: `spec/browser.test.ts:384-407`; the code it's meant to hold is
  `client/src/layout.ts:203` (`panelsThisVisit = panels`).
- With M1 (that line removed), the check passes. `Floating` keeps its own
  `saved` in memory (`floating.ts:22`, `:34`), and a resize doesn't read
  storage again. The fallback only matters when a new `Floating` is built.
  With storage blocked, move who's here and pin it, then Leave and Come
  back in:
  - real build: it comes back where it was put (x 1360) and pinned;
  - M1: it's back in its corner (x 1616) and unpinned.
- The unit test (`layout.test.ts`, "keeps them for the visit") does fail
  under M1, so the behaviour is held, just not by the browser check the
  spec names. Fix: have the browser check Leave and Come back in, then
  compare.

### 6. Minor: the dimming check's "a pinned panel never dims" can't fail

- Where: `spec/browser.test.ts:550-555`; the wiring it should hold is
  `client/src/floating.ts:42`.
- With M2 (pinned panels dim), the check passes. Clicking Pin with the
  mouse leaves the focus on the Unpin button inside the panel (confirmed:
  `activeElement` is "Unpin your cats"), and `Dimmer` treats focus inside
  as awake. Pinned or not, the panel stays bright.
  `client/test/floating.test.ts:96-110` holds `Dimmer`'s own callback, not
  what `Floating` passes it, so nothing holds the wiring. Fix: focus the
  room after pinning, before the clock moves on.

### 7. Minor: a drag doesn't end when its capture or button-up goes missing, carries on after the panel is pinned, and carries on across 960 px

- Where: `client/src/floating.ts:100-125`. The drag ends only on
  `pointerup` or `pointercancel` at the handle. `move` checks neither the
  button, nor pinning, nor the phone layout.
- **A button-up that never reaches the page:** press on the title, move,
  then release outside the page (sent by CDP with no `mouseReleased`). The
  panel follows later moves over its title with no button held: 110 px
  along a hover, and `.moving` stays. The same happens if the capture is
  released. Chrome usually delivers the `pointerup` to the capturing
  element, so this is rare: a context menu, a dialog or the OS taking the
  pointer.
- **Pinned mid-drag:** with Pin focused, drag the title or grip and press
  Space. The panel pins, then follows the drag 260 by 180 px, and saves
  that spot as pinned.
- **Narrowed below 960 mid-drag:** the drag goes on in the phone layout and
  saves a spot measured from the phone's box (who's here saved as
  left 173, bottom 423). Back at 1920×1080 it sits at (181, 442), not near
  its top-right corner. It's inside the stage, but not where anyone put
  it.
- Would a test catch it: none does. Fix:
  - end on `lostpointercapture`, and on a mouse move with `buttons === 0`;
  - ignore moves once the panel is pinned or the page is a phone's.

### 8. Minor: while the café wakes, the panels sit under the dusting cover, but Tab still reaches their grips and pins

- Where: `client/src/style.css:122` (panels at `z-index: 1`) and `:151`
  (`.waking`, `z-index: 1` inside the stage, later in the page, so it
  paints over them); `client/index.html:72-103`.
- On a café held waking, `elementFromPoint` at each panel's buttons is
  `waking`. Tab from Leave still goes to "Move the chalkboard", "Pin the
  chalkboard", "Move your cats" and "Pin your cats", with the focus ring
  out of sight under the cover. Arrows move a panel nobody can see, and
  Space pins it.
- Before the slice the panels stood beside the stage, outside the cover.
- Would a test catch it: none does. The dusting check
  (`spec/browser.test.ts:1314`) doesn't Tab. Fix: make the panels `inert`
  while the café wakes, or raise them above the cover.

### 9. Minor: the corners cover the cat tower at common laptop sizes, and the two left panels overlap when the status bar wraps; both are checked only at 1920×1080

- Where: `client/src/floating.ts:11-15` (`START`), `client/src/style.css:123-125`
  (max-heights taken from `100vh − 140px`, not from the stage);
  `spec/browser.test.ts:293-300`.
- Tiles under the default Your cats:
  - 1680×1050 (4×): (0,1), (1,1) and (0,2), the cat tower, where cats nap
    and hide;
  - 1440×900, 1470×836 and 1512×862 (3×; the last two are MacBook Air
    viewports): (0,1);
  - 1024×768 and 960×600 (2×): 4 and 8 tiles, the tower and bare floor.
  Every tile is clear at 2560×1440, 1920×1200, 1920×1080, 1920×953,
  1728×997, 1600×900, 1536×864, 1366×768 and 1280×720.
- At 960×600 with the status bar on two lines (the "updated" note and
  something carried, 101 px), the left panels overlap by 1 px with a short
  chalkboard and by 28 px with a full one. Their max-heights add up to 95%
  of `100vh − 140px`, which no longer fits a stage that the taller bar has
  shrunk.
- An unpinned panel can be moved, so nothing is unreachable. But the
  judged line ("nothing important hides under them by default") was judged
  from 1920×1080 only, and the browser check holds tiles and overlap there
  only. Fix: size from the stage (or clamp the second panel below the
  first), and show the user a laptop-sized screen.

### 10. Minor: the Move grip does nothing on Enter or Space, says nothing about the arrows, and a move isn't announced

- Where: `client/index.html:79`, `:87`, `:95` (a button with only an
  `aria-label`); `client/src/floating.ts:128-137` (arrow keys only).
- A screen reader hears "Move the chalkboard, button". Pressing it does
  nothing, no description says the arrows move it, and a move is silent.
  In a screen reader's browse mode the arrows don't reach the button at
  all.
- Sighted keyboard users are fine, since the spec check moves it by
  arrows. Fix:
  - add `aria-describedby` with "Arrow keys move it; Shift moves it
    further";
  - announce where it ends up, through `announce()` (for example "Moved
    to the top right");
  - or have Enter or Space say so.

### 11. Minor: "at 1920×1080 the room fits at 4×" isn't held by the unit tests the spec names

- Where: `client/test/scale.test.ts:9-14` (`fitScale(1896, 950)`); the
  spec's table says "client unit tests (`scale`, `layout`)".
- The test picks its own numbers and holds arithmetic. Nothing in
  `layout.test.ts` holds 4× at all. Putting the side columns back in
  `style.css` passes both. What actually holds it is the browser checks'
  `roomWidth === "1344px"` (`spec/browser.test.ts:234`, `:274`). Fix: name
  the browser checks in the spec's table, or drop the claim for the units.
  The fit itself is sound (see below).

## Checked and found sound

- **Click-through:**
  - a click over a bare tile under a pinned panel walks there, and over a
    still cat it opens the cat's menu (spec);
  - a finger tap through a pinned panel on a 1920×1080 touch screen sent
    `walkTo` for the tile under it;
  - the panel's padding and bar pass clicks through, and only Unpin takes
    one;
  - the chalkboard's tile and the hover ghost reach the canvas the same
    way (`pointer-events: none`). They weren't probed separately.
- **Stacking:**
  - menus, bubbles and toasts are at `z-index: 2` in the overlay. The stage
    makes no stacking context, so they paint over the panels;
  - "Add furniture"'s menu opened over who's here with every button on
    top;
  - the board, the nudge and the drawer stay above.
- **Dragging and placing:**
  - the room is 4× at 1920×1080 with 37 px of height to spare. It stays
    4× with the "updated" note showing (stage 957 ≥ 928) and while
    carrying something;
  - the stage clamp keeps every panel off Leave and the talk box, through
    a drag past the edge, a resize to 1280×720, and a phone and back;
  - rubbish, wrong types, arrays and huge numbers in `cafe.panels` are
    ignored or clamped (by the unit test, and by reading `savedPanels`
    and `panelAt`; not tampered with in a browser);
  - a title drag over the room walks nobody (spec);
  - an unpinned panel's body scrolls by finger, and the title and grip
    alone carry `touch-action: none`.
- **Dimming:**
  - a panel dims between 4 and 5 s (the 1 s tick);
  - the same markup rebuilt stays dim;
  - a change, the pointer or the focus brings it back;
  - a panel pinned by mouse and unpinned by keyboard dims again as it
    should;
  - `dispose` clears the ticker, the observer and the listeners;
  - a phone never dims.
- **The phone:**
  - layout A, layout B and the drawer are as before;
  - no grips or pins show (zero visible bar buttons);
  - the chalkboard's copy is 1 px and not a Tab stop;
  - the treat button sits beside the emotes in both layouts;
  - a 959.5 px frame reports 960 in Chrome, so the 959 and 960 media
    queries leave no gap there.
- **Pinning:** a select-all leaves out a pinned panel's text; a pinned
  panel can't be dragged; pins and spots survive a reload.
- **Headings:** an `h2` per panel and `h3` inside ("Inside", "At the
  window", "Said this visit").
- **Kept rules:**
  - `Dimmer` holds who's here's markup, said lines included, in memory
    only;
  - `cafe.panels` holds spots and pins only;
  - nothing reaches the server;
  - `client/src/protocol/` is untouched.
- **Not checked:** Firefox (it wouldn't start here), real Safari, a real
  screen reader, and Windows' classic scrollbars.
