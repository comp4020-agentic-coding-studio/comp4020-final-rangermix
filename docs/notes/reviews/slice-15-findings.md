# Findings: review of slice 15, "Music while you sit"

Brief: [slice-15-brief.md](slice-15-brief.md). Read cold on 2026-11-05 at
`5d826d2`, reviewing `04f218d..5d826d2` only. Built and run only in a
throwaway copy (`git archive 5d826d2`, outside the repo), never in this
checkout. Nothing live was touched: not the café, not Fly.

**Count:** 0 critical, 1 major, 8 minor.

## What was run

- **Typecheck and unit tests.** In the copy, `client`'s `tsc --noEmit` and
  the root's `tsc --noEmit` were both clean, and `client`'s `vitest run`
  passed 291 tests in 26 files. `vite build` wrote the six MP3s to
  `dist/assets/` under hashed names.
- **The browser checks.** I built the server with `cargo build --release -p cafe`
  and ran it from the copy's root with `PORT=18916`, a fresh `DATA_DIR`,
  and `CLIENT_DIR` set to the copy's `client/dist`.
  - `spec/music.test.ts` passed: 8 of 8.
  - The whole spec passed: 84 tests, with 1 skipped, across 12 files.
  - I stopped the server by its own PID each time.
- **Mutations.** Each was made in the copy and rebuilt with the same
  `BUILD_ID`. Afterwards I put each file back and diffed it against
  `5d826d2`.
  - **M1:** Next or Previous while paused sets the new track's `src`, with
    `preload = "auto"`.
  - **M2:** the constructor sets `audio.preload = "auto"`.
  - **S1:** `spec/music.test.ts:204` without its `.filter((t) => t !== "bubbles")`.
- **Playwright probes** in Playwright's Chromium (build 1243), each in a
  fresh context, against the same café. The probe scripts named below were
  throwaway files outside the repo.
  - **Chromium's own autoplay rule**, with no wrapper and no
    `page.evaluate` between a reload and the first press, by touch, mouse,
    Tab and an arrow key.
  - **A track that fails to load:** a 404, and a reset connection, then
    Play pressed again.
  - **The clock** jumped from 16:59 to 17:00:02, with nothing begun.
  - **Keyboard on a phone:** layout B with the drawer open, and layout A.
  - **Touch on a desktop**, with the panel pinned.
  - **iOS, emulated:** a `volume` that ignores writes and reads 1.
  - **The drawer:**
    - with the status bar grown by the update banner;
    - on landscape phones, at 844×390 and 667×375.
  - **Desktop sizes** from 1920×1080 down to 960×540, pinned and unpinned,
    with the longest title loaded.
  - **Focus rings** at 3× pixel density.
  - **A pause from outside the panel.**
  - **A remembered-off reload**, followed by presses.
- **The files.**
  - **Re-measured with ffmpeg** (`ebur128=peak=true`): loudness and true
    peak.
  - **ffprobe:** duration and bitrate.
  - **SHA-256 of each file**, compared with the manifest.
  - **Cross-checked against each other:** the URLs and file names in
    `playlist.toml`, `manifest.json`, `CREDITS.md` and `scripts/music.ts`.
  - **`scripts/music.ts`, run end to end** (37 s) in a separate copy. The
    committed files stood in for the originals, which aren't in the repo.
  - **All six source pages** on the Free Music Archive, fetched on
    2026-11-05.
- **The server's log** for the whole spec run (386 lines), grepped for
  `mp3` and `music`.

## Findings

### 1. Major: after a track fails to load, Play does nothing for the rest of the visit until the visitor happens to skip

- **Where:** `client/src/musicPanel.ts:131-141` (`playLoaded`). When the
  element already holds the named track (`same(this.held, this.loaded)`),
  it only calls `audio.play()`. An element whose load failed sits with
  `error.code` 4 and `networkState` 3 (`NETWORK_NO_SOURCE`). Calling
  `play()` on it fetches nothing and plays nothing. The `error` listener
  (`:87`) only redraws the panel.
