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
