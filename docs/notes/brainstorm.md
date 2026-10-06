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
approved. Defaults marked "to tune" were proposed and stood when the user was
asked; the numbers can change without reopening the decision.

1. **The heart is company around the cats.** Strangers end up talking because
   of what the cats do; the café should get better with more people in it. The
   cats remembering each person supplies the lasting trace, and furnishing the
   café together is how the room changes. (Q1)
2. **The world never stops, as far as anyone can tell.** The cats go on moving
   and acting whether or not anyone is there. Character decides how: some cats
   are more active when no humans are around, some less. The course's
   `fly.toml` stops the machine when nobody is connected and every deploy
   restarts it, so the server saves the world and, on waking, fast-forwards
   the simulation through the time it was down, with the same rules (as Neko
   Atsume does while the app is closed). Cats that are busier alone leave
   traces for the first visitor. Turning auto-stop off was rejected: it goes
   against a setting the course chose and wouldn't cover deploys. (Accepted
   with Q2; to become an ADR in the approaches step.)
3. **The roster will grow past three cats**, so cat characters and their
   effects are a modular system, not three hand-written cats.
4. **The server is in a compiled language such as Rust** (the user's lean;
   memory is no worry then). To be weighed against alternatives in the
   approaches step and recorded as an ADR.
5. **Keyboard-only use goes through a keyboard-controlled pointer**, so
   everything a mouse can do, the keyboard can. The pointer snaps to tiles,
   and Tab jumps between things you can act on (accepted with Q14).
6. **Accounts are a minimal username-and-password system**, not an identity
   the browser remembers.
7. **No deadline pressure.** The C8 cutoff doesn't shape the design.
8. **It's for people who miss having a cat, and for a small group of regulars
   who make it their café.** Visitors drop in for a few minutes of cat time;
   some come back often enough that the cats, and each other, know them. So
   the café has to be good with one to three people in it, regulars need to
   be recognisable, and the showcase crowd is the stress test, not the
   audience. (Q2: "A & C")
9. **At most six people inside, for now; everyone else waits at the window.**
   The cap is for the cats, as in a real café, and six is a starting number,
   not a fixed one. People waiting appear as avatars at the front window. They
   see the same view as the people inside, but the only thing they can do is
   talk. (Q3)
10. **A quiet seat frees up only when someone is waiting.** If a visitor's tab
    is hidden, or they haven't touched anything for a while, and someone is at
    the window, they get a "still there?" nudge; with no answer, their avatar
    walks out the door and the first person in line walks in. With nobody
    waiting, anyone can stay as long as they like. Giving up your seat to
    someone at the window wasn't chosen. (Q4)
    - *Default numbers, to tune:* a dropped connection keeps its seat for 30
      seconds; "gone quiet" means the tab hidden for 2 minutes or no input for
      10; the nudge waits 60 seconds for an answer.
    - *The line:* first come, first served. The window shows as many waiting
      avatars as fit along it, and a count ("+12 waiting") for the rest. When
      a seat frees, the first in line walks in through the door.
11. **Speech bubbles are public and fleeting.** Everyone inside and at the
    window sees every bubble, and nothing said is stored on the server.
    Clicking someone's avatar addresses your words to them (their name shows
    on your bubble); Enter with nothing selected talks to the room. The
    browser keeps a short list of recent bubbles for the current visit only,
    for anyone who reads slowly or missed one. A bubble stays up longer the
    longer the message is. (Q5, with the user's addition of length-based
    fading)
    - *Default numbers, to tune:* a bubble shows for 3 seconds plus 60 ms per
      character, capped at 10 seconds.
12. **The cats react to talk: to the room's noise and to their names.** How
    busy the room's chatter is becomes a mood the cats feel by character: a
    chatty café sends shy cats into hiding and draws social ones in, and a
    quiet one coaxes the shy ones out. A cat's name in a bubble makes it look
    up, and come over if it trusts the speaker. The server matches cat names
    in bubbles and reads nothing else. (Q6)
13. **People can pet, call, feed, play with, and pick up and carry a cat.** A
    cat that doesn't like what's happening scratches and jumps off. (Q7)
    - *Carrying:* how long a cat puts up with being held depends on its
      character and its trust in the holder, so nobody can keep a cat from the
      room for long. A held cat always jumps down at the door.
