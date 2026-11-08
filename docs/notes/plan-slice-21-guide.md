# Plan: slice 21, told how the café works

The spec is [21](../slices/21-told-how-the-cafe-works.md), approved
2026-11-09. Written from `main` at
[`fa7ee7b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fa7ee7b),
on branch `worktree-slice-21-guide`. The client only: no Rust, no protocol.

## What's there now

- `client/index.html`: the status bar is `#status-text`, `#outdated`,
  `#carrying`, `#add-furniture`, `#drawer-toggle` (layout B), `#layout-switch`
  (phones), `#leave`. The chalkboard's dialog (`#board`, `#board-backdrop`)
  stands outside `#cafe`, which is made `inert` while it's open.
- `client/src/main.ts`: `start()` reads `/api/me` and `backInside()` (the
  café's own reload for a new build), then `enter(me)` or the door.
  `enter()` builds everything for the visit; `stop()` takes it down on
  Leave, sign-out and walk-out. `onStillThere` hides the board first.
- A demo account is known from the welcome (`state.demo`); `demoBar.ts`
  puts `demo` on `body` for it.
- Per-device choices are `localStorage` keys `cafe.layout`, `cafe.panels`,
  `cafe.music`, each read and written in a `try`.
- `spec/`: five files open browsers (`balcony`, `browser`, `fill`, `music`,
  `welcome`), each through `browser.newContext`. Two checks replace
  `localStorage` with one that throws (`browser.test.ts`, the panels'
  grip; `music.test.ts`, the volume).

## Files

- **New `client/src/guide.ts`:**
  - `guideWanted(): boolean`: false only if `localStorage["cafe.guide"]` is
    `"off"`; true when storage throws.
  - `saveGuideWanted(on: boolean): void`: `"off"` or the key removed; never
    throws.
  - `shrinkInto(card: Box, button: Box): { x: number; y: number; scale: number }`:
    the translation from the card's middle to the button's, and the one
    scale that fits the card inside the button (`min` of the two ratios).
  - `class Guide`: built per visit from its elements; `open(from: "entry" | "button")`,
    `close(opts?: { now?: boolean })`, `isOpen`, `dispose()`. Open: shows
    the backdrop and the guide, ticks the box from `guideWanted()`, makes
    `#cafe` inert, focuses the words (`tabindex="-1"`), and, from the
    button, animates out of it. A document `keydown` while open: Escape
    closes; Tab and Shift+Tab go round the words, the box and Close. The
    box saves on `change`. A press that starts and ends on the backdrop
    closes it (the board's rule). Close: animates into the button with
    `element.animate` (a fade only under reduced motion, nothing where
    `animate` is missing), then hides, un-inerts the café and focuses the
    button or the room. The button lands with a small pop.
- **`client/index.html`:** `#guide-open` before `#add-furniture`; the guide
  (`#guide-backdrop`, `#guide`, `#guide-card` with `#guide-words`,
  `#guide-off`, `#guide-close`) after the board. Lines for one width carry
  `for-wide` or `for-narrow`; the demo line `for-demo`.
- **`client/src/style.css`:** the ⓘ round, as tall as its neighbours; the
  guide centred, `min(34rem, 100vw - 32px)` wide, its words scrolling and
  its foot always in view, inside `100dvh - 32px`; `for-wide` hidden below
  960 px, `for-narrow` from 960 px, `for-demo` hidden but on `body.demo`.
- **`client/src/main.ts`:** `enter(me, { reload })`, `start()` passing
  `reload: true` for `backInside()`; the guide built in `enter()`, opened at
  entry when wanted and not a reload, its button wired, closed now in
  `stop()` and before the "Still there?" nudge.
- **`spec/helpers.ts`:** `guideOff(context)`, an init script setting
  `cafe.guide` to `"off"` in a `try`.
- **The five browser files:** `guideOff` on every context, except where a
  check is the guide's own; the two blocked-storage checks close the guide.
- **New `spec/guide.test.ts`:** the spec's rows.

## Tasks, each test first

1. **The choice and the shrink** (`client/test/guide.test.ts`, then
   `guide.ts`'s three functions). Seen failing: the module doesn't exist.
2. **The dialog** (`client/test/guide.test.ts`, jsdom): open from entry
   makes the café inert and focuses the words; the box shows the saved
   choice and saves on change; Tab and Shift+Tab wrap; Escape, Close and a
   press on the backdrop close it, focus to the room or the button; `now`
   closes at once. Then `Guide`.
3. **The checks' visitors start with it off** (`spec/helpers.ts` and the
   five files), so the rest of `pnpm check` is held still while the page
   changes. Then **the page**: `index.html`, `style.css`, `main.ts`.
4. **The browser checks** (`spec/guide.test.ts`), written before task 3's
   page and run against a server built from this branch on a port of its
   own (port 8080 is another session's): entry at both sizes and by touch,
   the three ways to close and where the focus goes, the trap, ticked and
   unticked across Come back in and a reload, the build's reload, the
   widths and a resize, the demo line (the welcome rewritten to say demo,
   as `fill.test.ts` rewrites it for a fourth cat), reduced motion, the
   ⓘ's place, and the shrink's last frame on the button.
5. **Screens** for the user in `docs/notes/screens/slice-21/`.
6. **Review** by a fresh agent: brief and findings in
   `docs/notes/reviews/slice-21-*.md`; each finding fixed test first or
   answered.
7. **Deploy and check live**: merged onto `main`, CI deploys; the guide seen
   on the live café at both sizes with one `agent_` visitor, recorded in
   `docs/notes/slice-21-guide.md`.

## Execution log

Where the build departed from this plan, as it happened.

- **Every guide check timed out on its first run against the page** (task
  4). The server reads the client's build id once, as it starts, and the
  client had been rebuilt after it: each page saw a new build, reloaded
  itself, and that reload rightly brings no guide. Restarting the server
  after each client build fixed the run, not the code. The review's
  brief says so.
- **The words took a focus ring for a mouse** (seen in the first
  screens). Chrome counts the focus they take as the guide opens as a
  keyboard's. They're now ringed only when Tab brings the focus there (a
  `tabbed` class), test first in `client/test/guide.test.ts`
  ([`ba3cc86`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ba3cc86)).
- **The ⓘ squeezed the status line at 390 px in layout A**, "2/6" over
  "inside", since the line shrinks to its longest word before a button
  wraps. On a phone it now keeps 6rem, so a button goes to the next row;
  held by a line in the phone check (the status on one line).
- **The status line's check couldn't fail** (the review's finding 2; seen
  here too, before the review came back). `#status-text` is a flex item,
  so it's one box however its text wraps: the check counts its text's
  line boxes through a `Range`, seen failing with the `min-width` taken
  out ([`ff5a63c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ff5a63c)).
- **The two blocked-storage checks meet the guide again on Come back
  in**, as designed, and their clean-up couldn't press Leave behind it:
  both close it, through `closeGuide` (the review's finding 1).
- **The review** (14 findings: 1 major, 7 minor, 6 nits) was answered in
  [`b9fb6d0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b9fb6d0),
  each fixed test first but finding 10, answered
  ([findings](reviews/slice-21-findings.md)). One fix departed from the
  review's suggestion: holding the page still by hiding the root's
  overflow laid layout A out afresh in a phone's browser (the status bar
  24 px wide, 440 px above the screen, seen in a probe), so the guide
  instead cancels a wheel or a swipe outside its words and puts back any
  scroll that happens anyway.
