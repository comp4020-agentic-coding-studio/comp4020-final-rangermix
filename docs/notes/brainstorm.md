# Brainstorm: the cat café

Working state for the design conversation that started on 2026-10-07 (session
`2ae45b1d`). Nothing here is settled. Once a decision is made it moves to
`docs/design.md`, with an ADR if it's significant; the prompt log keeps the
exchange verbatim.

## The idea as given

- A 2D pixel-art online cat place, inspired by Neko Atsume and real cat cafés.
  It can be read as a game or as a social place.
- Many people online at once. When someone comes online, their avatar walks in
  through the door.
- People talk by clicking an avatar and typing; the words appear as a speech
  bubble over the speaker's head.
- Three cats to start, each with its own look and character.
- Furniture (a sofa, a bed, ...) that people can use and rearrange.
- People interact with the cats and with each other.
- The cats act on their own: they use the furniture and approach people
  occasionally and selectively, according to character. They react, in
  character, to changes: someone entering, food being put down, new furniture
  appearing.
- The server is the source of truth for everything live (cat actions and
  movement, furniture positions, people's actions), over a WebSocket both ways.

## Constraints that bite this idea

The full list is in [brief-and-crits.md](brief-and-crits.md). These are the ones
that shape this design most:

- **The machine sleeps when nobody is connected**, so server-run cats stop
  too. What the café looks like after a quiet night has to be designed, not
  left to chance.
- **256 MB of memory and one volume**, so the simulation and storage stay small.
- **Markers do a keyboard-only pass and use a 390×844 phone viewport**, so a
  canvas game needs a keyboard path and a touch path to everything.
- **"A chat room with the nouns swapped" is marked down.** The cats have to be
  why the place is worth visiting, not decoration around a chat.
- **The showcase is a full room at once**, so the café needs an answer for
  forty people arriving together.
- **C9 needs one written decision about several people at once**, and C10
  needs one server log line per user action.

## Assumptions to confirm

- It runs in the browser with no install, with pixel art drawn on a canvas.
- There is one shared café, not a private room per person.
- The cats are rule-based characters run by the server, not driven by an LLM.
- Identity is light: pick a name and a look, and the browser remembers you. No
  passwords.
- The cats remember people across visits. That is the most natural "trace
  still there when they come back" for C8.

## Questions and answers

1. **What should a visitor walk away with after ten minutes?** Asked
   2026-10-07; options were company around the cats, a bond with particular
   cats, a place made together, or a cozy hangout for friends. *Awaiting an
   answer.*

## Questions still to ask, roughly in order

- Who is it for, and at what scale? What happens when the café is full?
- What counts as a person: a name and a look remembered by the browser,
  or something stronger?
- Talking: does clicking an avatar address that person, or is every bubble
  public? Do bubbles vanish, or is there a log?
- Moving: click-to-walk, keys, or both? How do keyboard-only and touch work?
- The three cats: their looks, their characters, what each one wants, and how
  each chooses whom to approach.
- What people can do with cats (pet, feed, play, call) and how each cat answers.
- Furniture: the catalogue, who may rearrange it, what limits it, and what
  happens when two people move the same thing at once.
- What people can do with each other besides talk.
- The world while nobody is there: does time pass, is there day and night?
- What persists and what expires: furniture, cat memory, bubbles, presence.
- Art: who draws the pixel art (an asset pack, our own, or generated), and how
  many animations per cat.
- Safety for public text: limits, rate, muting.
- Then the approaches (stack, rendering, simulation, storage) and the design
  sections.
