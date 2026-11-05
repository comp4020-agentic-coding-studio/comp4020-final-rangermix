# 0022. Let markers drive the café through public demo accounts

- **Status:** Accepted
- **Date:** 2026-11-06

## Context

The course's markers start at `/readme/`, then use the deployed café for
about ten minutes as a newly invited member: two sessions side by side, at
1920×1080 and 390×844, a resize mid-use, a keyboard-only pass, and the
promises `spec/` names
([brief-and-crits.md](../notes/brief-and-crits.md)). Most of what makes the
café itself lives on a scale they won't see in ten minutes:

- **Trust takes days.** A cat's trust in someone grows by at most 10 times
  its trust rate in a Canberra day (`content/tuning.toml`): Mochi 10,
  Tora 6, Burakku 3. The three levels it unlocks are 20 (comes when
  called), 50 (greets you at the door) and 80 (naps on your lap), so a
  lap is at least 8 days away with Mochi, 14 with Tora and 27 with
  Burakku. A marker's new account is a stranger to every cat.
- **The café keeps Canberra time.** The light, the street, the music and
  each cat's rhythm follow the hour: Burakku is up from 21:00 to 05:00,
  Mochi naps after lunch, Tora's zoomies come at dawn and dusk. A marker
  sees whatever hour they mark at.
- **The clock can't move.** `server/src/time.rs` sets the café's offset
  from the wall clock once, at start, because a clock that moved mid-run
  would break every timer the café keeps. `CAFE_CLOCK_START` is refused on
  Fly ([ADR 0016](0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)),
  so the live café has always been on the wall clock.
- **The page takes its hour from the device.** The client's light, street
  and music set read the device's clock (`client/src/canberra.ts`), while
  the cats' rhythms are the server's.
- **Some things need a crowd.** The line at the window needs six people
  inside; a marker has two sessions.

On 2026-11-06 the user asked for "a combined approach of test account and
master control", and on the same day chose it: the page takes its clock
from the server, demo accounts move it forward, choose a furniture set
and add bots, and a regular's trust is seeded by the operator, with the
login in the README for markers.

## Options

1. **Ask markers to come back over days.** Honest, nothing to build. They
   won't: the brief gives them about ten minutes, and the top band asks
   only that a session resumes the next day.
2. **A night preview for one viewer, and an operator seed for one
   regular.** The page alone shows a chosen hour's light, street and music,
   labelled as a preview; the cats don't follow it. Small and safe for
   everyone else, but the cats' rhythms, the bowls, midnight's treats and
   the night's traces stay out of reach, and the line still needs a crowd.
3. **Demo accounts with a café-wide clock that only moves forward.** The
   page takes its clock from the server. A demo account picks a time of
   day and the server fast-forwards the whole café to it, at most 24
   hours, through the same replay a sleep uses, so every timer moves
   with it. Demo accounts also lay out one of three furniture sets at once
   and add or remove bots that take seats. Their trust is seeded by an
   operator command. It shows everything in minutes, but it changes the
   café for everyone inside, a public password lets anyone do the same,
   and the café's clock drifts ahead of Canberra's.
4. **A separate demo café**, a second app or a second world, where the
   clock can be set freely. The live café stays pure. But markers mark the
   deployed app, the course fixes its shape (one machine, 256 MB, one
   volume), and a second world in the binary doubles what the world task
   owns.
5. **A clock that can be set anywhere, back as well as forward.** The
   fewest steps for a marker, but going back means un-living what
   happened: saved timers, bans, board lines and trust days would all be
   dated in the future, a state no replay can produce.

## Decision

We will take option 3, as the user chose it:

- **The page takes its clock from the server.** The welcome's `now` sets
  the page's clock, so the light, the street, the window, the music set
  and the board's times all follow the café's clock, not the device's.
- **A demo account can move the café's clock forward**, to the next time
  of day it asks for, at most 24 hours ahead. The server fast-forwards the
  whole café to it with the replay a sleep uses, then sends everyone the
  new time at once. The clock never goes back, across restarts too.
- **A demo account can lay out one of three furniture sets** from
  `content/`, at once, without the rate limit, by the same placement rules.
- **A demo account can add and remove bots**, visitors the server runs,
  which take seats and join the line like anyone.
- **Demo accounts' trust is seeded by the operator**, with a subcommand of
  the server's binary run over `fly ssh console`, from data in `content/`.
- **The demo accounts' login is in the README**, for markers.
- **Only a demo account can do these**, and the server checks it. The
  controls are a floating bar at the top of the room that only a demo
  account sees.

The details are [slice 17](../slices/17-markers-see-weeks-in-ten-minutes.md)'s.

## Consequences

- **Two of the café's rules change** (`AGENTS.md`). Trust still never
  fades with absence, but the operator's seed for demo accounts is the
  one way trust changes without a person's doing. And the café keeps
  Canberra's time of day only until a demo account moves it: from then it
  runs ahead of the wall clock.
- **ADR 0016 stands**: `CAFE_CLOCK_START` is still for tests and still
  refused on Fly. Its consequence that "the live café is always on the
  wall clock" no longer holds once a demo account moves it.
- **The clock's offset becomes something the café changes and saves**, not
  a constant set at start. Every timer it keeps (cats' plans, bans, the
  quiet seat, sessions, trust days, treat days, the bowls) has to come
  through a jump as it comes through a sleep, which the replay already
  does for everything but the people inside.
- **Everyone in the café lives through each jump.** Their pages wait while
  the café replays the gap, and come back at the new hour.
- **Anyone who reads the README can do what a marker can**: move the clock,
  change the furniture, fill the café with bots, and be unkind to the
  regular's cats. Jumps are limited, bots leave on their own, and the
  operator's seed can be run again, but the café's clock can be pushed
  days ahead of Canberra's and can't be brought back.
- **The demo accounts' password is public by design**, unlike the agents'
  test accounts, whose passwords are never written down. Their recovery
  codes are the user's and aren't written in the repo, so nobody else can
  change the password.
- The commits that carry it out are slice 17's.
