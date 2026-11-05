# Brief: review of slice 15, "Music while you sit"

Slice 15, Task 6 ([plan-slice-15-music.md](../plan-slice-15-music.md)), by
[ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive 5d826d2 | tar -x -C <tmpdir>`, then link or
install `node_modules`), never in this checkout. Don't use ports 8080,
18825 or 18915 (other cafés run on them); run the café on port 18916 with
a fresh `DATA_DIR`, from the copy's root (it reads `content/` from the
working directory), with `CLIENT_DIR` pointing at the copy's
`client/dist`, and point the spec at it with `APP_URL`. Stop only the
servers you start, by their own process IDs (never `pkill` by name).
Don't touch the live café or the Fly app.

Review what slice 15 adds: `04f218d..5d826d2` on branch `slice-15-music`.

## What to read

- **The spec:** [`docs/slices/15-music-while-you-sit.md`](../../slices/15-music-while-you-sit.md),
  every "done when" line and how it's held, its numbers (night from 17:00
  to 6:00; 40% to start; about 128 kbps, loudness evened), its proposed
  defaults the user approved (a pinned music panel keeps its five
  controls; playlist order, looping; each visit from the set's first
  track; no volume slider on iOS) and the two questions settled from the
  builder's read (loudness checked without ffmpeg; remembered music plays
  on entering when the browser lets it).
- **Why:** [ADR 0020](../../adr/0020-play-public-domain-lofi-each-visitor-their-own.md)
  (CC0 lofi, each visitor their own player, nothing sent to the server).
- **The design:** `docs/design.md` ("The client", its "Music" entry, and
  "Numbers to tune"), and `AGENTS.md`'s "What the app must keep", above
  all "every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use", "never store or log what
  anyone says" and "the server decides every outcome".
- **The plan**, its decisions and its execution log, which records where
  the build departed: the limiter 2 dB under the ceiling, the files found
  by Vite's `import.meta.glob`, the checks' own autoplay rule, waiting
  music starting as a finger lifts, and the phone's drawer placed from the
  measured bars.
- **The files:** `content/music/` (six MP3s, `playlist.toml`,
  `CREDITS.md`, `manifest.json`) and `scripts/music.ts`, which wrote them.
  The originals aren't in the repo; each track's page is in the playlist.
- **The code:** `client/src/music.ts` (the playlist reader, the set by the
  hour, Next and Previous, `settle`, remembering), `client/src/musicPanel.ts`
  (`Music`: the audio element, the panel, `enter`, `pressed`, `dispose`),
  `client/index.html` (the music section), `client/src/style.css` (the
  panel at each size, the pinned rule, the drawer), `client/src/floating.ts`
  (the fourth panel's start and share), `client/src/main.ts` (wiring,
  presses, the drawer's measuring, stopping on leaving); their tests
  (`client/test/music.test.ts`, `musicPanel.test.ts`, `music-files.test.ts`)
  and `spec/music.test.ts`.
- **The screenshots:** `docs/notes/screens/slice-15/`, and the script that
  takes them.

## Out of scope

The room's drawing, walking and sprites (slices 11 to 13); slice 14's
panels except as the music panel uses them. Earlier work this slice
doesn't make worse.

## What to look for

Whether each "done when" line is truly held, or only appears to be, and
whether the kept rules hold. The conditions most likely to break it:

- **The browser's autoplay rule.** Headless Chromium keeps it, but a
  check's `page.evaluate` counts as a press. Does `spec/music.test.ts`'s
  `autoplayRule` model the rule faithfully enough that a check passing
  under it means a real browser would behave the same? Is any check that
  judges starting or silence run without it, where it should be?
- **Nothing fetched before Play.** Is there any path (the element's
  `preload`, a skip while paused, the clock moving a track, a reload with
  music remembered off, the `<audio>` in the markup) that fetches a track
  the visitor never asked to hear?
- **Across 17:00 and 6:00.** Playing, paused, paused at 0:00, skipping
  across the boundary, a song ending exactly at the boundary, and the page
  left open across it: does the panel always name what Play will play,
  and does the song begun always finish?
- **Nothing sent but presence.** Does any control, or the music starting
  by itself, send a frame other than `here`? Is anything about the music
  logged by the server or stored anywhere but `cafe.music` on the device?
- **The pinned panel.** Do the five controls work pinned by mouse and
  touch and keyboard, does nothing else in it take a click, and does
  slice 14's "a pinned panel lets every click through" still hold for the
  other three panels?
- **The phone.** Both layouts at 390×844, a resize across 960 px mid-song,
  the drawer with the status bar wrapping, iOS (where the slider hides)
  and a phone's own refusal to play before a tap.
- **The files.** Do the files match their manifest and playlist, does the
  loudness claim hold (re-measure with ffmpeg if you have it), do the
  credits and licences check out against each track's page, and is
  `scripts/music.ts` enough for someone to remake the files?
- **Accessibility.** The controls' names and states for a screen reader
  (Play and Pause, the volume), focus order, and the slim row's hidden
  heading.

## Findings

Write them to [`slice-15-findings.md`](slice-15-findings.md), numbered,
most serious first. For each: what's wrong, where (file and line), how
you saw it (a command, a check, a screenshot), and what "fixed" would
look like. Say plainly what you checked and found sound, so a line that
holds is known to have been looked at. Leave the answers section for the
builder.
