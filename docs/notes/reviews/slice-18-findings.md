# Findings: review of slice 18, "A balcony under the terrace"

Brief: [slice-18-brief.md](slice-18-brief.md). Read cold on 2026-11-07,
reviewing `25f0c64..3a19fb8` on `slice-18-balcony`.

I built and ran code only in throwaway copies outside the repo:

- `git archive 3a19fb8`, the slice;
- `git archive 25f0c64`, to compare with how things were before;
- a third copy of `3a19fb8` with `[deck]` taken out of `street.toml`.

Nothing in this checkout changed except this file. Nothing live was
touched: not the café, not Fly. The café ran on port 18919 with a fresh
`DATA_DIR`, seeded with `CAFE_DEMO_PASSWORD=catppuccino cafe demo seed`. I
stopped it by its own PID each time I switched its `CLIENT_DIR`, and at the
end.

**Count:** 0 critical, 3 major, 4 minor, 2 nits.

## What was run

- **Server tests.** `cargo test -p cafe` passed in the copy: 356 unit tests
  (1 ignored) and the integration tests (5, 3, 4, 3, 1).
- **Client tests.** `vitest run` passed 362 tests in 29 files. Both
  typechecks (root and client) were clean, and `vite build` was clean.
- **Browser checks.** I ran these against the copy's café with
  `APP_URL=http://localhost:18919 APP_DEMO_PASSWORD=catppuccino`.
  - `spec/balcony.test.ts` and `spec/fill.test.ts` passed, 13 of 13.
  - `spec/browser.test.ts` passed, 36 of 36.
- **Scratch unit probes.** These were throwaway `test/zz-*.test.ts` files
  in the copy's client, deleted afterwards. They drive the real
  `backdrop()`, `floorLayer()`, `streetMargin()` and `fitScale()`:
  - **Agreement.** The room's span against the street canvas's span:
    - over 210 desktop windows from 960×300 to 5120×2160, and 6 phone sizes
      in layout B;
    - at light 0, 0.5 and 1.
  - **What the stage shows.** The part of the street canvas the stage
    shows, against a reference span 1,500 px wider each side.
  - **Other `[deck]` values.** Other values of `out`, `rail`, `slab`,
    `storey` and `posts`, rendered to PNG as well.
  - **Cost.** Timings and cache behaviour.
- **Playwright probes.** These were throwaway scripts in the copy, run in
  Playwright's Chromium against the copy's café:
  - screenshots of wide, short windows;
  - the phone's layouts A and B, panned to each corner, by day and by
    night;
  - the page's background against `backdropColours()`, in both themes;
  - long tasks on a light turn and on a resize, with the CPU throttled.

  For the long tasks I ran the same script against a `25f0c64` client
  served by the same café.

## Findings

### 1. Major: on a wide, short window the balcony and building stop short of the window's left edge

**What's wrong.** `reach()` works out how far back the left arm must
reach, and it gets the direction along the left edge wrong
(`client/src/backdrop.ts:258-261`):

```ts
const alongLeft = (px: number, py: number) => {
  const { gx, gy } = fromCanvas(px, py);
  return gy - (gx - xo);
};
```

Points on the left face are `(xo, t)`. A screen point `(px, py)` lies
straight below the face's point where `gx + gy` matches, since x on screen
is `(gx + gy) * 16`. So the face's `t` above it is `gx + gy - xo`, not
`gy - gx + xo`. The `alongFront` beside it is right
(`gx + (gy - yo)`, which is `gx + gy - yo`).

On the stage sizes the slice was tested at, the span's top-left corner
happens to give the smaller value anyway, so `back` comes out far enough.
When the stage is much wider than it is tall, the left arm's end falls
inside the window:

- the deck, the glass and the building each end in a vertical cut;
- the street's towers and pavement show to the left of the cut.

The right arm is fine.

**How I saw it.**

- **In the browser.** I opened the café at 1920×400 and at 2560×540 in
  Playwright, with the panels and bars hidden for the shot. In both, the
  building's left face ends about 45 room px (1920×400) or 77 room px
  (2560×540) in from the window's left edge, with the street to its left.
  At 1920×1080 there is no cut.
