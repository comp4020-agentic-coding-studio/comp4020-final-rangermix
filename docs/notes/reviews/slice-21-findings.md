# Findings: review of slice 21, "Told how the café works, on the way in"

Brief: [slice-21-brief.md](slice-21-brief.md). Read cold on 2026-11-09,
reviewing `fa7ee7b..d580206` on `worktree-slice-21-guide`.

All code was built and run only in a throwaway copy outside the repo,
made with `git archive d580206`, with the checkout's `node_modules` and
`client/node_modules` linked in. The client was built first (`npx vite
build`, build id `mw8cycuk`), then the brief's server binary was started
from the copy's root on port 8131 with a fresh `DATA_DIR` and
`CLIENT_DIR` pointing at that build, after `cafe demo seed` with a local
demo password. That server was stopped by its own PID at the end.
Nothing in this checkout changed except this file. Nothing live was
touched: not the café, not Fly.

While the review ran, the builder committed
[`ff5a63c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ff5a63c)
after the brief (`spec/guide.test.ts`, `spec/music.test.ts` and the
slice's screens). It isn't part of `d580206` and wasn't reviewed or run.
By reading, it answers findings 1 and 2.

## What was run

- **Typecheck.** `tsc --noEmit` at the root and in `client/`: both pass.
- **Client tests.** `client/test/guide.test.ts`: 20 passed. The whole
  client suite: 463 passed in 32 files.
- **The guide's browser checks.** `spec/guide.test.ts` against the
  copy's café: 8 passed.
- **The whole `spec/`** against the same café: 131 passed, 1 failed, 1
  skipped. The failure is in `spec/music.test.ts`, and run alone it fails
  the same way (finding 1).
- **Playwright probes.** Throwaway scripts against the copy's café, each
  with fresh local accounts:
  - What `elementFromPoint` finds at the box's and the ⓘ's middles with
    the shrink held at 0, 100, 200, 300 and 340 ms. Then real mouse
    clicks there, held and in real time (finding 5).
  - The shrink's last frame measured against the ⓘ in 14 layouts:
    - 390×844 in layouts A and B, each plain, as a demo account, and with
      the café-updated pill;
    - 320×568 in A and B;
    - 960×800 desktop, as a demo account and with the pill;
    - 1920×1080 as a demo account;
    - 844×390, 1280×420 and 320×480.
  - Layout A by touch: a wheel beside the card, and a CDP touch swipe
    through the words. The page's `scrollY`, then the shrink's last frame
    (finding 4). The same in layout B.
  - A resize from 1920 to 390 during the shrink, and a close 100 ms into
    the grow (findings 12, 13).
  - The first welcome rewritten to name a newer build, walking in with
    the guide on. Then the socket dropped with the guide open and a newer
    build on the next welcome. Each time, a `MutationObserver` noted every
    showing of the guide across the reload (finding 3).
  - `localStorage` replaced by one that throws: tick, close, the ⓘ, then
    Come back in (finding 6).
  - Server messages pushed into the page's socket with the guide open:
    `stillThere`, `personLeft` for you, `replaced`, `waking`, and a
    sign-out with the socket dropped (finding 10).
  - Aria snapshots of the dialog at 1920 and 390. The focus ring after
    Enter on the ⓘ (finding 7). The Add furniture menu across the guide
    (finding 11). A tap beside the card at 390.
  - Both colour schemes: the card and the ⓘ screenshotted, and the
    checkbox's pixels read off them, ticked and not.
  - The status bar's height at 390 in each layout, with and without the
    demo bar and the pill, as built and with the ⓘ and the new
    `min-width` taken back out by an injected style (finding 14).
  - The phone check's one-line test on a static page and on the real
    page with the new `min-width` removed (finding 2).
  - Tab from the room after the guide closes (finding 9).
  - A real seeded demo account at both sizes.

**Count:** 0 critical, 1 major, 7 minor, 6 nits.

## Findings

### 1. Major: `pnpm check` fails at `d580206`, because the music's blocked-storage check leaves the guide open and its clean-up can't press Leave

**What's wrong.** `spec/music.test.ts` "keeps on, off and the volume for
the visit when the device won't store them" (line 595) closes the guide
at the first entry. It then presses Leave and Come back in. With storage
blocked, the guide pops up again, as designed, and nothing closes it.
The test's own assertions read state, so they pass. But the file's
`afterEach` (line 18) presses `#leave` without `force`. The café is
inert under the guide, so Playwright waits, and the hook times out at
10 s. `d580206` fixed the same pattern in `browser.test.ts` but not here.

So the "done when" row "Every existing check still walks into the café
as before | `pnpm check`" doesn't hold at `d580206`.
`docs/notes/slice-21-guide.md` says the whole of `pnpm check` was run.

**How it was seen.** The whole `spec/`: 1 failed ("Hook timed out in
10000ms", `spec/music.test.ts:18`). The same test alone with `-t "won't
store them"`: the same failure.

**What "fixed" looks like.** Close the guide after Come back in, as
`browser.test.ts` now does. `ff5a63c` does that. Then run the whole `spec/` again and record it. A shared helper
such as `closeGuide(page)` for both blocked-storage checks would stop
the two from drifting apart again.

### 2. Minor: the phone check's "status line on one line" can't fail

**What's wrong.** `spec/guide.test.ts:288` asserts
`el.getClientRects().length === 1` on `#status-text`. That span is a
flex item, so it's blockified, and it has one box however many lines
its text wraps to. The check passes whether or not the line wraps, so
it doesn't hold the `min-width: 6rem` added in `d580206`
(`style.css:360`).

**How it was seen.**
- A static flex row with the text squeezed: the text wraps to 2 lines,
  and `getClientRects().length` is 1.
- The real page at 390×844 in layout A, with the new `min-width` taken
  off by an injected style: "1/6 inside" wraps to 2 lines (counted from
  a Range's line boxes), and `getClientRects().length` is still 1.

**What "fixed" looks like.** Count the text's own line boxes through a
`Range`, as `ff5a63c` does. See it fail with
the `min-width` removed before trusting it.

### 3. Minor: the café's own reload throws away a guide that was wanted, including on a real first entry

**What's wrong.** `enter()` opens the guide unless `opts.reload`
(`main.ts:588`). The café reloads itself whenever a welcome names a
newer build (`cafe.ts:161-166`), and that is often the first welcome
after Walk in. Two cases:
- A newcomer whose page was loaded before a deploy walks in. The guide
  opens, the first welcome names the new build, and the page reloads
  straight back in with no guide. Nothing was ticked. That's a real
  entry skipped, which is what the brief asks about. `index.html` is
  `no-cache`, so this needs a page left open across a deploy.
- A deploy lands while someone is reading the guide. After the
  reconnect the page reloads, and the guide is gone.

**How it was seen.** The welcome's build rewritten by
`page.routeWebSocket`, as `fill.test.ts` does, on a newcomer's browser:
- Walk in: the guide was shown once, then the page reloaded once. After
  it the guide wasn't shown, `cafe.guide` was unset, and the
  café-updated pill showed.
- The socket closed 2.5 s after Walk in, with the guide open, and a
  newer build on the next welcome: after the reload, no guide, nothing
  stored.

**What "fixed" looks like.** Carry "the guide was open" across the
reload, for example a `sessionStorage` key set while it's open and read
with `backInside()`. On `reload: true`, open it again if it was open. A
spec check: a newcomer, the welcome's build rewritten, Walk in, and the
guide is there after the reload.

### 4. Minor: in layout A the shrink flies off the top of the screen once the newcomer has read to the end

**What's wrong.** In layout A the page is taller than the screen (1057 px
at 390×844), and nothing holds it still while the guide is open. The café
behind is inert, but the page still scrolls. A finger swipe through the
words, once they reach their end, chains to the page.

Closing then works like this. `close()` focuses the room first
(`guide.ts:135`), which scrolls the page. Only after that does it measure
the ⓘ (`guide.ts:142`). So the card shrinks onto an ⓘ that is off screen.
The newcomer doesn't see where it went, which is what the shrink is for.

Layout B doesn't scroll, and is unaffected. Opened from the ⓘ, the focus
goes back to the ⓘ, which by reading scrolls it into view before the
measure.

**How it was seen.** 390×844, layout A, by touch, guide on at entry:
- One CDP touch swipe of 500 px on the words: the words reach their end
  (340 of 340), and the page's `scrollY` goes to 213.
- Close: the last frame lands exactly on the ⓘ, at y = −80.8, off screen.
  `scrollY` is 109 after the room took the focus.
- A mouse wheel beside the card did the same.
- Layout B, the same swipe: `scrollY` 1, and it lands on screen.

**What "fixed" looks like.**
- `overscroll-behavior: contain` on `.guide-words`, and the page held
  still while the guide is open (for example `overflow: hidden` on the
  root, or `overscroll-behavior` on the backdrop).
- Then `focus({ preventScroll: true })` for the room, or measure the ⓘ
  before moving the focus.
- A spec check: layout A, a swipe, close, and the last frame on screen.

### 5. Minor: the shrinking card still takes clicks, and one can tick "no pop-up" unseen

**What's wrong.** The code says "Shut to the café at once; shown, taking
no clicks, until it lands" (`guide.ts:140-141`). It sets `pointer-events:
none` inline on `#guide` and the backdrop. But `.guide-card` sets
`pointer-events: auto` (`style.css:283`), which overrides what it would
inherit. So for the first two thirds or so of the 350 ms, the card goes
on taking clicks:
- a click meant for the café under it is swallowed;
- a click where the box is ticks it and saves `cafe.guide = "off"` while
  the guide is going away, so the visitor never sees the tick.

The ⓘ itself stays reachable: by 250 to 300 ms the card has moved off it,
and a click on it opens the guide again, as intended.

**How it was seen.** At 1920×1080, close, then hold the shrink:
- `elementFromPoint` at the box's place finds the card: its foot at
  0 ms, and the box itself at 100 and 200 ms. At 300 ms it finds the
  room.
- The computed `pointer-events` of the card is `auto` throughout.
- A real mouse click at the box's place, held at 0 ms: `checked` true and
  `cafe.guide` `"off"`, where it was `null` before.
- A click on the ⓘ held at 300 ms, and one 250 ms into a real-time
  shrink: the guide opens again.

**What "fixed" looks like.** The card takes no pointer events while
closing too, for example a `closing` class on `#guide` with
`.guide.closing .guide-card { pointer-events: none }`, cleared by
`open()` and `hide()`. Hold it with:
- a unit test that, after `close()`, the card's `pointer-events` is
  `none`;
- a browser check that `elementFromPoint` mid-shrink finds nothing of
  the guide.

### 6. Minor: with storage blocked the box doesn't hold even for the visit

**What's wrong.** `saveGuideWanted` swallows the failure with the comment
"Nowhere to keep it: the box holds for this visit" (`guide.ts:24`), and
the spec says "the box works for the visit". But `open()` sets the box
from `guideWanted()` (`guide.ts:103`), and that returns true whenever
storage throws. So a tick doesn't survive the next opening, even from
the ⓘ a moment later. `layout.ts` already has the pattern this needs: its
`thisVisit` keeps the layout chosen for the visit when storage throws.

**How it was seen.** `localStorage` replaced by one that throws:
- tick the box, Escape;
- the ⓘ: the box is unticked again;
- Leave, Come back in: the guide pops up.

**What "fixed" looks like.** An in-memory fallback in `guide.ts` like
`layout.ts`'s `thisVisit`, read when storage throws. A unit test with
`blockStorage()`: `saveGuideWanted(false)`, then `guideWanted()` is
false. The spec's two halves conflict on Come back in within one page:
"shows the guide at every entry" against "the box works for the visit".
That one is the user's call. At the least, the ⓘ shouldn't show the box
unticked straight after it was ticked.

### 7. Minor: opened by keyboard, the focus can't be seen

**What's wrong.** `ba3cc86` takes the ring off the words unless Tab
brought the focus there (`style.css:287-288`), so a mouse opening shows
no ring. But a keyboard opening shows none either: Enter on the ⓘ, as
seen, and by reading Space on the ⓘ or Walk in pressed by key. The focus
sits on the words with `:focus-visible` matching, and nothing marks it. That's WCAG 2.4.7, for
a scrollable stop the arrows act on.

**How it was seen.** At 1920×1080, the ⓘ focused, Enter:
- `document.activeElement` is `guide-words`;
- `:focus-visible` matches;
- computed `outline-style` is `none` and `box-shadow` is `none`;
- the screenshot shows no ring anywhere.

**What "fixed" looks like.** Add `tabbed` when the guide opens from a
keyboard press. The ⓘ's `click` has `detail === 0` when a key activated
it, and the entry can take whether Walk in was pressed by key. Hold it
with a unit test or a browser check that Enter on the ⓘ leaves the
words ringed, and a mouse click doesn't.

### 8. Minor: the phone half of a "done when" row isn't checked

**What's wrong.** The row is "A visitor walking in sees the guide over an
inert café, the focus in it, at 1920×1080 by mouse and at 390×844 by
touch". The 1920 check asserts `inert` and the focus (`spec/guide.test.ts`
lines 135-136). The 390 touch check (lines 261-297) asserts neither: it
checks the lines, the card on screen, the landing and the ⓘ's place. The
code path is shared, so it probably holds, but the row claims a check
that isn't there.

**What "fixed" looks like.** In the phone check, after
`#guide.waitFor()`: `expect(await inert(page)).toBe(true)` and
`expect(await focused(page)).toBe("guide-words")`.

### 9. Nit: a few of the words don't quite match what the café does

The words are the user's to judge (the spec's last row). These differ
from the code as it stands:
- **"Tab steps through what's there".** Tab only steps through the room
  once an arrow has shown the pointer (`input.ts:180`). Right after the
  guide closes, Tab goes to the talk box. Seen: Escape, then Tab, and the
  focus is on `talk-input`. Perhaps "the arrows bring up a pointer and
  move it; then Tab steps through what's there". The room's own
  `aria-label` has the same wording.
