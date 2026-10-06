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
    Burakku (ブラック, "black") with a stray "l" beside the semicolon; asked to
    confirm, they didn't correct it, so Burakku stands.
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
    - *Default numbers, to tune:* up to three changes in a burst, then one
      every 20 seconds (relaxed from one a minute at the user's request with
      design 2). How much the floor holds is set with the room's size in the
      design.
19. **People can emote, sit together and give.** A handful of emotes (wave,
    laugh, heart, yawn) over your avatar; sharing a sofa; handing someone one
    of your treats; passing them the cat you're holding, if the cat agrees.
    (Q13)
20. **Point, then act.** Click or tap a spot to walk there; click a cat, a
    person or a piece of furniture for a small menu of what you can do. On the
    keyboard, arrow keys move the tile-snapped pointer, Tab jumps between
    things, and Enter acts. One model for mouse, touch and keys, so the
    keyboard and the phone get the whole café. (Q14)
21. **The café keeps Canberra time.** Morning light, afternoon sun, lamps in
    the evening, dim at night, and the cats keep daily rhythms to match (Mochi
    naps after lunch, Burakku prowls at night). Everyone shares the one clock,
    because it's one café in one place. (Q15)
22. **The quiet hours leave traces, and a chalkboard by the door tells the
    story.** The room shows what happened (scattered toys, a toppled plant, an
    empty treat dish, a cat asleep somewhere new), and the chalkboard notes
    what the cats got up to, day and night ("3:12am, Burakku knocked over the
    fern"; "Mochi slept on Sam's lap for 20 minutes"). It records cats'
    doings, not what people said, and is wiped each morning. (Q16)
    - *Defaults, to tune:* wiped at 7:00 Canberra time, when the café
      "opens"; shows the latest eight entries.
23. **Claude draws the pixel art as code.** Sprites are small grids of palette
    numbers on a 16-pixel grid, so recolouring is trivial. The cats share one
    base sprite with swappable coats, patterns and eye colours, so a new cat
    is data, like its character. Because sprites are data, any of it can be
    redrawn later by hand or from a pack without touching the code. (Q17)
24. **Accounts: username and password, a look, and a one-time recovery code.**
    Sign up, pick a look, walk in. No email; instead the sign-up shows a
    recovery code once, which can reset the password, so a forgotten password
    doesn't cost a regular their cats' trust. Opening the same account in a
    second tab moves you there, and the first tab says so. (Q18)
25. **Light limits on public text, plus a slur blocklist.** About 100
    characters a bubble; a few bubbles per ten seconds per person; a personal
    mute that hides someone's bubbles on your own screen; an admin ban run
    from the server, with no admin screen; and a short blocklist of slurs,
    matched as whole words. (Q19)
    - *Default numbers, to tune:* 100 characters; up to five bubbles in a
      burst, then one every two seconds (relaxed from three per ten seconds at
      the user's request with design 2).
26. **What persists and what expires.** Persists across restarts and
    redeploys: accounts and looks; each cat's trust in each person; bans until
    they expire; the furniture layout; each cat's state (where it is, what it's
    doing, how hungry and tired it is); treats used today; the night's traces
    and the chalkboard until they're cleared. Expires: speech bubbles (never
    stored), emotes, a cat's anger (it cools, and isn't stored), and who is
    inside or in line (rebuilt as people reconnect after a restart). Proposed
    as a default with questions 15 to 19; no change requested.
