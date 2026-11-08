# Brief: moments for the final `PROCESS.md`

The final submission is due Mon 9 November 2026, 12:00 AEDT. `PROCESS.md` is
rewritten for it, not appended to. This brief asks for **candidate moments**
from the record, so the user can choose what goes in
([ADR 0013](../../adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
Nobody edits `PROCESS.md` from this brief, and no file in the repo is changed:
results come back as data.

## What `PROCESS.md` must do

- 900 to 1,100 words, describing the project as it stands at the end.
- Make the case for the stack and for the agent workflow, with citations
  (the brief; see [brief-and-crits.md](../brief-and-crits.md)). It is half the
  mark: "legibility of process" is 50%.
- Every claim cited by a commit link. ADRs are linked, not restated.
- The current version (crit 10's, 937 words, commit `06727de`) has six
  sections: where it stands; the harness came first; the design and the
  stack; the workflow (phases, then slices); logs as instruments; live
  testing, then mocked time. Some of that will stay, condensed, so new
  moments compete for roughly 400 to 550 words.

## What happened since crit 10

Crit 10's cutoff was Wed 21 October 2026, 13:30 AEDT. Since then, 328
commits (`06727de..HEAD`): the look rethought twice (ADRs 0017 to 0019,
slices 09 to 14), music (ADR 0020, slice 15), the room filling the window
(ADR 0021, slice 16), demo accounts for markers (ADR 0022, slice 17), balcony
studies (slices 18 and 19), the welcome at the door (ADR 0023, slice 20), the
sitting pose, a walk turning mid-step, walking onto the rug, and cleaning up
branches and worktrees. The prompt log's "Final submission" section
(`docs/prompts-result.md` from line 1372) records each prompt and outcome.

## What a moment is

One specific episode from the record where something was decided, caught or
changed, that shows how the stack or the agent workflow worked, or failed and
was corrected. Strongest:

- the user's own call, in their own words, that changed what was built;
- the process catching an error: a check that couldn't fail, a claim of the
  agent's that turned out wrong, a review finding that changed a decision, a
  red CI run that kept a bad build off the live café;
- a decision with its alternative and its cost on record;
- evidence that the stack, or the harness, paid off or cost something.

A list of features is not a moment. Neither is a summary of a slice.

## Rules for evidence

- Commit hashes come from `git log` only, never from memory. A short SHA
  must resolve: `git cat-file -e <sha>^{commit}`. Say what the commit
  actually did (its subject line), not what you expect it did.
- The user's words are quoted verbatim from `docs/prompts-result.md`, with
  the entry's *Sent* timestamp. Typos stay.
- ADRs and notes are cited by their path in the repo.
- Numbers (findings counts, timings, test counts) come from the record, with
  where they were read.
- The repo goes public: nothing private.

## Register

Match the current `PROCESS.md`: short plain sentences, past tense, concrete
nouns and numbers, no hype, no "leveraged" or "robust". Its best lines are
like "The café was right and the test was wrong."

## What to return, per moment

- a title;
- which part of `PROCESS.md` it serves (stack, harness, workflow, design,
  testing, look, markers, or other);
- what it would say: two to four sentences in the register above;
- the user's quotes, verbatim, with when each was sent;
- each citation, with what it supports;
- why it earns its words over the alternatives;
- its cost in words, and a strength from 1 to 5.
