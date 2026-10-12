# Harness

Rules for any agent working in this repo. `CLAUDE.md` is a symlink to this
file, so Claude Code and every other agent read the same rules.

`docs/design.md` is the settled specification. This file holds the rules. Read
both, along with the
[final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/),
before planning or building anything.

## Where things live

- **Settled decisions go in `docs/design.md`.** Once something is decided (what
  the app is, its scope, its stack, its data model), it is written there with
  the reason. A decision that lives only in a conversation hasn't been made. To
  change a settled decision, edit `docs/design.md` in the same commit as the
  work that follows from it.
- **Significant decisions also get an ADR in `docs/adr/`** (see below), and
  their `docs/design.md` entry links to it.
- **Working state goes in `docs/notes/`, one file per topic.** That covers what
  is in progress, what has been checked and what hasn't, and what is blocked
  and why. A check recorded only in a conversation looks exactly like a check
  nobody did.
- **The plan has two levels.** The root plan, `docs/notes/plan.md`, covers the
  project and lists every slice in order. Each slice's spec is in
  `docs/slices/`, and its detailed plan is `docs/notes/plan-slice-NN-slug.md`.
  See "How the work is built".
- **Every interaction and its outcome goes in `docs/prompts-result.md`.** See
  below.

## What the app must keep

The café's own rules, from `docs/design.md`. Each one is held by a check in
`spec/` or `cargo test` once that check exists, and by review until then. A
change that breaks one is wrong, whatever else it fixes.

- **Never store or log what anyone says.** Bubble text lives in memory and on
  screens only: not in the database, not in a snapshot, not in a log line. A
  log records that someone spoke, how long the bubble was and who it was
  addressed to. ([ADR 0010](docs/adr/0010-keep-speech-public-and-fleeting.md))
- **Never store email addresses or IP addresses.** Per-IP rate limits count
  in memory only and are never written down or logged.
- **The server decides every outcome.** Clients send intents; nothing a client
  claims about the world is trusted.
- **The cap is enforced on the server.** At most the set number of people are
  inside, and someone at the window can only talk.
- **The door's walkway is never blocked.** A placement that would block it is
  refused.
- **Trust never fades with absence.** Only what a person does to a cat changes
  that cat's trust in them.
- **Every action works by keyboard, touch and mouse**, at 390×844 and at
  1920×1080, and survives a resize mid-use.
- **Cats change through `content/`, not code.** A new cat is a data file; code
  adds kinds of behaviour, never an individual cat.
- **Generated TypeScript is never edited by hand.** `client/src/protocol/` is
  regenerated from the Rust types.

## How the work is built

In vertical slices
([ADR 0014](docs/adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md)).
A slice is one thing a visitor, or the operator, can use, built through every
layer it needs: Rust, the protocol, the client and the checks. Phases 1 to 3
were built as phases before this, and their plans and reviews stay as they
are.

- **Spec before plan.** Copy `docs/slices/template.md` to the next number. It
  says what the slice does, what it leaves out, and how each "done when" line
  is held: `cargo test`, `spec/`, a browser check, or a judgement naming who
  makes it and how. A spec the user hasn't approved is `Proposed`, and isn't
  planned.
- **Plan just before building.** The slice's plan is written when the slice
  starts, from the code as it stands then: files, interfaces, tests first,
  then code. It ends with an execution log of where the build departed from
  it.
- **Built natively, test first.** One agent builds the slice in one session,
  committing and pushing per task, with each test seen failing before its
  code.
- **Reviewed fresh.** At the end of each slice a reviewer who didn't build it
  reads it cold. Its brief and findings are files in `docs/notes/reviews/`.
  Every finding is fixed test first or answered before the slice is done.
- **Then deployed and checked live**, and the root plan's status updated.

## Architecture decision records

[ADR 0001](docs/adr/0001-record-architecture-decisions.md) explains why these
exist. A decision is significant enough for one if it's costly to reverse or a
marker would ask "why this and not that": the stack, the hosting, the data
store, auth, the app's shape and scope, and the agent workflow itself.

- **Copy `docs/adr/template.md`** to the next number, `NNNN-slug.md`. Fill in
  context, options (at least two, with real costs), decision and consequences.