- **What I saw:** probe `e-retry.mjs`.
  - **Setup:** the first request for `bubbles-*.mp3` was answered with
    `connectionreset`, and every later one was let through.
  - **The failure:** after Play, the element read `paused: true, err: 4,
    net: 3`. The panel said "Play", which is true.
  - **Play pressed twice more:** still paused, and **no new request** was
    made.
  - **What was remembered:** `cafe.music` read `{"on":true,"volume":40}`.
  - **The only way out:** Next, then Previous, then Play played the track.
    That works only because a skip while paused unloads the element. A
    404 (`c-404.mjs`) leaves it in the same state.
  - **The fix works:** in the same failed state, setting `src` again
    before `play()` played the track (`i-misc.mjs`, part 4).
- **Why it matters:**
  - A phone on a patchy connection is the likely case.
  - The panel's main control looks live but is dead, and nothing says
    why.
  - The "done when" line "Play, Pause, … work by mouse, touch and
    keyboard" doesn't hold in this state.
- **What fixed looks like:**
  - `playLoaded` treats an element in error as holding nothing. Either
    `if (!same(this.held, this.loaded) || audio.error)`, or the `error`
    listener sets `this.held = null`. The next Play then sets `src` again.
  - A short note ("Couldn't load Bubbles") would tell the visitor it was
    the network.
  - **Tests first:**
    - **Unit:** a fake element whose `error` is set after a failed
      `play()`. A second Play must set `src` again.
    - **Browser:** `page.route` aborts the first request for the track.
      Play pressed again must play it.

### 2. Minor: for up to 30 seconds after 17:00 or 6:00, Play starts the set the clock has left

- **Where:** `client/src/musicPanel.ts:34`, `:92` and `:171-177`.
  - The clock is looked at only every 30 s (`LOOK_EVERY`).
  - Play (`:68-73`) and the first press (`pressed`, `:114-118`) play
    `this.loaded` without consulting the clock.
- **What I saw:** probe `f-boundary.mjs`.
  - Entered at 16:59, with nothing begun.
  - The page clock was set to 17:00:02.
  - The panel still said Bubbles, and Play played
    `bubbles-CZzAD6PD.mp3`.
  - That song then counts as begun, so it finishes. A visitor who presses
    Play just after 17:00 hears a whole day track at night.
  - The same happens when music remembered on is waiting for a press and
    the press comes in that window.
- **Against the spec:** "The current set is always the clock's" and "one
  not yet begun follows the clock". The panel does name what Play plays,
  so it isn't false. It's late.
- **What fixed looks like:** settle against the clock at the moment of the
  press. Before choosing what to play in `playLoaded`, run
  `settle(this.loaded, this.hour(), this.played())` and unload if it
  moved, as `look()` does. A unit test: flip the fake hour from 16 to 17
  without advancing timers, press Play, and expect `moon-unit`.

### 3. Minor: a pause from outside the panel isn't remembered, and the system's media controls can't skip

- **Where:** `client/src/musicPanel.ts:68-79`. `on` is remembered only in
  the Play button's own click. The element's `play` and `pause` events
  (`:86-87`) don't touch it. There's no `navigator.mediaSession` anywhere
  in `client/src/`.