27. **Approach 1: a Rust server with a TypeScript canvas client.** The user
    proposed Rust knowing its benefits ("i'm well aware of the pros and that's
    why i proposed it"). To become the stack ADR with the spec.

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

Questions 15 to 19 were asked together on 2026-10-07 and answered in one
reply, which ended the clarifying questions.

15. **Day and night.** Options were Canberra time with light and cat rhythms to
    match, each visitor's own local time, or always a cozy afternoon. Answer:
    Canberra time.
16. **What the quiet hours leave behind.** Options were physical traces only;
    those plus a chalkboard by the door, wiped each morning; or nothing.
    Answer: traces plus the chalkboard.
17. **Who draws the pixel art?** Options were Claude drawing it as code, the
    user drawing base sprites for the code to recolour, or a free (CC0) pack
    with the cats drawn to match. Answer: Claude, as code.
18. **Accounts in detail.** Options were minimal with no recovery, or that plus
    a one-time recovery code shown at sign-up. Answer: with the recovery code.
19. **Safety for public text.** Options were light limits; those plus a short
    whole-word blocklist of slurs; or those plus in-app reporting. Answer: the
    limits plus the blocklist.

## Approaches, presented 2026-10-07

All three keep SQLite on the `/data` volume and one WebSocket per visitor.
The user chose 1 (decision 27).

1. **Rust server, TypeScript canvas client (recommended).** Rust (tokio and
   axum) serves the pages, `/readme/` rendered from `README.md`, accounts and
   the WebSocket, with one simulation task owning the world. The client is
   TypeScript drawing on a plain Canvas 2D, with the browser's own HTML for the
   text box, menus and a screen-reader announcer. Message types are defined
   once in Rust and TypeScript types are generated from them. Gains: the
   user's lean; tiny memory use; a fast, deterministic simulation for
   fast-forwarding hours on wake; a strict compiler that catches a class of
   agent mistakes before tests run. Costs: two languages; slow Rust builds,
   twice per push to `main` (CI's test image and Fly's deploy).
2. **TypeScript everywhere (Node server, same client).** Gains: one language,
   shared types with no generation step, fast builds, and a harness already in
   TypeScript; Node fits in 256 MB at this scale. Costs: gives up the Rust
   lean; looser guarantees; fast-forward is slower, though fine at these
   numbers.
3. **Rust everywhere (Rust compiled to WebAssembly in the browser, e.g.
   macroquad or Bevy).** Gains: one language, and the client can reuse
   simulation code. Costs: a canvas-only engine fights the browser on exactly
   what markers test (keyboard focus, text input on a phone, screen readers);
   bigger downloads; slower iteration.

## Design sections presented

### Sharing types between Rust and TypeScript

Asked how Rust can generate TypeScript, given protobuf and gRPC as the familiar
route. Answer: the same mechanism serde uses. A derive macro is a compile-time
plugin that reads a struct or enum and generates code; ts-rs's
`#[derive(TS)]` generates the TypeScript declaration from the field names and
types, honouring serde's attributes (`tag`, `rename_all`, ...), so the
TypeScript describes exactly the JSON serde emits. `#[ts(export)]` adds a
generated test, so `cargo test` writes the `.ts` files (into
`TS_RS_EXPORT_DIR`). Unlike protobuf this is code-first: the Rust types are the
schema and the wire stays JSON, readable in DevTools and in logs. Protobuf's
field-number versioning isn't needed when both ends deploy together; a build id
checked on connect makes a stale tab reload. Two guards: 64-bit integers
default to `bigint` in the TypeScript while `JSON.parse` yields numbers, so
`TS_RS_LARGE_INT = "number"`; and a check regenerates the bindings and fails if
they differ from what's committed. Alternatives doing the same job: typeshare
(a CLI that parses the Rust source) and specta. Checked against the ts-rs
README (version 12, MSRV 1.88) on 2026-10-07.

### Design 1: architecture and data flow (approved 2026-10-07)

- One Rust binary (tokio and axum) on the one machine. `/` serves the client;
  `/readme/` serves `README.md` rendered to HTML at startup, so its headings
  are in the server-sent HTML; `/api/*` handles sign-up, log-in and recovery
  with an HttpOnly session cookie; `/ws` is the WebSocket.
- The world task owns the whole café in memory (room, furniture, cats, who is
  inside and in line, trust, bans, the chalkboard). Connections send it
  commands over a channel; it handles them one at a time and steps the
  simulation ten times a second. One owner means no locks and one order of
  events that everyone sees, so "first grab wins" comes free.
- The store is SQLite on `/data`. A writer batches durable changes (accounts,
  trust, bans, furniture) into transactions; the cats' state is snapshotted
  every few seconds and on Fly's stop signal.
- The client is TypeScript built by Vite: a canvas for the room, HTML over it
  for the text box, action menus and a screen-reader announcer, and a
  WebSocket that reconnects on its own.
- Cats, furniture and sprites live in `content/` as TOML and sprite files,
  loaded at startup, so a new cat is a new file rather than new code.
- Repo layout: `server/`, `client/`, `content/`, and the existing `spec/`. The
  Dockerfile becomes three stages: build the client, build the server, copy
  both into a slim image.
- Data flow examples: a click becomes `walkTo`, the world plans a path, and
  `moved {who, path, startAt, speed}` goes to everyone; Mochi deciding to nap
  becomes `catActed` events; "Mochi!" in a bubble passes the length, rate and
  blocklist checks, goes out as `said` (never stored), counts as noise, and
  makes Mochi look up.

### Design 2: real-time behaviour (approved 2026-10-07, with relaxed limits)

- Snapshot, then events: on connect, a build-id check (a stale tab reloads),
  then a snapshot of the whole café stamped with the server's clock, then
  events in order.
- Walks are paths, not positions: each walk is sent once (path, start time,
  speed) and animated locally, which means few messages, smooth motion on a
  slow connection, and newcomers placing everyone mid-stride.
- The server decides: clients send intents, and the world checks them and
  broadcasts outcomes, which the sender renders like everyone else.
- Falling behind heals by snapshot: reconnects retry with backoff, the seat
  waits 30 seconds, and a connection too slow to keep up is dropped and
  reconnects to a fresh snapshot, so nothing is replayed.
- Public by default: everything in the room goes to everyone inside and at the
  window. Only treats left, your own trust with each cat, ban notices and the
  "still there?" nudge are yours alone; others see trust only through what the
  cats do.
- The window gets the same stream but can only send speech.
- Each connection is rate-limited before anything reaches the world task,
  with token buckets that allow a burst and then refill. The user asked to
  relax the first numbers (3 bubbles per 10 s, 1 furniture change a minute);
  the defaults are now up to 5 bubbles in a burst then one every 2 seconds,
  up to 3 furniture changes then one every 20 seconds, and 10 actions a second
  for everything else. All of them are tunable numbers.
- Calling is speaking: the "call" action puts the cat's name in a bubble, so
  the cats treat calling and saying a name the same way.

### Design 3: the cat character system (approved 2026-10-07)

- A cat is a data file (`content/cats/mochi.toml`): name, look (base sprite,
  coat palette, pattern, eyes), traits, daily rhythm, behaviour weights and
  handling parameters. A new cat is a new file; a new kind of behaviour is a
  new Rust module that cats can switch on. Balancing is editing numbers, not
  code.
- Traits are fixed per cat (0 to 1): sociability, boldness, curiosity,
  playfulness, appetite, energy, affection; plus tuning knobs for activity
  when alone (a multiplier), trust rate, temper (how fast anger rises) and
  grudge (how slowly it cools, and how long bans last).
- Needs change over time: hunger, tiredness, company, play and comfort, drifting
  at rates set by traits and the hour of the Canberra day.
- Stimuli: the world turns events into things each cat notices: someone
  arriving or leaving, the room's noise (bubbles in the last minute), its name
  in a bubble, a treat put down or offered, furniture placed or moved, being
  handled, another cat close by, someone waiting at the window.
- Choosing what to do is utility scoring. Each behaviour (wander, nap, eat,
  groom, approach someone, greet at the door, investigate, play, hide, perch at
  the window, knock something over, sit on a lap) scores itself from needs,
  traits, stimuli, trust and the hour. The cat picks among the top few,
  weighted by score: in character, not predictable. A stimulus interrupts the
  current behaviour only if it beats it by a margin, so cats don't dither.
- Being handled (pet, pick up, play, a treat, being passed): the cat answers
  from its affection, its state (asleep, eating, already held), its trust in
  the person and its anger at them. The outcomes are welcome (purr, trust up),
  tolerate, refuse (walk off or hiss, anger up), scratch and escape (trust
  down), or, when furious, a ban on that action from that person for as long
  as its grudge lasts. A banned action is refused with the time left.
- Trust runs 0 to 100 per cat per person, with levels that unlock behaviours:
  comes when called; then greets you at the door and sits by you; then naps on
  your lap and puts up with being carried longer. It never fades, and gains
  taper within a day, so regular visits beat one long session: it rewards
  regulars rather than grinding.
- Anger is per cat per person and held in memory only: it rises by temper and
  cools by grudge.
- Effects on the world: a cat lying on furniture claims it (moving it makes the
  cat jump off, annoyed); cats knock things over and scatter toys (the night's
  traces); notable moments become chalkboard lines; cats notice each other,
  napping together or keeping their distance.
- The same rules run live and in fast-forward, with one seeded random generator
  for the whole world. With nobody there, behaviours that need people aren't
  on offer and the alone-activity trait takes over: that is how Burakku's
  night happens. Seeded randomness also makes every behaviour reproducible in
  tests.
- The first three in these terms:
  - **Mochi:** naps after lunch and at night; sleeps more when alone; seeks
    everyone and is first to any treat; trusts quickly; grudges last hours.
  - **Burakku:** nocturnal; prowls and knocks things over when alone; hides
    when the room is noisy; trusts slowly and is devoted after; grudges last
    two days.
  - **Tora:** dawn and dusk zoomies (real cats are crepuscular); the same alone
    or not; first to new furniture; won over by play, bored by petting, quick to
    swat; grudges last hours.

### Design 4: persistence and fast-forward (presented 2026-10-07, *awaiting approval*)

- One SQLite file on the volume (`/data/cafe.db`, WAL mode), owned by one
  writer thread so the world task never waits on the disk. Tables: users,
  sessions, trust, bans, furniture, treats, mutes, chalkboard and traces, the
  cats' state, and a small key-value table for the world clock and the random
  generator's state. Schema changes are numbered migrations compiled into the
  binary and run at startup.
- What people change (accounts, trust, bans, furniture, treats, chalkboard
  lines) is written within a fraction of a second, batched into transactions.
  The cats' state, the world clock and the random state are saved every 5
  seconds and on Fly's stop signal. A crash loses at most a few seconds of cat
  wandering, never a trust gain or a moved sofa.
- Fly's stop, including an idle auto-stop, sends SIGINT and waits a
  best-effort 5 seconds before forcing the process down (checked in Fly's
  configuration reference, 2026-10-07), so the final save must be quick and
  the 5-second periodic save is the real safety net.
- Waking: load everything; the gap is now minus the saved world clock; run the
  same step function in one-second steps until caught up (8 hours is about
  29,000 steps, milliseconds in Rust); then open the doors. Gaps over a week
  replay only the last week, since by then the cats' needs have settled. The
  café's own schedule runs during catch-up: bowls refill, treats reset at
  midnight Canberra time, old chalkboard lines drop off.
- Redeploys are short sleeps: the old machine saves on the stop signal, the
  new one loads and fast-forwards a few seconds, clients reconnect, and a tab
  on the old build reloads.
- When things go wrong: a bad message gets an error, never a crash; a panic
  exits the process and Fly restarts it from the last save; if the database
  can't open at startup, the server fails loudly instead of serving an empty
  café. Fly's daily volume snapshots, kept 5 days by default, are the backup
  (checked in Fly's volume docs, 2026-10-07).
- **A correction to decision 22's defaults, proposed.** A chalkboard wiped at
  7:00 would erase the night before the morning's first visitor reads it, and
  staff tidying at opening would do the same to the traces. Proposal: the
  board keeps a rolling 24 hours, and traces stay until someone tidies them
  (standing the plant back up is just moving furniture), which makes tidying
  a small thing regulars do for each other.

### Design 5: accounts and safety (presented 2026-10-07, *awaiting approval*)

- Sign-up: a username (3 to 20 letters, digits, `_` or `-`, unique ignoring
  case, and shown to everyone, which the form says), a password (8 to 128
  characters, no composition rules), and a look from a few preset avatars and
  colours. The recovery code (16 characters, like `K7QF-2M9D-XR4T-8HWC`) is
  shown once, with a copy button; then you walk in.
- Recovery: username, recovery code and a new password reset the password,
  issue a fresh code and sign out other sessions.
- Passwords and recovery codes are hashed with argon2id, with at most two
  hashes running at once so a burst of log-ins can't exhaust 256 MB. Sessions
  are random tokens in an HttpOnly, Secure, SameSite=Lax cookie, stored
  hashed, lasting 30 days from last use.
- Log-in, recovery and sign-up are rate-limited per name and per IP address.
  `/api/*` and the WebSocket check the Origin header, so another site can't
  act with your cookie.
- Two tabs on one account: the newest takes over; the older says so and
  closes.
- Public text: bubbles up to 100 characters; design 2's rate limits; a
  whole-word slur blocklist in `content/blocklist.txt` (a blocked bubble
  isn't shown, and the sender is told why); mute is stored with the account,
  so the server stops sending you that person's bubbles on any device.
- Admin ban: a subcommand of the same binary, run over `fly ssh console`. The
  account can't log in and its open sessions close.
- A privacy rule for the harness: no email, no IP addresses stored, and bubble
  text is never written anywhere, neither the database nor the logs. The C10
  logs record that someone spoke, not what they said, which keeps decision
  11's "nothing said is stored" true.

## Still to come

- Approval of designs 4 and 5, and of the chalkboard and traces correction.
- The rest of the design: the client (rendering, sprites as data, pointer
  input, layouts at 390×844 and 1920×1080), shown as mockups if the user wants
  the visual companion; logging and testing, including which README promises
  `spec/` enforces.
