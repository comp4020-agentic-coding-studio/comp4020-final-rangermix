# Brainstorm: the cat café

Working state for the design conversation that started on 2026-10-07 (session
`2ae45b1d`). Nothing here is settled until the design is approved; then it
moves to `docs/design.md`, with an ADR for each significant decision. The
prompt log keeps the exchange verbatim.

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

## Decided in conversation so far

These are the user's answers. They move to `docs/design.md` once the design is
approved.

1. **The heart is company around the cats.** Strangers end up talking because
   of what the cats do; the café should get better with more people in it. The
   cats remembering each person supplies the lasting trace, and furnishing the
   café together is how the room changes. (Q1)
2. **The world never stops.** The cats go on moving and acting whether or not
   anyone is there. Character decides how: some cats are more active when no
   humans are around, some less.
3. **The roster will grow past three cats**, so cat characters and their
   effects are a modular system, not three hand-written cats.
4. **The server is in a compiled language such as Rust** (the user's lean;
   memory is no worry then). To be weighed against alternatives in the
   approaches step and recorded as an ADR.
5. **Keyboard-only use goes through a keyboard-controlled pointer**, so
   everything a mouse can do, the keyboard can.
6. **Accounts are a minimal username-and-password system**, not an identity
   the browser remembers.
7. **No deadline pressure.** The C8 cutoff doesn't shape the design.

## Proposed, awaiting the user

- **How decision 2 meets `fly.toml`.** The course config stops the machine a
  few minutes after the last connection closes, and every deploy restarts it.
  Proposal: the world never stops *as far as anyone can tell*. The server saves
  the world and, on waking, fast-forwards the simulation through the time it
  was down, with the same rules (Neko Atsume works this way: cats visit while
  the app is closed). Cats that are more active when nobody is around leave
  traces for the first visitor. The alternative, turning auto-stop off, goes
  against a setting the course chose ("most of why the app costs cents, not
  dollars") and still wouldn't cover deploys. To become an ADR in the
  approaches step.
- **A refinement of decision 5.** The pointer snaps to tiles, and Tab jumps
  between things you can act on (cats, people, furniture), so no one nudges a
  cursor pixel by pixel. To settle with the controls question.

## Assumptions not contested

- It runs in the browser with no install, with pixel art drawn on a canvas.
- There is one shared café, not a private room per person.
- The cats are rule-based characters run by the server, not driven by an LLM.

## Questions and answers

1. **What should a visitor walk away with after ten minutes?** Answer: company
   around the cats at the heart; the cats remembering you as the lasting
   trace; furnishing together as how the room changes ("exactly what i
   thought").
2. **Who is the café for?** Asked 2026-10-07; options were people who miss
   having a cat, the class at the showcase, a small group of regulars, or
   cozy-game players. *Awaiting an answer.*

## Questions still to ask, roughly in order

- Scale: how many people inside at once, and what happens when it's full?
- Talking: does clicking an avatar address that person, or is every bubble
  public? Do bubbles vanish, or is there a log? Do cats react to a noisy room?
- Moving and controls: click-to-walk, keys, or both; the keyboard pointer; touch
  on a 390×844 phone.
- The cat character system: traits, needs, reactions to events, effects on the
  room and other cats; activity with and without people; the first three cats'
  looks and characters.
- Trust: how a cat comes to know you, what trust unlocks, whether it fades.
- Food and treats: who can feed, and what limits it.
- Furniture: the catalogue, who may change it, what limits it, cats sitting on
  it, and two people moving the same thing at once.
- What people can do with each other besides talk.
- Time: is there day and night, and on whose clock? What traces does the night
  leave?
- What persists and what expires: furniture, cat memory, bubbles, presence.
- Art: who draws the pixel art, and whether looks are modular too (one base cat
  with coats and patterns) to match the modular characters.
- Accounts in detail: the sign-up path, one account in two tabs, no password
  recovery without email.
- Safety for public text: length, rate, muting.
- Then the approaches (stack, rendering, simulation, storage) and the design
  sections.
