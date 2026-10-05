# Settled design

Every decision fixed so far, each with its reason. `AGENTS.md` holds the rules;
this holds the specification. Working state belongs in `docs/notes/`, not here.

Nothing about the app itself is settled yet.

## Harness

- **One rules file.** `AGENTS.md` holds the rules and `CLAUDE.md` is a symlink
  to it, so every agent reads the same file and the two can't drift apart.
- **Carried over from assignment 2:** the "no time limit" rule and the
  memory-through-files rule. Both held up across A2's long build sessions.
- **Three records:** settled decisions in this file, working state in
  `docs/notes/`, and every prompt with its outcome in `docs/prompts-result.md`.
  The prompt log carries over from A2, where it was the source material for
  `PROCESS.md`.
