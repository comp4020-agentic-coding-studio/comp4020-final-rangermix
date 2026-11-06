# Findings: review of slice 16, "The café fills the window"

Brief: [slice-16-brief.md](slice-16-brief.md). Read cold on 2026-11-06,
reviewing `5a3a1df..244027f` on `slice-16-fill`. I built and ran code only
in throwaway copies outside the repo: `git archive 244027f`, plus
`git archive 5a3a1df` to compare against how things were before. Nothing
in this checkout changed except this file, and nothing live was touched:
not the café, not Fly. The café ran on port 18918 with a fresh `DATA_DIR`,
and I stopped it by its own PID each time.

**Count:** 0 critical, 4 major, 5 minor, 2 nits.

## What was run

- **Server tests.** `cargo test -p cafe` passed in the copy: 310 unit
  tests (1 ignored) and the integration tests (5, 4, 3, 1).
- **Client tests.** `vitest run` passed 309 tests in 27 files.
  `vite build` was clean.
- **Browser checks.** I ran these against the copy's café with
  `APP_URL=http://localhost:18918`.
  - `spec/fill.test.ts` passed, 7 of 7.
  - `spec/browser.test.ts` and `spec/music.test.ts` passed, 45 of 45.
- **Scratch server tests.** These went in the copy's `wake.rs` only and
  drive the real `wake()` from a store holding:
  - the live café's shape: a bare list of the old 12 by 10 pieces, the
    cushion moved, and one piece added from the catalogue;
  - unreadable saves;
  - a save at a third size, both bigger and smaller;
  - a furniture cap below the save.
- **Playwright probes.** These were throwaway scripts in the copy, run in
  Playwright's Chromium against the copy's café, at many window sizes, at
  DPR 1, 2 and 3, and in the light and dark themes. To show what a check
  would see if something broke, I injected CSS in the browser only (for
  example, hiding `#street`). For one comparison I ran the same probe
  against a `5a3a1df` server.

## Findings

### 1. Major: on a desktop, menus, speech bubbles and the waking screen now draw under the panels

**What's wrong.** The desktop stage is now
`body:not(.layout-b) .stage { position: fixed; inset: 0; }`
(`client/src/style.css:116`). A fixed element always forms a stacking
context. So everything in `#overlay` (`client/index.html:114`) is now
painted inside the stage's layer, below the panels:

- action menus (`.menu`, z 2, `style.css:258`);
- speech bubbles (`.bubble`, z 2, `style.css:256`);
- toasts.

The panels are `position: fixed; z-index: 1` at the root
(`style.css:156`). Panels can be dragged anywhere over the room, so a menu
or bubble that meets one is hidden behind it.

**How I saw it.**

- **A menu, before and after.** I opened a menu by keyboard, put the
  chalkboard panel over it, and asked `elementFromPoint` what is at each
  menu item.
  - On `5a3a1df`: `["menu","menu","menu","menu","menu"]`. The menu was on
    top.
  - On `244027f`: `["chalkboard"]`.
- **A real drag.** I dragged the chalkboard by its title to the room's
  middle, then opened a menu beside it. The menu opened under the panel.
  Only its focused button's ring showed, poking out past the panel's edge.
- **A bubble.** I said a line, then dragged the chalkboard over the
  bubble. `elementFromPoint` at the bubble's middle gave `chalkboard`.
- **The waking screen** (`#waking`, z 1, inside the stage) is now under
  the panels too. Before, it covered them.

**What fixed looks like.**

- The overlay's menus, bubbles and toasts paint above the panels again on
  a desktop. Either of these would do it:
  - lay out the stage with `position: absolute` in a `.cafe` that is
    `position: relative; height: 100vh` (absolute with `z-index: auto`
    makes no stacking context);
  - lift `#overlay` out of the stage into its own fixed layer above the
    panels.
- A browser check that:
  - drags a panel over an open menu, and over a bubble;
  - holds that `elementFromPoint` at each menu item, and at the bubble's
    middle, is the menu or the bubble;
  - runs at 1920×1080 and at a 3× size.

### 2. Major: the terrace takes clicks meant for the floor behind it, and hides floor tiles and the cats on them

**What's wrong.** The spec's "done when" says "a click or tap on it does
nothing", and design.md says the terrace takes no click. But the umbrella
and the street lamp are tall, and at 13 by 12 they are drawn over the
floor's front tiles (`client/src/render.ts:467`, `:692`, `:701`;
`content/street.toml:133`, `:151`).