- **"pin it to let clicks through to the room, and it fades when left
  alone".** A pinned panel never fades (`floating.ts:277`, 321). Perhaps
  "and each fades when left alone, unless pinned".
- **"Click a cat, a person or a piece of furniture to see what you can
  do".** A click on a piece you walk over (the rug, a cushion) walks you
  onto it, and its menu opens from there (design.md, "Controls"). A
  fixed piece has no menu at all.
- **On a phone, "Type in the box at the bottom".** In layout A the talk
  box is under the room, with the music, who's here and your cats below
  it. And the phone lines never say where the chalkboard is (tapped in
  the room), though "the chalkboard says what they got up to".

No cat's name and no number from `content/` appear, as the spec holds.

### 10. Nit: left open over the second-tab page

With the guide open, a `replaced` message (the café opened in another
tab) leaves the guide up over a café that's gone. The status behind says
"You opened the café in another tab." It closes as usual, and the
chalkboard's dialog behaves the same, so this is a nit.

`waking` also leaves it open, which is fine: unlike the board's lines,
nothing in it goes stale.

The nudge, a walk-out and a sign-out each shut it at once. After the
nudge, "Still there?" shows with the focus on I'm here. After the
walk-out, the door shows. After the sign-out, the way in shows. Closing
it on `replaced` too would leave no gap.