- **What I saw:** probe `i-misc.mjs`, part 5.
  - Music playing, then paused from outside the panel (as a keyboard's
    media key, a headset button or Android's media notification does).
  - The panel correctly said "Play".
  - `cafe.music` still read `{"on":true,…}`, so the next visit starts the
    music the visitor stopped. The spec says the next visit is "silent if
    they'd paused it".
  - The reverse also holds: music started from those controls is
    remembered off.
  - Read from the code, not tried on a device: with no `mediaSession`
    action handlers, those controls' Next and Previous do nothing. With
    no `mediaSession.metadata`, they can't show the track's title and
    artist.
- **What fixed looks like:**
  - Remember `on` from the element's `play` and `pause` events, ignoring:
    - the pause that `dispose()` makes;
    - the `pause` the browser fires just before `ended`, when
      `audio.ended` is true;
    - a refused `play()`.
  - Optionally, set `navigator.mediaSession.metadata` to the title and
    artist, with `nexttrack` and `previoustrack` handlers calling `skip`.
  - A unit test: the fake element pauses itself, and `rememberedMusic().on`
    is then false.

### 4. Minor: two "nothing fetched" paths are held only by unit tests; the browser check for one can't fail, and the other has none

- **Where:** `spec/music.test.ts:204` and `:316-330`.
- **A skip while paused.** The check filters out `"bubbles"`, the very
  track that the paused Next names.
  - **M1** (a paused skip loads the next track with `preload = "auto"`):
    the first-visit check **passed**, though a probe of the M1 build saw
    `bubbles-CZzAD6PD.mp3 bytes=0-` requested on that Next.
  - **S1** (the filter removed): the original build passed, and the M1
    build failed with `expected [ 'bubbles' ] to deeply equal []`.
  - So the filter isn't needed, and it hides the regression.
  - The unit test `musicPanel.test.ts:84-98` does catch M1.
- **A reload into the café when the browser refuses to play.**
  `playLoaded` sets `src` before the browser refuses, so only
  `preload = "none"` keeps the track from loading.
  - **M2** (`preload = "auto"`): all 8 music checks **passed**, though the
    M2 build fetched `bubbles` after the reload, before any press.
  - The check asserts only that something was fetched after the press
    (`:330`), not that nothing was fetched before it.
  - `musicPanel.test.ts:75` (`preload` is `"none"`) catches M2.
- **What fixed looks like:**
  - Drop the filter at `:204`.
  - After the reload at `:321-325`, add
    `expect(v.fetched.slice(fetchedBefore)).toEqual([])` before the key
    press.
  - Better still, don't set `src` until `play()` is allowed. That doesn't
    lean on a hint some browsers may ignore. `preload` is advisory in the
    HTML standard.

### 5. Minor: on a desktop, the focus ring of the panel's edge controls is cut off

- **Where:**
  - `client/src/style.css:130`: `.panel-body { overflow: auto }`. At 960
    px and over, the music body keeps it. Pinned, it's `hidden`
    (`:142`).
  - `:173-178`: the controls touch the body's edges.
  - The 3 px ring sits 2 px outside each control (`:65`), so whatever
    falls outside the scroll box is clipped.
- **What I saw:**
  - **Measured at 1920×1080:** Previous's left edge is at the body's left
    edge (1633 = 1633), and its bottom is 0.4 px above the body's bottom.
    The controls share one row, so every ring's bottom falls outside the
    body.
  - **The screenshot** (`m-ring-prev.png`, 3×): Previous's ring has lost
    its left and bottom sides.
  - **Not measured:** whether the volume slider (`flex: 1`) loses its
    ring's right side too.
  - **On a phone** the body is `overflow: visible` (`:251`), and the ring
    is whole (`l-ring-390.png`).
- **What fixed looks like:** room for the ring inside the body, for
  example `padding: 5px; margin: -5px` on `.music-controls`. A browser
  check would hold that each control's box plus 5 px lies within the
  body's box.

### 6. Minor: Next and Previous don't tell a screen reader what's now loaded, and in layout B the music row is first on screen but last by Tab

- **Where:**
  - `client/index.html:144`: the title and artist aren't in a live region,
    and `show()` doesn't call `announce`.
  - `:137`: the section comes after the talk bar.
- **What I saw:**
  - **Next or Previous by keyboard:** the focus stays on "Next track", and
    the new title changes silently.
  - **Layout B, drawer open, by Tab** (`g-phone-keys.mjs`). The drawer
    shows the music row at its top. Tab from the drawer toggle went:
    `layout-switch > leave > your-cats > room > talk-input > Say > Wave >
    Laugh > Heart > Yawn > put-treat > music-previous`, which is 11 stops
    before the row on top. In layout A, where the row sits under the talk
    bar, the order matches the screen.
- **Sound:**
  - **The names:** "Previous track", "Play" or "Pause", "Next track",
    "Volume", in a group "Music controls".
  - **The hidden heading:** clipped, not `display: none`, so it still
    labels the section. The grip and Pin are `display: none` below 960
    px, so Tab never reaches them.
- **What fixed looks like:**
  - A skip by the visitor is announced: `announce("Ocean Breeze, by
    HoliznaCC0")`, or `aria-live="polite"` on `.music-now`.
  - In layout B, either move the focus into the drawer when it opens, or
    place the drawer's panels so the music comes right after the drawer
    toggle.

### 7. Minor: on a desktop window under about 575 px tall, the music panel's controls are cut short, and pinned they can't be scrolled into view

- **Where:** `client/src/floating.ts:31` and `:90`. The music panel may grow
  to `stage height × 0.3 − 16`. The panel needs 121 px with any of the six
  titles. Below a stage of about 457 px it's capped short of that.
- **What I saw:** `h-sizes.mjs` and `n-wrap.mjs`.
  - **At 960×600 and above:** whole (cap 129 px or more).
  - **At 960×540, unpinned:** cap 111 px, and the body scrolls by 9 px.
  - **At 960×540, pinned** (`overflow: hidden`): Play's bottom is at 470,
    but the body ends at 461. The screenshot `h-960x540-pinned.png`
    shows the buttons' bottoms cut off.
  - A laptop with a short window, or a desktop zoomed to 175–200%, gets
    there.
- **What fixed looks like:**
  - The music panel's cap is at least its own content's height, since it
    is a fixed size and never grows with the café. Who's here takes what
    is left.
  - A check at a short desktop size holds that the five controls lie
    inside the panel, pinned.

### 8. Minor (needs a real iPhone): starting at the first tap relies on Safari counting `pointerup` as a gesture

- **Where:** `client/src/main.ts:99` and `:103-104`. Waiting music starts on
  `pointerup` for a tap. The plan's execution log says "a browser lets a
  tap start sound only at `pointerup`".
- **What holds:** I checked this in Chromium's own rule, with no wrapper
  (`b-real-touch.mjs`). After a reload, `play()` on entering was refused,
  and the first tap, click or key started it (`PLAY ok`). Tab works as the
  first press too.
- **What isn't checked:** WebKit on iOS decides for itself which events
  carry a gesture that may start media. No WebKit is installed for
  Playwright here, so it couldn't be tried. The spec's line "after a reload … the first click, tap … starts
  it" is held only in Chromium.
- **What fixed looks like:** try a reload straight into the café on a real
  iPhone with music remembered on, then tap the room. If it stays silent,
  `pressed` should also listen for `click` (or `touchend`) on the
  document. That is cheap, and harmless where `pointerup` already worked,
  since `pressed` does nothing once the music plays.

### 9. Minor: `scripts/music.ts` remakes the files, but not the same files, and doesn't say how to get the originals

- **Where:** `scripts/music.ts:6-10` and `:80`.
- **What I saw:** it ran end to end in a separate copy and rewrote the
  manifest it reads back. That part is sound.
  - **The originals:** it expects six files under the names in `TRACKS`,
    but says only "fetch them". The Free Music Archive's pages download
    through an overlay, and the file name it gives isn't recorded.
  - **The encoder:** the manifest records neither the ffmpeg nor the LAME
    version. A remake on another machine will hash differently and
    measure a few tenths apart.
  - That is self-consistent, since the test then holds the new record.
    But a remake can't show that the committed files came from the
    originals named.
- **What fixed looks like:** a line on where each page's download button
  is and what to name each file. And `ffmpeg -version`'s first line in
  `manifest.json`.

## Checked and found sound

- **The files.**
  - **Loudness and peak:** ffmpeg's re-measurement matches the manifest
    exactly. Integrated loudness is −16.6, −16.4, −16.7, −16.4, −16.8 and
    −16.8 LUFS, within 1 LU of −16. True peak is −1.7 dBTP at its
    highest, under −1.5.
  - **Bitrate:** 128 kbps CBR (ffprobe 128.04–128.06 kb/s).
  - **Size:** 15.5 MiB together, under 20 MB.
  - **Hashes:** each SHA-256 matches the manifest.
  - **Lengths** match the spec's table: 2:28, 3:18, 2:34, 2:52, 2:32 and
    3:15.
  - **Cross-checks:** every playlist entry has a file and every file an
    entry. Each URL is the same in the playlist, the manifest, the
    credits and the script.
- **Licences.** All six source pages, read 2026-11-05, say "licensed
  under a CC0 1.0 Universal License" and "AI generated? No", name
  HoliznaCC0, and are on the album *Public Domain Lofi*. `CREDITS.md`
  matches them.
- **The browser's rule in the checks.** `autoplayRule` follows the
  standard's activation-triggering events: a key going down other than
  Escape, a mouse button going down, a non-mouse pointer lifting. Like
  Chrome, it refuses `play()` without firing `play`, and a reload resets
  it.
  - **Matches the real browser:** headless Chromium's own rule, probed
    without the wrapper and without `page.evaluate` (which does pass
    `userGesture: true` to the page), refused on entering after a reload,
    and played at the first tap, click or key. The model matches the real
    rule.
  - **Checks run without it:** the keyboard, phone-touch, pinned and
    blocked-storage checks. Each had a real gesture when signing up, so
    the rule wouldn't change their outcome.
- **Nothing fetched before Play.**
  - **A first visit:** the markup's `preload="none"` with no `src`, and
    the constructor unloads.
  - **A skip while paused:** unloads, and no request was seen
    (`j-skip-paused.mjs`).
  - **The clock moving a track:** it only unloads.
  - **A reload with music remembered off,** then a key and a click:
    nothing fetched, and `src` stayed empty (`o-off.mjs`).
  - **A reload with music remembered on that the browser refuses:**
    nothing fetched in Chromium. See finding 4 for why this rests on
    `preload`.
- **Across 17:00 and 6:00** (`music.ts`, `settle`, `ended`, and their
  unit tests, read and run):
  - **A song begun finishes,** playing or paused mid-song. `played()`
    counts a playing song at 0:00 as begun.
  - **A paused song at 0:00** counts as not begun, and follows the clock.
  - **A song ending after the boundary** is followed by the new set's
    first track.
  - **Next and Previous** go to the new set's first and last tracks.
  - **A page left open:** the panel follows the clock within 30 s. The
    one gap is finding 2.
- **Nothing sent but presence.**
  - **Frames:** no control, nor a song starting or ending, sends anything
    but `here`, as the checks show and the code reads. `pressed` sends
    nothing.
  - **The server:** none of its code changed, and neither did
    `client/src/protocol/`. Its 386 log lines from the full run hold no
    `mp3` or `music`, since `ServeDir` logs no requests.
  - **Storage:** `cafe.music` holds only `on` and `volume`. A damaged
    record falls back field by field. With storage blocked, `on` and the
    volume are kept for the visit.
- **The pinned panel.**
  - **Mouse and keyboard:** the spec's pinned check passed.
  - **Touch** (`g-phone-keys.mjs`): Play, Next and Previous answered taps,
    the volume answered a tap at 90% (0.95), and Pause answered.
  - **Keyboard while pinned:** Enter on Play and on Next, and the arrows
    on the volume.
  - **Clicks through:** the words and the gaps between the controls pass
    clicks to the room. The new rule targets only `.music-controls`
    children, so slice 14's pinned check for the other panels still
    passes in the full run.
- **The phone.**
  - **Both layouts at 390×844:** within the width, a slim row (48 to 49
    px), and every bar button still answers a tap with the drawer open.
  - **The drawer** stays between the bars when the update banner grows
    the status bar (`status` ends at 175, the music starts at 183), and
    on landscape phones at 844×390 and 667×375, with no overlap.
  - **A resize across 960 px mid-song** doesn't stop it.
  - **Keyboard** works in both layouts.
  - **iOS, emulated:** the slider hides at both sizes, with no overflow.
- **Leaving.** Leave, being signed out and being walked out all call
  `stop()`, and `dispose()` pauses and unloads. Coming back in builds a
  fresh player and removes every old listener.
- **Slice 14's panels.** Who's here's share dropped from the whole stage
  to 0.7 to make room for the music. At every size from 1920×1080 to
  960×540, the two right-hand panels don't overlap.
- **The screenshots** I viewed match the build: the desktop by day,
  pinned at night, and both phone layouts. The script that takes them
  reads `APP_URL`.

## Also noticed (not counted)

- **The root plan's table:** `docs/notes/plan.md` has a blank line before
  row 15, so the row renders outside the table. The blank line predates
  the slice (it's there at `04f218d`), and the slice's edit kept it.
- **design.md's numbers:** they say "128 kbps stereo MP3 at −16 LUFS
  integrated". The files measure −16.4 to −16.8, as the plan's execution
  log explains (the limiter takes a few tenths). "Aimed at −16 LUFS,
  within 1 LU" would match the test.

## Not checked

- Real iOS Safari and desktop Safari (finding 8), Firefox, a real screen
  reader, and Android's media notification on a device.
- Whether the six tracks suit the café: the user's judgement, by ear.

---

## Answers

*By the builder, 2026-11-05.* Every finding is fixed in [`64c284d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/64c284d), each test
seen failing first against the code before it: the unit tests in
`client/test/musicPanel.test.ts` (seven new, all failing before), and four
new or tightened browser checks in `spec/music.test.ts` (all four failing
before). After it, the client's 299 tests, the whole spec (87 passed, the
restart check skipped without Docker) and both typechecks pass.

1. **Fixed.** The element's `error` event lets go of what it held, so
   the next Play sets the source again. Unit: a fake element whose first
   load fails; a second Play sets the source again and plays. Browser:
   the first request for Bubbles is reset by `page.route`; the panel says
   Play, and a second Play plays it. No note is shown: the panel truly
   says Play, and a second press is the remedy; a message is left for
   when the café has a place for such notes.
2. **Fixed.** `playLoaded` settles against the clock first, so Play and
   the first press just after 17:00 play the night set. Unit tests for
   both: the hour flipped from 16 to 17 with no timer run.
3. **Fixed.** On and off are remembered from the element's own `play`
   and `pause` events, so a media key or a headset's button counts. A
   pause counts only after a play (a refused `play()` is nothing), not
   while `ended` is true, and not the one `dispose()` makes (its
   listeners are gone first). The system's media controls get the
   track's title, artist and album through `navigator.mediaSession`,
   with Play, Pause, Next and Previous handlers, cleared when the visit
   ends. Unit tests for each; the media session against a stand-in,
   since no browser here shows a lock screen.
4. **Fixed both ways.** The filter at the paused-Next check is gone, and
   after the reload the check holds that nothing was fetched and no
   source set before the press. The code no longer leans on `preload`:
   it sets no source while `navigator.userActivation.hasBeenActive` is
   false, and a refused `play()` unloads. A unit test holds that a
   refused entry leaves no source.
5. **Fixed.** The music's body has 5 px of padding inside, given back by
   a matching negative margin, so each 3-px ring 2 px out stays inside
   the scrolling box. The browser check holds each control's box plus
   5 px inside the body, pinned and not.
6. **Fixed.** A skip announces "Ocean Breeze, by HoliznaCC0" through the
   page's live region. For layout B, opening the drawer takes the focus
   to its first control, the music's Previous, first on screen, and
   Escape inside the drawer closes it and gives the focus back to the
   toggle (the drawer names its panels with `aria-controls`). The
   browser check opens it by keyboard and reads both, and the
   announcement after Next.
7. **Fixed.** The music panel's cap is its own content's height, since
   it never grows with the café; who's here gets the stage less the
   music and the gaps. The browser check holds every control inside the
   panel and the body unscrolled at 1920×1080 and at 960×540, pinned and
   not, with the longest title loaded.
8. **Fixed as far as can be held here; the iPhone try is still owed.**
   `click` now starts waiting music too, beside `pointerup` and
   `keydown`, which costs nothing where `pointerup` already worked. No
   WebKit is installed for Playwright, so whether Safari honours either
   is held by a try on a real iPhone, recorded as not checked in the
   slice's notes until it's done.
9. **Fixed.** `TRACKS` records each original's own address (the
   `fileUrl` in its page's data) and the name to save it under, and
   `node scripts/music.ts <folder> --get` fetches them with curl. The
   manifest records the ffmpeg that made the files. Run end to end with
   `--get` into a fresh folder: the six originals fetched match the ones
   first downloaded byte for byte, and the six files it wrote match the
   committed ones byte for byte (only the manifest's new `ffmpeg` line
   changed).

**Also noticed.** The blank line splitting the root plan's table is
removed with this slice's row. design.md's numbers now say "aimed at
−16 LUFS, within 1 LU", as the test holds.