`hitAt` never sees the terrace, so a click on the umbrella or lamp goes to
whatever is behind it:

- a walk to a floor tile;
- or a cat's menu.

The terrace also covers floor tiles, so a cat or person standing there is
hidden.

**How I saw it.**

- **Clicks at 1920×1080**, on the pixels the terrace draws:

  | Clicked | Sent |
  | --- | --- |
  | Umbrella's canopy | `walkTo (9,12)` |
  | Canopy's near edge | `walkTo (8,11)` |
  | Lamp's head | `walkTo (12,10)` |
  | Lamp's pole | `walkTo (11,12)` |

- **At 1440×900**, one click on the canopy's edge opened Tora's menu.
- **Coverage.** I drew the real 13 by 13 room at 1×, with and without
  `street.terrace`, and compared the pixels:

  | Tile | Covered |
  | --- | --- |
  | (8,12) | 100% of its diamond; 71% of a 24-px cat standing on it |
  | (8,11) | middle hidden, 47% |
  | (9,11) | middle hidden, 32% |
  | (9,12) | middle hidden, 69% |
  | (11,11) | middle hidden, 55%; 38% of a cat |

  (7,12), (10,12) and (12,11) are partly covered.
- **A cat under the umbrella.** I placed a cat on (8,12) through the
  page's own socket. Only its ears show above the umbrella.

**How it got past.**

- `spec/fill.test.ts:239-240` clicks only the bench's seat and the table's
  top. Both are over the pavement.
- `client/test/street.test.ts` holds only that each thing's foot is off
  the grid.
- The render tests draw the old 12 by 10 room
  (`client/test/render.test.ts:28-30`), so the front terrace lands where
  the real floor's rows 10 to 12 are, and nothing compares the two.

**What fixed looks like.** A unit test draws the real floor
(`content/room.toml`) with and without the terrace and holds that no pixel
changes over:

- the floor's diamond;
- the walls;
- the 24- and 32-px figure columns above each floor tile.

Then the umbrella and lamp are moved, or made shorter, until it passes.
The alternative is to have the terrace swallow clicks on its own pixels
and show figures through it, but that still hides cats. The browser check
should also click points across every terrace thing's drawn pixels, not
two.

### 3. Major: on a desktop, the refusal toast is hidden under the floating talk bar

**What's wrong.** Refusals from the server ("That would cut part of the
café off.", "The way in from the door stays clear.", "Someone's in the
way.") are shown by `toast()` (`client/src/main.ts:32-38`, `:51`), at the
foot of the stage (`.toast { bottom: 0.75rem }`, `style.css:263`). The
stage is now the whole window, and the talk bar floats over its foot
(`style.css:124`, z 3), so the toast sits wholly under it. Screen readers
still hear the refusal through `announce`; sighted visitors see nothing
when the café refuses what they asked for.

**How I saw it.** I passed the café's frames through, adding one real
`error` frame after the welcome, and measured the toast against the talk
bar. In every case `elementFromPoint` at the toast's middle was the talk
box, and a screenshot shows no toast.

| Window | Toast (x, y range) | Talk bar (x, y range) |
| --- | --- | --- |
| 1920×1080 | 851–1069, 1035–1068 | 480–1440, 1015–1072 |
| 1440×900 | 611–829, 855–888 | 240–1200, 835–892 |
| 1000×700 | 391–609, 655–688 | 20–980, 635–692 |

