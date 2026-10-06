# 0010. Keep speech public and fleeting

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

People talk by typing; the words appear as a bubble over the speaker's head.
The brief marks down "a chat room with the nouns swapped", and both the app and
its repo are public. Some people read slowly or use a screen reader, so a
bubble that vanishes can be missed.

## Options

1. **Public and fleeting.** Everyone inside and at the window sees every
   bubble; it fades after a time that grows with its length; nothing said is
   stored on the server. The browser keeps a short list of the current visit's
   bubbles for anyone who missed one. It works like a café: you overhear, and
   if you weren't there it's gone, so attention stays on who is here now. The
   lasting trace stays with the cats, and there is nothing to moderate after
   the fact or to leak. The cost: no history for latecomers, and moderation
   has to work in the moment.
2. **Public, with a saved history** anyone can scroll back through. Latecomers
   can catch up, but the café drifts into a chat room, and stored speech has to
   be moderated and protected.
3. **Private when addressed.** Clicking someone's avatar opens a whisper only
   they see. Private conversations, but they pull people out of the shared room
   into side channels, and hidden speech is harder to moderate.

## Decision

We will keep speech public and fleeting, and never store or log what anyone
says.

## Consequences

- Clicking someone's avatar addresses your bubble to them (their name shows on
  it); Enter with nothing selected talks to the room.
- A bubble shows for 3 seconds plus 60 ms per character, up to 10 seconds; it
  holds up to 100 characters; bubbles pass a burst limit; a short whole-word
  blocklist stops slurs; mute is stored with the account; an admin can ban an
  account. All the numbers are tunable.
- The C10 logs record that someone spoke, its length and who it was addressed
  to, never the words. `AGENTS.md` makes this a rule.
- The cats hear bubbles, but only as the room's noise and as their own names;
  matching a cat's name is the only thing the server reads in a bubble.
- The commits that carry it out will be linked here as they land.
