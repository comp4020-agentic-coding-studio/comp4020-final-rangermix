# Prompts and results

A curated record of the sessions that built this project: each prompt as it
was typed, a trimmed version of what came back, and the commits it produced.
It is source material for `PROCESS.md`, not a draft of it. The rules for
keeping it are in `AGENTS.md` under "The prompt log".

---

## 1. Harness

*Session `746c957e`, Claude Code (Opus 5.5).*

*Sent 2026-10-05 20:44:13 AEDT*

> first check out the harness from past two assignments, make a list and suggest what we can carry over.

**Result.** Compared the harnesses of assignment 1 (`comp4020-ass1-rangermix`,
a static Vite explainer) and assignment 2 (`comp4020-ass2-rangermix`, an Astro
course site) with this repo's starter. The shared course plumbing (pre-commit
key blocker, TruffleHog scans, evidence check, `mise.toml`) is already here.
A1's harness was mostly course boilerplate plus project notes: spec, plan,
then tiered build; no invented numbers; offline data pipeline; a gotchas list.
A2's was fully custom: a governing sentence, rules backed by spec tests, a
content-pipeline order, verified citations, verify-before-done, commit and
push as you go, no time limit, and memory through files. The suggestions
grouped these into carry as-is, adapt for a full-stack app, and leave behind.
No files were changed.

---

*Sent 2026-10-05 20:59:50 AEDT*

> 1. CLAUDE.md is a symlink of AGENTS.md. They live together just fine
> 2. carry over: A2 #7 #8
> 3. Settled decisions in one file (docs/design.md), with working state in docs/notes/
> 4. carry over A2's docs/prompts-result.md: document every interaction and outcome