Layout B already had the same problem before this slice (at 390×844 the
toast sits 778–832, under the talk bar's 731–836). Slice 16 brings it to
every desktop.

**What fixed looks like.** The toast is placed within the band the bars
leave clear (`menu.ts`'s `freeArea`), above the talk bar, in both
layouts. A browser check at 1920×1080 and 390×844 (layout B) provokes a
real refusal and holds that the toast's middle is the toast.

### 4. Major: in the dark theme by day, the keyboard's focus ring is invisible over the street

**What's wrong.** `:focus-visible` draws `outline: 3px solid var(--focus)`
2 px outside the focused element (`style.css:65`). Since this slice, two
things it rings sit over the street, not the page's background:

- the room's canvas, whose outline is drawn on the street canvas;
- the floating status buttons (Add furniture, Leave, Refresh and the
  carrying bar's buttons).

In the dark theme `--focus` is `#89b4fa`, the day sky's own colour. The
table below gives the ring's contrast against what's now behind it, and
against what was behind it before.

| Theme | Against the day street | Against the page, before |
| --- | --- | --- |
| Dark | 1.00:1 on the top sky; 1.15–1.90:1 on the rest | 7.79:1 |
| Light | 2.33:1 on the sky; 1.68–2.02:1 on the towers | 4.34:1 |

WCAG 1.4.11 asks for 3:1. Keyboard use is first-class here ("every action
works by keyboard").

**How I saw it.**

- I computed contrasts from `palettes.json` and the tokens.
- I tabbed to Add furniture by keyboard (`:focus-visible` true) and took
  screenshots. In the dark theme there is no visible ring. In the light
  theme it shows, but faintly.
- I did the same for `#room`. In the dark theme the ring along the
  canvas's top can't be seen against the sky.

**What fixed looks like.**

- A ring that holds 3:1 whatever is behind it. For example:
  - a two-tone ring (the outline plus a `box-shadow` ring in
    `--paper`/`--card`);
  - or, for the room's canvas, an outline drawn inside it.
- A contrast test holding that ring against every street and room colour,
  by day and by night, in both themes. That would be the focus ring's
  counterpart to the glass's test.

### 5. Minor: a wrapped status line covers the top-left panel's controls, and the panels don't move for it

**What's wrong.** On a narrow desktop, the status line grows to two rows
when it holds both "The café was updated. Refresh" and the carrying bar.
The panels stay where they were placed against the one-row status line,
because `Floating` re-places them only on a resize of:

- a panel;
- the music panel's insides;
- the stage;
- the window.

It never watches `.status` or `.talk` (`client/src/floating.ts:42-70`);
`stageBox()` (`:78-85`) reads them only when `place()` happens to run.

**How I saw it.** I sent a welcome with another build id, so the café
counts as updated, then took a scratching post from the catalogue.

- **At 960×800:** the status line's bottom is 121, and the chalkboard
  starts at 66. The chalkboard's title, grip and pin are all under
  `carrying-text`, so by mouse or touch it can't be moved or pinned.
- **At 1100×800:** its grip is under Leave and its title under Add
  furniture.
- **Three seconds later** nothing had moved.

**What fixed looks like.** `.status` and `.talk` are observed too, so the
panels are placed again when either wraps. A browser check at 960×800,
with the café updated and something carried, holds every panel's title,
grip and pin reachable by `elementFromPoint`.

### 6. Minor: layout B's street check can't fail, and the plan's reason for that is wrong

**What's wrong.** `spec/fill.test.ts:200-219` samples the window's edges
in layout B as it pans. It skips anything within 24 px of a floating bar
(`:176`). In layout B the bars span the top and bottom, so every point it
keeps lies on rows 82 to 682, inside the room's canvas.

The execution log (`docs/notes/plan-slice-16-fill.md:125`) says "the
phone's layout B never showed the page, as its pan stops at the room's
edges". That isn't so. The 13 by 12 room at 3× is 792 px tall in an
844-px window, so 26 px above and below it are the street canvas's work.

**How I saw it.** In layout B, panned to each edge, I hid `#street` with
injected CSS.

- 22 of the window's edge points were then the page's own `#eff1f5`.
- The check's sampler kept 30 points, and none of them was the page.

The desktop check is sound by the same test: with the street hidden, all
82 of its points are the page.

**What fixed looks like.**

- The B check samples the window's edges themselves, for example with the
  bars hidden for the sample, or in the gaps beside and below them.
- It is seen to fail once with `#street` hidden.
- The execution log's sentence is corrected.

### 7. Minor: the slice 14 corner check passes by 6 px, and everyday content covers floor tiles

**What's wrong.** At 1920×1080 the panels clear every tile's middle only
for today's content:

- **The cats panel.** (0,1)'s middle is at y 652, and the cats panel
  starts at y 658: 6 px clear. A fourth cat is one file in `content/cats/`
  (AGENTS.md: "a new cat is a data file"), and it raises the cats panel
  72 px, so that tile is covered.
- **Who's here.** The floor's right tip now reaches x ≈ 1712, into the
  right panels' column (x 1640–1912). At 12 by 9 the room ended at
  x 1632. Who's here grows with what's said this visit, so a chat of
  14 lines covers (12,12).

The check (`spec/browser.test.ts:317`) samples the panels where they
start, with three cats and nothing said, so it holds the 17rem tuned to
that.

**How I saw it.**

- **A fourth cat**, added to the welcome through the page's socket:
  `(0,1) under cats-panel`.
- **Fourteen lines said:** who's here's bottom at y 869,
  `(12,12) under here-panel`.

**What fixed looks like.** Either:

- cap the bottom-left and top-right panels by where the floor's corners
  are, not only by a share of the stage (`floating.ts:31`, `:118`);
- or settle that a panel may cover a corner tile once content grows.

In both cases the check runs with a fourth cat and a long chat, or says
what it doesn't hold.

### 8. Minor: the street canvas is about nine times the window, and each redraw is a 70–180 ms long task

**What's wrong.** `paintStreet` draws the room's box plus a whole stage
more on each side (`client/src/stage.ts:190-220`). On a desktop the room
never moves, and in layout B the pan stops at the room's edges, so almost
none of it is ever seen.

| Window | Street canvas | Memory |
| --- | --- | --- |
| 1920×1080 | 5440×3216, 17.5 M px | about 70 MB |
| 2560×1440 | 7120×4200 | about 120 MB |
| A phone in layout B | 1980×2484 | about 20 MB |

The canvas is drawn again whenever the light, the scale or the stage's
size changes, run by run over all of it.

**How I saw it.** A `PerformanceObserver` for long tasks recorded these:

| What happened | Long tasks |
| --- | --- |
| Each step of a window drag at 1920×1080 | 73–106 ms |
| The light turning at 1920×1080 | 108 ms |
| A phone in layout B at 4× CPU slow-down, rotated | 136–140 ms |
| The same phone, the light turning | 182 ms |

17.5 M px is also over the 16,777,216-px canvas area iOS Safari allows.
iPad windows don't reach that size (1366×1024 gives 11.2 M px), so I note
it as headroom, not a fault.

**What fixed looks like.** A street canvas the size of the stage
(8 MB at 1920×1080):

- on a desktop, drawn once per light and size;
- in layout B, either redrawn for the part a pan reveals, or drawn only as
  much larger as the pan can reach.

The slice also needs a note of what the redraw costs on a slow phone.

### 9. Minor: some checks still count the old floor or a fixed one

None of these fails today, but each holds less than it says, or would go
stale with the next floor.

- **Fixed sizes in the slice's own checks.**
  - `spec/browser.test.ts:1510` hard-codes `const [w, h] = [13, 13]` in the
    street-click check.
  - `spec/fill.test.ts` loops `y < 13`, `x < 13` (`:72-73`) and uses
    `/ 400` and `13 + table.out` (`:237`, `:240`).
  - The spec asked for sizes "read from the client instead", and
    `window.cafeRoom.size` and the welcome's `room` are there to read.
- **The old floor's corners.**
  - `spec/browser.test.ts:673` parks the cats at "the room's far corner",
    `(11, 9 − i)`, which is now the middle-right of the floor.
  - `:1361-1362` sets them aside at (11,1) and (11,2).
  - `:495` looks for a bare tile under the cats panel only in `y < 10`,
    `x < 12`.
- **The render tests' room.** The render tests' `welcome()` room is still
  12 by 10 on the 400 by 264 canvas (`client/test/render.test.ts:28-30`),
  so no unit test draws the room the client draws. Finding 2 got past
  because of this.
- **The wake test.** The "done when" line "a café saved at 12×9 wakes …
  with every piece and cat where it was" is held by `Room::restore_saved`
  tests (`server/src/room.rs:1008`, `:1037`, `:1068`), not through
  `wake()`, and with no saved cats. My scratch test through `wake()`
  shows it holds:
  - the live café's bare list woke with all 14 of its pieces and the
    strip's 3;
  - the replay's own save wrote `{"floor":[13,13],"pieces":[…]}`;
  - a second wake added nothing.

  A test like it, with saved cats, would hold the line as written.

### 10. Nit: at 360 px wide, the phone's whole room puts two tiles' middles off screen

At 360×780 in layout A the room is cut 20 px each side.

- (0,1)'s middle is at x −4, and (12,12)'s at x 364.
- Each can still be tapped on the visible part of its diamond.

`spec/fill.test.ts` checks only 390, which is what the user accepted. At
375 and 414 every middle is on screen. Say in the spec whether narrower
phones are covered.

### 11. Nit: on very short desktop windows, the front tile is wholly under the talk bar

At 1920×556 and 1366×560 (2×), the tile (0,12) is wholly under the talk
bar. At 1280×590 its middle is. That breaks the "no floor tile wholly
under a bar" line, though only on windows few will use. It holds at
1920×1080 and at every laptop and maximised size I tried (item 5 of the
next section lists them).

## What I checked and found sound

1. **Waking the live café on the new floor.**
   - `read_arrangement` reads a bare list as "floor unknown", and
     `restore_saved` takes it to be 12 by 10. That is right for every save
     before this slice.
   - Through the real `wake()`:
     - every saved piece came back where it was;
     - the strip's sofa, lamp and plant were added once;
     - the replay's save recorded the floor;
     - waking again added nothing.
   - The furniture cap is respected: with a cap of 15 and 14 pieces saved,
     the café woke with 15.
   - Nothing is added onto the walkway or over another piece, because
     `check_place` gates every addition.
   - Furniture is restored before cats, so `place_cat` drops a saved spot
     that's no longer walkable and pettable.
   - Unreadable saves (`not json`, `{}`, a floor without pieces) fall
     back to room.toml's own furniture, as before.
   - `[]` gains the strip's three.
   - A save at a third size behaves sensibly. A 14 by 14 save drops what
     no longer fits and adds nothing. A 10 by 8 save gains the planned
     pieces wholly outside 10 by 8.
2. **The floor's numbers.**
   - The canvas is (w + d) × 16 by (w + d) × 8 + 64. `ACROSS =
     width + height − 1` gives 400 by 264, matching the spec.
   - The origin, `pickTile` and `toCanvas` all follow from the floor's
     size.
   - `parseFloor` reads the same `content/room.toml` the server reads.
   - The phone's layout A cuts 5 px each side at 390. It is centred to a
     whole pixel at 375 (12 and 13 px), 390 and 414.
   - There is no sideways scroll.
3. **The street canvas lines up with the room to the pixel.** In the
   street-only corners, the page shows no differing pixel between the
   room's canvas shown and hidden at these sizes:
   - 1000×500 (1×);
   - 1366×768 and 1280×720 (2×);
   - 1440×900 (3×);
   - 1920×1080 (4×);
   - 2560×1440 (5×);
   - the odd sizes 1919×1079, 1441×901 and 961×700, at DPR 1 and 2.

   In layout B, panned to each edge at DPR 1 and 3, the two canvases agree
   in the room's street-only bands. The street is redrawn when the light
   turns (the light is part of `streetKey`). It is `aria-hidden` and takes
   no pointer.
4. **The desktop's "no page showing" check can fail.** With `#street`
   hidden, all 82 of its sampled points are the page. With it shown, it
   passes by day and by night.
5. **The bars over the room.**
   - No floor tile is wholly under a bar at 1920×1080, 1920×955,
     1728×1000, 1512×860, 1440×900, 1440×816, 1440×790, 1366×657,
     1536×730, 1600×789, 1280×800 or 1280×650.
   - Every bar control was reachable by mouse, touch and keyboard
     whenever the status line didn't wrap over a panel.
   - The status pill, the carrying bar, the update notice and the talk
     bar's glass use the panels' tokens, which the contrast test holds at
     4.5:1. The talk bar's box, buttons and emotes keep opaque fills.
   - The focus order is unchanged: status, panels, room, talk bar, music.
6. **Menus between the bars.** `freeArea` and the low-menu check are
   honestly updated. The check now also holds the menu's bottom above the
   talk bar, by mouse and keyboard at both desktop sizes.
7. **Checks the brief named.**
   - The street-click check in `browser.test.ts` now finds its points from
     the café's own map, and refuses any point covered by a panel or bar.
     It still asserts that what's clicked is the street's pixel and that
     nothing is sent. That is a fair change, apart from its fixed 13 by 13
     (finding 9).
   - The slice 13 rim test's new `bare` exclusion skips only pixels the
     room already has in that colour without its pieces. It hides nothing
     about the pieces' rims.
8. **The terrace as data.**
   - Parser: `street.toml`'s `[[terrace]]` is read by the client alone. The
     parser refuses an unknown kind or side, and a new thing of a known
     kind is just lines in the file.
   - Light: the lamp is lit only at night.
   - Draw order: it is drawn after everything in the room. Whether that
     should cover the floor is finding 2.
   - The plan's "on the room's canvas and the street's" was built as the
     room's canvas only. That's harmless, since every thing falls inside
     the canvas at 13 by 12.
9. **Layout B.** It is unchanged apart from the street canvas behind it
   (finding 8 is its cost). Resizes across 960 px mid-use pass in
   `browser.test.ts` and `music.test.ts`.

## Answers

By the builder, 2026-11-06. Nine fixed, each seen failing first; two
nits answered in the spec.

1. **Fixed** ([`1a699d7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1a699d7)). The desktop stage is an absolute box in a
   café that fills the window, which makes no layer of its own; the waking
   screen is lifted over the panels by its own z. A browser check drags
   the chalkboard over an open menu and a bubble at 1920×1080 and
   1440×900: every menu item is what a click reaches, and over half the
   bubble's inside is its own paper. With the stage fixed again, 8% of it
   was.
2. **Fixed** ([`c6f0158`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c6f0158)), as you proposed. A render test draws the
   café's real floor, from `room.toml`, with and without the terrace and
   holds that nothing changes over the floor, the walls, or a figure's
   column over any floor tile: 1107 pixels did. The open umbrella is now
   a folded parasol, the street lamp a low lantern, the left planters set
   a little further out. This departs from the approved spec's "a table
   under an umbrella … and a street lamp": the user is told. The browser
   check clicks every terrace pixel off the room's shape, about 70, and
   says plainly that it can't tell one over the floor from the floor's
   own, which the render test holds. The slice 13 carried-chair test,
   which found its chair by colour, now looks only in its carrier's column.
3. **Fixed** ([`bdc003a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bdc003a)). A refusal's note is placed at the foot of
   the band the bars leave clear, as menus and rings are, in both layouts.
   A browser check sends a real refusal frame at 1920×1080, 1440×900 and
   390×844 (layout B), and holds the note above the talk bar with nothing
   floating over it.
4. **Fixed** ([`2a71593`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2a71593)). The ring is two tones: the outline, and a
   halo just outside it. Your contrast sums found no single halo for
   Latte's blue: its mid tones and the street's fall under 3:1 against
   both. So the light theme's ring is crust on white, and the dark
   theme's Mocha blue on black. A contrast test holds that against every
   colour the room and street are drawn in, one of the two holds 3:1, and
   the two hold 3:1 against each other. The look picker and layout B's
   focused room carry the halo too.
5. **Fixed** ([`c136883`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c136883)). `Floating` watches the status line and the
   talk bar. A browser check at 960×800, the café updated and something
   carried, holds both top panels' title, grip and pin reachable.
6. **Fixed** ([`6a7a530`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6a7a530)). The check sets the bars aside for its
   sample, so it reads the screen's own edges; with `#street` hidden it
   fails at the foot below the room. The log's sentence is struck out and
   corrected. It later caught finding 8's first cut, and the room's new
   focus ring along the screen's edge, which it now puts away to sample.
7. **Fixed** ([`7f5ccb2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7f5ccb2)), your first way. Each panel's height is
   capped so that, from its starting corner, it covers none of the floor's
   four corner tiles, and it scrolls instead. The cap is worked out from
   that corner wherever the panel's been moved: worked out from where it
   stands, it grew a moved panel 10 px mid-move and changed its height
   across a reload, which two slice 14 checks caught. A unit test holds
   the cap's sums. A browser check adds a fourth cat and fourteen lines
   said and holds every floor tile's middle the room's; before, (0, 1) was
   under your cats and (12, 12) under who's here.
8. **Fixed** ([`b0fd0e6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b0fd0e6)). The street reaches as far past the room as
   the stage is bigger than it, the whole gap either side, since layout B
   pans the room against an edge: 2240×1104 (2.5 M px) at 1920×1080,
   1200×900 on a phone. Measured: no long task as the light turns at
   1920×1080; one of 72 ms on a phone at a quarter speed, which includes
   the room's own floor layer.
9. **Fixed** ([`b2cebec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b2cebec)). The render tests' room is `room.toml`'s
   (`FLOOR`), and the slab test reads its edges from it. The checks read
   the grid from `window.cafeRoom.grid`, now exposed, and the welcome's
   room, for the cats' far corner, the tiles set aside, the bare-tile
   search and the street-click shape. A server test wakes a store holding
   the live café's bare list and saved cats through `wake()`, and fails
   if the strip isn't added. 400 by 264 and 1600 wide stay fixed where a
   check holds the spec's chosen floor itself.
10. **Answered in the spec.** The phone's whole room is held at 390, the
    size the course marks at and the user accepted the cut for. Narrower
    phones are cut more, and a corner tile there is reached by tapping
    its visible part.
11. **Answered in the spec.** The "no floor tile wholly under a bar" line
    holds at 1920×1080 and at every laptop and maximised size you tried;
    windows under about 600 px tall at 2× put the front tile under the
    talk bar. The marked viewport isn't one, and Tab still reaches the
    tile.
