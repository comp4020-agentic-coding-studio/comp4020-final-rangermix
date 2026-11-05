# Slice 15, music: where it stands

[Spec](../slices/15-music-while-you-sit.md),
[plan](plan-slice-15-music.md),
[review](reviews/slice-15-findings.md),
[screens](screens/slice-15/).

## Live, 2026-11-05

Merged to `main` at `6505db3`; CI's checks and deploy passed (run
41966210685), the first green run on `main` since the rug's pull request
merged: its test fixtures lacked slice 11's `perch` flag, and `main`
stopped at the client's typecheck until `a6d970e` gave them it.

Checked on the live café at about 15:19 AEDT with one account,
`agent_s15` plus four characters (a fresh password, never written down),
at 1920×1080, the visit left at once. Build `mw31cby3`.

- Entering: the panel named Bubbles by HoliznaCC0 and offered Play; the
  element was paused, and **no track was fetched**.
- Play: `bubbles-CZzAD6PD.mp3` played, at 40%; Next played Ocean Breeze.
  Only those two files were fetched, from the live build's assets
  (`audio/mpeg`, 2,363,140 bytes for Bubbles, as committed).
- **Nothing sent but presence:** the page sent no frame but `here` while
  the music played and skipped.
- Leave: the music stopped.
- The panel sat bottom right over the street's corner, the other three
  where they were.

## Not checked

- **A real iPhone** (the review's finding 8): reload into the café with
  music remembered on, then tap the room; it should start. No WebKit is
  installed for Playwright here. `click` is listened for beside
  `pointerup` in case Safari honours only that.
- Real Safari, Firefox, a screen reader, and a phone's lock-screen
  controls on a device.
- **The user's two judged lines:** whether the six tracks suit the café
  and the day and night sets feel different, by ear on the live café;
  and whether the panel sits comfortably, from the screens.

## For the user

- The README's credit says the tracks "play in the café once slice 15 is
  built". They do now; the clause is the user's to drop.
