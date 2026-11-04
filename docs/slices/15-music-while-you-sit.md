# 15. Music while you sit

- **Status:** Approved 2026-11-05 by the user ("merge slice 11 first, then work on music"), with its proposed defaults; read by a builder 2026-11-05 ([questions](../notes/reviews/slice-15-builder-check.md)), its four questions settled as the agent's calls at the end
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-15-music.md`
- **Design:** The client ("Music"),
  [ADR 0020](../adr/0020-play-public-domain-lofi-each-visitor-their-own.md);
  builds on [slice 14](14-panels-over-the-room.md)'s floating panels

## Story

Someone sits down in the café and quiet lofi plays. By day it's a bright,
easy set; from the evening a slower, dreamier one. A small panel says
what's playing, and from it they can pause, skip back or forward, and turn
it down. It's their own music: pausing or skipping changes nothing for
anyone else in the room. Next time they come in, it carries on as they
left it: playing at their volume if they had it on, silent if they'd
paused it.

## In this slice

- **Six tracks in `content/music/`,** all by HoliznaCC0 from the album
  *Public Domain Lofi*, each released under CC0 1.0 (checked on each
  track's own page on the Free Music Archive, 2026-11-05):

  | Set | Track | Mood (the artist's tags) | Length |
  | --- | --- | --- | --- |
  | Day | Bubbles | bright, relaxed | 2:28 |
  | Day | Ocean Breeze | ukulele, peaceful | 3:18 |
  | Day | Tranquil Mindscape | happy, reflection | 2:34 |
  | Night | Moon Unit | reflection, dreamy | 2:52 |
  | Night | Ease into Night | relax, chill | 2:32 |
  | Night | One Night in France | nostalgic, chill | 3:15 |

  The originals are 320 kbps, 41 MB together, and their loudness differs
  by 5 dB (−11.2 to −16.5 LUFS). They're re-encoded once, by a script in
  `scripts/`, to about 128 kbps and an even loudness, so the six together
  come to about 15 MB and none jumps out after another. The script records
  where each original came from, and beside each file its hash and the
  loudness it measured; the files it writes are what's committed, never
  edited by hand.
- **The playlist is data:** `content/music/playlist.toml` lists each set's
  tracks with title, artist, file, source page and licence. A new track is
  a file and an entry, never code (as a cat is).
- **Credited** in `content/music/CREDITS.md`, with each track's source
  page, and on the panel itself, which names the artist. CC0 asks for no
  credit; this is courtesy, and so the public repo shows where each file
  came from. A line for `README.md`'s sources is proposed to the user,
  whose file it is, as slice 10's Catppuccin credit was.
- **Day and night sets by the café's clock,** Canberra time, whoever is
  listening: the night set from 17:00, when the room's light starts to
  turn, until 6:00, and the day set otherwise. The current set is always
  the clock's.
- **Playing in order, looping:** within a set the tracks play in the
  playlist's order and loop. Previous and Next step through the current
  set's three tracks only, wrapping round.
- **Across a boundary** (17:00 or 6:00): the song playing, or paused,
  finishes first. It isn't cut off, and a paused one picks up where it
  stopped. When it ends by itself, the new set's first track follows;
  Next from it goes to the new set's first track, and Previous to its
  last.
- **The music panel** shows the track's title and artist, and has
  Play/Pause, Previous, Next and a volume slider:
  - **Desktop:** a fourth floating panel, with slice 14's dragging,
    pinning, dimming and remembering, starting in the room's bottom-right
    corner.
  - **Phone, layout B:** a slim row in the drawer, at its top.
  - **Phone, layout A:** a slim row under the room, with the treats and
    emotes.
- **Remembered per device**, as the phone's layout is (or for the visit,
  if storage is blocked): whether music was on, and the volume. Never
  sent to the server.
- **Starting up:** browsers won't play sound until a visitor has touched
  the page. A first visit is silent until the visitor presses Play. For
  a visitor whose device remembers music on, the player tries to play as
  they enter the café, at the remembered volume; signing in or pressing
  Come back in is a touch, so it usually starts at once. If the browser
  refuses (a reload straight into the café, say), it starts at their
  first click, tap or key press inside the café. Until then, the panel
  shows the track ready and Play, not a false "playing".
- **Leaving** the café, or being signed out, stops the music. Coming back
  in picks it up again by the same rule.
- **Being there:** a press on the music panel counts as being present,
  as any press in the café does (the quiet seat,
  [ADR 0009](../adr/0009-free-a-quiet-seat-only-when-someone-is-waiting.md)),
  so someone listening and skipping keeps their seat.
- **Loading:** a track loads only when it's about to play, never all six
  up front, so a visitor who never presses Play downloads none of them.

## Not in this slice

- **A shared café radio,** where everyone inside hears the same track at
  the same moment. Each visitor has their own player
  ([ADR 0020](../adr/0020-play-public-domain-lofi-each-visitor-their-own.md)).
- **Sound effects** (a purr, the door's bell). That would be a slice of
  its own.
- **Bensound's tracks.** Their free licence covers online videos and
  educational films, not a website's background music; that needs a paid
  licence per track whose files couldn't go in a public repo
  ([ADR 0020](../adr/0020-play-public-domain-lofi-each-visitor-their-own.md)).
- **Choosing a track from a list, shuffle, or a seek bar.** The panel has
  the four controls asked for.
- **Music on the sign-in card or the "You've left" screen.**
- **Anything on the server.** It serves the files as it serves the rest
  of the client.

## Done when

| What must be true | Held by |
| --- | --- |
| The six tracks and their playlist load from `content/music/`; every playlist entry's file exists, and every file has an entry | client unit test (`music`, reading the playlist) |
| Each track credits HoliznaCC0 with its source page and CC0 1.0 in `CREDITS.md` | client unit test (every playlist entry's title and source page appear in `CREDITS.md`) |
| The re-encoded files are about 128 kbps, together under 20 MB, and within 1 LU of the loudness the script aims for | client unit test: the bitrate read from each file's frame headers, the total size, each file's hash matching the one the script recorded, and the loudness it recorded within 1 LU of the target (CI has no ffmpeg, so the loudness is measured when the script encodes) |
| The set follows the Canberra hour: day from 6:00, night from 17:00 | client unit test (`music`, every hour of a day) |
| Crossing 17:00 or 6:00 mid-song, playing or paused, finishes the song; when it ends, the new set's first track follows, and Next goes to it | client unit test (fake clock) |
| Next and Previous wrap round the clock's set's three tracks, and never leave it | client unit test |
| Play, Pause, Previous, Next and the volume work by mouse, touch and keyboard, at 1920×1080 and 390×844 in both phone layouts, and after a resize across 960 px | browser check (the element's `paused`, `currentSrc` and `volume`) |
| The panel shows the title and artist of what's loaded, and Play or Pause truly | browser check |
| A first visit makes no sound and fetches no track until Play | browser check (no request for any of the six files before Play, wherever the build serves them) |
| With music remembered on, it starts on entering at the remembered volume; after a reload straight into the café, which the browser won't let play, the first click, tap or key press starts it | browser check |
| On, off and the volume are remembered on reload, and kept for the visit when storage is blocked | browser check, as the layout switch's |
| Leaving the café stops the music | browser check |
| Pausing or skipping changes nothing for anyone else: no message is sent but the presence ping any press sends | browser check (no WebSocket frame but `here` on Play, Pause, Next, Previous or volume, as the street's check filters it) |
| On desktop the music panel drags, pins and dims as slice 14's panels do, and when pinned its controls still work | browser check, as slice 14's |
| Every action still works by keyboard, touch and mouse at both sizes | `spec/` (the existing checks pass) |
| The six tracks suit the café, and the day and night sets feel different | judged: by the user, listening to each on the deployed café |
| The panel sits comfortably at both sizes, pinned and unpinned | judged: by the user, from screenshots at 1920×1080 and 390×844 |

## Rules it touches

- **Every action works by keyboard, touch and mouse, at 390×844 and at
  1920×1080, and survives a resize mid-use.** Four new controls at every
  size, and the panel moves between layouts on a resize.
- **Never store or log what anyone says, never store email or IP
  addresses.** Untouched: nothing about the music reaches the server or a
  log.
- **The server decides every outcome.** Untouched: the music is each
  visitor's own and changes nothing in the café.
- **Generated TypeScript is never edited by hand.** The protocol doesn't
  change.

## Numbers

New lines for `docs/design.md`'s "Numbers to tune":

- Night music: from 17:00 to 6:00 Canberra time (*tunable*); the day set
  otherwise.
- Starting volume: 40% (*tunable*).
- Files: about 128 kbps MP3, loudness evened to one target (*tunable*,
  set in the plan).

## Open questions

Settled 2026-11-05 by the user:

- **Where the music comes from:** HoliznaCC0's public-domain lofi, not
  Bensound (1A). The six tracks are the agent's picks from the artist's
  tags, to be judged by ear.
- **When the night set starts:** 17:00, with the room's light (2A).
- **What Previous and Next move through:** the current set's three (3A).
- **Starting:** remembered per device, starting at the first touch in
  the café, at 40% to begin with (4B).
- **Where the panel goes:** a fourth floating panel on desktop, a row in
  the drawer or under the room on a phone (5A).
- **When:** this spec now, built after slice 14 merges and before
  slice 11 (6A).
- **Whose music:** each visitor has their own player, with nothing sent
  to the server.

Proposed defaults, for the user to approve with the spec:

- **A pinned music panel.** Slice 14 lets every click on a pinned panel
  through to the café, except its Unpin. A pinned music panel that
  couldn't be paused would be a trap. *Default:* on the music panel,
  pinning lets clicks through everywhere but its five controls (Play or
  Pause, Previous, Next, the volume, Unpin); the title and artist pass
  clicks to the café.
- **Order within a set.** *Default:* the playlist's order, looping, so
  Previous means the track before. Shuffle is out of scope.
- **Where a remembered player picks up.** *Default:* at the start of the
  set's first track each visit, not mid-song where it was left. Keeping
  the spot would mean saving it every few seconds, for little gain in
  two-to-three-minute songs.
- **The phone's controls.** *Default:* the same four controls in one
  row, the volume a slider; on iOS, where a page can't set the volume,
  the slider is hidden and the phone's own buttons do it.

Settled by the agent 2026-11-05, from the builder's read
([questions](../notes/reviews/slice-15-builder-check.md)); each could be
settled without changing what gets built:

- **Checking loudness where there's no ffmpeg** (its question 1). CI's
  runner has no ffmpeg, and a check that needed it would stop every
  deploy. The script measures when it encodes and records each file's
  hash and loudness; `pnpm check` holds the files to that record, the
  bitrate from the frame headers and the total size. The cost: the 1 LU
  line rests on the measurement taken when the files last changed.
- **Remembered music when the browser would already play** (question 2).
  It plays on entering, and waits for a press only if the browser
  refuses. The user's 4B was about the browser's block, not a wish for
  silence after Walk in.
- **Which set is current near 17:00 and 6:00** (question 3). Always the
  clock's. The song playing, or paused, finishes; then the new set's
  first track, and Next and Previous go into the new set, so nobody who
  skips is stuck in the old one.
- **The presence ping** (question 4). A press on the music panel counts
  as being there, as every press does, so someone listening isn't nudged
  out of their seat; the check that no message is sent lets that ping
  through, as the street's and the waking checks do.

The user's, not the slice's:

- **`README.md`'s music line.** The README promises "soothing music",
  which slice 11 settled would come out. With this slice it comes true,
  so whether the line stays, and the credit line proposed for its
  sources, are the user's to write.
