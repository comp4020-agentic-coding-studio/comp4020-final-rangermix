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
  little trust when a cat eats a treat they put down.
- **Controls: point, then act.** Click or tap a spot to walk there; click a
  cat, a person or a piece of furniture for a menu of what you can do. On the
  keyboard a pointer snaps to tiles: arrows move it, Tab and Shift+Tab cycle
  through nearby things, Enter acts or opens the menu, Esc closes it, and Enter
  with nothing selected goes to the talk box. *Why:* one model for mouse, touch
  and keyboard means the keyboard-only pass and the phone get the whole café.

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
  in what the cats do.
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
  distance.
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

- **12 by 10 tiles of 16 pixels**, seen from inside with the street wall at the
  top. That wall holds the window, where the line's faces peek in; the door,
  with a walkway that's never blocked; and the chalkboard beside it. A floor
  plan is in [notes/mockups/client-layouts.html](notes/mockups/client-layouts.html).
- **Starting furniture:** a window seat, where cats go to look at the line; a
  cat tower; a sofa; a rug; a table and two chairs; a cat bed; a box; a floor
  cushion; toys; and plants. Everything moves except the walls, window, door,
  chalkboard and bowls. The catalogue offers these kinds plus a scratching
  post and a lamp.
- **Traces stay until someone tidies them.** Standing a toppled plant back up
  is just moving furniture, so tidying is a small thing regulars do for each
  other.
- **The chalkboard** notes what the cats got up to, day and night ("3:12am,
  Burakku knocked over the fern"; "Mochi slept on Sam's lap for 20 minutes"),
  over a rolling 24 hours. It records cats' doings, never what people said.
  *Why rolling:* a morning wipe would erase the night before the first visitor
  read it.

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
  state (where it is, what it's doing, how hungry and tired it is); treats
  used today; traces and chalkboard lines; the world clock and the random
  generator's state.
- **Not kept:** bubbles, emotes, cats' anger, and who is inside or in line
  (rebuilt as people reconnect).
- **When it's written:** people's changes within a fraction of a second,
  batched into transactions; the cats' state, the world clock and the random
  state every 5 seconds and on the stop signal. A crash loses at most seconds
  of cat wandering, never a trust gain or a moved sofa. Fly's stop sends SIGINT
  and waits a best-effort 5 seconds, so the periodic save is the real safety
  net.
- **Waking:** load everything, replay the gap in one-second steps with the same
  rules (eight hours is about 29,000 steps), then open the doors. Gaps over a
  week replay only the last week. The café's schedule runs during the replay:
  bowls refill, treats reset at midnight Canberra time, and chalkboard lines
  older than 24 hours drop off.
- **Redeploys** are short sleeps: the old machine saves on the stop signal, the
  new one loads and fast-forwards a few seconds, clients reconnect, and tabs on
  the old build reload.
- **Migrations** are numbered and compiled into the binary.
- **Failures are loud:** a bad message gets an error, never a crash; a panic
  exits the process and Fly restarts it from the last save; a database that
  won't open stops the server rather than letting it serve an empty café.
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

## The client

- **Logged out,** `/` shows the sign-up and log-in card over a still picture of
  the café, with a link to `/readme/`.
- **Desktop (1920×1080):** the room in the middle at the largest whole-number
  scale that fits; the readable chalkboard on the left; who's inside, who's at
  the window and the current visit's bubbles on the right; the talk box under
  the room; a small menu beside whatever you click.
- **Phone (390×844):** two layouts, with one button to switch between them,
  remembered per device. **A**, the default: the whole room on top at 2×, with
  the visit's bubbles, treats, emotes and the talk box below, and actions in a
  sheet from the bottom. **B**: the room fills the screen at 3× and pans to
  follow you, with floating controls and actions in a ring around what you
  tapped. Tapping the chalkboard opens its readable copy. Wireframes are in
  [notes/mockups/client-layouts.html](notes/mockups/client-layouts.html).
- **Drawing:** the canvas uses the largest whole-number scale that fits, so
  pixels stay crisp and a resize mid-use just refits; things are drawn back to
  front by row; day and night is a tint by the Canberra hour.
- **Sprites** are grids of palette numbers in `content/sprites/`, drawn by
  Claude as code. Cats share a base sprite with swappable coats, patterns and
  eyes, and recoloured images are cached at startup. Any sprite can be redrawn
  later, by hand or from a pack, without touching code.
- **HTML over the canvas** for bubbles (any language renders crisply, which a
  pixel font can't), menus (real buttons the keyboard can focus) and a
  screen-reader live region that narrates what happens ("Mochi walked over to
  you"). Reduced-motion settings are honoured.

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
- **Also logged:** arrivals, departures, the line and walk-outs; cats'
  behaviour changes (a `cat` line when a cat starts to nap, hide, eat, play,
  perch, investigate, knock something over, come to someone, greet, take a
  lap or jump down; never per step); bans; the bowls' refills; each
  wake-up's fast-forward summary; errors.
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
- **Type drift:** regenerating the TypeScript types must leave
  `client/src/protocol/` unchanged.
- **`spec/`, black-box against the running image:** the two shipped checks;
  real-time within a second between two clients; the cap and the line (a
  seventh person lands at the window and can only talk, and the first in line
  walks in when a seat frees); bubbles never replayed on reconnect; the
  100-character cap, burst limits and blocklist; first grab wins; sign-up's
  one-time recovery code, and recovery; the log-in card's link to `/readme/`.
- **Browser checks** (Playwright, in `spec/browser.test.ts`): a keyboard-only
  pass at 390×844 and 1920×1080 with a resize mid-use, a tap on a cat by
  touch, the phone layout switch, and one visitor's change reaching
  another's page. CI installs Chromium for them, and spec files run one at a
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
| Simulation | 10 steps a second live; 1-second steps in fast-forward, at most 7 days |
| Cat state saved | every 5 seconds, and on stop |
| Session | 30 days from last use |
| Sign-up, log-in and recovery attempts | 5 a minute per name from one address, so nobody elsewhere can lock a name out; 60 a minute per IP address, since a whole venue can share one |
| Password hashing | argon2id, 19 MiB, 2 iterations, at most 2 at once |
| Avatar looks | 4 avatars in 6 colours |

## Harness

- **One rules file.** `AGENTS.md` holds the rules and `CLAUDE.md` is a symlink
  to it, so every agent reads the same file and the two can't drift apart.
- **Carried over from assignment 2:** the "no time limit" rule and the
  memory-through-files rule. Both held up across A2's long build sessions.
- **Three records:** settled decisions in this file, working state in
  `docs/notes/`, and every prompt with its outcome in `docs/prompts-result.md`.
  The prompt log carries over from A2, where it was the source material for
  `PROCESS.md`.
- **Significant decisions get an ADR** in `docs/adr/`, and this file links to
  each one. ([ADR 0001](adr/0001-record-architecture-decisions.md))
- **Built in phases.** A roadmap in `docs/notes/plan.md` splits the spec into
  phases lined up with the crits; each phase gets a detailed plan when it
  starts, is built natively in one session with tests written before code, and
  ends with a fresh reviewer whose brief and findings are files.
  ([ADR 0012](adr/0012-plan-in-phases-and-build-each-phase-natively.md))