- **In a probe.** I compared the pixels the stage shows of the street
  canvas against the same backdrop drawn over a span 1,500 px wider. 31
  window sizes differ, all at the left edge only. Examples:

  | Window | Scale | Visible pixels that differ |
  | --- | --- | --- |
  | 1400×250 | 1× | 14,500 |
  | 1920×400 | 1× | 18,400 |
  | 2560×540 | 1× | 42,120 |
  | 3440×720 | 2× | 9,360 |
  | 5120×720 | 2× | 160,560 |

  With only `alongLeft` changed to `gx + gy - xo`, all of them fall to 0.

- **Why the checks miss it.**
  - The backdrop test "the balcony past the room's two ends" checks only
    the `far` span, which is tall enough.
  - The browser check runs only at 1920×1080.
  - The room-span-against-stage-span agreement probe still finds 0
    differences at every size, because the cut is outside the room's
    canvas.

**What "fixed" looks like.**

- `alongLeft` returns `gx + gy - xo`.
- A unit test fails on today's code: for a span far wider than it is tall
  (for example 1920×400 at 1×, from `streetMargin`), the backdrop over that
  span equals, pixel for pixel, the same backdrop drawn over a much wider
  span, everywhere a stage of that size shows.

The design says the balcony runs "to the window's edges, so … no end of it
shows". Today that holds only at some window shapes.

### 2. Major: the parasol's tip is now hidden under the floor's slab, so the terrace no longer stands wholly in front of the room

**What's wrong.** The terrace used to be drawn after everything in the
room. Now it lives in the backdrop, and the room's floor layer is drawn
over it (`client/src/render.ts:448-458`). The plan's reason was that
"nothing in the room is drawn where it is". That isn't quite true. The
folded parasol (`client/src/backdrop.ts:321-327`, 26 px over the deck,
from `content/street.toml:159-163`) reaches up past the floor's front
slab on screen, and the slab now covers its top four pixels:

- `(320,198)` and `(322,197)` are the parasol's pink;
- `(321,197)` and `(323,196)` are its dark pole.

At 4× that's a notch about 16 px wide in the parasol's tip, against the
floor's slab line. It shows in the slice's own `corner-day.png`, where the
parasol's pink block is clipped flat by the slab's dark edge.

The test meant to hold this can't see it. It is the render test "puts
nothing of the terrace or the balcony where the real floor…"
(`client/test/render.test.ts:885-931`). Its `room()` shape counts the
floor's diamond and the walls, but not the floor's own slab, the 6 px
under its two front edges. The parasol's tip lies in that band. So the
test passes, and it would equally pass for anything of the terrace or
balcony that rises behind the slab.

**How I saw it.**

- For each terrace thing I compared the backdrop's pixels over the room's
  span with and without that thing. Then I asked which of those pixels the
  floor layer (drawn over the backdrop) leaves unchanged, that is, covers.
  Only the umbrella had any: those 4.
- Over the whole terrace, 3,162 of the terrace's pixels are in the room's
  span, and 4 are covered.

**What "fixed" looks like.**

- Either the parasol is kept below the slab line (a pixel or two lower),
  or it is drawn over the room as the terrace was.
- The render test's `room()` counts the floor's slab band (the 6 px under
  its front and left edges, where `drawFloor` paints) as part of the room.
- The test sees the parasol fail first.

Finding 3 is the same blind spot, reached through content.

### 3. Major: `[deck]` values both readers accept draw the glass behind the room, and `cargo test` refuses a street with no `[deck]`

**What's wrong.** "Cats change through `content/`, not code" extends to
the street, and the slice's spec says "a different `[deck]` … draws
sensibly; a bad one is refused by both readers with a clear message".
Three ways this doesn't hold:

