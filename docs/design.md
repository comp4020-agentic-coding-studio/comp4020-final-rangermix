# Settled design

Every decision fixed so far, each with its reason. `AGENTS.md` holds the rules;
this holds the specification: what is true now. The reasoning and rejected
options behind the big decisions live in `docs/adr/`. Working state belongs in `docs/notes/`, not here.

The app's design was settled in one conversation on 2026-10-07, recorded in
[notes/brainstorm.md](notes/brainstorm.md), and the user approved it as written
the same day. The order it's built in is [notes/plan.md](notes/plan.md).
Numbers marked *tunable* are
starting values: changing one doesn't reopen its decision. They are collected
under [Numbers to tune](#numbers-to-tune).

## The café

- **An online cat café in pixel art.** One shared café in the browser, inspired
  by Neko Atsume and real cat cafés, readable as a game or as a place to be.
  ([ADR 0002](adr/0002-make-a-cat-cafe-where-company-forms-around-the-cats.md))
- **Its heart is company around the cats.** Strangers end up talking because
  of what the cats do, so the café gets better with more people in it. The
  cats remembering each person is the lasting trace, and furnishing the café
  together is how the room changes. When features pull apart, this wins.
  *Why:* the brief asks for an app that is more interesting because others are
  there, and marks down a chat room with the nouns swapped; here the cats are
  why people come, and talk follows from them.
- **It's for people who miss having a cat, and for regulars who make it
  theirs.** Visitors drop in for a few minutes of cat time; some come back
  often enough that the cats, and each other, know them. So the café has to be
  good with one to three people in it, regulars have to be recognisable, and
  the showcase crowd is the stress test, not the audience.
- **Six inside, the rest at the window.** At most six people are inside
  (*tunable*), for the cats' sake, as in a real café. Everyone else waits as an
  avatar at the front window, sees the same view and can only talk. The line
  is first come, first served; the window shows as many waiting avatars as fit
  and a count for the rest; when a seat frees, the first in line walks in
  through the door.
  ([ADR 0008](adr/0008-cap-the-cafe-at-six-with-a-line-at-the-window.md))
- **A quiet seat frees up only for someone waiting.** If a visitor's tab is
  hidden or they haven't touched anything for a while, and someone is at the
  window, they get a "still there?" nudge; with no answer, their avatar walks
  out and the first in line walks in. With nobody waiting, anyone can stay as
  long as they like. *Why:* sitting quietly with a cat is what the café is for,
  but a forgotten tab shouldn't hold a sixth of it. This is crit 9's recorded
  decision about several people at once.
  ([ADR 0009](adr/0009-free-a-quiet-seat-only-when-someone-is-waiting.md))
  The page tells the server when its tab is hidden or shown, and, at most
  every 30 seconds, that someone touched it; any message counts as an
  answer, except "my tab is hidden". An unanswered nudge frees the seat at
  once: the first in line walks in while the quiet visitor walks out the
  door, and their page says why and offers to come back, which joins the
  line. A dropped connection is left to the grace period instead.
- **The world never stops, as far as anyone can tell.** The cats go on living
  whether or not anyone is there. When the machine has been stopped (idle,
  deploy or crash), the server fast-forwards through the gap on waking.
  ([ADR 0006](adr/0006-fast-forward-the-world-when-the-server-wakes.md))
- **It keeps Canberra time.** Morning light, afternoon sun, lamps in the
  evening, dim at night, and cats with daily rhythms to match. *Why:* one café
  in one place has one clock, and a night visit becomes a different visit.
  A demo account can move that clock on, never back; from then the café
  runs ahead of Canberra's wall clock
  ([Showing it to markers](#showing-it-to-markers); slice 17, part 1
  built). Accounts and their sessions keep Canberra's own clock, so a jump
  logs nobody out.

## People

- **Accounts:** a username, a password and a look, with a one-time recovery
  code shown at sign-up. Details under [Accounts and safety](#accounts-and-safety).
  ([ADR 0007](adr/0007-use-password-accounts-with-a-recovery-code.md))
- **Arriving:** your avatar walks in through the door if there's a seat, or
  joins the line at the window.
- **Leaving:** a Leave button walks you out at once and frees your seat for the
  next in line; closing the tab or losing the connection keeps the seat for the
  grace period.
- **Talking is public and fleeting.** Everyone inside and at the window sees
  every bubble, and nothing said is stored or logged. Clicking someone's avatar
  addresses your words to them (their name shows on your bubble); Enter with
  nothing selected talks to the room. A bubble stays up longer for a longer
  message. The browser keeps a short list of the current visit's bubbles for
  anyone who missed one.
  ([ADR 0010](adr/0010-keep-speech-public-and-fleeting.md))
- **With cats:** pet, call, feed a treat, play, and pick up and carry. Calling
  a cat puts its name in a bubble, so to the cats calling and saying the name
  are the same thing. A cat can refuse any of it; see [The cats](#the-cats).
- **With each other:** emotes (wave, laugh, heart, yawn), sharing a sofa,
  handing someone one of your treats, and passing them the cat you're holding,
  if the cat agrees.
- **Rearranging:** anyone inside can place, move and remove furniture from a
  free catalogue, within limits: a rate limit (*tunable*), a door walkway that
  always stays clear, and a floor that holds only so much (*tunable*). The
  first person to grab a piece holds it, everyone sees it being carried, and if
  they disconnect it drops back where it was. A cat lying on a piece that's
  moved jumps off, annoyed. In detail: grabbing walks you over and lifts the
  piece, and reserves it from the moment the server accepts the grab, so the
  second person to reach for it is told who has it; putting it down walks
  you beside the spot; Put it back returns it (a new piece just goes) and
  Put it away removes it; the catalogue puts a new piece in your hands.
  Every rule is the server's: on the floor, never on the door's walkway, no
  overlap except on a rug, and a piece that blocks never lands on someone
  standing or heading there, never cuts any floor off from the door, and
  never leaves a cat's bed out of reach. The arrangement is saved by kind
  and place. (plan-phase-2.md, decisions 3 to 7.)
- **Sitting:** the sofa, chairs, window seat and cushion seat one person to
  a tile, so two can share the sofa; any walk stands you up, and a piece
  someone sits on can't be carried.
- **Treats:** the café fills the bowls on a schedule, so no cat goes hungry
  because nobody came, and each visitor has a few treats a day (*tunable*) to
  put down or offer by hand. *Why:* scarcity makes a treat a choice, and stops
  a crowd flooding the floor with food. A treat goes down at your feet, or is
  handed to someone inside (it joins their day's treats); used and received
  treats are stored per Canberra day, treats on the floor are not. The bowls
  hold three portions; a hungry cat eats one, and the treat's giver gains a
  little trust when a cat eats a treat they put down. At Canberra midnight
  everyone in the café is told their new day's treats.
- **Controls: point, then act.** Click or tap a spot to walk there; click a
  cat, a person or a piece of furniture for a menu of what you can do. On the
  keyboard a pointer snaps to tiles: arrows move it, Tab and Shift+Tab cycle
  through nearby things, Enter acts or opens the menu, Esc closes it, and Enter
  with nothing selected goes to the talk box. *Why:* one model for mouse, touch
  and keyboard means the keyboard-only pass and the phone get the whole café.
  A piece people walk over (one that doesn't block, such as the rug or a
  cushion) is somewhere to go: a click or tap on it walks you onto it, and a
  click on the tile you stand on, or are already walking to, opens its menu;
  Tab and Enter open it at once. *Why:* the rug fills twelve tiles of the
  middle of the room, and a click there used to open a menu that only moves
  it, so nobody could stand on it (the user's ask, 2026-11-05;
  [notes](notes/walk-onto-rugs.md)).

## The cats

([ADR 0011](adr/0011-drive-cats-with-data-defined-characters.md))

- **A cat is a data file** in `content/cats/`: name, look (base sprite, coat,
  pattern, eyes), traits, daily rhythm, behaviour weights and handling
  parameters. A new cat is a new file; a new kind of behaviour is a Rust module
  that cats can switch on; balancing is editing numbers.
- **Traits** are fixed per cat, from 0 to 1: sociability, boldness, curiosity,
  playfulness, appetite, energy and affection, plus activity when alone (a
  multiplier), trust rate, temper and grudge.
- **Needs** drift over time, at rates set by traits and the Canberra hour:
  hunger, tiredness, company, play and comfort.
- **Stimuli:** someone arriving or leaving; the room's noise (bubbles in the
  last minute); the cat's own name in a bubble; a treat put down or offered;
  furniture placed or moved; being handled; another cat nearby; someone at the
  window.
- **Choosing what to do:** every behaviour (wander, nap, eat, groom, approach
  someone, greet at the door, investigate, play, hide, perch at the window,
  knock something over, sit on a lap) scores itself from needs, traits,
  stimuli, trust and the hour, and the cat picks among the top few, weighted by
  score. A new stimulus interrupts the current behaviour only if it scores
  higher by a margin, so cats don't dither. *Why:* in character without being
  predictable.
- **Noise and names:** a chatty café sends shy cats into hiding and draws
  social ones in; a quiet one coaxes the shy ones out. A cat's name in a bubble
  makes it look up, and come over if it trusts the speaker. Matching cat names
  is the only thing the server reads in a bubble.
- **Being handled:** the first time a cat meets someone, it sniffs their hand,
  even half asleep (a cat that's hiding stays hidden): a small first gain in
  trust, so even a first visit leaves a trace.
  After that the cat answers from its affection, its state (asleep, eating,
  already held), its trust in the person and its anger at them. It may
  welcome it (purring, trust up), tolerate it, refuse it (walking off or
  hissing, anger up), scratch and jump down (trust down), or, when furious, ban
  that action from that person for as long as its grudge lasts. Trying a
  banned action shows the time left. How long a cat puts up with being held
  depends on its character and its trust in the holder, and a held cat always
  jumps down at the door. *Why:* there are no café-wide rules; each cat
  enforces its own boundaries, firmly.
- **Trust** runs from 0 to 100 per cat per person and never fades with absence.
  Gains taper within a Canberra day, so regular visits beat one long session.
  It unlocks behaviour: the cat comes when you call; then greets you at the
  door and sits by you; then naps on your lap and puts up with being carried
  longer. Your own trust with each cat is shown to you; others see trust only
  in what the cats do. The operator's seed for demo accounts is the one
  change to trust that isn't a person's doing
  ([Showing it to markers](#showing-it-to-markers)).
- **Anger** is per cat per person and kept in memory only: it rises with
  unwelcome handling by temper and cools by grudge. Bans are stored until they
  expire. Pet, play, offer and pick up answer by one rule; a refusal or
  pushing adds 0.3 plus half the cat's temper, most of it gone by the end of
  the grudge. A cat already at 0.6 scratches instead of pulling away (trust
  down 2); one already at 1.0 bans that action from that person for its
  grudge, so a scratch comes before a ban. A ban doesn't spend the anger,
  which cools as before. A cat in your arms that refuses you, or one on your
  lap that scratches you, gets down. A refused treat is no quarrel: a cat
  that isn't hungry (hunger under 0.2) just doesn't take it. (Phase 3's
  review, findings 1, 17, 18 and 22.)
- **Carrying:** a cat that agrees is held and moves with its holder, whose
  arms are then full (no furniture, and no sitting: picking a cat up gets you
  off your seat); it jumps down when it has had enough (8 seconds, plus up to
  52 more by trust and affection, halved if it only tolerated being picked
  up), at the door, or when its holder leaves or drops. Passed to someone
  standing beside you who is here (not walking out or dropped), it goes if it
  knows them (trust 20), isn't angry at them, and hasn't banned them picking
  it up: being passed to someone is being picked up by them. (Phase 3's
  review, findings 5, 19 and 20.)
- **Effects on the room:** a cat lying on furniture claims it; cats knock
  things over and scatter toys, leaving traces; notable moments become
  chalkboard lines; cats notice each other, napping together or keeping their
  distance. A cat lying on a seat claims it, so nobody sits there. Cats never
  settle on one tile together or where someone stands or sits (only a lap cat
  lies on its person, and one cat to a lap), look at each new piece once from
  where someone could pet them, and play only with toys that are still there.
  (Phase 3's review, findings 6 and 23 to 26.)
- **The same rules awake and asleep:** one seeded random generator drives the
  world, live and in fast-forward. With nobody there, behaviours that need
  people aren't on offer, and activity when alone takes over.

### The first three

| | Mochi | Burakku | Tora |
|---|---|---|---|
| Look | round, white and grey | black | orange tabby |
| Rhythm | awake mornings and evenings; naps after lunch and overnight | awake at night | zoomies at dawn and dusk |
| When the café is empty | sleeps more | prowls and knocks things over | carries on as usual |
| With people | seeks everyone, first to any treat, trusts quickly | hides when it's noisy; slow to trust, devoted after | first to new furniture; won by play, bored by petting, quick to swat |
| Grudge | 2 hours | 2 days | 4 hours |

Burakku is ブラック, "black". She was first named Buraku, which reads in
Japanese as 部落, a word tied to discrimination against the burakumin, and was
renamed.

## The room

- **13 by 13 tiles**, a floor 13 wide and 12 deep under the street wall
  (12 by 10 until slice 16, grown so the room fills the 1920×1080 viewport
  at 4×; [ADR 0021](adr/0021-grow-the-floor-and-float-the-bars.md)), seen
  from inside at an angle, with the street wall (row 0) standing at the
  back left. A café saved on the old floor woke on the new one with its
  pieces where they were, and room.toml's pieces on the new strip added
  once: the saved arrangement keeps the floor it was saved on. That wall holds the window, where the
  line's faces peek in; the door, with a walkway that's never blocked; and
  the chalkboard beside it. A floor plan is in
  [notes/mockups/client-layouts.html](notes/mockups/client-layouts.html).
  The room is drawn isometric, each tile a 32×16 diamond, since slice 09
  ([ADR 0017](adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md));
  the grid, and every rule about it, is unchanged.
- **Starting furniture:** a window seat, where cats go to look at the line; a
  cat tower; a sofa; a rug; a table and two chairs; a cat bed; a box; a floor
  cushion; toys; and plants. Everything moves except the walls, window, door,
  chalkboard and bowls. The catalogue offers these kinds plus a scratching
  post and a lamp.
- **Traces stay until someone tidies them.** Standing a toppled plant back up
  is just moving furniture, so tidying is a small thing regulars do for each
  other. Toys a cat knocks over, or scatters while playing with nobody inside
  (a chance of half its playfulness), lie strewn about until someone picks
  "Gather up the toys", and no cat plays with them till then. Traces are saved
  with the furniture, through restarts and replays.
- **The chalkboard** notes what the cats got up to, day and night ("3:12am,
  Burakku knocked over the fern"; "Mochi slept on Sam's lap for 20 minutes"),
  over a rolling 24 hours. It records cats' doings, never what people said.
  *Why rolling:* a morning wipe would erase the night before the first visitor
  read it. The server writes a line when a cat knocks something over (the
  toys read as scattered), first sniffs a newcomer's hand, sleeps five minutes
  or more on a lap, greets someone at the door, plays with someone or with the
  toys, looks over a new piece, or perches at the window. The softer doings
  are written at most once an hour per cat; meetings, knock-overs and laps
  every time. A line is fixed fields: when, the cat, what it did, and a
  username or a piece's kind. So nothing anyone typed can reach it, and the
  client puts it into words. People are named by username, only for what a
  cat did with them. The latest 8 are shown.
  ([Slice 02](slices/02-what-the-night-left-behind.md), [plan](notes/plan-slice-02-chalkboard.md).)

## Architecture

- **One Rust binary** (tokio and axum) on the one machine.
  ([ADR 0003](adr/0003-use-a-rust-server-and-a-typescript-canvas-client.md))
  - `/` serves the client; `/readme/` serves `README.md` rendered to HTML at
    startup, so its headings are in the HTML the server sends; `/api/*` handles
    sign-up, log-in and recovery; `/ws` is the WebSocket.
  - **One world task owns the café** in memory: the room, furniture, cats, who
    is inside and in line, trust, bans and the chalkboard. Connections send it
    commands over a channel; it handles them one at a time and steps the
    simulation ten times a second. *Why:* one owner means no locks and one
    order of events that everyone sees, so "first grab wins" comes free.
    ([ADR 0004](adr/0004-run-one-authoritative-world-over-websockets.md))
  - **The store** is SQLite at `/data/cafe.db`, written by a writer thread.
    ([ADR 0005](adr/0005-keep-all-state-in-sqlite-on-the-volume.md))
- **The client** is TypeScript built by Vite: a canvas for the room, HTML over
  it for bubbles, menus, the talk box and a screen-reader announcer, and a
  WebSocket that reconnects on its own.
- **Content is data:** cats, furniture, sprites and the blocklist live in
  `content/` and are loaded at startup.
- **Shared types:** message types are Rust enums and structs with serde, and
  ts-rs generates their TypeScript into `client/src/protocol/`, so the client
  and server can't drift. 64-bit integers are generated as `number`
  (`TS_RS_LARGE_INT`), because JSON numbers aren't `bigint`.
- **Layout:** `server/`, `client/`, `content/` and the existing `spec/`. The
  Dockerfile builds the client, builds the server, and copies both into a slim
  image.

## Real-time

([ADR 0004](adr/0004-run-one-authoritative-world-over-websockets.md))

- **A snapshot, then events.** On connect: a build-id check (a tab left open
  across a deploy reloads), then a snapshot of the whole café stamped with the
  server's clock, then events in order.
- **Walks are paths.** Each walk is sent once (path, start time, speed) and
  animated locally: few messages, smooth motion on a slow connection, and a
  newcomer can place everyone mid-stride.
- **The server decides.** Clients send intents; the world checks them and
  broadcasts the outcome, which the sender renders like everyone else.
- **Falling behind heals by snapshot.** Reconnects retry with backoff and the
  seat waits (*tunable*); a connection too slow to keep up is dropped and
  reconnects to a fresh snapshot, so nothing is replayed.
- **Public by default.** Everything that happens in the room goes to everyone
  inside and at the window. Only your treats left, your trust with each cat,
  ban notices and the "still there?" nudge are sent to you alone.
- **Limits before the world:** each connection's bubbles and emotes, and its
  other actions, pass token buckets that allow a burst and then refill
  (*tunable*). Furniture changes are counted per person inside the world, so
  a reconnect doesn't refill them, and only an accepted change spends one.

## Persistence and fast-forward

([ADR 0005](adr/0005-keep-all-state-in-sqlite-on-the-volume.md),
[ADR 0006](adr/0006-fast-forward-the-world-when-the-server-wakes.md))

- **Kept across restarts and redeploys:** accounts and looks; each cat's trust
  in each person; bans until they expire; mutes; the furniture; each cat's
  state (where it is, what it's doing and until when, a walk under way, how
  hungry and tired it is; a cat in someone's arms or on a lap comes back on
  its own feet, since nobody is inside when the café wakes); treats
  used today; traces and chalkboard lines (a `chalkboard` table, one row per
  line, written as it happens and deleted a day old; a replay's end rewrites
  it); the world clock and the random
  generator's state.
- **Not kept:** bubbles, emotes, cats' anger, and who is inside or in line
  (rebuilt as people reconnect).
- **When it's written:** people's changes within a fraction of a second,
  batched into transactions; the cats' state, the world clock and the random
  state every 5 seconds and on the stop signal. A crash loses at most seconds
  of cat wandering, never a trust gain or a moved sofa. Fly's stop sends SIGINT
  and waits a best-effort 5 seconds, so the periodic save is the real safety
  net.
- **Waking:** open the doors at once, load everything, and replay the gap
  behind them in one-second steps with the same rules (eight hours is about
  29,000 steps), on a thread of its own. Gaps over
  3 days replay only the last 3 days (`replay_max_days`, cut from a week on
  2026-10-15). The café's schedule runs during the replay:
  bowls refill, treats reset at midnight Canberra time, and chalkboard lines
  older than 24 hours drop off. The world is built at the saved clock with
  the saved random generator (`world` keys `saved_at` and `rng`, written in
  the cats' save job), so the same save and the same gap make the same night.
  The replay writes nothing and logs nothing on the way; what it changed is
  saved once, before the café counts as awake. Meanwhile the page, the
  README and sign-up, log-in and recovery work as usual. A café page opened,
  or a tab reconnecting, meanwhile is told `waking`, and shows "Dusting off
  the café…" (a broom sweeping and dust rising, still under reduced motion)
  with nothing of the café, until its welcome. Nothing can be done
  meanwhile: only presence, "still here" and leaving go out, the talk box
  keeps your words and says why, and a Leave sent meanwhile frees the seat
  as the café wakes. A socket lost while waking says "Reconnecting…". At the machine's baseline CPU
  that's about 1.3 seconds after eight hours asleep and about 13 to 15 at
  the 3-day cap ([slice-01-wake.md](notes/slice-01-wake.md),
  [slice-07-waking.md](notes/slice-07-waking.md)). A stop during the replay
  doesn't wait for it: the save it started from still stands. A replay that
  panics is logged, and the café wakes at now from the save without it.
  (Slice 07, [plan](notes/plan-slice-07-waking.md).) A saved clock or random state that
  can't be read wakes the café anyway, with a warning line: no replay, or a
  fresh generator. (Slice 01, [plan](notes/plan-slice-01-fast-forward.md).)
- **Redeploys** are short sleeps: the old machine saves on the stop signal, the
  new one loads and fast-forwards a few seconds, clients reconnect, and tabs on
  the old build reload.
- **Migrations** are numbered and compiled into the binary.
- **Failures are loud:** a bad message gets an error, never a crash; a panic
  is one JSON `error` line; a world task that dies, or can't wake, ends the
  process, and Fly restarts it from the last save, rather than the server
  serving pages with no café behind them (slice 07); a database that won't
  open stops the server rather than letting it serve an empty café. Any
  failure to start is one JSON `error` line, then exit code 1.
  Fly's daily volume snapshots, kept 5 days, are the backup.

## Accounts and safety

([ADR 0007](adr/0007-use-password-accounts-with-a-recovery-code.md))

- **Sign-up:** a username (3 to 20 letters, digits, `_` or `-`; unique ignoring
  case; the form says it's shown to everyone), a password (8 to 128
  characters, no composition rules) and a look from preset avatars and
  colours. The recovery code (16 characters in four groups, from an alphabet
  without look-alike characters) is shown once, with a copy button.
- **Recovery:** username, recovery code and a new password reset the password,
  issue a fresh code and sign out other sessions.
- **Storage:** passwords and recovery codes are hashed with argon2id at
  OWASP's minimum configuration (19 MiB, 2 iterations, parallelism 1), with at
  most two hashes running at once. Session tokens are random, sent in an
  HttpOnly, Secure, SameSite=Lax cookie, stored only as hashes, and last 30
  days from last use.
- **Protection:** sign-up, log-in and recovery are rate-limited per name and
  per IP address; `/api/*` and `/ws` check the Origin header. Opening the same
  account in a second tab moves you there, and the first tab says so.
- **Public text:** bubbles up to 100 characters; the rate limits above; a
  whole-word slur blocklist in `content/blocklist.txt` (a blocked bubble isn't
  shown, and its sender is told why); mute stored with the account, so the
  server stops sending you that person's bubbles on any device.
- **Admin ban:** a subcommand of the same binary, run over `fly ssh console`.
  The account can't log in, and its open sessions close.
- **Privacy:** no email addresses, no IP addresses stored, and bubble text never
  written anywhere. Per-IP rate limits are counted in memory and never written
  down or logged.

## Showing it to markers

Decided 2026-11-06 by the user
([ADR 0022](adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md));
built as [slice 17](slices/17-markers-see-weeks-in-ten-minutes.md), approved
the same day. Part 1, everything but the furniture sets, is built (2026-11-06,
[plan](notes/plan-slice-17-demo.md), [notes](notes/slice-17-demo.md)); part 2,
the sets, comes after slice 16. The demo accounts are `demo1` and `demo2`,
with the password `catppuccino`, each seeded with Mochi at 85, Tora at 55
and Burakku at 25.

- **Markers get a regular's account.** They have about ten minutes and a
  new account, which every cat treats as a stranger, and a lap is at least
  8 days of visits away. So the README gives them a demo account's login
  beside their own, and the two side by side show what weeks change.
  *Why:* the café's point is what time builds, and markers can't wait for
  it.
- **Demo accounts** are marked as such in the store, by the operator only.
  `cafe demo seed`, a subcommand of the server's binary run over
  `fly ssh console`, creates them, marks them and sets each cat's trust in
  them from `content/demo.toml`; a restart loads it. Their password is in
  the README, public by design. Their recovery codes are never shown, so
  only running the seed again changes the password.
  Sign-up refuses `demo` followed only by digits, and names starting `bot_`.
- **The page keeps the café's clock**, set from the welcome's `now`: the
  light, the street, the window, the music set and the board's times follow
  the server, not the device.
- **A demo account moves the clock forward** to the next time of day it
  asks for, at most 24 hours on (`jump_max_hours`), at most once a minute
  by the café's clock (`jump_every_secs`); "Canberra time" moves it on to
  the next whole day ahead, so the hour is Canberra's again. Everyone's
  page is told who moved it and to when, and covers the café ("demo1 moved
  the café on to 23:30. Time passes…"). The server ends walks where they
  are, calls off errands, puts back what's carried, sets the people aside,
  and replays the gap off the runtime as it replays a sleep; then it brings
  everyone back with their timers moved on by the gap, so nobody is walked
  out by a jump, moves any cat off someone's tile, and welcomes everyone
  at the new time, the world first caught up to the café's clock as it is
  after the replay, so no page runs behind. A page that opens meanwhile is
  told at once. An action that reached the café while it lived the hours is
  refused (`movedOn`); one that arrives after a short jump has ended is
  done at the new hour, checked against the café as it is then. The lead
  grows by exactly the gap asked for, and "Canberra time" aims for the
  time Canberra's own clock reads, by the local date and time, so daylight
  saving can't leave it an hour out. Sessions and the accounts' rate
  limits keep Canberra's own clock, so a jump spends nobody's session
  (slice 17's review, findings 4, 5, 8, 9 and 10). How far ahead the café is (`world.ahead`) is saved with the
  replay's end and loaded before the clock is first read, so the clock
  never goes back, across restarts too.
- **A demo account lays out one of three furniture sets** from
  `content/layouts/` at once, without the rate limit, by the usual
  placement rules.
- **A demo account adds and removes bots**: up to six (`bots_max`),
  `bot_1` to `bot_6`, visitors the server runs, which take seats and join
  the line, now and then walk to free floor or wave, and never talk, sit,
  handle a cat or touch furniture. A visitor can't hand one a treat or
  pass it a cat, and who's here marks each "(a bot)". They leave when removed (the newest
  first), with the demo account that added them, or after 15 minutes
  (`bot_stay_mins`), which a jump doesn't spend. The cats never meet one,
  the quiet seat passes them by, and nothing about them is stored.
- **The controls are a floating bar at the top of the room**, which only a
  demo account sees, working by keyboard, touch and mouse at both sizes:
  the café's time and how far it runs ahead, Morning 07:00, Afternoon
  13:30, Evening 18:30 and Night 23:30 (picked for the cats), an hour on,
  any time typed, Canberra time, and the bots. On a desktop it floats in
  one row under the status bar; on a phone it's one slim row whose Time
  and Bots open below, one at a time; in layout B the room pans clear of
  it. Its card is opaque, so its text holds 4.5:1 by the page's own
  colours. Everyone else sees what it did.
- **The README's "For markers"** gives the login and a ten-minute path.

## The client

- **Logged out,** `/` shows the sign-up and log-in card over a still picture of
  the café, with a link to `/readme/`.
- **Desktop (1920×1080), and anything 960 px wide or more** (slice 14,
  2026-11-05,
  [ADR 0018](adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)):
  the room spans the window at the largest whole-number scale that fits,
  4× at 1920×1080 (3× at 1440×900), and since slice 16 the status line and
  the talk bar float over it as layout B's do: the status a glass pill top
  left with its buttons top right, the talk bar a glass bar across the
  bottom middle, on the panels' tokens. A small menu opens beside whatever
  you click, kept between the bars. The chalkboard, your cats
  and who's here (who's inside, who's at the window and what was said
  this visit) float over the room's empty corners, top left, bottom left
  and top right, half see-through, 17rem wide so where they start every
  floor tile's middle stays clear, and kept inside the stage between the
  bars. Each moves
  by dragging its title or grip, by mouse or finger, or by its grip and
  the arrows, and can be pinned: a pinned panel can't be moved or
  selected, its grip goes, and a click, tap or hover on it reaches the
  café under it, except on its Unpin. An unpinned panel unchanged for 4
  seconds, with the pointer and the focus elsewhere, dims and grows more
  see-through. Where each is and which are pinned are remembered per
  device, or for the visit. Their glass is frosted: what's behind is
  blurred and squeezed toward the panel's end of the scale before the
  card goes over it thinly, a quarter (a tenth dimmed), and the panels'
  own text is a shade darker (light) or brighter (dark) than the page's,
  so their text holds 4.5:1 over anything the room and street can show
  while the room shows through as soft shapes. In the dark theme that
  reads as frosted glass at any hour; in the light theme (the device's
  setting, not the café's hour) the panels show the room as white at any
  hour, day or night, the cost of 4.5:1 over anything in a light panel
  (slice 14's review, finding 1): the user's to weigh. "Put a treat down" is in the talk bar beside
  the emotes, at every size, so a pinned panel costs nothing.
- **Phone (390×844), and anything narrower than 960 px:** two layouts, with
  one button to switch between them, remembered per device (or for the visit,
  if the device won't store it). **B**, the default: the room fills the
  screen at 3× and pans to follow you, up and down too so nothing it follows
  sits under the floating bars, with floating controls and actions in a ring
  around what you tapped. **A**: the whole room on top at 1×, with the
  visit's bubbles, treats, emotes and the talk box below, and actions in a
  sheet from the bottom. B became the default in slice 09, because the room
  at an angle fits a phone's width only at 1×, and the phone's layouts reach
  up to 960 px because the desktop's panels leave the room too little room
  below that
  ([ADR 0017](adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md),
  slice 09's review). While a ring is open the room holds still, and by the room's edges
  it moves over, past its edge if it must, so the ring stays round what it is
  for with every button on screen. Tapping the chalkboard opens its readable
  copy, a modal dialog: it takes the focus and holds it, the café behind is
  inert, and Escape, Close or a click beside it gives the room back. A click,
  or Tab and Enter, opens it at every size, and the arrows can put the pointer
  on it (the only spot on the street wall they reach). On the keyboard the
  chalkboard comes last in the Tab cycle, after the cats, people and
  furniture, so it isn't everyone's first Tab by the door, and one Shift+Tab
  reaches it. On a phone the panel's copy is out of sight but still read by a
  screen reader, in both layouts; in B the rest of that panel (your cats)
  comes with the drawer, so Tab never reaches what isn't on screen. The welcome carries the board's numbers, so the client keeps
  the same day and the same eight as the server. Wireframes are in
  [notes/mockups/client-layouts.html](notes/mockups/client-layouts.html).
- **Drawing:** the canvas uses the largest whole-number scale that fits, so
  pixels stay crisp and a resize mid-use just refits; the room is coloured
  by the Canberra hour's light (below), with nothing laid over it.
  The canvas is worked out from `content/room.toml`'s floor, which the
  client reads as the server does: (w + d) × 16 by (w + d) × 8 + 64 px at
  1×, 400 by 264 for 13 by 12 (slice 16). The street runs on past it to
  the window's edges, on a canvas behind it at the room's scale, lined up
  to the pixel (slice 16). On a phone the whole room (layout A) is shown at
  1× centred on its middle, so at 390 px its two side tips are cut by 5 px
  each, at the user's asking ("it's okay to hide a bit of the corner of
  the room for now").
- **The look** is chosen
  ([ADR 0017](adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md),
  from [notes/visual-direction.md](notes/visual-direction.md)) and built in
  slices 09 to 11.
  - **A 2:1 isometric camera** on the same grid (slice 09, built), kept
    over a top-down 3/4 one on 2026-11-04
    ([ADR 0018](adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)):
    32×16 diamonds on a canvas the floor's size (400×264 since slice 16). Things are drawn so nothing wholly behind
    another comes after it, and things on one spot go piece, treat, cat,
    person, a cat on their lap; what stands on a piece is drawn up on it. A
    click or tap acts on what's drawn under it, up off its tile, before the
    floor: a figure on its sprite's own pixels, a piece on its parts. Each
    piece is drawn as its parts (slice 11), boxes from
    `content/sprites/furniture-models.json`, each its own colour, listed
    back to front: a sofa's back, arms and seat; legs under the table,
    chairs and window seat; a pot and leaves. What's up on a piece stands
    on the part under its tile. A piece a cat can knock over (the plant,
    the toys, the lamp) lies down as its parts on their side; one with no
    model, or knocked over without one, is a single block as tall as
    `content/sprites/heights.json` says.
  - **Catppuccin-led colours** (slice 10, built): `content/sprites/palettes.json`
    holds a day set and a night set of the same shape, written by
    `scripts/palettes.ts` from Catppuccin's values (credited in
    `content/sprites/CREDITS.md`), never by hand: a client test holds that
    it is what the script writes. A coat's day colours are data, in
    `content/sprites/coats.json`; a new coat is a key there, then a run of
    the script, which works out its night colours. By day, Mocha's pastels on wood mixed
    from its peach and rosewater; at night, every colour pulled toward
    Mocha's base and lavender, cats and people less, and the window's
    glass lit yellow. The light is day through the afternoon, halfway in
    the evening, and night from 21:00, the sets blended slot by slot. The
    page follows the device's setting: Catppuccin Latte in a light one
    (mauve for links and buttons, subtext1 for muted text) and Mocha in a
    dark one (peach), every text and control at 4.5:1 or better. The
    keyboard's focus ring is two tones, an outline and a halo just outside
    it, crust on white in the light theme and Mocha's blue on black in
    the dark, so over the room and the street one of them holds 3:1
    against anything (slice 16's review, finding 4).
  - **Cats about 24 px and people about 32 to 36 px tall**, drawn by Claude
    as PNGs in `content/sprites/` and turned into palette slots by the
    client, with a pose for each thing a cat does (slice 11). 32-px tiles
    stay, judged again on 2026-11-04 against 16, 24 and 48
    ([notes/art-style.md](notes/art-style.md)).
  - **Walkers face where they go** (slice 12, built;
    [ADR 0018](adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)):
    by their direction on screen, not on the grid: up the screen shows
    their back, down it their face, and going left mirrors the sprite.
    Standing, they keep the side they last walked with; someone who's just
    walked in from the door faces into the room. The client remembers the
    side, since the server's messages don't carry it, and keeps it through
    a reconnect. They move by screen pixels: the
    canvas holds the room at its scale, the room is drawn into it in room
    pixels, and a figure is placed to the canvas's own pixels, so a walk
    on the diagonal is even and the phone's camera holds a walker still
    as it follows them. A sprite's own pixels stay whole.
  - **The room is a diorama on its street** (slice 13, built;
    [ADR 0018](adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)):
    the floor has a thickness and the walls a top, and the street stands
    behind the café, sky and towers by day, stars and lit windows by
    night, in the same hour's light as the room, with clouds in the day's
    sky and a warm band low between the towers (faint clouds by night). It
    fills the corners the room's diamond leaves. The street is data,
    `content/street.toml` (the skyline's height, the towers' widths and
    heights, the windows, each cloud's spot, the warm band), with
    its colours in the palette's "street" slots by day and by night; it
    takes no click. Since slice 16 it runs to the window's edges, and the
    café's terrace stands in the room's two bottom corners: by the floor's
    left edge a bench between two planters, out front a table with a
    folded parasol, two chairs and a low lantern, lit at night. It's kept
    low and off the floor: anything tall out front would stand over the
    floor's front tiles on screen (slice 16's review, finding 2). Each thing is
    a `[[terrace]]` line in `street.toml` (its kind, the floor's edge it
    stands by, how far along and how far out); each kind is drawn as its
    own few blocks in the furniture's colours. It's scenery: off the
    café's grid, nearest the viewer of all, taking no click.
  - **Crisp, with outlines and shadows** (slice 13, built;
    [ADR 0019](adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)):
    every pixel of the room one colour, with no anti-aliasing: shapes are
    filled and traced by whole room pixels, never as canvas paths; a
    one-pixel outline, each piece's own colour darkened, where it meets
    what's behind it; shadows cast from the street wall's windows, with
    their light through the panes; and the floor darkened where it meets
    a wall or a piece, the plain wall shading the strip beside it. Each
    piece casts the shadow of the block it's drawn as, and cats and people
    on the floor cast a small one. The street, the floor, its seams and the
    rug are one layer, shaded pixel by pixel and worked out when the light
    or the furniture changes, not every frame; the shadows are the same by
    night. Blocks are lit from the windows: the left face a little shaded,
    the front, turned away from them, most.
- **Sprites** (slice 11) are PNGs in `content/sprites/png/`, drawn by
  Claude with `scripts/cats.mjs` and `scripts/people.mjs` in a fixed key of
  slot colours; `scripts/sprites.ts` turns them into the grids of palette
  numbers in `cat.txt` and `avatar.txt` the client and `cargo test` read,
  and a test holds that the grids are its output. Cats are about 24 px,
  people 32. Each cat has a coat (its colours, six slots) and a build (its
  shape: round, slim, striped), both data in its file in `content/cats/`;
  a build is a folder of frames, one for each thing a cat does (sitting,
  walking and walking away, asleep, on a lap, eating, playing, held,
  perched, scratching, knocking something over, greeting), every frame
  facing right and mirrored to face left. Recoloured images are cached.
  Any sprite can be redrawn later, by hand or from a pack, as PNGs.
- **HTML over the canvas** for bubbles (any language renders crisply, which a
  pixel font can't), menus (real buttons the keyboard can focus) and a
  screen-reader live region that narrates what happens ("Mochi walked over to
  you"). Reduced-motion settings are honoured.
- **Music** (decided 2026-11-05,
  [ADR 0020](adr/0020-play-public-domain-lofi-each-visitor-their-own.md);
  [slice 15](slices/15-music-while-you-sit.md), built): quiet lofi by
  HoliznaCC0, released under CC0, six tracks in `content/music/` with a
  playlist (`playlist.toml`, data as a cat is) and credits
  (`CREDITS.md`), three for day and three for night by the Canberra
  hour, the night set from 17:00 until 6:00. `scripts/music.ts`
  re-encoded each once from its original to 128 kbps aimed at −16 LUFS, and
  `manifest.json` records each file's hash and measured loudness, which a
  client test holds the files to (CI has no ffmpeg). Each visitor has
  their own player (`client/src/music.ts` chooses, `musicPanel.ts`
  plays): the track's title and artist, Play or Pause, Previous, Next and
  a volume, in a fourth floating panel on a desktop (bottom right; pinned,
  its five controls stay live), a slim row under the talk bar in layout
  A, and at the top of the drawer in layout B. A set plays in order and
  loops; a song begun when the clock crosses 17:00 or 6:00 finishes, then
  the new set's first track follows. No track is fetched until it plays.
  Whether it was on, and how loud (40% to start), is remembered per device
  under `cafe.music` and never reaches the server; remembered on, it plays
  on entering, or at the first press in the café if the browser won't let
  it yet (a key going down, a finger lifting, or the click a tap ends in);
  nothing is set loading before then. The system's media controls (a
  phone's lock screen, a keyboard's media keys) name the track and play,
  pause and skip it, and a pause from them is remembered as the panel's
  is. Leaving stops it. *Why not Bensound,
  as first asked:* its free licence covers online videos, not a website's
  background music, and a paid track's files couldn't go in the public
  repo. *Why each their own:* pause and skip are personal, and a shared
  radio would need the server to keep its clock for no gain in a room of
  six.

## Logging

- **One JSON line per user action** on stdout (Rust `tracing`), collected by
  Fly: who, what, when, and the outcome, so the logs can tell the story.
  A refused action is logged too, with its code, in one place in the world
  (and where the rate limit stops one first); an action that starts with a
  walk over is logged when it starts, and again when it happens or is
  refused at the end of the walk. A refusal or walking line names the cat,
  piece or person it was about. Something put back because its carrier left,
  dropped or walked out says so. An account refusal is logged with its code
  but not the name typed, since a password sometimes lands in the name field.
  (Phase 3's review, findings 8 and 11 to 15.)
- **Also logged:** a demo account's asks (`set_clock`, `add_bot`,
  `remove_bot`) and each jump (one `cafe` line, `what = "jumped"`: who,
  the gap, the steps, how long, the refills and each cat's walks; slice
  17); arrivals, departures, the line and walk-outs; cats'
  behaviour changes (a `cat` line when a cat starts to nap, hide, eat, play,
  perch, investigate, knock something over, come to someone, greet, take a
  lap or jump down; never per step); bans; the bowls' refills; each
  wake-up's fast-forward summary (one `cafe` line, `what = "woke"`, after
  each `listening` and before the next: whether it's the first start, the
  gap, the steps replayed, whether the cap cut it, whether the replay
  failed, how long it took, the bowls' refills and each cat's walks);
  errors.
- **Never logged:** bubble text (a `said` line records who, the length and who
  it was addressed to), passwords, recovery codes, session tokens, IP
  addresses.
- **Live view:** `pnpm logs`, which pipes `flyctl logs` through
  `scripts/narrate.ts` to turn the JSON into sentences in Canberra time
  ("19:42:07  sam petted Mochi, who purred"). *Why no stats page:* crit 10
  accepts a log tail, and a page would be one more thing to build and
  secure.

## Checks

- **Rust rules (`cargo test`)**, seeded so every run is the same: each cat's
  character; handling outcomes and ban lengths; trust tapering within a day but
  never fading; fast-forward (an empty night leaves traces and chalkboard
  lines, and the same seed gives the same night); the store surviving a stop
  and a start; pathfinding and placement (the door walkway can't be blocked);
  rate limits; the blocklist; accounts and recovery; the quiet-seat rule, with
  a controllable clock; bubble text never reaching a log line.
- **Long gaps on mocked time, never a real night**
  ([ADR 0016](adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)).
  Every instant the server reads comes from one clock (`time::now_ms`), which
  a test can start at a chosen instant with `CAFE_CLOCK_START` (an RFC 3339
  time with its offset); from there it runs at the wall's speed. It is
  refused on Fly, or if it won't parse, before the store is opened, and
  every start's `listening` line says which clock it's on. `cargo test`
  runs the built binary through a night (23:00 to 07:30: the wake-up line,
  the 7:00 refill, trust kept, the board's lines and traces, the furniture
  where it stood), a midnight (treats back) and nine days asleep (the last
  three replayed), and slice 07's waking tests sleep a week on it. No check
  waits on a real night or the live logs. (Slice 08,
  [plan](notes/plan-slice-08-mocked-time.md).)
- **Type drift:** regenerating the TypeScript types must leave
  `client/src/protocol/` unchanged.
- **`spec/`, black-box against the running image:** the two shipped checks;
  real-time within a second between two clients; the cap and the line (a
  seventh person lands at the window and can only talk, and the first in line
  walks in when a seat frees); bubbles never replayed on reconnect; the
  100-character cap, burst limits and blocklist; first grab wins; sign-up's
  one-time recovery code, and recovery; the log-in card's link to `/readme/`;
  a new chalkboard line on another visitor's board within a second;
  a stop and a start of the container, which replays the gap (by the
  restart's own wake-up line) and keeps the furniture, trust and chalkboard
  as they were (CI keeps `/data` on a Docker volume and gives the spec the
  commands as `APP_RESTART` and `APP_LOGS`; elsewhere it's skipped); and,
  on a café seeded with `cafe demo seed` (CI seeds the volume before the
  app starts and gives the spec `APP_DEMO_PASSWORD`; elsewhere it's
  skipped), only a demo account moves the clock, two pages get the new
  hour within a second of each other, and bots fill the café so the next
  visitor waits at the window (`spec/demo.test.ts`, slice 17). After the spec, CI checks the app's own log lines: every
  line has a time and a target, every start logs its wake-up, and none holds
  anything said, or the demo accounts' password.
- **Browser checks** (Playwright, in `spec/browser.test.ts`): a keyboard-only
  pass at 390×844 and 1920×1080 with a resize mid-use, a tap on a cat by
  touch, the phone layout switch, one visitor's change reaching
  another's page, the chalkboard read at both sizes by keyboard, touch
  and mouse, and the demo bar: a visitor has none, demo1 reaches it by Tab
  at 1920×1080 and moves the café on by a typed time while the room's light
  follows the server's clock with the device's twelve hours out, and demo2
  adds and removes a bot by touch at 390×844, Escape closing its group,
  through a resize (slice 17). CI installs Chromium for them, and spec files run one at a
  time, since they share one café that seats six.
- **CI:** a Rust job (format, lint, `cargo test`, type drift) beside the
  existing check job, and the deploy waits for both.
- **Enforced and judged.** Enforced by `spec/`: six inside and the line,
  real-time, vanishing bubbles, text limits, accounts and recovery, the keyboard
  path at both sizes. Enforced by `cargo test`: the cats' characters, trust
  never fading, grudges, the night's traces, persistence, bubble text never
  logged. Judged: whether strangers talk because of the cats, whether the cats
  feel like characters, and whether regulars feel remembered, assessed at the
  crit 9 pod session, in the crit 10 logs, and at the showcase.

## Numbers to tune

| What | Starting value |
|---|---|
| People inside | 6 |
| Seat kept after a dropped connection | 30 seconds |
| Reconnect backoff | 0.5 seconds, doubling to at most 5 |
| Falling behind | a connection with 256 unsent messages is dropped to reconnect |
| "Gone quiet" | tab hidden 2 minutes, or no input for 10 |
| Time to answer "still there?" | 60 seconds |
| Bubble on screen | 3 seconds + 60 ms per character, at most 10 seconds |
| Bubble length | 100 characters |
| Bubbles | 5 in a burst, then 1 every 2 seconds |
| Furniture changes | 3 in a burst, then 1 every 20 seconds, per person; only accepted changes count |
| Other actions | 10 a second |
| Furniture on the floor | at most 30 movable pieces |
| Treats | 3 per visitor per Canberra day |
| Bowl refills | 7:00, 12:00 and 18:00 Canberra time, 3 portions each |
| Anger | +0.3 + temper / 2 per unwelcome handling, cooling over the grudge; a cat already at 0.6 scratches, one already at 1.0 bans |
| Not hungry | under 0.2 hunger, a cat takes no treat from a hand |
| Holding a cat | 8 seconds + up to 52 by trust and affection, halved if only tolerated |
| New furniture | worth investigating for 2 minutes |
| Day and night | morning from 6:00, afternoon from 12:00, evening from 17:00, night from 21:00 |
| Trust levels | 20 comes when called; 50 greets you at the door and sits by you; 80 naps on your lap |
| Trust gained per day | at most 10 points per cat per person, times the cat's trust rate |
| Grudges | Mochi 2 hours, Tora 4 hours, Burakku 2 days |
| Chalkboard | rolling 24 hours, latest 8 lines shown |
| Chalkboard repeats | the same doing by the same cat at most once an hour; meetings, knock-overs and laps every time |
| A lap worth a line | 5 minutes or more |
| Scattering the toys | half the cat's playfulness, while it plays with nobody inside |
| Simulation | 10 steps a second live; 1-second steps in fast-forward, at most 3 days (`replay_max_days`) |
| Cat state saved | every 5 seconds, and on stop |
| Session | 30 days from last use |
| Sign-up, log-in and recovery attempts | 5 a minute per name from one address, so nobody elsewhere can lock a name out; 60 a minute per IP address, since a whole venue can share one |
| Password hashing | argon2id, 19 MiB, 2 iterations, at most 2 at once |
| Avatar looks | 4 avatars in 6 colours |
| A demo account's jump | at most 24 hours on, at most once a minute by the café's clock (slice 17) |
| Bots | at most 6, each staying at most 15 minutes |
| Music | the night set from 17:00 to 6:00 Canberra time, the day set otherwise; 40% to start, in steps of 5; 128 kbps stereo MP3 aimed at −16 LUFS integrated, within 1 LU, true peak under −1.5 dBTP (slice 15) |

## Harness

- **One rules file.** `AGENTS.md` holds the rules and `CLAUDE.md` is a symlink
  to it, so every agent reads the same file and the two can't drift apart.
- **Carried over from assignment 2:** the "no time limit" rule and the
  memory-through-files rule. Both held up across A2's long build sessions.
- **Three records:** settled decisions in this file, working state in
  `docs/notes/`, and every prompt with its outcome in `docs/prompts-result.md`.
  The prompt log carries over from A2, where it was the source material for
  `PROCESS.md`.
- **The agent writes `PROCESS.md`, and the user chooses what goes in it.** It
  is written from the prompt log and the commits; where there's more to choose
  from than fits, the user picks from the options first. The course convenor
  approved this harness.
  ([ADR 0013](adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md))
- **Significant decisions get an ADR** in `docs/adr/`, and this file links to
  each one. ([ADR 0001](adr/0001-record-architecture-decisions.md))
- **Agents test on the live café.** With accounts of their own, named
  `agent_…`, and on the Fly app as testing needs, within the course's fixed
  shape. ([ADR 0015](adr/0015-let-agents-test-on-the-live-cafe-and-its-fly-app.md))
- **Long gaps are checked on mocked time,** in unit and integration tests,
  never by waiting for a real night on the live café.
  ([ADR 0016](adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md))
- **Built in vertical slices.** Phases 1 to 3 were built as phases lined up
  with the crits ([ADR 0012](adr/0012-plan-in-phases-and-build-each-phase-natively.md)).
  The rest is built as vertical slices, each one thing a visitor can use
  through every layer it needs. The root plan, `docs/notes/plan.md`, lists
  them in order. Each has a spec in `docs/slices/`, and gets a detailed plan
  just before it's built. It is built natively in one session with tests
  written before code, and ends with a fresh reviewer whose brief and findings
  are files.
  ([ADR 0014](adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md))
