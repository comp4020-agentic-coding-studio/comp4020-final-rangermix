# 0013. Let the agent write PROCESS.md and the user choose its content

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

The brief asks for a `PROCESS.md` of 900 to 1,100 words, rewritten at each
crit, that makes the case for the stack and the agent workflow with every
claim cited. It also advises drafting `README.md` and `PROCESS.md` yourself,
because a document that reads like an agent's tells the marker you've added
little.

This repo keeps a curated log of every prompt and its outcome,
`docs/prompts-result.md`, carried over from assignment 2. Until now `AGENTS.md`
said the log is source material for a `PROCESS.md` the user writes in their own
words. In practice the user had the agent draft `PROCESS.md` from the log at
crits 8 and 9.

The user reports that the course convenor approved this harness, the prompt
log with the agent writing `PROCESS.md` from it, and has pointed other students
to it as good practice. The user's instruction (2026-10-12): "You will write
PROCESS.md for me, however I will decide what's the content inside eventually.
When there's a lot of contents to choose from, show me the options and let me
choose."

## Options

1. **The user writes `PROCESS.md` from the log**, as the brief advises and
   `AGENTS.md` said. It's the user's voice throughout, but every crit the user
   re-reads the log and the commits to find what's citable, and the agent's
   knowledge of which commit shows what goes unused.
2. **The agent writes it from the log and the commits, and the user decides
   what goes in.** Where there is more material than fits, the agent sets out
   the options, each with what it would say and what it cites, and the user
   chooses. Every claim can be checked against `git log` as it's written, and
   the user's judgement is what's selected and how it's argued. The cost: the
   prose is the agent's, so the risk the brief names (reading like an agent's
   document) is managed by the user's choices and edits, and by quoting the
   user's own prompts, not removed.
3. **The agent writes it alone.** The least work for the user, but the
   choices that show deliberate direction would be the agent's, which is what
   the legibility-of-process mark is about.

## Decision

We will have the agent write `PROCESS.md` from the prompt log and the commit
history, with the user deciding its content: when there is more to choose from
than fits, the agent shows the options and the user picks before it writes.

## Consequences

- `AGENTS.md` says so under "PROCESS.md", in place of the line that the user
  writes it in their own words.
- The prompt log matters more: it's where the options come from, so its
  results need to keep the decisions and the reasons, not just what was built.
- The user's edits win. A passage the user has rewritten is not reworded
  without asking.
- `README.md` and the crit reflections stay the user's; the agent drafts them
  only when asked.
- Revisit if a marker's or the convenor's feedback says the account reads as
  the agent's rather than the user's.
