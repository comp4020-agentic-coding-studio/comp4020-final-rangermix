# Slice 15, a builder's read: the questions left

From the brief [slice-15-builder-check.md](../briefs/slice-15-builder-check.md).
Read on 2026-11-05 against `main` at `fdff759` and `origin/slice-14-panels`
at `f743f0f`. I assumed the spec's four proposed defaults are approved as
written.

There are four questions, the most important first.

## 1. How does `pnpm check` measure loudness when CI has no ffmpeg?

The "done when" table says the script checks its own output, including
"within 1 LU of the loudness the script aims for", and that this check runs
in `pnpm check`. Measuring integrated loudness means decoding the MP3s.
ffmpeg is installed on this machine (`/opt/homebrew/bin`). But `pnpm check`
also runs in CI on `ubuntu-latest`, and GitHub's Ubuntu 24.04 runner image
doesn't list ffmpeg (its readme, read 2026-11-05). `mise.toml` installs only
node and pnpm. The deploy job needs the check job to pass, so a check that
calls ffmpeg would fail every push to `main` and stop every deploy. There
are three ways round it:

- **(a)** Install ffmpeg in CI, with a step in `.github/workflows/checks.yml`.
  Every machine that runs `pnpm check` then needs ffmpeg, cloud sessions
  included.
- **(b)** Add a dev dependency that decodes MP3 in Node, and compute EBU
  R128 loudness in TypeScript. Its result has to agree with ffmpeg's, the
  tool the script uses to set the loudness, to well within 1 LU.
- **(c)** The script measures each file with ffmpeg when it encodes it, and
  writes the result and the file's hash into a committed manifest.
  `pnpm check` then checks:
  - the bitrate, read from the MP3 frame headers with no decoder;
  - the total size;
  - that each file still matches its hash, and that its recorded loudness
    is within 1 LU of the target.

**Why the answer changes the plan:** each option costs something different.

- (a) changes the course's workflow and adds a tool to every machine.
- (b) adds a dependency, and a loudness measurement that needs its own
  tests.
- (c) needs neither. The cost is that the 1 LU line rests on a measurement
  taken when the files last changed, not one taken on every run.

I'd guess (c).

## 2. If the browser already allows sound, does remembered music start straight away, or wait for the first press inside the café?

The spec says a visitor whose device remembers music on "hears it start at
their first click, tap or key press inside the café". A browser lets a page
play sound once the visitor has made any gesture on it, and most ways into
the café involve one:

- signing up or logging in on the page (typing, then Walk in);
- pressing Come back in after leaving.

On desktop, Chrome may also allow sound with no gesture at all on a site
someone visits often (its media engagement score). Only reloading straight
into the café with the session cookie reliably comes with no gesture.

There are two readings:

- **Literal:** the player keeps its own flag for whether there has been a
  press inside the café yet, and waits for one even when the browser would
  let it play. Someone who has just pressed Walk in hears nothing until
  their next press.
- **Natural:** try to play on entering the café, and if the browser refuses,
  wait for the first press.

**Why the answer changes the plan:** the two readings are different code,
and they change which path the browser check can test. `visit()` in
`spec/browser.test.ts` signs up by keyboard, so every page it opens has
already had a gesture. With the natural reading, music starts as soon as
those pages enter. "The first press starts it" could then only be checked
after a reload with the session cookie.

I checked this in Playwright's headless Chromium on 2026-11-05:

- After a navigation, `play()` is refused with `NotAllowedError` until there
  has been a gesture.
- Keyboard input counts as a gesture, and so does `page.evaluate`.

## 3. Around 17:00 and 6:00, which set is "the current set"?

The spec says two things that disagree between the boundary and the end of
the song that's playing:

- The song playing finishes, and the next comes from the new set.
- Previous and Next "never leave" the current set.

Three cases need an answer:

- **Next at 17:01 while a day song plays.** It could go to the next day
  track (the current set is the set of the track loaded). Then someone who
  always skips before a song ends never reaches the night set. Or it could
  go into the night set (the current set is the clock's). Then Next leaves
  the set it was playing, and Previous from a day track into the night set
  has no obvious "track before".
- **A day track paused at 16:55 and played again at 17:30.** Does it pick up
  where it stopped, or does the night set begin?
- **The song after the boundary.** Is it the new set's first track, or the
  track at the same position in the new set?

**Why the answer changes the plan:** it decides whether the player keeps its
set separately from the clock. It also decides what the fake-clock unit
tests assert for "never leave it" and "the next is from the new set".

I'd guess:

- From the boundary on, Next goes to the clock's set's first track, and
  Previous to its last.
- A paused song picks up where it stopped, since it's still "the song
  playing".
- A song that ends by itself is followed by the new set's first track.

## 4. Does "no WebSocket frame" include the presence ping?

Every `pointerdown` and `keydown` on the page calls `cafe.touched()` in
`main.ts`. That sends `{ type: "here" }` on the first press in the café, and
after that at most every 30 seconds (design.md, "A quiet seat frees up only
for someone waiting"; ADR 0009). So a click on Play sends a frame if it's
someone's first press, or their first in 30 seconds. There are two ways to
square that with the spec:

- **Leave the music controls out of that listener.** The check then holds as
  written. But someone who only uses the music panel counts as gone quiet,
  and can be nudged out of their seat while their music plays.
- **Let the check allow `here` and `presence` frames.** The street and
  waking checks already do this: see the `filter((f) => f.type !== "here")`
  lines in `spec/browser.test.ts`. The "done when" line's wording then
  changes to match.

**Why the answer changes the plan:** the first option changes how presence
works. The second changes a line of the spec that the reviewer will hold the
build against. I'd guess the second.