1. **Accepted values draw the glass behind the room.** Both readers allow
   `out` from 1 to 4 and `rail` from 0 to 32:
   - `client/src/street.ts:115-123`;
   - `server/src/content.rs:260-266`.

   Below a threshold, the rail's top rises past the floor's slab on
   screen. The floor layer is drawn over the backdrop, so the glass, its
   posts and its handrail are cut off by the room. The rail's pixels that
   the room covers, by `out`:

   | Rail | out 1.0 | out 1.2 | out 1.4 | out 1.6 | out 1.8 | out 2.0 | out 2.2 | out 2.4 and over |
   | --- | --- | --- | --- | --- | --- | --- | --- | --- |
   | 18 px | 2,300 | 1,097 | 0 | 0 | 0 | 0 | 0 | 0 |
   | 24 px | 4,674 | 3,493 | 1,910 | 711 | 0 | 0 | 0 | 0 |
   | 32 px | 7,730 | 6,597 | 5,074 | 3,901 | 2,704 | 1,500 | 297 | 0 |

   The PNGs of `out = 1, rail = 18` and `out = 2, rail = 32` show it
   plainly: the floor's slab edge runs across the panes, and posts stop
   where the floor begins. So the spec's "Numbers" claim, that the
   handrail is "clear of the floor and of anyone on it", is true at 2.6
   and 18 only.

   The render test above (finding 2) doesn't catch this either. With
   `out = 2, rail = 32` and the terrace pulled in to fit, it flags 0 while
   1,509 balcony pixels are under the room.

