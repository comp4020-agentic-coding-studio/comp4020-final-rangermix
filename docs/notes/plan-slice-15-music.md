# Slice 15, "Music while you sit": Implementation Plan

> Method fixed by [ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
> built natively, test first, committed and pushed per task, a fresh review
> with brief and findings as files, then deployed. Why:
> [ADR 0020](../adr/0020-play-public-domain-lofi-each-visitor-their-own.md).

**Goal:** someone in the café hears quiet lofi, a day set and a night set
by the Canberra clock, from their own player: a panel with the track's
title and artist, Play or Pause, Previous, Next and a volume, remembered
per device; nothing reaches the server.

**Approved:** the user, 2026-11-05 10:13 AEDT, "merge slice 11 first, then
work on music": the spec as written, with its proposed defaults (a pinned
music panel keeps its five controls; playlist order, looping; each visit
from the set's first track; no volume slider on iOS).

**Spec:** [`docs/slices/15-music-while-you-sit.md`](../slices/15-music-while-you-sit.md).
Written 2026-11-05 from `main` at `04f218d` (slices 11 to 14 merged).

## Decisions made in this plan

1. **The files.** The six originals, fetched from each track's own page on
   the Free Music Archive (each checked on 2026-11-05: "licensed under a
   CC0 1.0 Universal License", "AI generated? No"), are 320 kbps MP3s, 41
   MB together, at −11.2 to −16.4 LUFS integrated with true peaks at or
   over 0 dBTP. `scripts/music.ts` re-encodes each once with ffmpeg to
   128 kbps stereo MP3 at **−16 LUFS integrated, −1.5 dBTP true peak**
   (EBU R128, ffmpeg's two-pass `loudnorm`), so the loud ones come down,
   none is pushed into clipping, and the level sits under talk. It writes
   `content/music/<file>.mp3` and `content/music/manifest.json`: each
   file's source URL, its SHA-256, and the loudness ffmpeg measured on the
   result. The originals stay out of the repo.
2. **Checked without ffmpeg** (the spec's settled question 1): the client
   test reads each MP3's frame headers for the bitrate, sums the sizes,
   hashes each file against the manifest, and holds the manifest's
   loudness within 1 LU of −16.
3. **Served as the client's own files.** Vite copies `content/music/`
   into the build (`publicDir`-free: an explicit copy step in
   `vite.config.ts`), so the server serves them as it serves the client,
   and the Docker image carries them.
4. **The player is a module, `client/src/music.ts`,** with no DOM in its
   choices: which set the hour picks, which track comes next or before,
   what happens when a set ends across 17:00 or 6:00. It's tested with a
   fake clock. `client/src/musicPanel.ts` wires one `<audio>` element and
   the panel to it.
5. **The desktop panel is slice 14's fourth floating panel** (`Floating`
   gets it with the rest), starting bottom-right. Pinned, its five
   controls keep `pointer-events`, the rest passes clicks through.
6. **Remembered** under `cafe.music` in `localStorage` (on, volume), or
   for the visit when storage is blocked, as `cafe.layout` and
   `cafe.panels` are.

## Tasks

1. The files: `scripts/music.ts`, the six tracks, the manifest, the
   playlist and `CREDITS.md`; tests that read them.
2. The player's choices (`music.ts`): sets by the hour, Next and Previous,
   crossing a boundary; tests first with a fake clock.
3. The panel and the audio element, at every size; browser checks first
   (no fetch before Play, play and pause and skip by mouse, touch and
   keyboard, the volume, nothing sent but `here`, leaving stops it).
4. Remembering, and starting on entering or at the first press; browser
   checks first.
5. Slice 14's dragging, pinning and dimming for the music panel, its
   controls live when pinned; browser checks first.
6. Screens, design.md, the review, merge, deploy and the live check.

## Execution log

Where the build departed from this plan, as it happened.

- **Task 1, the files** (2026-11-05). Encoded at −16.4 to −16.8 LUFS
  and −1.7 to −5.1 dBTP, 15.5 MB together. `loudnorm` alone left One
  Night in France at +0.3 dBTP once encoded: the 128-kbps encoder adds
  up to about 2 dB between samples (−2.4 dBTP limited, −0.5 once
  encoded). So the script limits 2 dB under the ceiling before encoding,
  which keeps every file under −1.5 dBTP and takes a few tenths off the
  loudness, still within the 1 LU the test holds.
- **Tasks 3 and 4 in one commit** (2026-11-05): the panel's wiring and its
  remembering share `musicPanel.ts` and `main.ts`, and were built
  together, each test seen failing first.
  - **The files are found by Vite,** not copied by a step in
    `vite.config.ts` (decision 3): `import.meta.glob` over
    `content/music/*.mp3` with `?url` gives each file a hashed address in
    the build and fetches nothing. A new track is still a file and a
    playlist entry.
  - **The browser's rule, in the checks.** Headless Chromium keeps the
    autoplay rule, but a check's own `page.evaluate` counts as a press
    there, which hid a refusal in a first probe. `spec/music.test.ts`
    keeps the rule by the page's own input, as the HTML standard words it
    (a key or a mouse button going down, a finger lifting), and the checks
    that judge starting use it.
  - **Waiting music starts as a finger lifts,** not as it lands: a browser
    lets a tap start sound only at `pointerup`, so starting at
    `pointerdown` was refused for the very tap meant to start it (found by
    the phone's check). Keys still start it as they go down.
  - **The drawer is placed from the bars, measured.** At 390 px the status
    bar wraps to two rows and the drawer, fixed 72 px down, covered Whole
    room and Leave (it did before this slice; the music's row made it
    plain). `main.ts` now measures the status and talk bars and sets the
    drawer's top, bottom and room; the phone's check taps each bar button
    with the drawer open.
  - **The Pause label changes at once,** not at the `pause` event a task
    later, so a quick second press reads the panel truly.
- **The review** (9 findings, 1 major) is answered in
  [`reviews/slice-15-findings.md`](reviews/slice-15-findings.md), all
  fixed. **Not checked:** a reload into the café on a real iPhone with
  music remembered on, then a tap (finding 8); no WebKit is installed for
  Playwright here. Real Safari, Firefox and a screen reader were not
  tried either.
