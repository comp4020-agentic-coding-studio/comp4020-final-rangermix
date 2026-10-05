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