2. **A shadow can spill off the deck.** The server's "every terrace thing
   stands on the deck" check is only `t.out < deck.out`
   (`server/src/content.rs:275-278`). A thing's blocks and its shadow
   reach further than its spot:
   - a planter's shadow reaches 0.55 tiles;
   - a bench's 1.3 along it.

   With `out = 2` (allowed, since every `out` in today's file is under 2),
   38 of the planter's shadow pixels fall past the deck's edge onto the
   building's face and slab, a darker stone colour where there's no
   stone. The client's unit test "stands every terrace thing on the deck"
   checks 0.7 tiles round each spot, but only against today's file.

3. **`cargo test` refuses a street with no `[deck]`.** The design, the
   `street.toml` header and the client reader all say "Without this table
   there's no balcony, as before slice 18", and the client reads that
   happily. The server's test panics instead
   (`server/src/content.rs:254`, `street["deck"].as_table().expect(...)`).
   I ran it in the copy with `[deck]` removed:

   ```
   test content::tests::the_balcony_is_data_with_colours_by_day_and_night ... FAILED
   panicked at server/src/content.rs:254:26
   ```

   So an operator who takes the balcony out, as the docs invite, breaks
   CI.

What drew sensibly: no rail, no building, a bare deck (rail 0, storey 0,
slab 0), storey 32, out 4, and posts 0.5 or odd values like 1.3 and 2.6.
The room's span and the stage's agree at every one of those posts values.

**What "fixed" looks like.**

- **Both readers refuse a `[deck]` whose rail would rise behind the floor's
  slab.** The client's `readDeck` and the server's test hold, for example,
  the rail's top on screen at least a pixel below the slab's foot at the
  rail's line. Or `out` and `rail` get ranges that can't meet (from the
  table above, `out ≥ 1.4` at 18 px and `≥ 2.4` at 32 px). Either way,
  with a message that says why.
- **The "stands on the deck" rule counts the thing's own reach.** That is
  `t.out` plus its shadow's half-width across, or a margin such as 0.6
  tiles. Both readers hold it, so a thing's shadow and blocks stay on the
  stone.
- **The server's test accepts a missing `[deck]`** and checks its values
  only when it's there, as the client does.

### 4. Minor: the browser check for the deck past the canvas can't tell one missing arm, and "lined up" covers only half of it

**What's wrong.** `spec/balcony.test.ts:100-107` counts deck pixels
beside the room's canvas on both sides together and asks for more than
20. At 1920×1080 there are 21 on the left and 21 on the right, by day and
by night (worked out from the backdrop at the check's own points). So with
either arm gone (finding 1 is an arm cut short), it still finds exactly
21 and passes.

The seam half (lines 111-116) compares the two canvases only where the
room's canvas shows deck stone. The building's faces, the glass and the
rail, which run under the same seam, aren't compared. My agreement probe
found the two canvases agree there anyway. But the check wouldn't notice
if they stopped.

**How I saw it.** I counted the stone pixels per side at the check's
points, from `backdrop()` over the 1920×1080 stage span: left 21, right
21.

**What "fixed" looks like.**

- The check asks for deck (or building) pixels on each side separately.
- It compares the two canvases at every point inside the room's canvas
  near its edges where the room's canvas isn't the room (the check's own
  `inRoom` shape), not only on stone.
- Better still, it also runs at a wide, short window, which would have
  caught finding 1.

### 5. Minor: building the backdrop costs more than the street did, so a light turn and every resize step are longer tasks

**What's wrong.** The backdrop is a raster of strings over the whole
stage span plus margins. For each light it builds the street, then the
building, deck, terrace and glass, then `runs()`. The street canvas then
draws from it. The floor layer does the same for the room's span, and
copies it.

That's all done on the main thread in one go:

- on a light turn, for both spans;
- on every resize step that changes the street's margins, for a new span.

The street canvas's own draw from `runs()` is cheap (1 to 5 ms). The build
is not.

**How I saw it.**

- **Long tasks, before and after.** Playwright's Chromium with a longtask
  observer. A light turn is 16:59:40 to 17:00, day to evening. The resize
  is ten steps of 10 px. Same café, `25f0c64` client against `3a19fb8`,
  repeated once for the new build:

  | Window, CPU throttle | Light turn before | Light turn after | Resize before | Resize after |
  | --- | --- | --- | --- | --- |
  | 390×844 phone, 6× | 111 ms | 193–203 ms | none | none |
  | 1920×1080, 4× | 90 ms | 142–143 ms | 2 tasks, longest 53 ms, total 103 ms | 10 tasks, longest 130–136 ms, total 864–881 ms |
  | 2560×1440, 4× | 98 ms | 157–158 ms | 10 tasks, longest 67 ms, total 616 ms | 10 tasks, longest 159–160 ms, total 1,056–1,069 ms |

  The phone's resize has no long task because layout B's margins don't
  change.

- **Unthrottled, in jsdom.** For the span alone, the old `streetRuns`
  against the new `backdrop` plus `runs()`:

  | Window | Old | New |
  | --- | --- | --- |
  | 1920×1080 | 8 ms | 19 + 1 ms |
  | 1280×720 | 26 ms | 44 + 2 ms |
  | 2560×540 at 1× (a 4,720×816 span) | 251 ms | 375 + 17 ms, about 55 MB of heap |

The slice 16 review's finding 8 brought the street's redraw down to "a
short task". This brings a resize at 1920×1080 back to a long task on
every step.

**What "fixed" looks like.** One or more of these:

- Build the street part as runs, as before, and draw only the balcony
  into the raster over the rows where it is.
- Store the raster as numbers (a `Uint32Array`), not strings.
- Debounce the street canvas's rebuild on a resize, so a drag builds once
  at the end, keeping the old canvas positioned meanwhile.

Then a test or a measured note holds a light turn at 1920×1080 under the
old cost.

### 6. Minor: the backdrop's four-span cache is first-in-first-out, so a drag-resize evicts the room's own span and rebuilds the floor layer

**What's wrong.** `backdrop()` keeps four spans and deletes the oldest
inserted (`client/src/backdrop.ts:53`). A hit doesn't refresh a span's
place. The room's span, the one the floor layer copies, is asked for
every frame but was inserted first. So after a few street spans from a
resize, it's evicted. `floorLayer` then sees a new `base` and rebuilds the
whole floor layer (`render.ts:452`), on top of the new street span.

**How I saw it.** In a probe, I resized a pixel a frame and called
`backdrop` for each frame's street span, then `floorLayer` for the room:

| Drag | Frames | Distinct street spans | Floor layer rebuilds | Cost of the rebuilds |
| --- | --- | --- | --- | --- |
| 1920 → 1720 at 1080 high | 201 | 51 | 12 | 196 ms |
| 1280 → 1080 at 720 high | 201 | 101 | 26 | 420 ms |

Building those street spans took a further 795 ms and 3,655 ms.

Nothing goes stale: the cache key includes the light, the terrace and the
deck, and a light change rebuilds both. It just thrashes.

**What "fixed" looks like.**

- A hit moves its span to the back (delete and re-set), or the room's span
  is kept apart from the street's.
- A unit test fails on today's code: after five other spans, the room's
  span is still the same `Raster` object and `floorLayer` returns the same
  layer.

### 7. Minor: the two browser checks that now read `backdropColours()` can't fail at night in the dark theme, and are only run by day

**What's wrong.** This is the brief's question: do the changed checks
still fail when the page's own background shows?

- **By day, yes.** `backdropColours()` has 80 colours at light 0, and
  neither page background (`#eff1f5`, `#1e1e2e`) is among them, nor black
  or white. So both checks still fail on the page by day:
  - `spec/fill.test.ts:211-212`, the window's edges;
  - `spec/browser.test.ts:1533-1593`, the bottom corners.
- **At night, no.** At light 1, `#1e1e2e`, the dark theme's page, is
  among them: it's the night sky's colour. `fill.test.ts` runs its night
  pass in the light theme, where the page is `#eff1f5`, so that pass is
  sound. But nothing runs the dark theme at night, where the check
  couldn't tell the two apart.

The plan's execution log says this, and that it was so before. But the
set the checks take is now wider than the street's colours. It is every
colour the backdrop draws in a span three times the room's each way, over
a much larger area than the points sampled. That's a looser check by
construction.

The bottom-corner check in `browser.test.ts` now accepts any of those 80
colours where it once required the street's. It's still sound against the
page by day. It's also the check that proves a click there does nothing,
and that still holds (36 of 36 passed).

**How I saw it.** Playwright: `window.cafeRoom.backdropColours()` against
the body's computed background:

| Light | Theme | Page background | Among the backdrop's colours |
| --- | --- | --- | --- |
| 0 | light | `#eff1f5` | no |
| 1 | light | `#eff1f5` | no |
| 1 | dark | `#1e1e2e` | yes |

**What "fixed" looks like.** Each check samples against the colours the
backdrop draws at that point, which `backdrop(span, light).at(x, y)` gives
directly, not a set from anywhere. Or failing that, it asserts the page's
background isn't in the set it uses, so a palette change can't quietly
make it pass. Recording the dark-night gap in the notes as a known limit
would also do.

### 8. Nit: two `SLAB` constants for one number, and the balcony's spec "Numbers" line now describes only the shipped values

`render.ts:417` now exports `SLAB` and nothing imports it. `backdrop.ts:28`
declares its own `const SLAB = 6`, and the tests declare it four times
more (`client/test/backdrop.test.ts:113, 223, 321, 466`). If the floor's
slab ever changes, the terrace and deck would stand at the old depth. One
exported constant, imported where it's used, would fix that.

The spec's "Numbers" line says the handrail is "about 27 room px below the
floor's front and left edges … so it's clear of the floor". That's true
for `out = 2.6` and `rail = 18`, and finding 3's table shows where it
stops being true. A sentence there saying it holds only for these values
would help.

### 9. Nit: the slice's prompt log has no entry for the approval or the build

The spec says "approved 2026-11-07 … (question 2, D)". The plan quotes
the user's "D". But `docs/prompts-result.md` on this branch ends at entry
18 (the walk that turns mid-step). It has no entry for the prompt that
answered "D" and asked for the build, and none of the commits
`f2766e4..3a19fb8` touch it.

AGENTS.md asks for an entry "at the end of every turn that did work,
before the final commit of that turn". It may be meant to come with the
merge. If so, the entry needs the verbatim "D" prompt and its timestamp
from the transcript, and the commit links from `git log`.

## What I checked and found sound

1. **The two canvases agree to the pixel over the room's canvas.** That
   is, the room's span from `backdrop()` against the street canvas's span:
   - at light 0, 0.5 and 1;
   - over 210 desktop windows (960×300 to 5120×2160, at scales 1× to 5×
     as `fitScale` gives them) and 6 phone sizes in layout B (3×);
   - result: 0 pixels differ.

   The whole stage span also agrees with a much bigger reference span at
   1920×1080, 2560×1440, 1280×720 and 390×844: every pixel the same, the
   building's storeys and the posts included. The tile-at-a-time
   `edgeLine` and the posts counted back from the floor's corners do what
   the execution log says. The fault in finding 1 is in where the span
   ends, not in how it's drawn.

   In the browser, `spec/balcony.test.ts`'s seam check passed by day and
   by night. Layout B is panned by moving the street canvas, not
   redrawing it, so the pan can't make the canvases disagree.
2. **`reach`'s right arm** reaches past every span I tried. Only the left
   arm's sign is wrong (finding 1).
3. **Crisp.**
   - Every run of the backdrop is `#rrggbb`. The software canvas records
     no path, no fill below full alpha, and no smoothing for the backdrop's
     runs.
   - The glass is a per-pixel `mix` of what's already in the raster. The
     rail is drawn last of all, so nothing behind it comes after it. The
     posts and handrail go over the tint.
   - The balcony's shadow on the wall is `darken(darken(wall, lit),
     SHADOW)` and never black. The `shade()` result (`rgb(…)`) reaches
     only `Raster.context().fillStyle`, which reads `rgb(…)`, and never
     `darken`. So the first build's black band can't recur.
   - The floor layer is still drawn as one image with smoothing off.
4. **The deck and the terrace.**
   - Stone is in two tones in both arms by day and by night.
   - The deck reaches exactly `out` and no further.
   - Each terrace thing's spot is on it, with its shadow. Under the rail,
     the slab's edge shows.
   - The floor's own slab and the shadow mask are unchanged. The mask
     covers only the floor's diamond, so it never darkens the balcony.
   - The room's own drawing (figures, furniture, pointer, ghost) is
     unchanged apart from losing the per-frame terrace. `draw()` still
     lays the floor layer first and everything else over it.
   - The render test "shows the backdrop's terrace on the room's canvas"
     holds.
5. **The building.**
   - It is only on its two faces under the deck's outer edges, never over
     the deck, the rail or the room (the unit tests' `onFace` is a fair
     shape).
   - It is the room's wall colour, lit as the room's blocks are.
   - Its windows are lit only at night: by day, the lit and dark window
     colours are the same, so it blends in toward evening.
   - It is drawn down past the span's foot at every span I tried. The
     corner where its faces meet has posts on both arms.
6. **Clicks on the balcony do nothing.** The click check in
   `spec/balcony.test.ts` finds more than 30 balcony points by mouse and
   by touch, clicks every fourth, and sees no menu and no frame sent. The
   street canvas is `pointer-events: none`, and a click there goes to
   `pickTile`, which returns null off the floor and its street wall.
7. **Contrast.** The contrast test adds every palette colour tinted by the
   glass. I went further, and took every colour `backdropColours()`
   actually draws: 239 across day, evening and night, shaded faces,
   outlines, shadows and tints included. The panels' words were at least:
   - 6.86:1 in the light theme;
   - 5.10:1 in the dark;

   normally and dimmed.
8. **The phone.**
   - In layout A at 390×844 the whole room shows, by day and by night,
     with the balcony and building as a strip below it.
   - Layout B pans to the bottom-left, bottom-right and top-left. At the
     bottom-right, the deck, glass and building show under the front
     edge.
   - `fill.test.ts`'s "pans to each side, no page showing" and the
     resize-across-960 checks in `browser.test.ts` pass.
   - The balcony takes no input, so the keyboard, touch and mouse rule is
     untouched.
9. **Content.**
   - `[deck]` is read by both readers with the same ranges and the same
     storey rule (0, or 32 to 96).
   - The client reader refuses a missing or out-of-range value with
     `deck.<key> must be …`, as its test shows.
   - `palettes.json`'s `balcony` lists are generated by
     `scripts/palettes.ts` (the palettes test holds that), seven by day
     and seven by night.
   - Not having to change code to change the balcony holds, apart from
     finding 3's gaps.
10. **The changed checks the brief named.**
    - **Slice 16's "nothing of the terrace over the floor".** Moving it
      from the drawn room to the backdrop was necessary. Comparing the
      drawn room with and without the terrace couldn't fail once the
      terrace was under the room. The new form compares the backdrop with
      and without the terrace and the balcony against the room's shape.
      Its weakness is that shape (finding 2), not the move.
    - **Slice 13's corner test.** It now reads the bottom corners as the
      backdrop's own pixel there, which is honest, since the building
      stands there. Its top corners are still held to the street's
      colours.
    - **The two browser checks:** finding 7.
11. **What reaches the server.** The slice adds a content test and
    nothing else. No protocol change. No input path, storage or log line
    is touched.

## Answers

*For the builder.* Every finding is fixed, each with a test seen failing
first, or with its bug put back to see the test fail.

1. **Fixed** ([`a4ddde8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a4ddde8)).
   - `alongLeft` is `gx + gy − xo`.
   - A unit test holds the street canvas's span to a far wider one,
     everywhere the stage shows, at 1920×1080, 1920×400, 2560×540, 1400×250
     and 3440×720. It failed at the four wide ones.
   - The browser check gained a 2560×540 pass, with the window's edges
     held to the deck's own geometry (finding 4). With the old sign put
     back, it fails.
