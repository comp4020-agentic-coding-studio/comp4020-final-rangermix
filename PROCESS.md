# Process overview

## Where it stands

This is the final submission. The project is a 2D pixel-art cat café: one
shared room where up to six people sit with three cats who each have a
character and remember everyone they meet. It's live at
[comp4020-final-rangermix.fly.dev](https://comp4020-final-rangermix.fly.dev),
drawn at an angle in Catppuccin-led colours, with lofi music, a chalkboard of
what the cats did overnight, and demo accounts that show a marker weeks of
the café in ten minutes. The design is in [`docs/design.md`](docs/design.md),
its decisions in 23 ADRs, the rules in [`CLAUDE.md`](CLAUDE.md). Three specs
were never built: mute and the blocklist, a load check, and an accessibility
pass ([plan](docs/notes/plan.md)), so the café has never been measured under
a crowd.

## The harness came first

I had the agent compare the harnesses from my two assignments, then picked
what to keep: one rules file every agent reads, `docs/design.md` for what is
true now, `docs/notes/` for work in progress, and a
[prompt log](docs/prompts-result.md) of every interaction
([`8aa93ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8aa93ec)).
I added ADRs because editing `design.md` overwrites the options we turned
down ([ADR 0001](docs/adr/0001-record-architecture-decisions.md);
[Nygard, 2011](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).
The agent writes this file from that log and I choose what goes in, a
harness the course convenor approved
([ADR 0013](docs/adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).

## The design is mine

I started from "a 2d pixel art style online cat place", after Neko Atsume
and real cat cafés. The agent asked, and I decided. Its most useful finding
was a conflict: the course's `fly.toml` stops the machine when nobody is
connected
([`7e7fbb7`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7e7fbb7)).
My answer, "The server won't stop simulating the game", became a café that
replays what it missed when it wakes
([ADR 0006](docs/adr/0006-fast-forward-the-world-when-the-server-wakes.md)).
The heart is company around the cats
([ADR 0002](docs/adr/0002-make-a-cat-cafe-where-company-forms-around-the-cats.md)):
six inside, everyone else at the window
([ADR 0008](docs/adr/0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)),
and cats that keep their own boundaries: "cat can scratch and jump off if
they don't like it"
([`910873c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/910873c)).

The look changed because I called it "a bit... normal, not standing out".
A recolour alone still looked ordinary, so the room went isometric
([ADR 0017](docs/adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)).
Two weeks later I asked why it looked blurred, and whether top-down would
suit it better. The agent measured the cause: anti-aliased polygons, 763
colours in a frame whose fills use 37
([`9ee88de`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/9ee88de)).
I said "stay isometric", and from nine edges drawn side by side chose crisp
ones with outlines and cast shadows
([ADR 0019](docs/adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md);
[`e464602`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/e464602)).

## The stack, and where it paid

I picked a Rust server with a TypeScript client, because the 256 MB machine
has to replay the hours it slept. When the agent listed Rust's costs again, I
pushed back: "i'm well aware of the pros and that's why i proposed it." At
the sixteenth of a core Fly guarantees, eight hours replay in 1.3 s
([`b1f1417`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b1f1417)).
Types are written once in Rust and generated as TypeScript
([ADR 0003](docs/adr/0003-use-a-rust-server-and-a-typescript-canvas-client.md)).
That paid when two branches each passed alone: the rug fix's fixtures lacked
a flag slice 11 had just added, so `main` failed its typecheck and deployed
nothing
([`a6d970e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a6d970e)).
Since the server decides everything on a grid
([ADR 0004](docs/adr/0004-run-one-authoritative-world-over-websockets.md)),
the camera, colours, walking and street changed no line of the protocol;
only the art's new poses did
([`abe3135`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/abe3135)).

## The workflow

Phases 1 to 3 were built as phases lined up with the crits
([ADR 0012](docs/adr/0012-plan-in-phases-and-build-each-phase-natively.md)).
Phase 3's 34 findings arrived all at once
([`3bc886a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3bc886a)),
so I changed the method: "Instead of phases, create virtical slices of
functionalities". Each slice has a spec saying how every "done when" line is
held, a plan written just before it's built, a builder who writes each test
before its code, a reviewer who reads it cold, and my judgement for what no
test can decide
([ADR 0014](docs/adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md);
[`5196876`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5196876)).
Seventeen slice reviews found 186 findings, 50 major, none critical. Agents
test on the live café with throwaway `agent_` accounts
([ADR 0015](docs/adr/0015-let-agents-test-on-the-live-cafe-and-its-fly-app.md)),
and every action logs one line of who, what and when, which `pnpm logs`
narrates in Canberra time
([`a086231`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/a086231)).

## One clock, moved

Two slices ended waiting on a real night, and days later neither had been
read, so I asked: "for the long gap checks use unit test and integ test with
mocked time. do not rely on realworld checks"
([ADR 0016](docs/adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)).
The server reads every instant from one clock, which a test can start
anywhere and Fly refuses
([`5805cdf`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5805cdf)).

That clock carried the demo. A lap from Burakku is at least 27 days of trust
away, and a marker has about ten minutes. The demo, I said, is "how markers
receive this", and the server "will fast forward time to the target clock
for at most 24 hours"
([ADR 0022](docs/adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md)).
So a demo account's jump is the replay the café runs on waking
([`c7fcba1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/c7fcba1)),
and since Fly refuses a set clock, the clock gained a lead that only grows
([`b32d747`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b32d747)).
The reviewer, on another model, found what else read it: every page was cut
off within 25 s of a jump, because silence was timed on that clock. It also
found trust a cat gave during a jump shown but never stored. Both were fixed
test first before `main`
([`ed0556e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ed0556e),
[`20a93b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/20a93b0)).

## What caught what

My judgement caught the agent. Building slice 18, it ran the balcony on past
both ends of the room to hide a cut edge, its own call, flagged for me
([`3a19fb8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/3a19fb8)).
On a wide window I said "it should just show the cafe corner": the room is a
diorama cut at its walls, so slice 19 ends the balcony there
([`297a253`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/297a253)).

Review caught what one visitor leaves the next. Slice 20 put a door before
the café, with "I'm not *name*" for a shared computer and, as I asked, one
form: "unify log in and sign up"
([ADR 0023](docs/adr/0023-greet-a-returning-visitor-at-the-door.md)). Four
reviewers, one lens each, with two skeptics trying to refute every finding,
kept all 16. The last visitor's recovery code was left in the page, enough to
take their account, and their unsent draft waited for the next person
([`8616e75`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8616e75)).
One finding changed a decision: the name check and its sign-up each spent a
try, halving a venue's sign-ups
([`b901cf1`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/b901cf1)).

Nothing caught a lost slice. I asked for the furniture sets after slice 16.
Slice 16 landed, the plan still said "after slice 16", and no session picked
them up. I found out two days later, as a demo account: "I don't see cafe
arrangement preset using demo account. is that implemented or not?" They
were built, reviewed and live by the next morning
([`2714714`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/2714714)).