- **Write the ADR in the same commit as the decision's first change**, and add
  or update the `docs/design.md` entry that links to it.
- **Never rewrite an accepted ADR's substance.** To change a decision, write a
  new ADR that supersedes it and set the old one's status to
  `Superseded by [NNNN](NNNN-slug.md)`. Fixing typos and adding commit links is
  fine.
- **When the user hasn't decided, the status is `Proposed`.** Present the
  options and don't build on it until they accept.

## The prompt log

`docs/prompts-result.md` records every prompt the user sends and what came of
it. It is the source material for `PROCESS.md`, not a draft of it.

- **Append an entry at the end of every turn that did work**, before the final
  commit of that turn, so the entry ships with the commits it describes.
- **Prompts are verbatim**, quoted as typed. A clarifying question and its
  answer are logged too, because the answer changes what gets built.
- **Timestamps come from the session transcript**, in Canberra time (AEST
  UTC+10, or AEDT UTC+11 from the first Sunday in October). Don't guess them.
- **Results are curated**: the decisions, what was built or rejected, and why.
  Leave out tool output.
- **Every commit hash comes from `git log`**, linked as
  `[`<sha>`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/<sha>)`.
  Never write one from memory.
- **Omitted:** prompts that are only "continue" or only a bare slash command
  with no answer of its own. Any work they resumed is filed under the prompt
  that asked for it.
- Each session's first entry names the session id and the tool (Claude Code,
  Codex, ...).
- **A line marks each crit.** A crit's section holds every entry sent after
  the previous crit's cutoff, up to and including its own. Before the first
  entry sent after a cutoff, put `---` and a heading
  `## Crit N: "Name" (cutoff Day D Month YYYY, HH:MM AEDT)`, with the cutoff
  for the author's crit group (Wednesday 13:30 for crits 8 and 9). Sessions
  are `###` headings under it, numbered on from the section before. A session
  that runs across a cutoff is split there, and its heading is repeated after
  the line, marked "(continued)". Entries sent after crit 10's cutoff go under
  `## Final submission (due Mon 9 November 2026, 12:00 AEDT)`.

## PROCESS.md

The agent writes `PROCESS.md`, and the user decides what goes in it
([ADR 0013](docs/adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
The course convenor approved this harness, the prompt log with the agent
writing `PROCESS.md` from it, and has pointed others to it as good practice.

- **Written from the record**: the prompt log, `git log`, the ADRs and the
  notes. Every claim is cited by a commit link, and ADRs are linked rather
  than restated.
- **The user chooses.** When there is more material than fits, set out the
  options first, each with what it would say and what it cites, and let the
  user pick before writing.
- **The user's edits win.** Don't reword a passage the user has written or
  changed without asking.
- **Rewritten, not appended, at each crit**, at 900 to 1,100 words, as the
  brief asks, so it always describes the project as it stands.
- **`README.md` and the crit reflections are the user's.** The agent drafts
  them only when asked, and the user decides the final text.

## No time limit

Nothing in this repo is on the clock, so never trade a step for speed. The
slow work (reading the brief properly, writing the test before the code,
checking the deployed app rather than assuming) is what an agent watching the
clock cuts first. Don't stub a feature to finish later, drop a check, shrink
the scope, or stop to ask whether a long job is worth finishing. The one reason
to stop short is a real blocker: name it, and write down where the work stands
in `docs/notes/`.

## Memory and agent communication

Prefer files to context. A conversation gets compacted, ends, or happens in a
cloud session this clone never sees, and the repo is the only memory every
session shares. Anything the next session or another agent needs is written to
a file here, then committed and pushed with the work it describes.

- Agents talk through files. Give a subagent or parallel session its brief as a
  file and have it write its result to one; the message only says which file
  to read. A finding that lives only in a message is gone with the session that
  sent it.
- Keep project state out of machine-local memory under `~/.claude`: it never
  reaches a cloud session, and `PROCESS.md` can't cite it.
- The repo goes public when it ships, notes and prompt log included. Write
  nothing in them that can't be public: no keys, no secrets, no personal data
  about third parties.