2. **Fixed** ([`41a0389`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/41a0389)).
   - A new render test asks the floor layer itself whether it covers any
     pixel the terrace or the balcony adds. It failed on 304 pixels:
     - the floor slab's 1-px foot line, drawn over the deck's inner row
       (now drawn by the backdrop too, in the same colour);
     - the parasol's four (now 3 px lower).
3. **Fixed** ([`41a0389`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/41a0389)).
   - Both readers refuse a rail higher than (out − 0.2) × 16 − 3 px. That
     rule is your table's boundary with a margin, measured again here: the
     last covered reach is 1.3 at 18 px, 1.7 at 24 and 2.2 at 32. The
     render test checks the rule against what the room covers on both
     sides of it.
   - Both readers refuse a terrace thing nearer the deck's edge than 0.6
     tiles.
   - The server's test takes a street with no `[deck]` (`check_balcony`).
   - New Rust tests fail with the old rules put back.
4. **Fixed** ([`847de67`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/847de67)).
   - Each side is held separately: every point beside the room's canvas is
     the backdrop's own pixel there, and there are balcony pixels on each
     side.
   - The seam is compared wherever the room's canvas shows the backdrop,
     not only on stone.
   - Holding the screen to the backdrop alone couldn't see an arm cut
     short, since both canvases would be cut alike. So the check also
     holds the window's own edges, under the line the deck's outer edge
     runs along, to have no street colour. That line is found from the
     floor's corners, not the backdrop.
   - It runs at 1920×1080 and 2560×540, and fails with finding 1's sign
     put back.
