# Process overview

## Where it stands

This is week 9, the first crit of the final project. The project is a 2D
pixel-art cat café: one shared room where up to six people sit with three
cats who each have a character and remember everyone they meet. The design
is in [`docs/design.md`](docs/design.md), the big decisions in the ADRs, the rules in `CLAUDE.md`. A deliberately small
version is now live at
[comp4020-final-rangermix.fly.dev](https://comp4020-final-rangermix.fly.dev):
sign up, walk in through the door, talk in bubbles, pet a cat, move a
cushion, and find your trust with each cat still there next visit. What it
leaves out is listed in [`docs/notes/crit-8-mvp.md`](docs/notes/crit-8-mvp.md).

## The harness came first

Before choosing an app, I had the agent compare the harnesses from my two
assignments:

> first check out the harness from past two assignments, make a list and suggest what we can carry over.

I picked what to keep:

> 4. carry over A2's docs/prompts-result.md: document every interaction and outcome

That gave three records with three jobs: `docs/design.md` for what is true
now, `docs/notes/` for work in progress, and a prompt log of every
interaction
([`8aa93ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8aa93ec)).
Two rules came from assignment 2: "no time limit", and memory through files, because sessions end and the repo is the only memory they share. Then I asked for
ADRs:

> also use ADR as described in https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/#what-you-submit

[ADR 0001](docs/adr/0001-record-architecture-decisions.md) explains why
`design.md` alone wasn't enough. Editing it overwrites the options we turned
down, and an ADR keeps them
([Nygard, 2011](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions);
[`bc3393e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bc3393e)).

## The design: I decided, the agent asked

I started with a long description of the idea, inspired by Neko Atsume and
real cat cafés. Most of it was the cats:

> cats will interact with enviorments and users occationly and selectively based on their character. cats will also respond (based on their character) to changes of enviorment …
>
> Help me brainstorm to finish the design of this game. ask as many questions as you need.

The agent followed the brainstorming method from Jesse Vincent's
[Superpowers](https://github.com/obra/superpowers): questions, then
approaches, then the design in sections, each approved before the next. First it recorded what the brief and deploy config constrain
([`7e7fbb7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7e7fbb7)).
The most useful thing it found was a conflict. The course's `fly.toml` stops
the machine when nobody is connected, so cats simulated on the server would
freeze. I didn't want a world that stops:

> The server won't stop simulating the game … some cats can have character that make them more active when no humans around

The agent proposed fast-forwarding the world when the server wakes, as Neko Atsume does, and I accepted
([ADR 0006](docs/adr/0006-fast-forward-the-world-when-the-server-wakes.md);
[`a175cc7...0b4d17a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/compare/a175cc7...0b4d17a)).
After that, nineteen questions settled the design. The answers that changed
it most were mine:

- A cap of six, with everyone else watching from the window:
  "they watch from the same view as user inside, but can't interact other than
  talking"
  ([ADR 0008](docs/adr/0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)).
- The agent offered enforced house rules. I turned them down so the cats
  enforce their own: "if they are really angry they will ban you from making
  that move for a certain time period like no picking up for 2 days"
  ([`910873c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/910873c)).

## The case for the stack

The agent laid out three approaches. I picked Rust with a TypeScript client,
because the 256 MB machine has to run a simulation that can replay a week of
missed time on waking. I'd suggested Rust from the start ("that should be fine
if we choose to use a compiled language like rust") and pushed back when the
agent listed its costs again:

> use 1. i'm well aware of the pros and that's why i proposed it. i'm curious how you define in rust and generate to TS.

The agent checked the ts-rs README first ([ts-rs](https://github.com/Aleph-Alpha/ts-rs)). Message types are written
once in Rust, and a derive macro generates the matching TypeScript. The check also
caught a trap: 64-bit integers come out as `bigint` by default, so the
protocol maps them to `number`
([ADR 0003](docs/adr/0003-use-a-rust-server-and-a-typescript-canvas-client.md);
[`6c22ccc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6c22ccc)).

Rust keeps the simulation small and deterministic, and its strict compiler catches a class of agent mistakes before any test runs.
The client draws the room on a canvas but keeps real HTML for the talk box, menus and screen-reader announcements, because markers do a keyboard-only pass and test on a phone. The rest follows from the course's fixed setup:

- one authoritative world over WebSockets
  ([ADR 0004](docs/adr/0004-run-one-authoritative-world-over-websockets.md));
- SQLite on the only volume, using Fly's daily volume snapshots as the backup
  ([ADR 0005](docs/adr/0005-keep-all-state-in-sqlite-on-the-volume.md);
  [Fly.io](https://fly.io/docs/volumes/snapshots/)).

## The case for the workflow

Every design section came to me before the next began. When I asked to "relex a bit on the
limits", the fixed rate limits became burst allowances
([`f4f2b63`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/f4f2b63)).
After seeing light mockups of the client I asked for both phone layouts with a switch, and a link to the README from the login page
([`59067a3...a4ce6c2`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/compare/59067a3...a4ce6c2)).
The agent caught a contradiction: the spec promised never to store IP addresses while rate-limiting by IP, so per-IP counts now live in memory only
([`0e4e982`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/0e4e982)).

When the design was done, the spec, ten ADRs, and a "What the app must keep"
list in `CLAUDE.md` were written in one commit
([`02b176a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/02b176a)).
Each rule is meant to be held by a check in `spec/` or `cargo test`, not left to review: never log what anyone says, the server decides every outcome, and the door's walkway can't be blocked.

## From design to a small live version

I asked for the plan and a first phase for this crit together. The agent split
the design into five phases, one per crit, built test first
([ADR 0012](docs/adr/0012-plan-in-phases-and-build-each-phase-natively.md)),
and planned phase 1 as 18 tasks. When its budget ran out mid-build, the plan and a ledger of finished tasks carried the work over.

Then I asked for the bare minimum crit 8 needs: "you can over simplify things
first - we can adjust later. record all things you simplified". The agent read the crit page, cut to a deployed app where a stranger does the core thing and finds their trace again, and wrote every cut into `crit-8-mvp.md`: no hand-checks with two windows or on a phone, no art pass, no whole-phase review. The checks that stayed ran against the built image, including that no spoken word reaches a log.

Watching it, I saw what the tests hadn't: the page flashing "Reconnecting" nonstop, a rebuilt client reloading against an older server. A tab now reloads at most once per build
([`5b20999`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5b20999)).

Last, "add one furniture you can move around": one cushion, with the door's walkway kept clear and nine more simplifications recorded
([`8292b36`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8292b36)).
