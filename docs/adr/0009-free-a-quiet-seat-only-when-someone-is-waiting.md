# 0009. Free a quiet seat only when someone is waiting

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

With six seats ([ADR 0008](0008-cap-the-cafe-at-six-with-a-line-at-the-window.md)),
one forgotten tab holds a sixth of the café. But sitting quietly and watching a
cat, without touching anything, is exactly what this café is for. Crit 9 asks
for one recorded decision about how the app behaves when several people use it
at once, with the alternatives weighed; this is that decision.

## Options

1. **Step out when away, and only when someone is waiting.** If a visitor's tab
   is hidden, or they haven't touched anything for a while, and someone is at
   the window, they get a "still there?" nudge; with no answer, their avatar
   walks out the door and the first in line walks in. Quiet watching is safe
   whenever nobody is waiting, and forgotten tabs still free their seats. The
   cost: the away signals can misjudge someone reading without touching
   anything, so the nudge has to be noticeable and easy to answer.
2. **Timed visits while there's a line**, say 15 minutes each, then swap and
   rejoin the line. Predictable rotation at the showcase, but it hurries the
   slow, lingering visit the café exists for.
3. **Nobody is moved**; a seat frees only when its tab closes. The simplest,
   but one forgotten tab blocks a seat for hours.
4. **Give up your seat** to someone at the window. A kind gesture, but it
   depends on goodwill and does nothing about forgotten tabs.

## Decision

We will free a seat held by someone who has gone quiet only while someone is
waiting, after a "still there?" nudge they can answer.

## Consequences

- Starting values, all tunable: a dropped connection keeps its seat for 30
  seconds; "gone quiet" means the tab hidden for 2 minutes or no input for 10;
  the nudge waits 60 seconds for an answer.
- With nobody waiting, anyone can stay as long as they like.
- The rule is tested in Rust with a controllable clock, because waiting real
  minutes is too slow for CI's black-box checks.
- At the crit, the pod's natural counter-argument is option 2, timed visits.
- The commits that carry it out will be linked here as they land:
  [`207fa4b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/207fa4b) (the nudge and the walk-out).
