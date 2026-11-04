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
