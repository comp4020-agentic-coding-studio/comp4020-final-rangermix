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