### 11. Nit: a menu stays open under the guide and after it

Add furniture's menu, opened and then left by pressing the ⓘ, stays open
under the guide, and is still open after the guide closes. The focus
returns to the ⓘ. The board calls `closeMenu()` as it opens
(`main.ts:301`), and the guide could too (in `main.ts`, wired to the ⓘ),
which would cover a ring in layout B as well.

### 12. Nit: a resize mid-shrink sends the card off screen

The transform is fixed when the shrink starts. A resize from 1920×1080
to 390×844, 100 ms into it, ends the card at (903.7, −89.8) on a window
390 wide, with the ⓘ at (223.8, 28.2). It only lasts 350 ms. Finishing
or hiding the shrink at once on a resize would hold it.

### 13. Nit: closing during the grow jumps to full size first

Closing 100 ms into the grow cancels it, and the shrink starts from the
full card: 175 px wide, then 544 px in the next frame, then shrinking.
Starting the shrink from where the grow had got to would avoid the jump,
for example by reading the current transform before `cancel()`.

### 14. Nit: where the bar wraps, the ⓘ and Add furniture part

At 320×568 in layout B, the ⓘ ends the first row and Add furniture
starts the second. At 390×844 in layout B with the café-updated pill,
the ⓘ sits beside the pill and Add furniture is a row below. The spec's
placement row is held at 390 in the ordinary state, as checked. The ⓘ
also costs height at 390:

