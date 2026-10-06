# 0011. Drive cats with data-defined characters

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The café starts with three cats, and the roster will grow ("the game will not
stop at 3 cats"), so cat characters and their effects have to be modular. The
cats act on their own and selectively; they react in character to arrivals,
noise, their names, treats and furniture; they behave differently with and
without people; they enforce their own boundaries; and they remember each
person. The simulation has to be deterministic for fast-forward and tests
([ADR 0006](0006-fast-forward-the-world-when-the-server-wakes.md)) and fit in
256 MB.

## Options

1. **Data-defined characters over a shared library of behaviours.** Each cat
   is a data file of look, traits, daily rhythm and behaviour weights; Rust
   provides the behaviours; each behaviour scores itself from the cat's needs,
   traits, stimuli, trust and the hour, and the cat picks among the top few,
   weighted at random. A new cat is a file, the rules stay consistent across
   cats, tuning needs no code, and a seeded generator makes it reproducible.
   The cost: scores need play-testing to tune, and emergent behaviour can
   surprise.
2. **A hand-written state machine or behaviour tree per cat.** Precise control
   of each cat, but every new cat is new code, and three cats drift into three
   codebases.
3. **LLM-driven cats.** Open-ended behaviour, but it puts an API key on a public
   server, costs money per decision, adds latency, can't be reproduced in
   fast-forward or tests, and the 256 MB machine can't run a model itself.

## Decision

We will define each cat as a data file of look, traits, daily rhythm and
behaviour weights, and choose its behaviour by utility scoring over needs,
traits, stimuli, trust and the hour, with seeded weighted randomness.

## Consequences

- Balancing is editing numbers in `content/cats/`; new kinds of behaviour are
  Rust modules that cats switch on.
- How a cat answers handling (welcome, tolerate, refuse, scratch and escape, or
  a ban when furious), how fast it trusts, and how long it holds a grudge all
  follow from the same traits.
- Every behaviour is reproducible in tests from a seed.
- Revisit if scoring can't express a character the café needs.
- The commits that carry it out will be linked here as they land.
