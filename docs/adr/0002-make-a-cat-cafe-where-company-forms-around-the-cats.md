# 0002. Make a cat café where company forms around the cats

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The brief asks for a multi-user, real-time website that's good, designed so
it is more interesting because other people are using it at the same time. It
marks down "a chat room with the nouns swapped" and features with no reason to
exist, whether or not the checks pass.

The starting idea was a 2D pixel-art online cat place, inspired by Neko Atsume
and real cat cafés, that could be read as a game or as a social place: avatars
walking in through a door, speech bubbles, three cats with their own
characters, furniture to use and rearrange, and cats that act on their own and
react to what people do. That idea holds several possible apps. The decision
is which one is the heart, the thing that wins when features pull apart, and
who it is for.

## Options

1. **Company around the cats.** Strangers end up talking because of what the
   cats do, and the cats react to the crowd as well as to individuals. It
   answers the brief's co-presence directly: the café gets better with more
   people in it. It costs the most engineering, because the cats have to be
   good enough to carry the place, and they must still be worth visiting when
   only one or two people are there.
2. **A bond with particular cats.** Each cat gets to know you over visits, and
   coming back is the point, as in Neko Atsume. It gives a strong reason to
   return, but other people become background: a mostly solitary game is a
   weak answer to a multi-user brief.
3. **A place made together.** Furnishing the café is the core loop, and the
   cats' choices show whether the room suits them. It gives a visible shared
   history, but conflicts over furniture become the main event and the cats
   become judges or decoration.
4. **A cozy hangout for friends.** A cute place to be online with people you
   know, with the cats as atmosphere. It is the simplest to build and the
   closest to a chat room with the nouns swapped.

For the audience, the options were people who miss having a cat, the class at
the showcase, a small group of regulars, and cozy-game players.

## Decision

We will build a cat café whose heart is company around the cats (option 1),
with the cats' memory of each person (from option 2) as the lasting trace and
furnishing together (from option 3) as how the room changes. It is for people
who miss having a cat and for a small group of regulars who make it their
café; the showcase crowd is the stress test, not the audience.

## Consequences

- The cats' character system is the core of the work
  ([ADR 0011](0011-drive-cats-with-data-defined-characters.md)).
- The café has to be good with one to three people in it, so the cats need a
  life of their own in a near-empty room: activity when alone, and traces of
  the night.
- Regulars have to be recognisable, so trust is per person and shows in how the
  cats behave toward them.
- Talk stays light and fleeting
  ([ADR 0010](0010-keep-speech-public-and-fleeting.md)); the lasting trace
  is the cats' memory, not a transcript.
- Out of scope because they don't serve company around the cats: currency,
  collecting, progression, chat history.
- Revisit if the C9 pod session or the showcase shows strangers don't in fact
  talk because of the cats.
- The commits that carry it out will be linked here as they land.