14. **Trust is per person and per cat, and it never fades.** It grows with
    welcome interactions and dips when someone pushes (petting a cat that's
    leaving, calling it over and over). Being away never costs trust. It shows
    to everyone: a trusting cat greets you at the door, comes when called,
    sits by you, and eventually naps on your lap. (Q8)
15. **The first three cats are Mochi, Burakku and Tora.** (Q9, the proposal
    with two renames.) The black cat was first renamed "Buraku"; told that the
    spelling reads in Japanese as 部落, a word tied to discrimination against
    the burakumin, the user renamed her again. They typed "burakkul;", read as
    Burakku (ブラック, "black") with a stray "l" beside the semicolon; to
    confirm.
    - **Mochi:** round, white and grey; sociable and greedy; goes where the
      people and food are; naps more when the café is empty.
    - **Burakku:** black and shy; hides when the room is busy and explores
      when it's empty, so she leaves the night's traces; slow to trust,
      devoted once won.
    - **Tora:** an orange tabby; curious and playful; first to inspect new
      furniture, chases toys, knocks things over; tolerates petting, loves
      play.
16. **The café fills the bowls on a schedule, and each visitor has a few treats
    a day** to put down or offer by hand. No cat goes hungry because nobody
    came, and each cat rushes, waits or ignores a treat by character. (Q10)
    - *Default number, to tune:* three treats per visitor per day.
17. **No hard café rules: the cats enforce their own boundaries, firmly.** How
    a cat reacts to unwelcome handling differs by cat, and a really angry cat
    bans that person from that action for a while, such as no picking up for
    two days. (Q11, with the user's addition)
    - *How anger works:* each cat's anger toward a person rises with unwelcome
      actions (waking it, holding it too long, chasing it, pushing an action it
      dislikes) and cools with time. Mildly annoyed, it walks off or hisses.
      Angry, it scratches and jumps off, and trust dips. Furious, it refuses
      that action from that person for a while, with the length set by its
      character (Tora forgets in hours; Burakku holds a grudge for two days).
      Bans are per cat, per person and per action, and they persist across
      visits.
18. **Anyone inside can rearrange the café**, from a free catalogue, within
    gentle limits: each person can make one change every minute or so, the
    door and walkways always stay clear, and the floor only holds so much. A
    cat on a piece that gets moved jumps off, annoyed. (Q12)
    - *Two people grabbing the same piece:* the first grab wins. The piece
      lifts into that person's hands, everyone sees it being carried, and if
      they disconnect it drops back where it was. A C9 candidate, alongside
      the quiet-seat rule.
    - *Default number, to tune:* one change per person per minute. How much
      the floor holds is set with the room's size in the design.
19. **People can emote, sit together and give.** A handful of emotes (wave,
    laugh, heart, yawn) over your avatar; sharing a sofa; handing someone one
    of your treats; passing them the cat you're holding, if the cat agrees.
    (Q13)
20. **Point, then act.** Click or tap a spot to walk there; click a cat, a
    person or a piece of furniture for a small menu of what you can do. On the
    keyboard, arrow keys move the tile-snapped pointer, Tab jumps between
    things, and Enter acts. One model for mouse, touch and keys, so the
    keyboard and the phone get the whole café. (Q14)

## Proposed, awaiting the user

- **What persists and what expires, by default.** Persists across restarts and
  redeploys: accounts and looks; each cat's trust in each person; bans until
  they expire; the furniture layout; each cat's state (where it is, what it's
  doing, how hungry and tired it is); treats used today; and whatever the
  quiet hours leave behind (Q16). Expires: speech bubbles (never stored),
  emotes, a cat's anger (it cools, and isn't stored), and who is inside or in
  line (rebuilt as people reconnect after a restart). Asked alongside
  questions 15 to 19.

## Assumptions not contested

- It runs in the browser with no install, with pixel art drawn on a canvas.
- There is one shared café, not a private room per person.
- The cats are rule-based characters run by the server, not driven by an LLM.

## Questions and answers

