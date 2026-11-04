# 0020. Play public-domain lofi, each visitor their own

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

On 2026-11-05 the user asked for background music: "pick from
https://www.bensound.com/royalty-free-music/lofi, pick 6 music with
slightly different style, 3 for day, 3 for night. add playing music info
panel. user can do pause/play, change volume, prev/next on that panel."

Two things constrain where the music can come from:

- **Bensound's licence.** Its terms of use
  ([bensound.com/terms-and-conditions](https://www.bensound.com/terms-and-conditions),
  read 2026-11-05) allow the free licence only for tracks marked "Free
  Music" (17 of the 71 lofi tracks), and only "as part of an online video
  or live video streaming that is published AND accessible free of
  charge", or for theatrical performances and films "meant for
  educational purpose only" that don't "generate revenue". A website's
  background music isn't among them. "Background music for a video game,
  application, software" is listed under the paid Professional licence,
  per track. Bensound's pricing page says pay-per-track licences start
  "from 34 Euros"; third-party comparisons put Professional at about €65
  a track, which wasn't confirmed on Bensound's site.
- **The repo goes public.** Bensound's terms forbid making the audio
  "available ... separately from the Project" and permitting "a third
  party to use or copy" it. A paid track committed to a public repo would
  be both; it would have to reach Fly outside git and outside CI, which
  deploys from the repo.

And one about who hears it: the café is one shared room, so the music
could be one shared radio, or each visitor's own.

## Options

Where the music comes from:

1. **Bensound, free licence.** What was asked. Not allowed for a website,
   so not an option the café can take.
2. **Bensound, six Professional licences.** About €390 (unconfirmed), and
   the files kept out of the public repo, so the deploy needs a second
   path for them, and a clone of the repo has no music.
3. **Ask Bensound for permission** for a non-commercial student project,
   and use something else until they answer. An answer might not come
   before the final submission on 9 November.
4. **HoliznaCC0's *Public Domain Lofi*** on the Free Music Archive: about
   50 lofi tracks, each released under CC0 1.0 (checked on each chosen
   track's own page), instrumental and marked not AI-generated. Free,
   no conditions, can be committed and deployed like any content. The
   cost: it isn't the catalogue the user pointed to, and one artist's
   style is narrower than Bensound's several.

Who hears it:

1. **Each visitor their own player.** Pause and skip are personal, as the
   request reads; nothing reaches the server, so none of the café's rules
   are touched.
2. **One café radio,** everyone hearing the same track at once. Closer to
   a real café, but pause becomes mute, skip becomes a vote or a
   free-for-all, and the server has to keep the radio's clock.

## Decision

The user chose 1A on 2026-11-05: we will play six of HoliznaCC0's CC0
lofi tracks, committed in `content/music/` with a playlist and credits,
three for day and three for night by the Canberra hour. And each visitor
has their own player, whose state stays on their device and never
reaches the server. Built as
[slice 15](../slices/15-music-while-you-sit.md).

## Consequences

- No cost and no licence to track. The credit is courtesy, since CC0
  asks for none, and makes the public repo say where each file came from.
- A new track is a file and a playlist entry in `content/music/`, as a
  new cat is a data file.
- The image grows by about 15 MB once the tracks are re-encoded, which
  the 256 MB machine serves from disk as it does the rest of the client.
- The user asked for Bensound and gets another artist; the six picks are
  the agent's, from the artist's tags, and stay open to the user's ear.
- If Bensound ever grants permission, or the user buys licences, swapping
  the tracks is a content change, but committing paid files to the
  public repo would still be against Bensound's terms.
- A shared radio stays possible later as its own slice, since the
  player's controls would sit on top of whatever chooses the track.
