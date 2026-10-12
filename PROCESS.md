# Process overview

## Where it stands

This is week 10, the final project's second crit. The project is a 2D
pixel-art cat café: one shared room where up to six people sit with three
cats who each have a character and remember everyone they meet. The design
is in [`docs/design.md`](docs/design.md), the big decisions in the ADRs, the
rules in [`CLAUDE.md`](CLAUDE.md). The first three phases are live at
[comp4020-final-rangermix.fly.dev](https://comp4020-final-rangermix.fly.dev)
([`25cf3f1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/25cf3f1)).
New since crit 8: a rule for quiet seats, rearranging furniture together, cats
with moods, and a log line for every action. A spec check holds it to the
brief's real-time line: a bubble reaches another person within a second
([`eec8cb4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/eec8cb4)).

## The harness came first

First I had the agent compare the harnesses from my two assignments, then
picked what to keep:

> 4. carry over A2's docs/prompts-result.md: document every interaction and outcome

That gave three records with three jobs: `docs/design.md` for what is true
now, `docs/notes/` for work in progress, and a
[prompt log](docs/prompts-result.md) of every interaction
([`8aa93ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8aa93ec)).
The agent writes this file from that log and I choose what goes in, a
harness the course convenor approved
([ADR 0013](docs/adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
Two rules came from assignment 2: "no time limit", and memory through files,
because sessions end and the repo is the only memory they share. I added
ADRs, because editing `design.md` overwrites the options we turned down
([ADR 0001](docs/adr/0001-record-architecture-decisions.md);
[Nygard, 2011](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions);
[`bc3393e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/bc3393e)).

## The design: I decided, the agent asked

I described the idea, inspired by Neko Atsume and real cat cafés, and asked
the agent to "brainstorm to finish the design of this game. ask as many
questions as you need." It followed the brainstorming method from Jesse
Vincent's [Superpowers](https://github.com/obra/superpowers), and first recorded
what the brief and deploy config constrain
([`7e7fbb7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7e7fbb7)).
That found the most useful conflict: the course's `fly.toml` stops the machine
when nobody is connected, so the cats would freeze. I didn't want a world that
stops ("The server won't stop simulating the game"), and accepted its proposal
to fast-forward the world when the server wakes
([ADR 0006](docs/adr/0006-fast-forward-the-world-when-the-server-wakes.md);
[`a175cc7...0b4d17a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/compare/a175cc7...0b4d17a)).

Nineteen questions settled the rest, and the answers that changed it most were
mine: a cap of six with everyone else watching from the window
([ADR 0008](docs/adr/0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)),
and cats that enforce their own boundaries instead of house rules: "if they
are really angry they will ban you from making that move for a certain time
period like no picking up for 2 days"
([`910873c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/910873c)).

## The case for the stack

I picked a Rust server with a TypeScript client, because the 256 MB machine
has to run a simulation that can replay a week of missed time on waking. When
the agent listed Rust's costs again, I pushed back:

> use 1. i'm well aware of the pros and that's why i proposed it. i'm curious how you define in rust and generate to TS.

The agent checked the [ts-rs](https://github.com/Aleph-Alpha/ts-rs) README
before answering: types are written once in Rust and a derive macro
generates the TypeScript, mapping 64-bit integers to `number`, not `bigint`
([ADR 0003](docs/adr/0003-use-a-rust-server-and-a-typescript-canvas-client.md);
[`6c22ccc`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/6c22ccc)).
Rust's strict compiler also catches a class of agent mistakes before any test
runs. The client draws the room on a canvas but keeps real HTML for the talk
box and menus, because markers do a keyboard-only pass. The rest follows from
the course's fixed setup: one authoritative world over WebSockets
([ADR 0004](docs/adr/0004-run-one-authoritative-world-over-websockets.md)),
and SQLite on the only volume, with Fly's daily snapshots as the backup
([ADR 0005](docs/adr/0005-keep-all-state-in-sqlite-on-the-volume.md);
[Fly.io](https://fly.io/docs/volumes/snapshots/)).

## The case for the workflow

The spec, ten ADRs and the rules in `CLAUDE.md` went in one commit, each rule
meant to be held by a check in `spec/` or `cargo test`
([`02b176a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/02b176a)).
I left the build method to the agent: five phases lined up with the crits,
each planned when it starts, built test first by one agent, then reviewed
fresh
([ADR 0012](docs/adr/0012-plan-in-phases-and-build-each-phase-natively.md)).
One builder, not one per task, because the Rust types, the generated
TypeScript and the world's rules change together. Each review, six reviewers
with two skeptics per finding, kept 17 findings for phase 1, 19 for phase 2
and 34 for phase 3
([`123a899`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/123a899),
[`fc32dc5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/fc32dc5),
[`3bc886a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3bc886a)).

Phase 3's 34 arrived all at once, so I changed the method for what's left:
"it's okay to stay tightly coupled as long as it won't affect speed too much.
Instead of phases, create virtical slices of functionalities".
Each slice now has a spec saying how every "done when" line is checked, a plan
written just before it's built, and its own fresh review
([ADR 0014](docs/adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md);
[`5196876`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5196876)).

## Crit 9's decision: who keeps a seat

One forgotten tab holds a sixth of the café, yet sitting quietly by a cat is
what my README says people come for: "accompany, warmness, relaxed time with
friends". So a quiet seat frees only while someone is waiting: a "still
there?" nudge, and with no answer the avatar walks out and the first in line
walks in
([ADR 0009](docs/adr/0009-free-a-quiet-seat-only-when-someone-is-waiting.md)).
Timed visits would hurry the lingering visit, never moving anyone lets one
forgotten tab block a seat for hours, and giving up your seat rests on
goodwill. The cost: "away" can misjudge someone reading without touching
anything, so the nudge has to be easy to see and answer. It's tested against
a controllable clock
([`207fa4b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/207fa4b)),
and the ADR expects the pod to argue for timed visits.

## Directing, grounding and correcting

My prompts this week were short ("/goal finish phase 3") because the direction
was already in files. At crit 8 I'd asked for the bare minimum and to "record
all things you simplified so we have something to work on later"; this week
began by putting those 24 cuts into the plan
([`4bd070b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4bd070b)).
Grounding meant reading before claiming: the brief before the design, the
docs before relying on a library, and an independent checker re-opening every
README source (seven were dropped)
([`343d8be`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/343d8be)).

The corrections that count changed the code or a check, not just retried:

- I reported "it's flashing reconnecting fast and nonstop": a rebuilt client
  reloading against an older server. A tab now reloads at most once per build
  ([`5b20999`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5b20999)).
- An avatar drawn in the wrong look, noted at crit 8 as a fluke, was real:
  everyone walked in to the same tile
  ([`8cbdedf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8cbdedf)).
- CI failed twice on the cap check, because spec files ran at once against one
  café that seats six; they now run one at a time
  ([`e42f2a4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e42f2a4)).
- A browser check waited up to 200 seconds for a cat to agree to be picked
  up; the app's own logs showed the cats asleep. A cat's consent isn't the
  test's to have, so the check now proves the touch path
  ([`25ff89d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/25ff89d)).