| Layout at 390×844 | With the ⓘ | Without the ⓘ and `min-width` |
| --- | --- | --- |
| B, B demo | 106 px | 106 px |
| A, A demo | 93 px | 48 px |
| B updated | 203 px | 167 px |
| A updated | 137 px | 101 px |

The 48 px for A without them is the "2/6" over "inside" squeeze that
`d580206` fixed. Keeping the ⓘ and Add furniture together, for example
as a no-wrap pair, would keep "just left of Add furniture" true when the
bar wraps.

## What holds as claimed

- **Whether it pops up is remembered in this browser, defaults to yes,
  and yes where storage throws.** Held by `client/test/guide.test.ts`. The
  box's own storage-blocked behaviour is finding 6.
- **The card's middle onto the button's, scaled to fit inside it.** Held
  by the unit tests and the spec at both sizes. Measured beyond the spec,
  the last frame lands exactly on the ⓘ (dx and dy 0.00, and the card's
  box inside the ⓘ's) in all 14 layouts probed: both phone layouts with
  and without the demo bar; the café-updated pill wrapping the bar to 4
  or 5 rows; 320 px; 960 px; landscape 844×390; and a 1280×420 window.
  Layout A after a scroll is the exception (finding 4).
- **Over an inert café, the focus in it.** Held at 1920 by the spec. At
  390 it holds by reading, but isn't checked (finding 8).
- **Close, Escape and a press beside it close it; the focus goes to the
  room, or to the ⓘ.** Held. A tap beside the card at 390 also closes it,
  the café no longer inert and the focus on the room.
- **Tab and Shift+Tab stay inside.** Held, in the spec and the unit tests.
- **Ticked, it stays down on Come back in and on a reload; the ⓘ shows it
  ticked; unticked, it's back.** Held.
- **The café's own reload doesn't pop it up.** Held, but that rule also
  costs a real entry its guide (finding 3).
- **Widths and a resize mid-use.** Held. The words still scroll with the
  foot in view at 844×390, 1280×420 and 320×480.
- **The demo line.** Held. Also seen with a real seeded `demo1` at both
  sizes.
- **Reduced motion.** Held: it fades only, and gives no pop.
- **The ⓘ just left of Add furniture at 1920 and in both phone layouts at
  390.** Held in the ordinary state (finding 14 for wrapped bars).
- **`pnpm check`.** Not held at `d580206` (finding 1).

## The brief's questions

- **Changed checks.** `guideOff` only sets `cafe.guide` before each load.
  The ⓘ is in every other check's status bar, so they still test the
  layout as a newcomer gets it. A newcomer differs only by the guide over
  the room at entry and the focus in it, which are the guide's own
  checks. I found no regression the switch hides. Of the two
  blocked-storage checks, `browser.test.ts` closes the guide at both
  entries. `music.test.ts` closes it only at the first (finding 1).
- **The modal.** Nothing of the café is reachable while it's open:
  - `#cafe` is inert, and everything outside it but the guide is hidden.
    That covers the board, the nudge, the door and the way in.
  - The guide's `keydown` listener is registered before `main.ts`'s
    others, and it moves the focus before they run.
  - The drawer's Escape needs the focus inside the drawer, which can't
    be there.
  - The music's first press, and the presence ping (at most every
    30 s), do fire on presses in the guide. Both are harmless: a press is
    the visitor being here, and the only entry that leaves the music
    waiting for a press, the café's own reload, brings no guide.
  - Finding 5 is the one gap, and only during the shrink.
- **Contrast**, against the card and computed from `style.css`'s tokens
  (Latte | Mocha):

  | What | Latte | Mocha |
  | --- | --- | --- |
  | Words | 7.99 | 8.69 |
  | Lede and hint | 6.25 | 5.65 |
  | Close's text | 5.41 | 9.27 |
  | Words' focus ring | 18.75 | 5.97 |

  Read off screenshots:

  | What | Latte | Mocha |
  | --- | --- | --- |
  | Unticked box's border | `#767676`, 4.54 | `#858585`, 3.41 |
  | Ticked box's fill | `#6a12de`, 7.62 | `#fcd5bd`, 9.21 |
  | Tick on the fill | | 8.21 |

  Every pair passes.
- **Screen readers.** The dialog is named "How the café works". Lines for
  the other width are `display: none` and absent from the dialog's
  snapshot at each size, and so is the demo line for others. The ⓘ is
  named "How the café works", and the box is labelled "Got it, no pop-up
  next time".
- **Rules.** Only `cafe.guide` is stored, in this browser. There's no
  server or protocol change, and `client/src/protocol/` is untouched.