5. **Fixed** ([`c876ae5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c876ae5)).
   - The street's margins grow in steps of 16 room px.
   - The street canvas is rebuilt only when its light, scale or span
     changes.
   - The room's span is cut from the street's when that's built.
   - Unit tests hold the steps (a 200-px drag gives at most 5 spans) and
     the cut (no build).
   - Measured as you did, in Chromium with the CPU slowed 4× (ms):

     | Window | Light turn | Ten-step resize |
     | --- | --- | --- |
     | 1920×1080 | 108–114 | no long task |
     | 2560×1440 | 135 | one task of 60 |
     | 390×844 (6×) | 146 | — |

   - The light turn stays 20 to 45 ms over the street's alone, since the
     balcony is drawn once per light. That's three times a day, as one
     task, so it's kept as the cost of the balcony.
6. **Fixed** ([`c876ae5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c876ae5)).
   - A hit moves its span to the back.
   - A unit test asks for the room's span between eight street spans and
     gets the same raster each time. It failed after the third.
7. **Fixed** ([`847de67`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/847de67)).
   - The checks hold each point to `window.cafeRoom.backdropAt(x, y)`, the
     backdrop's own pixel there, which replaces the colour set.
   - The edge check runs at night in the dark theme too. With the street's
     canvas hidden it sees the page.
   - Building the one-pixel backdrops this needs found two more ways a
     small span differed from a wide one:
     - `reach`'s two tiles to spare didn't cover the deck's width;
     - a storey reaching past a span's foot was left out.

     Both are fixed under a unit test that builds each one-pixel span from
     scratch, sweeping the stage. Its first form cut them all from a wider
     span already built, and passed with both bugs.
8. **Fixed.**
   - The slab's depth is one `SLAB`, in `shapes.ts`, imported by
     `render.ts`, `backdrop.ts` and the tests.
   - The spec's Numbers say the handrail's clearance holds at these values
     and give the rule that keeps it for others.
9. **Answered.** The prompt-log entry for "D" and the build comes with the
   merge, with its timestamp from the transcript and links from `git log`.