1. **What should a visitor walk away with after ten minutes?** Answer: company
   around the cats at the heart; the cats remembering you as the lasting
   trace; furnishing together as how the room changes ("exactly what i
   thought").
2. **Who is the café for?** Options were people who miss having a cat, the
   class at the showcase, a small group of regulars, or cozy-game players.
   Answer: people who miss having a cat, and a small group of regulars.
   Fast-forward on wake was accepted in the same reply.
3. **How many people inside at once, and what happens when it's full?** Options
   were a cap of about twelve with a window to watch from, no cap with cats
   reacting to the crowd, several cafés with their own cats, or one café with
   several capped rooms. Answer: the cap with a window, at six for now; people
   waiting show as avatars at the window, see the same view, and can only
   talk.
4. **When the café is full and someone is waiting, what happens to a seat held
   by someone who has gone quiet?** Options were stepping out after a nudge
   only when someone is waiting, timed visits while there's a line, never
   moving anyone, or giving up your seat to someone at the window. Answer:
   stepping out after a nudge, only when someone is waiting.
5. **What does a speech bubble reach, and how long does it last?** Options
   were public and fleeting (with a list of recent bubbles kept only in the
   browser for the visit), public with a saved history, or private when
   addressed to someone. Answer: public and fleeting, with the fade delay
   adjusted to the message's length.
6. **Do the cats react to talk?** Options were to noise and names, to names
   only, to noise only, or not at all. Answer: to noise and names. In the same
   reply the user asked for several questions per message from here on.

Questions 7 to 11 were asked together on 2026-10-07 and answered in one reply.

7. **What can a person do with a cat?** Options were pet, call, feed and play,
   each of which a cat can refuse; that plus picking up and carrying; just pet
   and feed; or more verbs. Answer: the four plus picking up and carrying; a
   cat that doesn't like it scratches and jumps off.
8. **How does trust work?** Options were per person and per cat, never fading
   and visible to everyone; the same but fading with absence; or shared by the
   whole café. Answer: per person and per cat, never fading.
9. **The first three cats.** Options were the user describing them, or the
   proposal of Mochi, Sumi and Kaki. Answer: the proposal, with Sumi renamed
   Buraku and Kaki renamed Tora.
10. **Food and treats.** Options were scheduled bowls plus a few treats per
    visitor per day; anyone filling bowls any time; or visitors as the only
    feeders. Answer: scheduled bowls plus a few treats a day.
11. **Café rules.** Options were enforcing a few house rules in the mechanics,
    or no hard rules with cats reacting badly. Answer: no hard rules, with
    strong negative feedback: each cat reacts its own way, and a really angry
    cat bans that person from that action for a while.

Questions 12 to 14 were asked together on 2026-10-07 and answered in one
reply, which also renamed Buraku to Burakku (decision 15).

12. **Who can rearrange the café?** Options were anyone inside within gentle
    limits, anyone a cat trusts, or each person only their own pieces. Answer:
    anyone inside within gentle limits.
13. **What can people do with each other besides talk?** Options were emotes and
    sitting together; that plus giving treats and passing a cat; or talk only.
    Answer: emotes and sitting together, plus giving.
14. **How do people move and act?** Options were point-then-act across mouse,
    touch and keyboard; walking with keys while the pointer only acts; or seats
    instead of free walking. Answer: point, then act.

Questions 15 to 19 were asked together on 2026-10-07. *Awaiting answers.*

15. **Day and night.** The café keeps Canberra time, with light and cat
    rhythms to match; each visitor sees their own local time; or it's always a
    cozy afternoon.
16. **What the quiet hours leave behind.** Physical traces only (scattered toys,
    a toppled plant, a cat asleep somewhere new); those plus a chalkboard by
    the door where the café notes what the cats got up to, wiped each morning;
    or nothing, because the staff tidy up.
17. **Who draws the pixel art?** In every option the cats share one base sprite
    with swappable coats, patterns and eye colours. Claude draws it as code
    (palette-indexed pixel grids); the user draws the base sprites and the
    code recolours them; or a free (CC0) pack for the room, furniture and
    avatars, with the cats drawn to match.
18. **Accounts in detail.** Minimal: username and password, pick a look, no
    recovery, and a second tab takes over from the first; or that plus a
    one-time recovery code shown at sign-up.
19. **Safety for public text.** Light limits (about 100 characters a bubble, a
    few bubbles per ten seconds, a personal mute, and an admin ban from the
    server); those plus a short whole-word blocklist of slurs; or those plus
    in-app reporting.

## Still to come

- Whatever questions 15 to 19 raise.
- Then the approaches (stack, rendering, simulation, storage) and the design
  sections, including the cat character system: traits, needs, reactions to
  events, effects on the room and other cats, and cats defined as data.
