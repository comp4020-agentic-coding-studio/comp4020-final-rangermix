# Brief: pre-flight interface scan of the phase 1 plan

You are checking an implementation plan before anyone builds from it. Work
read-only: the only file you write is the result file named at the end.

## What to read

- `docs/notes/plan-phase-1.md`, all of it. It has 18 tasks with complete code;
  each task opens with an **Interfaces** block saying what it consumes from
  earlier tasks and what it produces for later ones.
- `docs/design.md` and `AGENTS.md` only when you need them to decide which
  side of a mismatch is right.

## What to check

For every pair where a later task uses something an earlier task produces,
compare the producer's actual code in the plan with the consumer's actual
code in the plan, not just the Interfaces prose. Look for:

- function and method names, parameter order and types, return types,
  `async` or not, `&self` or `&mut self`, `pub` or private;
- struct fields, enum variants, serde renames (the wire is camelCase), and
  module paths (`crate::x::y`);
- `Cargo.toml` features and dependencies that later code needs but an
  earlier task didn't add (or a later task forgets to add);
- `content/tuning.toml` keys against the `Tuning` struct against every place
  a tuning field is read; the same for `room.toml`, `furniture.toml` and the
  cat TOMLs against their structs;
- items a later task modifies or replaces (for example `AppState::new` gains a
  parameter in Task 10, `world/mod.rs` is replaced in Task 9): does the later
  task update every earlier call site and test that would otherwise break?
- in the client: generated TypeScript type and field names against their use
  in `.ts` files; element ids and classes in `index.html` and `style.css`
  against their use; exports against imports; `package.json` scripts against
  the commands the steps run;
- the spec tests (`spec/*.test.ts`) against the server behaviour and the
  helpers they import;
- test counts in `Expected:` lines against the tests the step actually adds,
  where a step states a count.

Crate API correctness (axum, rand, rusqlite and so on) is out of scope: the
compiler checks it. Cross-task consistency is the job.

## What to write

Write `docs/notes/reviews/phase-1-preflight.md` with:

1. **Rows**: one line per producer/consumer pair you checked, as
   `Task A → Task B: <what A produces> vs <what B consumes>: OK` or
   `... : CONFLICT (see C<n>)`. Tasks that share nothing get no row.
2. **Conflicts**: for each, an id `C<n>`, the plan line numbers of both
   sides, what exactly differs, and the smallest change that would make them
   agree, saying which side should change and why.
3. **Other defects noticed** (optional, kept separate): anything inside a
   single task that would fail to compile or fail its own test, with line
   numbers. Keep it to things you are confident about.

Be precise and cite line numbers; a conflict without them can't be checked.
Reply with only the path of the result file and the number of conflicts.
