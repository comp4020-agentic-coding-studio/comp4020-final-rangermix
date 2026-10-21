# Prompts and results

A curated record of the sessions that built this project: each prompt as it
was typed, a trimmed version of what came back, and the commits it produced.
It is source material for `PROCESS.md`, not a draft of it. The rules for
keeping it are in `AGENTS.md` under "The prompt log".

---

## Crit 8: "It's alive!" (cutoff Wed 7 October 2026, 13:30 AEDT)

### 1. Harness

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

### 2. Designing the cat café

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

### 3. Building phase 1 for crit 8

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

---

## Crit 9: "All at once" (cutoff Wed 14 October 2026, 13:30 AEDT)

### 4. Closing phase 1 and building phase 2

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

*Continued, same prompt.* Phase 1 was then closed, and phase 2 built.

- **Task 17, README material**, as a workflow: one researcher per area, an
  independent checker re-opening every source (seven that wouldn't open
  were dropped), one writer; two quotes re-checked by hand and one wrong
  line corrected. `docs/notes/readme-material.md` adds what a check
  enforces, by test file, and where the README and the design differ (the
  template's first lines are still published; the README promises music).
  Nothing was written in `README.md`.
  [`343d8be`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/343d8be)
- **Task 19, the crit 8 cut.** A tab on an old build now says to refresh;
  bubbles stay inside the room; far pets are pinned by tests (a second pet
  on the way replaces the first, which explains crit 8's script). The
  "wrong look" after a sign-up was found, not a fluke: everyone walked in
  to the same tile, so whoever stood there hid the newcomer; newcomers now
  go to a free tile. Two browsers side by side, the phone by touch and
  keyboard with a resize, and a restart mid-visit were checked by hand in
  Playwright against the image, with screenshots in `docs/notes/screens/`.
  [`a41b6a2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a41b6a2)
  [`dfb30b9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/dfb30b9)
  [`2756005`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2756005)
  [`4fc73eb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4fc73eb)
  [`8cbdedf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8cbdedf)
  [`bc44fea`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bc44fea)
- **Task 18, phase 1's review**, as a workflow: six reviewers by area, two
  skeptics per finding. 17 findings stood (4 major: a silent phone holding
  its seat for minutes, huge names as rate-limit keys, anyone locking a
  name out of log-in, the talk box dead after Leave and Come back). Eleven
  were fixed test first, two answered as settled design, four folded into
  phase 2. Phase 1 closed with everything green.
  [`b21b06c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b21b06c)
  [`02ba73f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/02ba73f)
  [`123a899`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/123a899)
- **Phase 2's plan** ([`c34c3b9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c34c3b9)),
  then its build, test first: the quiet seat of ADR 0009, crit 9's
  recorded decision
  ([`207fa4b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/207fa4b));
  emotes
  ([`4ec24e3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4ec24e3));
  rearranging together, where everything but the bowls moves, a grab
  reserves the piece so the first grab wins, the server keeps the walkway
  clear and never lets a piece cut the café off, cats jump off, and
  people sit and share the sofa
  ([`77dbe99`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/77dbe99));
  the phone's layout B
  ([`d3ef876`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/d3ef876));
  and browser checks in the spec and CI, after which spec files run one at
  a time because they share one café that seats six
  ([`e42f2a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e42f2a4)).
  design.md and ADRs 0004 and 0009 record it
  ([`487c519`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/487c519)).

Phase 2's review, as a workflow like phase 1's, kept 19 findings (4
major: a reconnect not counting as being there, a carrier able to hold two
pieces, a half-called-off grab losing "first grab wins", and layout B
leaving the keyboard's pointer off screen). Fifteen were fixed, test first
where they were behaviour, and four answered. Two CI runs had failed on
the cap check before the spec ran its files one at a time; neither
deployed. Phase 2 closed with 188 Rust tests, 59 client tests and the
spec's 26 (four in a browser) green twice, a minute apart, against the
image.
[`4595f6f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4595f6f)
[`fc32dc5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fc32dc5)

*Sent 2026-10-09 19:15:06 AEDT*

> /goal finish phase 3

**Result.** Phase 3's plan
([`bdfb1dd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bdfb1dd)),
then its build: one log line for every action a visitor takes, refusals
and walks over included, with `pnpm logs` turning the JSON into sentences
for crit 10
([`a086231`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a086231));
and the cats' moods in one change to the protocol: hunger and play,
bowls refilled on Canberra's clock, three treats a day to put down, offer
or give, playing, picking up, carrying and passing a cat, laps, knocking
things over and tidying, and anger that turns into scratches and stored
bans
([`0a08fca`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0a08fca)).
The world's side of that was written before its tests, which the plan's
execution log owns up to. A treat put down while walking in landed in the
doorway; it now lands on the floor
([`e730eb9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e730eb9)).
The whole-phase review kept 34 findings, 10 major
([`3bc886a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3bc886a)),
and the client's answers were briefed for an agent working in parallel
([`6e98a5e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6e98a5e)).
The course key's weekly budget then ran out, at 20:30, during triage:
finding 4's fix was written but not committed, and the client agent had
only read code. Picked up in the next session.

### 5. Finishing phase 3

*Session `d554b4ba`, Claude Code (Opus 5.5).*

*Sent 2026-10-10 16:41:08 AEDT*

> continue on the last session which stopped due to used up all credit

**Result.** Where the last session stopped was read from its transcript,
not guessed: the goal "finish phase 3", in the `phase-1-2` worktree, with
finding 4's fix passing its test but uncommitted and the client agent's
worktree gone. All 34 findings were then answered in this session itself,
no agents, each confirmed against the code first and fixed test first,
with the test seen failing for the reason the finding gave. The
"Answered" table in `docs/notes/reviews/phase-3-findings.md` says how for
each.
- **Rooms and handling.** A chair on the rug blocks again
  ([`30dc5ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/30dc5ec)).
  A held cat that turns on its holder gets down; nobody holds a cat seated;
  nothing is passed to someone walking out or dropped; a full cat takes no
  treat from a hand. Two rules changed in design.md: a pass follows the
  pick-up's bans and anger, and a cat bans only once already furious, so a
  scratch comes first. That still left Tora's first refusal exactly on the
  scratch line, so her temper went from 0.6 to 0.65
  ([`52c5f0d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/52c5f0d)).
- **The logs.** Refusals at the end of a walk, every put back, account
  refusals with their code but never the name typed, logouts, and what each
  refusal was about, are all logged now
  ([`ab8a31b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ab8a31b));
  the narrator has words for every line the server writes and runs from any
  path
  ([`4ec799a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4ec799a)),
  with one phrasing corrected after reading the local café's own logs
  through it
  ([`6e38723`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6e38723)).
- **The cats' lives.** No settling on a seated stranger, on another cat, or
  two to a lap; each new piece looked at once, from where someone can reach;
  no playing with toys that aren't there; midnight's new treats sent to
  everyone; the bowls safe on the day the clocks go back; a picked-up
  toppled piece saved standing; the lap threshold from tuning. Finding 30
  was answered by design: design.md's empty café holds over the plan's
  "prowling hour", and the test now counts Burakku's knocks
  ([`eba6bfc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/eba6bfc)).
- **The client and the checks.** A held cat goes with its holder, with
  "Put {name} down" in the bar; the treat button keeps its focus; a lap cat
  is drawn over its person; menus stop offering what full arms can't do;
  layout B holds still under a ring. Four browser checks were added, and a
  CI step that checks the app's own log lines after the spec
  ([`151e04f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/151e04f)).
- **A check that waited on the cats.** CI failed that push on one browser
  check, which waited up to 200 seconds, as fresh visitors, for a cat to
  let itself be picked up; nothing deployed. The app's own log, narrated,
  showed why: all three cats curled up within half a minute and slept on
  for three more, and one retry came 9 seconds after a refusal (the
  spacing ran from the ask, not the answer), which counted as pushing. A
  cat's consent isn't the test's to have, so the check now proves the touch
  path to "Pick {name} up" and that the café answers, and puts the cat down
  from the bar when it does agree; the bar became its own module with a
  client test. Running the whole spec on a fresh container, as CI does,
  then turned up a keyboard fault: Tab's list kept each target's tile from
  the first press, so it could name a cat but point where the cat had
  been. Each Tab now finds where its target is now
  [`25ff89d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/25ff89d).
- **Checked.** 250 Rust tests and 76 client tests green; the spec's 47
  (9 in a browser) green twice against the image on fresh containers, as
  CI runs it, each time followed by the new log check over the app's own
  199 lines. CI then passed all three jobs on the closing push and
  deployed it; the read-only live checks pass, and the live page's script
  has the new carrying bar.

### 6. A line for each crit

*Session `6558300f`, Claude Code (Opus 5.5).*

*Sent 2026-10-12 21:38:29 AEDT*

> add separation line by crit 8, 9, 10 in @docs/prompts-result.md and save in harness.

**Result.** Before this prompt, the user had undone the weekly lines from
[`93a6aba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/93a6aba)
in the working tree, including that session's entry, so this replaces them.
Each section now runs up to a crit's cutoff, the moment the crit's snapshot
is taken: crit 8's holds everything sent up to Wed 7 October 13:30, and crit
9's holds everything after that, up to Wed 14 October 13:30. That puts
phase 3, built for crit 10, under crit 9, because it was done before crit 9's
cutoff. Crit 10's line goes in with the first entry sent after crit 9's
cutoff. As before, each crit is a `---` and a `##` heading, with the sessions
under it as `###`. `AGENTS.md` has the rule under "The prompt log": where the
line goes, how it is labelled, splitting a session that runs across a
cutoff, and a last section for anything sent after crit 10, up to the final
deadline.

### 7. `PROCESS.md` for crit 9, and building in slices

*Session `bef6b01b`, Claude Code (Opus 5.5). Its first prompt asked for the
weekly lines that entry 6 replaced.*

*Sent 2026-10-12 21:45:43 AEDT*

> now base on @docs/prompts-result.md rewrite @PROCESS.md per assignment / crit requested.

**Result.** The brief, the crit 9 page and the assessment page were read live
first. `PROCESS.md` runs 900 to 1,100 words. It is rewritten, not appended to,
at each crit, and it makes the case for the stack and the workflow, with ADRs
linked rather than restated. Crit 9 adds real-time deployed, one recorded
decision about several people at once with its options and cost, and an
account of how the work was directed, grounded and corrected. Uncited claims
don't count, and the top band wants fixes that land in the harness or the
checks rather than retries.
- **Kept, condensed:** the harness, the design and the stack, still in the
  user's first person and built on their own prompts, quoted verbatim.
- **Replaced:** crit 8's "From design to a small live version" gave way to
  three sections:
  - the workflow as it ran: phases, reviews keeping 17, 19 and 34 findings,
    and two budget-outs carried over by files;
  - crit 9's decision, ADR 0009, set against the README's "accompany,
    warmness, relaxed time with friends";
  - directing, grounding and correcting, with four corrections that changed
    the code or a check (the reload loop, the shared spawn tile, spec files
    run one at a time, and the browser check that waited on a cat's consent).
- **Checked:** every claim was checked against `git log`, the review notes
  and the plans.
  - The skeptics were the reviews' practice, not ADR 0012's, so the text
    credits them to the reviews.
  - A claim about the crate API spike was dropped, since no commit records it.
  - A sentence judging whether ADR 0012's revisit trigger had been met was
    left out as the user's call.
- **Numbers:** 1,099 words counting hashes, and the evidence check passes
  with 20 cited commits.
- **Flagged:** the brief advises drafting `PROCESS.md` yourself, and
  `AGENTS.md` says the user writes it in their own words, so this is a draft
  to rework.

*Sent 2026-10-12 22:13:07 AEDT*

> 1. The harness of documenting and writing PROCESS.md is approved by course convenor, and was promoted to others as a good practice. Correct @AGENTS.md on this. You will write PROCESS.md for me, however I will decide what's the content inside eventually. When there's a lot of contents to choose from, show me the options and let me choose.
> 2. This is a rather small MVP project, not a full on one, so it's okay to stay tightly coupled as long as it won't affect speed too much. Instead of phases, create virtical slices of functionalities, then create spec for each of them. We'll have two level of plans: root-level plan for the project itself and all slices, and slice-level plans prepared just before implementation so it will be updated to the details of the project. Each slice will be build natively as you said in option 1. however I don't know what you mean by "no independent check until the end of the phase", you mean checked by myself?
> 3. write a draft for crit 9 reflection

**Result.**
- **Who writes `PROCESS.md`.** This settles the previous entry's flag.
  `AGENTS.md` no longer says the user writes it. A new "PROCESS.md" section
  sets the rules:
  - it is written from the record, with every claim cited;
  - when there is more material than fits, the options come to the user
    first;
  - the user's edits win;
  - it is rewritten at each crit;
  - `README.md` and the reflections stay the user's, drafted only on request.

  ADR 0013 records the decision, with the convenor's approval as the user
  reported it, and `design.md`'s harness gained a line linking it.
- **Slices instead of phases.** ADR 0014 supersedes ADR 0012.
  - **The question.** "Independent check" meant a reviewer who didn't build
    the work: a fresh agent, briefed through a file, reading it cold. It did
    not mean the user, whose own checks are separate. Under phases that
    review came only at a phase's end, which is how phase 3's 34 findings
    arrived at once. Under slices it comes after every slice.
  - **The root plan.** `docs/notes/plan.md` was rewritten. It holds the
    project, phases 1 to 3 as built, the old phases 4 and 5 as six slices,
    and who writes what.
  - **The specs.** Each slice has a spec in `docs/slices/`, made from a
    template: the story, what's in and out, a "done when" table naming how
    each line is held, the rules it touches, its numbers, and open questions
    with proposed defaults. The six slices are fast-forward on wake, the
    chalkboard and night traces, mute with the blocklist and the admin ban,
    the showcase load check, the art pass and the accessibility pass. All
    six are `Proposed` until the user approves them.
  - **The open questions:** what a visitor sees while the café wakes;
    whether the chalkboard names people; where the blocklist's words come
    from; whether to load-test the live café, which would leave forty
    accounts that can't be deleted; the README's promise of music; and
    axe-core as a test dependency.
  - **The rules.** `AGENTS.md` gained "How the work is built" and an entry
    for the two levels of plan.
- **The crit 9 reflection.** A 290-word draft in `reflections/crit-9.md`.
  The breakthrough is fresh reviews finding the several-people bugs the
  tests missed, which led to the switch to slices. The second answer is
  about prompts getting shorter because the direction lives in files.
- **Not done:** `PROCESS.md` doesn't yet mention ADR 0013 or 0014. Under the
  new rule, the options for it go to the user first.

*Sent 2026-10-13 00:03:32 AEDT*

> A & B

**Result.** Both of the options offered for `PROCESS.md` went in.
- **A.** In "The case for the workflow", the paragraph about the budget
  running out gave way to the switch to slices. It quotes the user's line on
  tight coupling and cites ADR 0014 and
  [`5196876`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5196876).
- **B.** "The harness came first" gained one sentence: the agent writes the
  file from the log and the user chooses what goes in, a harness the
  convenor approved (ADR 0013).
- **"Where it stands"** now says "the first three phases" rather than "three
  of five", since there are no phases after the third.

Making room took about 40 words out elsewhere. Most of that came from
tightening phrasing, and one detail was cut: that the fresh run also caught
Tab pointing where a cat had been. It still stands in the prompt log and in
[`25ff89d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/25ff89d).
The result is 1,100 words counting hashes, and the evidence check passes
with 21 cited commits.

---

## Crit 10: "Fly by instruments" (cutoff Wed 21 October 2026, 13:30 AEDT)

### 8. The flaky ring check

*Session `c232fad1`, Claude Code (Opus 5.5). The user started it from a
proposal made in session `efabe266`, which began with their prompt for a
summary of the project at 16:06:22 AEDT. Its prompt is the brief that
session wrote, quoted below without the line the app adds naming a shared
notes folder outside the repo.*

*Sent 2026-10-14 16:09:02 AEDT*

> Background (from the session that started this one):
> Catppuccino is a COMP4020 final project: a real-time multi-user pixel-art cat café with a Rust server and a TypeScript canvas client, deployed on Fly at comp4020-final-rangermix.fly.dev, with CI in GitHub Actions running `cargo test` plus a vitest/Playwright spec in spec/. Phases 1–3 are built and live. The repo has strict harness rules in AGENTS.md: test first, commit and push per task directly on main, every prompt logged verbatim in docs/prompts-result.md with commit hashes taken from git log, working state kept in docs/notes/. On 14 Oct the user asked for a project summary, and that summary found this flaky browser check failing on docs-only commits; this session is the follow-up.
>
> Task:
> The browser check "in the bigger room, keeps a keyboard-opened ring round a cat well away from you" in spec/browser.test.ts (around line 330) fails intermittently in CI and has turned `main` red. It failed on two commits that changed only docs: GitHub Actions run 38396585523 (13 Oct, "reflection & readme": "the ring is round its cat: expected 116.99 to be less than or equal to 72") and the run for "Mark each crit in the prompt log" (12 Oct, expected 130.99). CI's deploy job is skipped whenever this fails.
>
> Task:
> 1. Read AGENTS.md (CLAUDE.md links to it) and docs/design.md first, and follow their rules.
> 2. Find the root cause. Hypothesis, not confirmed: the test records `cat.at` when it tabs to the cat, then waits 500ms. During that wait the cat walks on and the ring follows it, so the test compares against a stale tile. The other possibility is a real client bug: in layout B (the bigger room that follows you), the ring doesn't track its cat, or the view snaps back to you. Reproduce it locally, running the spec repeatedly if needed, and decide which it is from evidence.
> 3. If the bug is in the client, fix it test-first: get a check that fails reliably, then fix the code. If it's the test, make it deterministic, for example by reading the cat's position from the latest frames at the moment of measuring. Don't loosen the 1.5-tile tolerance, and don't wait on a cat's consent, which an earlier fix (commit 25ff89d) removed for the same reason.
> 4. Run the whole spec and `cargo test` locally, then push to `main` and confirm CI goes green and the deploy runs.
> 5. Log the prompt and result in docs/prompts-result.md as AGENTS.md describes. Crit 9's cutoff (Wed 14 Oct 2026, 13:30 AEDT) has passed, so this entry starts the crit 10 section; look up crit 10's cutoff for the author's group before writing its heading. Record what was found in docs/notes/.
>
> Done when: the cause is named with evidence, the fix is committed and pushed with a test seen failing before it (if it was a client bug), CI on main is green, and the prompt log and notes are updated.

**Result.** The check was right and the client was wrong.
- **The cause.** In layout B the view stops at the room's edges, so a cat
  lying against a wall sits at the screen's edge. To keep every button on
  screen and clear of the bars, the ring slid inwards off its tile, onto the
  cat, by up to its radius plus half a button. The check failed whenever the
  cat it picked was napping by a wall. Both failing runs were at night, with
  cats on the cat bed at (0,7) and the sofa at (0,5).
  - A local probe reproduced 116.99 px exactly, for a cat on the cat bed.
  - The new check reproduced 130.99 px exactly, for the end of the sofa.
- **Ruled out:** both of the brief's ideas. The ring is anchored to the tile
  the check measures, not to the cat. And the room holds still from the
  keypress that opens the ring.
- **The fix,**
  [`4e54ca4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4e54ca4).
  While a ring is open, the room moves over, past its edge if it must, by
  however far the ring would have slid. The ring stays round its tile, with
  every button on screen. Touch rings had the same fault and get the same
  fix. `design.md`'s line on layout B now says so.
- **Test first.** A new browser check opens a ring by keyboard on the sofa's
  end, against the left wall. It failed three times out of three before the
  fix and passes after it. A new unit test for `ringCentre`, the clamp
  factored out of `ringPositions`, also failed first. The original check
  keeps its 1.5-tile tolerance and waits on no cat.
- **Checked.**
  - Locally, against a release build on a fresh database: the whole spec
    (48 checks), the browser file five times in a row, the client's 77 tests
    and all 250 Rust tests.
  - CI: the fix's own run was cancelled in the queue by a newer push from
    the slice 01 session, which shares this checkout. The next run, on
    [`1c1a1f3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1c1a1f3),
    contains the fix and passed all three jobs, including the deploy. All
    ten browser checks passed, and the live bundle has the fix.
- **Recorded.** `docs/notes/ring-check-flake.md` holds the evidence. Crit 10's
  cutoff above assumes the author is in Liùrú. That is inferred from crits 8
  and 9's Wednesday 13:30 cutoffs, and `docs/notes/brief-and-crits.md` notes
  it as inferred.

### 9. Slices 01 and 02

*Session `efabe266`, Claude Code (Opus 5.5). It began before session 8,
which it proposed; its entry follows that one's.*

*Sent 2026-10-14 16:06:22 AEDT*

> give me a summary of current project state

**Result.** A read-only summary: phases 1 to 3 live, six slice specs all
`Proposed`, crit 9's cutoff passed with no `crit-9` tag, and `main` red
on CI from one flaky browser check on docs-only commits. That check became
session 8's task, by a proposal the user started.

*Sent 2026-10-14 16:10:49 AEDT*

> slice 1&2 approved, finish them

**Result.** Both specs approved with their proposed defaults. Each slice was
planned from the code as it stood, then built test first, task by task.
- **Slice 01, fast-forward on wake** ([plan](notes/plan-slice-01-fast-forward.md)).
  The clock and random state are saved with the cats
  ([`a36c0b5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a36c0b5)). A replay runs in one-second steps, quiet, and
  saves once ([`c951efe`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c951efe)). `wake()` runs before the doors
  open, and any startup failure is a JSON line and exit code 1
  ([`1c1a1f3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1c1a1f3)). The wake-up line is narrated and checked
  ([`b116590`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b116590)). A stop and a start of the image in the spec,
  with CI on a Docker volume ([`c85f704`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c85f704)). An 8-hour replay
  takes 54 ms locally. Live redeploys log 3- to 5-second gaps, each taking
  0 ms.
- **Slice 01's review** (fresh agent, [findings](notes/reviews/slice-01-findings.md)):
  1 major (waking got the cats up) and 8 minor. Answered test first:
  findings 1 ([`96a6cca`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/96a6cca)), 2 and 3 ([`1e84f3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1e84f3d)),
  5 ([`afdc819`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/afdc819)), 6 ([`8866b2b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8866b2b)), and 7 and 9
  ([`779fa45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/779fa45)).
- **Slice 02, the chalkboard and the night's traces**
  ([plan](notes/plan-slice-02-chalkboard.md)). Lines are fixed fields, so
  none can carry speech; first meetings name people
  ([`11dbf30`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/11dbf30)). Lines are kept across restarts and replays
  ([`857d7c8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/857d7c8)). Scattered toys are narrated and tidied
  ([`8a893ed`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8a893ed)). The board is read in the desktop panel and
  in a dialog opened from its tile ([`53fa6af`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/53fa6af)). Spec and
  browser checks ([`b8a4800`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b8a4800)) found two client faults, both
  fixed: the board was the first Tab, and the first Shift+Tab skipped the
  last thing.
- **After the usage limit reset** (the prompts were only to continue):
  - **Slice 01's findings 4 and 8.** The restart check now reads the
    restart's own wake-up line and puts down a cushion only the store could
    keep ([`b0e73ca`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b0e73ca)). Before the change, two CI runs had
    failed on a working café whose cats were all napping.
  - **Waking at Fly's baseline CPU.** An 8-hour wake takes 1.9 s, and the
    week's cap 29.5 s. That run also showed cats frozen by timers from a
    clock that had stepped back, guarded in [`a35beb1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a35beb1). All
    nine answers are in the findings file ([`b1f1417`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b1f1417)).
  - **Slice 02's docs and review.** Recorded in design.md
    ([`33e742d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/33e742d)). A fresh reviewer found 1 major problem (the
    board wasn't modal) and 8 minor. Fixed test first in
    [`20c1810`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/20c1810), [`09ca527`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/09ca527) and
    [`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01), and answered in [`5fc5e41`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5fc5e41).
  - **Live.** Both slices are deployed, with CI green on
    [`be74a01`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/be74a01). Live idle stops of up to 51 minutes wake in
    under 20 ms.
- **Left:** two judged lines need a real night: slice 01's wake-up after
  hours asleep, and the user's reading of the board.
  [`notes/slices-01-02-status.md`](notes/slices-01-02-status.md) has these
  and the decisions waiting on the user.

*Sent 2026-10-15 14:23:06 AEDT*

> 1. you can create accounts for testing and do whatever you need to with the cafe with those accounts for testing.
> 2. same with the fly.io deployment, do whatever you need to for testing.
> 3. add 1&2 to harness
> 4. tune the gap cap to 3 days
> 5. while the server do the replays, serve the signup / login page normally. if when they login the replay is still ongoing, serve the cafe page right away with no state, and show "dusting off the cafe..." or something similar, with animation.
> 6. "I’ve put up a card for a follow-up from slice 01’s review: a crash in the café’s live game loop currently leaves the server up with a dead café instead of restarting it." explain why the crash and why not fixed, or just a possible edge case

**Result.**
- **1 to 3, testing live.** [ADR 0015](adr/0015-let-agents-test-on-the-live-cafe-and-its-fly-app.md)
  and a new section in `AGENTS.md` ([`e60dc05`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e60dc05)) cover both:
  - agents test with accounts of their own, named `agent_…`, whose
    passwords are never written down, and keep visits short;
  - on Fly they do whatever testing needs, without changing the course's
    fixed shape or destroying the volume, and leave `main`'s build
    serving.
  Used at once:
  - an agent read the live board and found it empty, because traces from
    before slice 02 had never been tidied, so the cats had nothing left to
    knock over;
  - another agent tidied them ([`dc1c9ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/dc1c9ef));
  - slice 07's live check stopped and started the machine.
- **4.** The cap is `replay_max_days = 3` in `tuning.toml`
  ([`fc086c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fc086c6)), a tunable number, so no new ADR.
- **5, slice 07** ([spec](slices/07-getting-in-while-the-cafe-wakes.md),
  [plan](notes/plan-slice-07-waking.md)).
  - **The server.** The port opens at once and the replay runs behind it.
    A socket opened meanwhile is told `waking` and gets its welcome when
    the café is awake ([`3e83d1d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3e83d1d)). The log check now
    expects `listening` before `woke` ([`bc72005`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bc72005)).
  - **The page.** It shows "Dusting off the café…" with a broom sweeping
    and dust rising, still under reduced motion ([`af4e548`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/af4e548)).
  - **Seen on the image** at Fly's baseline CPU, with the save set back
    three days: the page in 0.4 s, a sign-up during the replay, the
    overlay, then the café after 13 to 15 s ([`4e8b1b4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4e8b1b4)).
  - **The review.** A fresh agent found 1 major problem (a Leave sent
    while waking was lost) and 10 minor. Fixed test first in
    [`0f416e9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0f416e9), [`30bd6e9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/30bd6e9) and
    [`a4e986c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a4e986c), and answered in [`8278fa8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8278fa8).
- **6.** The crash was never observed. It's a gap: if any future bug
  panicked inside the world task, tokio would end only that task, and the
  server would go on serving pages with no café behind them, so Fly would
  never restart it. It was out of slice 01's scope. Slice 07 had to watch
  its new background task anyway, so it now watches the world task too: if
  it dies, the process exits with a JSON line and Fly restarts it. The
  separate card was withdrawn.

### 10. Where it stands, a week out from crit 10

*Session `013dedec`, Claude Code (Opus 5.5), run as a background job.*

*Sent 2026-10-17 17:06:47 AEDT*

> check current progress, what's left in the plan

**Result.** A read-only check of the root plan against the slice notes, the
specs, CI and the live Fly logs.
- **Done and live:** phases 1 to 3 and slice 07. CI on `main` is green
  through `7b1a740`.
- **Waiting on a night:** slices 01 and 02 are built and deployed, each
  short of one judged line.
- **Waiting for approval:** the specs for slices 03 to 06, none planned.
- **Crit 10 (Wed 21 Oct, 13:30):** a `PROCESS.md` rewrite, the user's
  reflection, and a rehearsal of the demo by the logs alone.
- **Stale notes:** the root plan's last section still described crit 9, and
  the status note still asked about the 30-second first wake, which the
  3-day cap and slice 07 had settled.
- **No night's wake yet:** Fly's log buffer held only that afternoon's
  three short wake-ups.

*Sent 2026-10-17 17:10:56 AEDT*

> update your notes first

**Result.** The notes now say where the work stands
([`71fcdf5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/71fcdf5)):
- **The root plan:** crit 10's cutoff, a "where it stands" section, and
  what's left in order. The order of slices 03 to 06 is marked as the
  agent's suggestion, since the user hasn't chosen one.
- **The status note:** the 30-second wait is settled, with today's check
  added.
- **Slice 01's notes:** the afternoon's three wake-ups (3 to 8 ms after gaps
  of 5 to 15 minutes). Fly's buffer keeps only 100 lines, so the night's
  wake had already gone; the note says how to catch the next one.
- **The brief note:** `crit-8` is the only crit tag on the remote.

*Sent 2026-10-17 17:50:31 AEDT*

> for the long gap checks use unit test and integ test with mocked time. do not rely on realworld checks

**Result.** Slice 08, "Long gaps held by mocked time"
([spec](slices/08-long-gaps-held-by-mocked-time.md),
[plan](notes/plan-slice-08-mocked-time.md),
[ADR 0016](adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)),
approved by the ask itself
([`8d3b2f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8d3b2f9)).
- **The gap it closed.** The unit tests already passed time in. The built
  binary could only read the wall clock, so slice 07's tests faked a long
  sleep by rewriting the saved clock. Slices 01 and 02 each waited on a
  real night.
- **One clock**
  ([`5805cdf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5805cdf)).
  `time::now_ms()` is the wall clock plus an offset fixed once at start
  from `CAFE_CLOCK_START`. It's refused on Fly or if it won't parse, before
  the store opens. `listening` says which clock a start is on, and the log
  check requires it.
- **The built café through a night, a midnight and nine days**
  ([`b167901`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b167901)).
  The test starts it at 23:00 and again at 07:30, then checks the wake-up
  line, trust, the 7:00 refill, the board and the furniture. Slice 07's
  tests sleep a week on the same clock. Two things turned up:
  - The bowls are empty by 07:30 because the cats eat the 7:00 refill
    within minutes. That's the café working, and the test was wrong.
  - Tests chose ports in a way that could race. The café now binds port 0
    and logs the port it took.
- **The night lines off the live café**
  ([`2d51fa3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2d51fa3)).
  Slice 01 went to `Live`. Slice 02's judged line is now read on the board
  the night test prints. It shows four lines, all within five minutes of
  23:00, and nothing after: once everything is down, the cats do nothing
  the board counts.
- **The review**
  ([brief](notes/reviews/slice-08-brief.md) [`e18bd2d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e18bd2d),
  [findings](notes/reviews/slice-08-findings.md) [`9c24eb0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/9c24eb0)).
  2 major findings and 8 minor.
  - Both majors were checks that could pass without the behaviour: a café
    forgetting treats, and one forgetting its furniture.
  - All were fixed in
    [`b955ba9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b955ba9)
    and answered in
    [`92b6c05`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/92b6c05).
    Each fix was seen failing under its fault.
  - A first fix for the furniture finding was itself flaky. The concurrent
    stress run caught it before it shipped.

*Sent 2026-10-17 20:33:52 AEDT*

> check if the subagent is stalled

**Result.** Not stalled at the time: it had built its copy and run a batch
of clock probes at 20:15, nine odd `CAFE_CLOCK_START` values, each exiting
cleanly. It was quiet since then, and nothing was hung.

*Sent 2026-10-17 21:34:41 AEDT*

> so what and how long are we waiting for

**Result.** The reviewer was stalled by then: it had done nothing for an
hour, two and a half hours in. It was told to write up what it had at once,
and did: 0 critical, 2 major, 8 minor findings, which became the fixes
above.

*Sent 2026-10-21 12:20:38 AEDT*

> merge it

**Result.** `main` fast-forwarded from `7b1a740` to `e702baf` (slice 08's
11 commits). CI run 39526943033 passed: rust, check and deploy. The check
job's log check now runs with `--wall`. The live café's first start on the
new build (`mvhfoihc`, 12:30:52 AEDT) logged `"clock":"wall"`, and woke after
25 minutes asleep in 8 ms. Slice 08 went to `Live`. What's left from it is
slice 02's judged line, read by the user on the board the night test prints.

*Sent 2026-10-21 13:02:42 AEDT*

> rewrite @PROCESS.md as crit required

Asked and answered before writing: which of the new material should fill
the room left after the harness, design, stack and workflow. The user chose
"Logs as instruments" and "Live testing, then mocked time" (not slices and
reviews as a section, and not keeping crit 9's quiet seat), and to push it
to `main` once the evidence check passed.

**Result.** `PROCESS.md` rewritten for crit 10, not appended: 937 words, 15
cited commits, all resolving by `pnpm check:evidence`. The harness, the
design and the stack are condensed. Two new sections:
- the logs as the crit's instruments, and as how the flaky ring check and
  the cats' "consent" were found;
- live testing (ADR 0015), the three days spent waiting on a real night,
  and the mocked time it led to (ADR 0016), with what slice 08's review
  found.
Crit 9's quiet-seat section was cut for room. ADR 0009 still records it.

### 11. Rethinking the look

*Session `9c19684c`, Claude Code (Opus 5.5), run as a background job. It ran
alongside session 10, on its own branch.*

*Sent 2026-10-17 18:05:47 AEDT*

> let's rethink about the visual design of the game. currently the visual is a bit... normal, not standing out. more specifically, I think a better colour setting direction is the https://catppuccin.com/, and the current sprites can be more refined pixel arts. I need your help to judge on whether you think the catppuccin colour can be used, and how dense the pixel art should be. Also I want the camera of the cafe work in an angled view, like [a Neko Atsume yard screenshot] and [a Hades room screenshot] . help me judge on that as well.

**Result.** A judgement, not a build:
[`docs/notes/visual-direction.md`](notes/visual-direction.md), with studies
rendered from `content/` by throwaway scripts kept beside them
([`ab144ea`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ab144ea)).
- **Catppuccin: yes, but as a source, not a strict palette.** It has no
  brown, so snapping the room to it turns the wood flat salmon or peach.
  Its hues as anchors, with browns mixed from its peach and rosewater, keep
  the café warm. The bigger idea is a day palette and a Mocha-dark night
  palette, with the window lit, in place of today's grey overlay.
- **The recolour alone still looked ordinary.** The plainness comes mostly
  from flat, evenly lit, square-on drawing, so a palette alone won't fix
  it.
- **Density: 32-px tiles, 24-px cats.** At 16 px a cat is a silhouette; at
  24 it gets a face, markings and readable poses; 32 crowds the people.
- **Camera: isometric, as in Hades, not Neko Atsume's single picture.** It
  keeps the tile grid, so the server and protocol don't change; the client's
  renderer, picking and browser checks do. The cost is the phone: the room
  is 336 px wide at 1×, so layout B (3×, panned) would become the phone's
  default.
- Slice 05 now notes that it waits on the user's choice. Nothing is
  decided, so there is no ADR yet.

---

## Final submission (due Mon 9 November 2026, 12:00 AEDT)

### 12. After crit 10: where it stands, slice 02, and the look

*Session `6753d63d`, Claude Code (Opus 5.5), run as a background job.*

*Sent 2026-10-21 15:50:49 AEDT*

> check the current project status

**Result.** A read, nothing changed. Phases 1 to 3 and slices 01, 07 and 08
were live, CI green on every recent run, and the live café answered on `/`
and `/readme/`. Crit 10's reflection and `PROCESS.md` rewrite both landed
before its cutoff (13:08 and 13:10). Open: slice 02's judged line, slices 03
to 06 waiting for approval, the visual direction judgement still on its own
branch, a root plan that still listed crit 10's work as undone, and no
`crit-9` or `crit-10` tag.

*Sent 2026-10-21 15:57:49 AEDT*

> 1. Slice 2 lgtm, merge it
> 2. continue the visual redesign, or show me if it is done

**Result.**
- **Slice 02 is `Live`**
  ([`95b5a7e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/95b5a7e)).
  Its code was already on `main` and deployed, so "merge it" meant the
  user's reading of the board a mocked night leaves: the judged line passed.
  The reviewer's three notes (repeated plants, times with no day, meetings
  crowding out the night) stay noted, not asked for.
- **The visual redesign wasn't done: it was a judgement, not a build.** It
  is now merged onto `main`
  ([`e5dd18b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e5dd18b)),
  with the prompt log keeping session 10's entries whole, then session 11's.
  It stops at four choices for the user: which of the colours, the camera
  and the density to take; the phone's default layout if the camera is
  angled; who draws the sprites; and whether the page follows Catppuccin.
- **The root plan brought to after crit 10**
  ([`49f1927`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/49f1927)):
  slice 02 live, crit 10's work recorded, and the visual direction first in
  what's left, since it decides what slice 05 becomes.

Asked and answered after the studies were shown: the four choices the
judgement left open. The user took the recommended option on each:
"Which of the three changes should the redesign take?" — "All three";
"If the room is angled, what should the phone (390×844) show by default?" —
"Layout B default"; "Who should draw the new sprites?" — "The agent";
"Should the page around the room follow Catppuccin too?" — "Yes, Latte and
Mocha".

- **The look chosen**
  ([`f83105a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f83105a)):
  [ADR 0017](adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md),
  accepted, with the options the judgement weighed. `docs/design.md` says
  what changes (the room's tiles, the phone's default, the drawing, the
  sprites, the page's colours) and that none of it is built yet. Slice 05
  is superseded.
- **Slices 09 to 11 proposed**
  ([`1c113f8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1c113f8)):
  the camera with plain blocks and picking through the stage, then the day
  and night palettes and the page, then the agent's PNG sprites. The
  server and protocol don't change. Each waits for the user's approval
  before it's planned. Open questions with proposed defaults: the arrows
  along the room's axes (09), the afternoon keeping the day's palette (10),
  one cat first and the README's music promise taken out (11).

*Sent 2026-10-21 16:16:07 AEDT*

> [a screenshot of Tora's menu, opened on the room's bottom row, cut off under the talk bar] when a cat is on the lower part of the room clicking it hides some of the menu, fix it

**Result.** Fixed
([`740069b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/740069b)).
- **Cause:** on a desktop the menu opened at its tile's top-right corner,
  and only its top was kept on screen. The stage cuts off whatever runs
  past it, so a cat's menu (five or six actions) opened low in the room lost
  its last actions under the talk bar. Reproduced on a local café: Tora on
  the box at (1,9), the menu's bottom 200 px past the stage at 1920×1080.
- **Fix:** the menu is measured once it's on the page and placed beside its
  tile, moved up as far as it must, or to the tile's left when the right
  has no room (`menuSpot`, beside the ring's `ringCentre`). One taller than
  the stage scrolls.
- **Held by** five layout unit tests and a browser check that pins a cat
  to the bottom row on its own page, through its socket, and opens its menu
  by mouse and by keyboard at 1920×1080 and 1280×720. Each was seen failing
  first; the browser check found the menu's bottom at 1168 against the
  stage's 1014.
- **Checked locally:** the client's 94 unit tests, 18 of the 20 browser
  checks and the other 43 spec checks pass. The two slice 07 waking checks
  that route the socket time out on this machine with or without the fix,
  so they're CI's to hold.

*Sent 2026-10-21 16:41:28 AEDT*

> I don't see the redesign being deployed. is it merged or not?

**Answer.** Not built yet, so nothing to deploy: what was on `main` was the
decision (ADR 0017) and the slice specs, which waited for approval under
AGENTS.md. Asked and answered: "Approve the redesign slices so I can start
building?" — "Approve 09–11, start 09", with each spec's proposed default
([`aff9e71`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/aff9e71)).

**Result.** Slice 09, the room seen at an angle, planned and built on its
own branch, `slice-09-isometric`, so a half-built room never reaches
`main`, which deploys every push. Plan
([`f420577`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f420577)),
then test first, task by task:
- **The camera** as a pure module
  ([`23ab0f5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/23ab0f5)):
  where a tile lands on a 336×232 canvas, which tile a point picks (row 0,
  the street wall, on the wall's face), and the draw order. A single depth
  number tied a cat beside the sofa with the sofa, so the order became a
  sort on "wholly behind".
- **The stage** on it
  ([`5af5571`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5af5571)):
  menus, rings, bubbles and picking through one transform; 3× on the
  desktop.
- **The room drawn at an angle**
  ([`32cbf7f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/32cbf7f)):
  floor diamonds, the two back walls, furniture as blocks as tall as
  `content/sprites/heights.json` says. The first screenshot showed cats
  napping inside the blocks; they now sit on top.
- **A phone opens in the bigger room**
  ([`7bbcd4e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7bbcd4e)).
- **The browser checks find tiles through the page**
  ([`4fd3746`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4fd3746)).
  B by default had hidden the chalkboard's copy from screen readers on
  every phone, which slice 02's check caught; fixed.
- **Screenshots and the execution log**
  ([`b805c70`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b805c70)),
  and the review brief
  ([`00b859b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/00b859b)).
  A fresh reviewer is reading it.
- **The review** ([findings](notes/reviews/slice-09-findings.md),
  [`f2f9467`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f2f9467)):
  0 critical, 3 major, 9 minor. The majors: a click on a cat drawn up on
  the window seat walked to the wall behind it; a lap cat was drawn under
  its sitter; treats and toys put on the rug were drawn under it. All
  twelve were fixed test first
  ([`94170cb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/94170cb),
  [`1d67769`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/1d67769),
  [`9c66b6a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/9c66b6a),
  [`e244043`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e244043),
  [`c59b576`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c59b576),
  [`dfda24f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/dfda24f),
  [`d081b08`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/d081b08))
  and answered
  ([`8cf77bf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8cf77bf)).
  Two checks first passed without their fix and were corrected until they
  failed: the edge-ring check measured a one-button ring by its button,
  which can't fail, and the Tab check started from the wrong place.
- **Merged to `main`** once fmt, clippy, `cargo test`, the 127 client
  tests and 65 of 67 spec checks passed locally (the two left are slice
  07's waking checks, which time out on this machine on `main` too).
- **Deployed, after one red run.** The merge's first CI run failed two
  browser checks, so nothing deployed. On a fresh café, as CI runs one: a
  tap that opened the board was closed by the phone's click after it,
  landing on the backdrop (hidden before by where the board's tile sat),
  and the touch pick-up check skipped cats napping on furniture. Fixed
  ([`0b0fddd`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0b0fddd));
  CI run 39586448040 passed and deployed. Checked live with one short
  `agent_` visit: the angled room at 3× on the desktop, the board opened
  from the street wall, a phone in the bigger room, no errors
  ([notes](notes/slice-09-isometric.md)). The judged line, whether the
  room reads as a room you look into, is the user's.

*Sent 2026-10-22 05:15:21 AEDT*

> rotate the room angle 90 degree, so the door and window is on the left side, otherwise lgtm. finish this part and slice 10

**Result.**
- **Slice 09 judged, and turned**
  ([`f02e67d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f02e67d)).
  The camera now looks from the room's front-right corner on the same
  canvas, so the street wall, with the windows, door and chalkboard in
  their order from the left, stands up the back left, and a plain wall up
  the back right. Only one 90° turn does that: the other would have put
  the street wall in front, hiding the room. The camera module's tests
  were rewritten for the new corners and seen failing on the old camera;
  picking, the draw order and the browser checks followed the module.
  Slice 09 is `Live`.
- **The turned room checked live** with one short `agent_` visit: the
  street wall on the left, the board opened from it, a phone in the bigger
  room ([notes](notes/slice-09-isometric.md)).
- **Slice 10, Catppuccin by day and by night**, planned
  ([`0ae465f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0ae465f))
  and built test first:
  - **The colours as data**
    ([`0a666a5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0a666a5)):
    `palettes.json` holds a day set and a night set, written by
    `scripts/palettes.ts` from Catppuccin's published values (MIT,
    credited in `content/sprites/CREDITS.md`). By day the study's
    Catppuccin-led mix; at night everything pulled toward Mocha's base,
    and the windows lit yellow. The light steps by the Canberra hour,
    halfway in the evening, in place of the grey wash.
  - **The page in Latte and Mocha**
    ([`05cad2b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/05cad2b)),
    every text and control at 4.5:1 or better, held by a test that reads
    the stylesheet; it found the old light theme's link at 4.496:1.
  - **The review**
    ([findings](notes/reviews/slice-10-findings.md),
    [`f2e5ced`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f2e5ced)):
    1 major and 5 minor. The major: nothing held that the page draws in
    the hour's light, and one slip would have painted the café in night
    colours all day. Fixed with a `Light` type and a browser check that
    reads the canvas's own pixels at 10:00 and 22:00 on one page
    ([`c8e2f62`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c8e2f62)).
    The minors: the placeholder's contrast, the toys' fixed colours, a
    backdrop check that couldn't fail
    ([`87e2c1b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/87e2c1b)),
    coats back in data with `palettes.json` held to its script
    ([`cbc7bee`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/cbc7bee)),
    and the README's credit proposed to the user
    ([`3f2de37`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3f2de37)).
    Answered in
    [`6c7a0d8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6c7a0d8).
  - **Merged to `main`** after the whole spec passed on a fresh café, 69
    of 69.
  - **Deployed and checked live**: CI run 39670502960 passed and
    deployed. One short `agent_` visit at 07:00: the page in Latte or
    Mocha by the device's setting, the floor's own pixels in the day
    set, no errors ([notes](notes/slice-10-palette.md)). The judged line
    and the README's credit are the user's.
  - **A flaky check, steadied.** The next, notes-only push went red: the
    light check read the canvas before its first frame, and a local rerun
    caught a roaming cat over the spot it reads. It now waits for painted
    pixels and pins every cat
    ([`38ba731`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/38ba731)).
    The deploy was skipped while it was red, so the live café kept the
    tested build.
