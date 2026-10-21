# Process overview

## Where it stands

This is week 11, the final project's third crit. The project is a 2D
pixel-art cat café: one shared room where up to six people sit with three
cats who each have a character and remember everyone they meet. The design
is in [`docs/design.md`](docs/design.md), the big decisions in the ADRs, the
rules in [`CLAUDE.md`](CLAUDE.md). It's live at
[comp4020-final-rangermix.fly.dev](https://comp4020-final-rangermix.fly.dev).
New since crit 9: the café keeps living while the machine sleeps, a
chalkboard tells what the cats did overnight, the doors open while it
wakes, and every long sleep is tested on mocked time
([`34fa01c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/34fa01c)).

## The harness came first

I had the agent compare the harnesses from my two assignments, then picked
what to keep. That gave three records with three jobs: `docs/design.md` for
what is true now, `docs/notes/` for work in progress, and a
[prompt log](docs/prompts-result.md) of every interaction
([`8aa93ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8aa93ec)).
The agent writes this file from that log and I choose what goes in, a
harness the course convenor approved
([ADR 0013](docs/adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
I added ADRs because editing `design.md` overwrites the options we turned
down ([ADR 0001](docs/adr/0001-record-architecture-decisions.md);
[Nygard, 2011](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

## The design and the stack

The agent asked, and I decided. It first recorded what the brief and the
deploy config constrain
([`7e7fbb7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7e7fbb7)),
which found the most useful conflict: the course's `fly.toml` stops the
machine when nobody is connected, so the cats would freeze. I didn't want a
world that stops, and accepted its proposal to fast-forward the world when
the server wakes
([ADR 0006](docs/adr/0006-fast-forward-the-world-when-the-server-wakes.md)).
The answers that changed the design most were mine: a cap of six with
everyone else at the window
([ADR 0008](docs/adr/0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)),
and cats that enforce their own boundaries
([`910873c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/910873c)).

I picked a Rust server with a TypeScript client, because the 256 MB machine
has to replay days of missed time on waking. When the agent listed Rust's
costs again, I pushed back: "i'm well aware of the pros and that's why i
proposed it." Types are written once in Rust and generated as TypeScript
with [ts-rs](https://github.com/Aleph-Alpha/ts-rs)
([ADR 0003](docs/adr/0003-use-a-rust-server-and-a-typescript-canvas-client.md)),
and Rust's compiler catches a class of agent mistakes before any test runs.

## The workflow

Phases 1 to 3 were built as phases lined up with the crits, each reviewed
fresh ([ADR 0012](docs/adr/0012-plan-in-phases-and-build-each-phase-natively.md)).
Phase 3's 34 findings arrived all at once, so I changed the method:
"Instead of phases, create virtical slices of functionalities". Each slice
has a spec saying how every "done when" line is checked, a plan written just
before it's built, a builder who writes each test before its code, and a
reviewer who reads it cold
([ADR 0014](docs/adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md);
[`5196876`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5196876)).

## Logs as instruments

Crit 10 is a demo by the logs alone. Every action a person takes is one
JSON line saying who, what and when, refusals included, and `pnpm logs`
narrates Fly's tail in Canberra time: "19:42:07 sam petted Mochi, who
purred"
([`a086231`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a086231)).
Each wake-up logs its own summary, how long it slept and how long it took
to catch up
([`b116590`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b116590)).
The café must never log what anyone says, so after the spec's visitors have
been, CI pipes the image's whole output through a check: every line has a
time and a target, every start logs its wake-up, and none holds a word the
spec said in a bubble.

The logs earned their keep as instruments for me, not only for the crit:

- A browser check that kept turning `main` red failed only at night. The
  live logs showed the cats napping against the walls, where the client slid
  a cat's ring off its tile. The check was right and the client was wrong
  ([`4e54ca4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/4e54ca4)).
- Another check waited minutes for a cat to agree to be picked up, and the
  logs showed the cats asleep. A cat's consent isn't the test's to have, so
  the check now proves the touch path
  ([`25ff89d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/25ff89d)).

## Live testing, then mocked time

Some checks needed the real thing, so I let agents test on the live café
with throwaway `agent_` accounts, and on the Fly machine itself, within the
course's fixed shape
([ADR 0015](docs/adr/0015-let-agents-test-on-the-live-cafe-and-its-fly-app.md);
[`e60dc05`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e60dc05)).
It paid off at once. An agent read the live chalkboard and found it empty:
traces from before the board existed had never been tidied, so the cats had
nothing left to knock over. Another agent tidied them
([`dc1c9ef`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/dc1c9ef)).

The cost showed in two slices that each ended on a line waiting for a real
night: the first wake-up after hours asleep, and my reading of the board.
Three days later neither had been read. Fly keeps only the last 100 log
lines, so the morning's traffic pushed the night's wake-up out before anyone
looked. So I asked: "for the long gap checks use unit test and integ test
with mocked time. do not rely on realworld checks"
([ADR 0016](docs/adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md);
[`8d3b2f9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8d3b2f9)).

The server now reads every instant from one clock, which a test can start at
a chosen moment, and which the server refuses on Fly
([`5805cdf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5805cdf)).
`cargo test` starts the built server at 23:00 on a Friday, lets a visitor
meet a cat, stops it, and starts it again at 07:30
([`b167901`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b167901)).
The first run asserted the bowls were full, and they were empty: the cats
eat the 7:00 refill within minutes. The café was right and the test was
wrong.

The fresh reviewer found the sharper problem: two of those checks would pass
on a café that forgot treats or furniture on every restart. Each fix was
proven by breaking the café on purpose and watching the test fail. A
concurrent stress run then caught my first fix being flaky before it
shipped
([findings](docs/notes/reviews/slice-08-findings.md);
[`b955ba9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b955ba9)).