**Result.** Wrote `AGENTS.md` (which `CLAUDE.md` links to) with four sections:
where things live, the prompt-log rules (adapted from the conventions at the
top of A2's log), "No time limit", and "Memory and agent communication".
Created `docs/design.md` with the harness decisions recorded as settled and
nothing yet settled about the app, `docs/notes/` with a README, and this log.
[`8aa93ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8aa93ec)

---

*Sent 2026-10-05 21:52:45 AEDT*

> also use ADR as described in https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/#what-you-submit

**Result.** The brief makes ADRs optional: record the context, the options,
the choice and its cost; they don't count toward `PROCESS.md`'s word count,
which can link to them. It doesn't fix where they live, how they're named or
which template to use, so those were decided here. ADRs go in `docs/adr/`,
named `NNNN-slug.md`, from a template following Nygard (2011) with an added
Options section the brief asks for. ADR 0001 records the practice itself and
why `docs/design.md` alone wasn't enough: it describes the current state and
loses rejected options when edited. `AGENTS.md` gained the rules: which
decisions need an ADR, writing it in the same commit as the decision,
superseding instead of rewriting, and `Proposed` status until the user decides.
[`bc3393e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bc3393e)

---

## 2. Designing the cat café

*Session `2ae45b1d`, Claude Code (Opus 5.5).*

*Sent 2026-10-07 00:48:28 AEDT (a first send at 00:48:15 was interrupted and sent again unchanged)*

> I want to build a 2d pixel art style online cat place. The inspiration is from the game nekoatsume and cat cafes in reality. This can be viewed as a game or a social place. It allows multiple user online at the same time. When user come online, its avatar will enter the place from the door. user can talk to each other by clicking the avatar and type out what they want to say. the words will come up as a bubble on their head. initially there will be three cats, with different look and character. user can interact with some enviorments like sofa, bed, and they can change the enviorments as well. user can interact with cats and other user as well. cats will interact with enviorments and users occationly and selectively based on their character. cats will also respond (based on their character) to changes of enviorment, like user entering room, or cat food being placed, or new furniture being placed. all realtime data comes from the server, like cat action, movement, furniture location, user action, etc. use websocket for two-way communication.
>
> that's my thought so far. Help me brainstorm to finish the design of this game. ask as many questions as you need.

**Result.** Treated as a new project, so it takes the full design path:
questions one at a time, two or three approaches, the design section by
section, then the spec written into `docs/design.md` with ADRs before any plan
or code. Read the final project brief, the C8 to C10 crit specs, the marking
viewports and the starter's deploy config, and recorded what binds this idea
in `docs/notes/brief-and-crits.md`. The constraints that shape it most: the
machine stops when nobody is connected, so server-run cats stop too; it has
256 MB; markers do a keyboard-only pass and use a 390×844 phone viewport; and
the brief marks down "a chat room with the nouns swapped", so the cats have to
be the reason to visit. Started `docs/notes/brainstorm.md` with the idea as
given, assumptions to confirm (one shared café, rule-based cats, light
identity, cats that remember people) and the question queue. The first
question asks what a visitor should walk away with after ten minutes. Also
flagged that C8's cutoff falls on Wednesday 7 October for every crit group
but one.
[`7e7fbb7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7e7fbb7)

---

*Sent 2026-10-07 01:30:09 AEDT*

> "The machine shuts down when nobody is connected. The cats stop with it, so we need to decide what the café looks like after a quiet night." The server won't stop simulating the game, including cats' movement, actions, etc. what might change is that some cats can have character that make them more active when no humans around, and some will be less active. The game will not stop at 3 cats so we need a modular system of cat characters and their effects.
>
> "The server is small: 256 MB of memory and one storage volume." that should be fine if we choose to use a compiled language like rust.
>
> "a keyboard-only pass" an easy solution is to have a pointer controlled by keyboard so it works without a mouse.
>
> "Identity is light: you pick a name and a look, and the browser remembers you." use a simple user system with password, keep it minimum as we don't need much for the project.
>
> "I'd put A at the heart. B gives you the lasting trace (the cats remember you), and C is how the room changes." exactly what i thought.
>
> don't worry about deadline

**Result.** Recorded the answers in `docs/notes/brainstorm.md` as decisions in
progress. Company around the cats is the heart, with trust as the lasting
trace and furnishing as how the room changes. The world never stops, and some
characters are more active when nobody is around. The roster grows past three,
so characters are modular. Accounts are a minimal username and password, and
keyboard use goes through a keyboard-driven pointer. Rust is the lean for the
server, to be weighed against alternatives in an ADR. Raised one conflict: the
course's `fly.toml` stops the machine when nobody is connected and every deploy
restarts it, so a world that never stops needs the server to fast-forward the
simulation through the gap when it wakes, as Neko Atsume does. Turning
auto-stop off would go against a setting the course chose and still miss
deploys. Proposed snapping the keyboard pointer to tiles, with Tab to jump
between things. The next question asks who the café is for.
[`a175cc7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a175cc7)

---

*Sent 2026-10-07 01:57:03 AEDT*

> Q2: A & C. fast-forward-on-wake is acceptable

**Result.** The café is for people who miss having a cat and for a small group
of regulars who make it their café. So it has to be good with one to three
people in it, regulars need to be recognisable, and the showcase crowd is the
stress test rather than the audience. Fast-forward on wake moved from proposed
to decided in `docs/notes/brainstorm.md`, to become an ADR in the approaches
step. The next question asks how many people fit inside at once and what
happens when the café is full.
[`0b4d17a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0b4d17a)

---

*Sent 2026-10-07 02:07:10 AEDT*

> A. cap at 6 for now. for people waiting show their avatar at window. they watch from the same view as user inside, but can't interact other than talking.

**Result.** Recorded the cap: at most six people inside for now, for the cats'
sake as in a real café, with everyone else waiting as an avatar at the front
window. People at the window see the same view as those inside and can talk,
but do nothing else. With only six seats, a forgotten tab could hold one for
hours, so the next question asks what happens to a quiet seat while someone is
waiting. Added the shape of the line (how many fit at the window, who comes in
next) to the question queue.
[`1f7cb5c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1f7cb5c)

---

*Sent 2026-10-07 02:12:56 AEDT*

> A

**Result.** A seat held by someone who has gone quiet frees up only while
someone is waiting: they get a "still there?" nudge, and with no answer their
avatar walks out and the first person in line walks in. Giving up your seat to
someone at the window wasn't chosen. No numbers came with the answer, so
defaults are noted for tuning: 30 seconds of grace for a dropped connection,
"gone quiet" meaning a tab hidden for 2 minutes or no input for 10, and 60
seconds to answer the nudge. Rather than spend a question on the line itself,
a first-come-first-served default was proposed, to confirm with the design
sections. The next question asks what a speech bubble reaches and how long it
lasts.
[`5ea4a61`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5ea4a61)

---

*Sent 2026-10-07 02:18:32 AEDT*

> A. adjust fade delay with message length

**Result.** Speech bubbles are public and fleeting: everyone inside and at the
window sees them, nothing said is stored on the server, and clicking an avatar
addresses your words to that person. A list of recent bubbles is kept only in
the browser for the current visit, for anyone who missed one. Following the
user's addition, a bubble stays up longer for a longer message, with a default
of 3 seconds plus 60 ms per character, capped at 10 seconds. The seat and line
defaults stood, since no change was asked for. The next question asks whether
the cats react to talk.
[`8f3e82f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8f3e82f)

---

*Sent 2026-10-07 02:24:54 AEDT*

> A. ask more question at a time is possible

**Result.** The cats react to talk in two ways. The room's chatter is a mood
they feel by character: shy cats hide in a busy café and come out in a quiet
one, and social cats are drawn in. A cat's name in a bubble makes it look up,
and come over if it trusts the speaker. The server matches cat names and reads
nothing else in a bubble. The brainstorming method changed at the user's
request: questions now come several at a time. That preference is noted in
`docs/notes/brainstorm.md` and in machine-local memory. Questions 7 to 11 went
out together: what a person can do with a cat, how trust works, the first
three cats (with a proposed Mochi, Sumi and Kaki), food and treats, and
whether café rules are enforced.
[`2bb56de`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2bb56de)

---

*Sent 2026-10-07 02:34:59 AEDT*

> 7B, cat can scratch and jump off if they don't like it. 8A 9B sumi -> buraku, kaki -> tora 10A 11B with strong negative feedback - cat can react differently, and if they are really angry they will ban you from making that move for a certain time period like no picking up for 2 days.

**Result.** People can pet, call, feed, play with, and pick up and carry a cat,
and a cat that objects scratches and jumps off. Trust is per person and per
cat and never fades with absence. The first three cats are the proposed ones,
renamed: Mochi, Buraku and Tora. The café keeps the bowls full, and each
visitor has a few treats a day. The user turned down enforced house rules in
favour of the cats enforcing their own boundaries: each reacts its own way,
and a really angry cat bans that person from that action for a while. Defaults
were proposed for that anger (annoyed, angry, furious, with grudge length set
by character), for how long a cat tolerates being carried, and for two people
grabbing the same furniture (first grab wins). Flagged that "Buraku" reads in
Japanese as a word tied to discrimination against the burakumin, with
alternatives; the name stands unless the user changes it. Questions 12 to 14
went out: who can rearrange the café, what people can do with each other, and
how people move and act.
[`910873c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/910873c)

---

*Sent 2026-10-07 02:45:06 AEDT*

> burakkul; Q12 A, Q13 B, Q14 A

**Result.** The black cat was renamed again. "burakkul;" was read as Burakku
(ブラック, "black"), assuming a stray "l" beside the semicolon, and the user was
asked to confirm. Anyone inside can rearrange the café from a free catalogue,
within gentle limits: one change per person every minute or so, the door and
walkways kept clear, a limited amount of floor. People can emote, sit
together, hand each other treats and pass a cat. Everything works by pointing
and then acting, the same way on mouse, touch and keyboard, which settled the
tile-snapped pointer with Tab. The anger, carrying and furniture-grab defaults
stood, so `docs/notes/brainstorm.md` was reorganised with each default under
its decision. The last batch went out, questions 15 to 19: day and night, what
the quiet hours leave behind, who draws the pixel art, accounts in detail, and
safety for public text. A default for what persists and what expires went with
them.
[`864a7c7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/864a7c7)

---

*Sent 2026-10-07 02:50:55 AEDT*

> Q15 A Q16 B Q17 A Q18 B Q19 B

**Result.** That ended the clarifying questions.
- The café keeps Canberra time, with light and cat rhythms to match.
- The quiet hours leave traces in the room, and a chalkboard by the door
  notes what the cats got up to, wiped each morning.
- Claude draws the pixel art as code: palette-indexed sprites on a 16-pixel
  grid, with modular cat looks.
- Accounts get a one-time recovery code at sign-up, so a forgotten password
  doesn't cost a regular their cats' trust.
- Public text gets light limits plus a short whole-word slur blocklist.

The persistence default and the name Burakku stood. Three approaches went to
the user, all with SQLite on `/data` and one WebSocket per visitor: a Rust
server with a TypeScript canvas client (recommended: the user's lean where it
pays, and the browser's own text input and accessibility where markers test
them), TypeScript everywhere, or Rust compiled to WebAssembly. The costs were
stated: Rust means two languages and slow builds, twice per push once CI
deploys. The design comes next, a few sections at a time.
[`1794606`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1794606)

---

*Sent 2026-10-07 02:59:55 AEDT*

> use 1. i'm well aware of the pros and that's why i proposed it. i'm curious how you define in rust and generate to TS. I know protobuf / grpc and other template language can do this, but don't know rust can do it.

**Result.** Approach 1 is settled: a Rust server with a TypeScript canvas
client. The question about generating TypeScript got an answer checked
against the ts-rs README first. A derive macro is the compile-time plugin
serde uses to generate JSON code, and ts-rs's `#[derive(TS)]` generates the
TypeScript declaration the same way, honouring serde's attributes, so the
types describe exactly the JSON on the wire. Unlike protobuf it is code-first,
with JSON instead of a binary format; a build id checked on connect replaces
field-number versioning, since both ends deploy together. Two guards came out
of the check: 64-bit integers default to `bigint`, so the protocol overrides
them to `number`, and a check fails if the committed bindings drift from the
Rust types. The first two design sections went out for approval. Design 1 is
the architecture: one binary, one world task that owns the café and processes
commands in order (which makes "first grab wins" free), SQLite on `/data` with
batched writes and snapshots, and cats as data files. Design 2 is the
real-time behaviour: snapshot then events, walks sent as paths, the server
deciding every outcome, slow connections healed by a fresh snapshot, and
calling a cat folded into saying its name.
[`6c22ccc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6c22ccc)

---

*Sent 2026-10-07 03:12:02 AEDT*

> nice explanation. D1: agreed D2: agreed but relex a bit on the limits

**Result.** Designs 1 and 2 were approved. The limits moved to token buckets
that allow a burst and then refill: up to 5 bubbles then one every 2 seconds
(was 3 per 10 seconds), up to 3 furniture changes then one every 20 seconds
(was one a minute), and 10 actions a second for everything else. Design 3, the
cat character system, went out for approval:
- A cat is a TOML file of look, traits, daily rhythm and behaviour weights,
  and new kinds of behaviour are Rust modules that cats opt into.
- Needs drift with the Canberra hour.
- Events become stimuli each cat notices.
- Behaviours score themselves from needs, traits, stimuli, trust and the hour,
  and the cat picks among the top few, so it stays in character without being
  predictable.
- Handling ends in welcome, tolerate, refuse, scratch-and-escape, or a ban
  when the cat is furious.
- Trust never fades, and its gains taper within a day so regulars beat
  grinders.
- One seeded generator runs both live and fast-forward.

The first three cats were restated in these terms. Mochi naps after lunch,
Burakku is nocturnal, and Tora has dawn and dusk zoomies, after real cats'
crepuscular habits.
[`f4f2b63`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f4f2b63)

---

*Sent 2026-10-07 03:21:29 AEDT*

> approve

**Result.** Design 3 was approved, and designs 4 and 5 went out together.

Design 4 is persistence and fast-forward:
- One SQLite file on the volume, written by a single writer thread.
- People's changes are written within a fraction of a second; the cats, the
  world clock and the random state are saved every 5 seconds and on Fly's stop
  signal.
- On waking, the server fast-forwards in one-second steps, capped at a week.
- Redeploys behave as short sleeps, and failures are loud rather than
  silently empty.

Two Fly facts were checked in its docs before being relied on. Fly takes daily
volume snapshots, kept 5 days, which serve as the backup. A stop sends SIGINT
with only a best-effort 5 seconds before force, which makes the periodic save
the real safety net.

Working through it exposed a flaw in an earlier default: wiping the chalkboard
at 7:00, and staff tidying at opening, would erase the night before the morning
visitor saw it. The proposed fix: a rolling 24-hour board, and traces that stay
until someone tidies them.

Design 5 is accounts and safety:
- Sign-up with a one-time recovery code.
- argon2id with at most two hashes at once on the 256 MB machine.
- Hashed session tokens in a SameSite cookie, Origin checks, and rate-limited
  log-in.
- Mute stored with the account, and an admin ban run over `fly ssh console`.
- A privacy rule: bubble text is never written to the database or the logs,
  so the C10 logs record that someone spoke, not what they said.
[`c9ebf01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c9ebf01)

---

*Sent 2026-10-07 03:31:20 AEDT*

> D4 D5 approved; use light mockups

**Result.** Designs 4 and 5 were approved, and with them the fix to the
chalkboard: a rolling 24 hours, with traces staying until someone tidies them.
The user took up the brainstorming visual companion for the client, asking for
light mockups, so it was started from the worktree and showed one screen of
wireframes:
- two phone layouts at 390×844 to choose between (the whole room on top at 2×
  with controls below, or the room filling the screen at 3× and panning);
- a desktop layout at 1920×1080 (the room at 5× between a readable chalkboard
  and a panel of who's here and what was said);
- a 12×10 floor plan with the line's faces at the street window, a door
  walkway that's never blocked, and a window seat for cats to watch the line.

The non-visual parts went to the terminal: whole-number scaling that refits on
resize, sprites as palette grids, bubbles and menus as HTML over the canvas
(any language renders, and the keyboard can focus menus), a screen-reader live
region, and keyboard bindings.

The companion's working directory holds a session key, so `.superpowers/` was
added to `.gitignore`. The screen itself was copied to `docs/notes/mockups/`
to keep it in the record.
[`59067a3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/59067a3)

---

*Sent 2026-10-07 03:47:16 AEDT*

> phone both A and B with one button to switch. others approved. add link to readme at login page

**Result.** The phone gets both layouts with one button to switch between
them. A is the default, since the user's clicks in the companion were on A,
and the choice is remembered per device. The desktop layout, the floor plan
and the client's technical points were approved. As the user asked, the
logged-out card links to `/readme/`. With no more visual questions ahead, the
companion screen was cleared.

The last section, design 7, went out:
- Logging: one JSON line per user action (who, what, when, outcome) for C10,
  with bubble text, credentials and IP addresses never logged, and a formatter
  script over `flyctl logs` as the live view.
- Testing: seeded `cargo test` for the cats' rules, fast-forward and
  persistence; a drift check on the generated types; black-box `spec/` checks
  for the promises; Playwright for the keyboard pass at both marking sizes;
  a Rust CI job the deploy waits on.
- A first split of the README's promises into enforced (and by which layer)
  and judged (and how assessed).
- The `CLAUDE.md` rules that follow from the design.
[`a4ce6c2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a4ce6c2)

---

*Sent 2026-10-07 03:54:43 AEDT*

> approved

**Result.** With design 7 approved, the brainstorm ended and the spec was
written in one commit.

`docs/design.md` now specifies the whole app, from the café and who it is for
through the cats' character system, the room, architecture, real-time,
persistence, accounts, the client, logging and checks. It ends with one table
of every tunable number.

Ten ADRs record the significant decisions with their rejected options:
- 0002 the app's shape and scope;
- 0003 the Rust and TypeScript stack;
- 0004 the single authoritative world over WebSockets;
- 0005 SQLite on the volume;
- 0006 fast-forward on wake;
- 0007 password accounts with a recovery code;
- 0008 the cap of six with a window line;
- 0009 the quiet-seat rule, as crit 9's decision;
- 0010 fleeting speech;
- 0011 data-defined cats, including why not LLM-driven ones.

`AGENTS.md` gained "What the app must keep": never store or log speech, no
email or IP addresses stored, the server decides, the cap and the door
walkway, trust that never fades, the keyboard and both marking sizes, cats
through `content/`, and generated types never edited by hand.

Before the user reviewed it, the self-review checked the spec:
- Links and anchors all resolve.
- A contradiction was fixed: no stored IPs against per-IP rate limits, now
  counted in memory only.
- Numbers the design had left open were pinned as tunable defaults.
- A wrong row about Mochi's rhythm was corrected.

The visual companion was stopped. The spec now waits for the user's review
before any implementation plan.
[`02b176a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/02b176a)
[`0e4e982`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0e4e982)

---

*Sent 2026-10-07 04:23:23 AEDT*

> approved. finish spec and the implementation plan, then separate a first phase deliverable for crit 8, then finish that phase. /goal

**Result, the plan.** The spec was approved as written. `/goal` isn't a
command here, so it was read as marking the request as the goal to carry
through without stopping. That instruction also settled what the planning
skill would otherwise have asked: the execution method was chosen by the
agent and recorded in ADR 0012.
- **Roadmap.** `docs/notes/plan.md` splits the spec into five phases, lined up
  with crits 8, 9 and 10, the deadline and the showcase.
- **ADR 0012, the workflow.** A detailed plan per phase when it starts; each
  phase built natively, test first; then a fresh reviewer briefed through
  files.
- **Phase 1, "It's alive".** The crit 8 deliverable, planned in 18 tasks in
  `docs/notes/plan-phase-1.md`, each with files, interfaces, tests first and
  code. It covers accounts with recovery codes, the room with six inside and a
  line at the window, walking by mouse, touch and keyboard, fleeting bubbles,
  the three cats with a first set of behaviours, pets and calls, trust that
  persists, `/readme/`, the image and the deploy.
- **What phase 1 leaves out.** It names what it defers to later phases, and
  the five inputs most likely to bite a real visitor, each pinned by a test.

Before writing code into the plan, every crate API it relies on was compiled
in a throwaway spike. That caught rand 0.10's moved traits, argon2 0.6's new
hashing call, and ts-rs turning 64-bit integers into `bigint`. A script also
checked all 28 sprites drawn into the plan for size and stray pixels.

Planning turned up three changes to the spec, each going into `design.md` in
the same commit as its code:
- the per-IP limit on log-in attempts rises from 5 to 60 a minute, since a
  whole showcase room shares one address;
- a cat sniffs your hand the first time it meets you awake, so a first visit
  always leaves a trace;
- a Leave button frees your seat at once.

The welcome message gained the café's capacity, for the "4/6 inside" status
line.

Partway through, the user pushed their first `README.md`; the plan was rebased
onto it. One mismatch was noted for the user: the README promises soothing
music, which the design doesn't have.
[`2719d7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2719d7a)
[`28310c8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/28310c8)
[`82cfe9a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/82cfe9a)

**Result, the build (Tasks 1 to 12, logged in the next session).** The
session ran out of budget during Task 13, before it could log this, so it is
filed here, under the prompt that asked for it. Twelve tasks were built test
first: the server and `/readme/`, the protocol in Rust with its generated
TypeScript, content from `content/`, the SQLite store, accounts with recovery
codes, the trust book, the three cats as data, the world (arriving, the window
line, walking, talking, the cats' lives), the WebSocket, the client's sprites
and its way in. Each task's departures from the plan are in its "Execution
log". Two rulings changed `design.md`:
- a cat sniffs a newcomer's hand even when napping, because a café left
  empty had all three asleep and a first visit left no trace;
- cats only nap, hide or wander where someone can stand next to them, since
  one corner of the cat tower was out of reach.

At that point 125 Rust tests, 11 client tests and 16 spec tests passed.
[`b6d6949`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b6d6949)
[`f475814`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f475814)
[`09bdee4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/09bdee4)
[`029dbda`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/029dbda)
[`113b30f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/113b30f)
[`34e5fdd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/34e5fdd)
[`dbd8a58`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/dbd8a58)
[`b8da323`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b8da323)
[`f0d5fb1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f0d5fb1)
[`eec8cb4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/eec8cb4)
[`7db40cf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7db40cf)
[`fdf9c0f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fdf9c0f)
[`fb86b1c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fb86b1c)

---

## 3. Building phase 1 for crit 8

*Session `308a67b6`, Claude Code (Opus 5.5).*

*Sent 2026-10-07 09:31:50 AEDT*

> carry over the context from 2ae45b1d-f600-4c98-8122-bf9b88f7c0ab and continue the goal

**Result.** The earlier session was found from its transcript and progress
ledger. It had stopped mid-Task 13 when its budget ran out, with Task 13's
code written and passing but not yet looked at or committed. The files were
compared line by line with the plan and matched. In a browser the café drew
crisp at 5× on a 1920×1080 desktop and at 2× on a 390×844 phone with no
sideways scroll, and refitted after a resize. The cats moved on their own,
and a scripted second visitor walked in. One frame after the first sign-up
drew the avatar in the wrong look; it couldn't be reproduced, and it was
noted rather than chased. Task 14 (acting in the café) was then written from
the plan and passed its tests.
[`ce55fef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ce55fef)

*Sent mid-turn, 2026-10-07 09:39:27 AEDT*

> it's flashing reconnecting fast and nonstop

**Result.** The cause was a reload loop, not a dropped connection. The local
server read the client's build id once at startup; the client had been
rebuilt since, so every welcome told the page it was out of date, and it
reloaded, reconnected and reloaded again. The agent explained this and
proposed two fixes: reload at most once per build (recommended), or read the
build id per connection. The user then interrupted the turn.

*Sent 2026-10-07 09:41:56 AEDT*

> read crit 8 spec, build bare minimum MVP for it. you can over simplify things first - we can adjust later. record all things you simplified so we have something to work on later.

**Result.** The C8 page asks for: deployed by the cutoff; a visitor can do the
core thing and find their trace when they come back; the README, `PROCESS.md`
and a reflection in the user's words; and the repo public via `/ship`. The
rest of phase 1 was cut to what that needs, and every cut was written into
[`docs/notes/crit-8-mvp.md`](notes/crit-8-mvp.md): fifteen items, from the
missing two-window and phone checks to the skipped README material and phase
review.
- **The reload loop.** Fixed the recommended way, test first. A tab reloads at
  most once per server build; it carries on (simplified: silently) if the
  mismatch remains, and never reloads without `sessionStorage`. Seen in the
  browser: one reload, then steady.
- **Task 14.** Checked by hand with the mouse: walking, the cat menu,
  petting (Tora sniffed, trust 0 → 0.6), and bubbles. Japanese renders and
  markup stays text. Checked with the keyboard alone: the pointer, Tab
  through cats, Enter for the menu, Escape out, and Tab on to the talk box.
- **Task 15, trimmed.** The three-stage image and a Rust CI job the deploy
  waits for. Getting rustfmt and clippy clean took a formatting commit at
  width 140 (the code's own width, about half the churn of the default) and
  `#[allow(dead_code)]` on two items kept for phases 3 and 4. Against the
  built image, `pnpm check` passed and no spoken words reached the logs. A
  script showed trust and the session surviving a container restart. The
  plan's by-hand passes at both sizes were cut (listed in the notes).
- **Deploy: blocked.** There's no Fly token on this machine, and by the plan
  agents don't enter it. The repo is still private, so CI won't deploy
  either. The live URL accepts a connection but doesn't answer.
[`5b20999`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5b20999)
[`383506a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/383506a)
[`e5249fd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e5249fd)
[`978a923`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/978a923)

*Sent mid-turn, 2026-10-07 09:44:58 AEDT*

> yes I clicked

**Result.** It confirmed that three unexplained walks in the server log
during the browser check were the user's own clicks, not a fault.

*Sent 2026-10-07 09:54:00 AEDT*

> add one furniture you can move around

**Result.** Built as the first, cut-down piece of the design's rearranging
(phase 2), in the same spirit as the crit 8 cut, with every simplification
added to [`docs/notes/crit-8-mvp.md`](notes/crit-8-mvp.md) (items 16 to 24).
- **What moves.** A new floor cushion, from the design's catalogue: people
  walk over it, cats nap on it. It is the only movable piece. A piece that
  blocks can't be marked movable yet, because moving one safely needs a
  cut-off check and a "someone's standing there" check; the content loader
  refuses it.
- **How.** Click, tap or Tab to the cushion, pick "Move the cushion", then
  pick a spot. The server refuses anything off the floor, over another piece
  or on the door's walkway, tells everyone who moved it, and saves the
  arrangement so it survives a restart. Moves are limited to 3 at once, then
  1 every 20 seconds, the design's numbers.
- **Tests first.** Rust tests for the placement rules and the restore;
  client tests for the state and for pointing at the cushion; and
  `spec/furniture.test.ts`, which holds `AGENTS.md`'s walkway rule, the
  real-time move and the limit. Each was seen failing first.
- **Checked by hand.** Mouse, keyboard and phone size. The keyboard check
  found a fault: after the menu, the pointer jumped back to your own tile,
  so arrows moved from there instead of from the cushion. Placing now starts
  with the pointer on the piece. A restart brought the cushion back where it
  was last put. One apparent persistence fault turned out to be a spec run
  moving it after the hand-made move.
- **A test-helper race.** One spec run timed out waiting for a welcome. The
  helper attached its listener only after the socket opened, so a welcome
  arriving right behind the upgrade could be lost; it now listens first.
  Later full runs passed 19 of 19. Runs fired back to back also hit the
  per-address sign-up limit, which is the limit doing its job.
[`8907493`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8907493)
[`8292b36`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8292b36)

*Sent 2026-10-07 10:06:08 AEDT, a bare `/comp4020:ship`, which loads the ship skill; its steps are the work and are filed here.*

**Result.** The skill's first steps found the repo right (private, in the
course org) and the crit 8 cutoff at Wed 13:30. Preflight found two blockers:
`README.md`, `PROCESS.md` and `reflections/crit-8.md` were uncommitted in the
main checkout, which was 26 commits behind, and the Fly app had never been
deployed. The checkout was fast-forwarded to
[`ed466d4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ed466d4)
and that commit was deployed by hand; the live site serves its page and both
assets, and the three read-only live checks pass. The secret scan flagged four
places as "credential assignment"; each was a dummy test password or a
function name, and the one real token is in the ignored `mise.local.toml`.
Nothing was made public: the flip waits for a yes.

*Sent mid-turn, 2026-10-07 10:09:28 AEDT*

> adjust @PROCESS.md to reflect current progress and selective MVP.

**Result.** `PROCESS.md`'s "Where it stands" now says a small version is live
and links what it leaves out; "Next" became "From design to a small live
version": the five phases, the bare-minimum request and its recorded cuts, the
reload loop caught by watching it, and the cushion. Your own sections stay,
trimmed in a few places to keep it near 1,100 words. The evidence check passes
with all 14 cited commits resolving.

*Sent 2026-10-07 10:15:24 AEDT*

> yes flip

**Result.** Because the reflection was still uncommitted and the flip can't be
undone, the agent asked once more, naming what becomes public, with three
choices. *Answered 10:15:47 AEDT: "Commit both, then flip (Recommended)".*
`README.md` and `reflections/crit-8.md` were committed by name and pushed. The
secret scan was re-run and found the same four harmless test-fixture lines,
each read before going on. The repo was then made public, and the dispatched
CI run passed the Rust job, the checks (the whole spec against the built
image, the evidence check, both secret scans) and the deploy. Fly release v2
came from that run; the page and its assets load, and the read-only live
checks pass. The deployed commit is tagged `crit-8`.
[`659952a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/659952a)

## 4. Closing phase 1 and building phase 2

*Session `94478ac0`, Claude Code (Opus 5.5, then Sonnet 5.5 as the session's
model changed).*

*Sent 2026-10-09 17:24:24 AEDT*

> read the repo, give an overview on where we are, and what we cut short for crit 8

**Result.** An overview, no changes. Phase 1 is live and tagged `crit-8`,
deliberately cut; Tasks 17 (README material) and 18 (the whole-phase review)
never ran, and `docs/notes/crit-8-mvp.md` lists 24 things the cut skipped or
simplified. The ones that matter most for crit 9 were named: nobody has
watched two real browsers side by side, the phone was checked only for
drawing, and nothing that signs up has been tried on the live site. ADR 0009
is already written as crit 9's multi-user decision, but its nudge and
walk-out aren't built.

*Sent 2026-10-09 17:27:46 AEDT*

> add the cut-short parts to the plan, then resume on the plan, keep working until reach hard blocker or finished phase 1 & 2 /goal

**Result.** The cut list is now in the plan. Items 1 to 15 close phase 1
through a new Task 19 in `plan-phase-1.md` (a refresh notice for a tab on an
old build, far pets pinned by a test, bubbles kept inside the room, the wrong
look chased, the two-window, phone and restart checks done by hand in a
browser, a first look at the art, `placeholder/` removed), run after Task 17
and before Task 18's review. Items 16 to 24, all the cushion's, go to phase
2's rearranging, which `plan.md` now spells out. `crit-8-mvp.md` gained a
table saying where each item went, with a column for its outcome.
