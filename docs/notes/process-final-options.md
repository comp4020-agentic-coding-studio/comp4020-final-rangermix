# Options for the final `PROCESS.md`

Set out on 2026-11-09 for the user to choose from, before the rewrite
([ADR 0013](../adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
Found by a workflow of five readers over different parts of the record, from
[the brief](briefs/process-final-moments.md); four readers' candidates were
checked by a verifier each (every SHA with `git cat-file` and `git show`, every
quote by exact match in the prompt log, every number against its source). The
fifth reader's (git, CI and the live notes) verifier and the synthesizer were
cut off by a usage limit, so those were checked by the main session: every
SHA resolves with the subject claimed, and the CI counts were recounted with
`gh run list`.

`PROCESS.md` runs 900 to 1,100 words. The parts kept from crit 10's version,
condensed, take about 450 to 550, so about four to six moments fit.

## Moments since crit 10

Words are each moment's own cost. **S** is strength, 1 to 5.

| ID | Moment | What it would say | Cites | Words | S |
|---|---|---|---|---|---|
| M1 | The look had a cause | "a bit... normal" led to studies: a recolour alone still looked ordinary; the blur was canvas polygons anti-aliasing (763 colours in a frame whose fills use 37), not the camera; top-down would keep it and cost days of the five left. "5. stay isometric". Nine edges compared: outlines over soft edges went 1,633 → 2,468 colours, crisp 115; the user chose "9 Crisp + self outline + cast shadows + AO". | `ab144ea` `f83105a` `9ee88de` `14f6476` `e464602`; ADRs 0017 to 0019 | 110 | 5 |
| M2 | The look changed twice and the server never knew | Rules are about tiles, so of 92 commits on slices 09, 10, 12 to 14, seven touched the server (content tests) and none the protocol; the camera as one module made the user's 90° turn land in 11 minutes. Only the art reached the wire, as a perch flag. | `23ab0f5` `f02e67d` `abe3135`; ADR 0004 | 80 | 4 |
| M3 | Weeks of cat life in ten minutes, on the replay built for sleep | A lap is 8 days away with Mochi, 27 with Burakku; a marker has ten minutes. "1. consider markers only..." and "the server will fast forward time to the target clock for at most 24 hours". A jump is the replay a sleep uses; ADR 0016 kept a set clock off Fly, so the clock gained a lead that only grows. Cost named: the public password can push the café ahead for good. | `a4ed140` `c7fcba1` `b32d747` `5805cdf`; ADRs 0006, 0016, 0022 | 100 | 5 |
| M4 | One clock, moved | Slice 17's reviewer, on another model, found every page cut off within 25 s of a jump (silence timed on the café's clock), sessions aging on it, trust given during a jump shown but never stored. All fixed test first before `main`. | `75fa789` `ed0556e` `065cc7a` `20a93b0` | 80 | 5 |
| M5 | The public password, reviewed as an attacker's | "this sets the furniture immediately without rate limit": a script sent 40 sets in 5 s and a visitor crossing the room got one tile. That changed a decision: one set every 10 s. | `50dc122` `58b8c9a`; ADR 0022 | 70 | 4 |
| M6 | The balcony I didn't approve | The agent ran the balcony past both ends of the room, its own call, flagged for judgement. "it should just show the cafe corner": the room is a diorama cut at its walls, so slice 19 ends it there. | `3a19fb8` `c3bc882` `4e80796` `297a253` `69f0313` | 85 | 5 |
| M7 | An approved line, changed and put back | Slice 12's approved "at most one screen pixel per frame" can't be met at 3× (about 2.4 px a frame). The builder rewrote it; the cold review said the user hadn't seen it; the log said so in bold; "1. yes that's okay". | `2bebc92` `566385c` | 70 | 5 |
| M8 | The record was wrong, and I had decided on it | The user kept slice 14's glass on the agent's word that it was white by day; the review found it white at any hour in the light theme (114 of 114 pixels at 22:00), since the screens had paired day only with light. Corrected with all four pairings, the choice back with the user. Also: a claim that shadows fail at night, corrected by the night study before anything was built. | `756cec2` `0065fa7` `e464602` | 85 | 5 |
| M9 | Every review found a check that couldn't fail | 13 slice reviews since crit 10, each with at least one check that passed on a broken café: slice 13's street check passed with the street one flat colour; slice 11's 33 browser checks passed with cats picked by their old 16-px box. Each fix's test was seen failing on the reviewer's broken build. | `9389131` `18a53f8` `c2e5303` `c59b576` | 90 | 5 |
| M10 | Four lenses and two skeptics | Slice 20's door, for a shared computer. "unify log in and sign up...". Four reviewers, two skeptics per finding, all 16 stood: the last visitor's recovery code left in the page, their bubble and draft left for the next person, an IP-logging mutation that passed, a log check that would have blocked the deploy. One changed a decision: a name check pays for its sign-up. | `8616e75` `b901cf1` `1a7900a` `600e41a`; ADR 0023 | 95 | 5 |
| M11 | A walk that snapped back was the server's | The user said what it should do; the cause was the server routing every new walk from the last tile. One helper fixed people, bots and cats with no protocol change; a WebSocket check failed on unfixed `main`; live, the largest move across a turn was 0.049 of a tile. | `1db9fde` `25f0c64`; ADR 0004 | 80 | 4 |
| M12 | A licence stopped the music | Bensound's free licence doesn't cover a game, and its files can't go in a public repo; the agent read the terms before building and found HoliznaCC0's CC0 lofi. "1A 2A 3A 4B 5A 6A and yes each visitor gets their own player". | `163f9cc` `a455fe2`; ADR 0020 | 80 | 4 |
| M13 | Viewport, not monitor | The user asked for a bigger floor, not a bigger tile, citing the course's 1080p viewport; the course says "Those are _viewports_, not monitor sizes"; the room's box depends only on width plus depth; 13 by 12 at 4×. | `92199ca` `c215e03` `09c3166`; ADR 0021 | 100 | 4 |
| M14 | CI as the gate, and a type across two branches | 69 runs on `main` since crit 10: 57 green, 7 red, 5 cancelled; every red run skipped the deploy. One was a phone bug only a fresh café shows; one a clash of the ts-rs-generated types, where the rug's green PR met slice 11's new perch flag and `main` failed to typecheck until the fixtures had it. | `0b0fddd` `215f31b` `a6d970e` `12fc1d7` `38ba731` | 100 | 4 |
| M15 | A slice the plan lost | The furniture sets waited for slice 16, which landed, and no session picked them up. The user found it by logging in as a demo account; built, reviewed and live by the next morning. 03, 04 and 06 are still only proposed. | `8557330` `2714714` `8a59266` | 85 | 4 |
| M16 | Parallel sessions | Three sessions at once on 5 November; a clash no merge marked (slice 16's checks faked the device's clock the page no longer read); conflict markers committed to the prompt log and taken out; 29 branches and 13 worktrees removed. | `8d85e8e` `14c266c` `2b2c600` | 85 | 3 |
| M17 | A café saved on the old floor, woken on the new | The floor grew from 12 by 10 to 13 by 12 under visitors' furniture; a save from `main`'s own server woke on it with its pieces kept and the new strip's added once; live the same. | `3250c50` `a2f9452` `8ea8ac5` | 70 | 3 |
| M18 | The README said more than the code backs | Four readers checked the user's "What's good?" lines: ten say more than the code backs, and "minimal resource usage" was never measured. | `16bdb1e` | 80 | 3 |
| M19 | A type closed a slip no test caught | Slice 10's review found one-line slips that left every check green, one painting the café in night colours all day; the light became a type, `0 \| 0.5 \| 1`. | `c8e2f62` | 65 | 4 |
| M20 | Answered with a picture | A held cat hid 34 of 42 of its holder's skin pixels; "no. use princess hugs like these", with three pictures. | `9080ed6` `ac925af` | 70 | 3 |
| M21 | The sitting pose, committed by the user | Asked as a patch for the user to commit; `/code-review` found a screenshot script signing up non-`agent_` accounts, against `CLAUDE.md`; a second cold review found no pixel moved but the one meant to. | `16bdb1e` | 90 | 3 |

Sentences rather than moments, for the workflow section: 13 slice reviews
since crit 10 found 147 findings (45 major, 89 minor, 13 nits, none
critical); across all 17 slice reviews, 186 with 50 major. The client's tests
went from 94 (21 October) to 443, `spec/` from 63 to 125.

## What stays from crit 10's version

| ID | Section | Now | Condensed |
|---|---|---|---|
| E1 | The harness came first | 130 words | 80 to 90: the comparison, three records, ADRs, ADR 0013 |
| E2 | The design and the stack | 210 | 150 to 200, with the replay timed at a sixteenth of a core (`b1f1417`: 8 h in 1.3 s) and a live 51-minute sleep in 14 ms (`2f67cbe`); memory never measured |
| E3 | The workflow | 110 | 100 to 120, with the review counts |
| E4 | Logs as instruments | 220 | 60 to 100, or cut: crit 10's story |
| E5 | Live testing, then mocked time | 280 | 60 to 100; folds into M3 and M4 as "one clock" |
| E6 | Cats as data (new) | | 100: three cat files touched by three commits; floor, terrace, balcony, sets and seed all in `content/` |
| E7 | Rules held by checks in CI (new) | | 85: the log check learning the demo password; the ts-rs diff |

## Skeletons

- **A, the workflow corrected itself** (led by the process catching things):
  where it stands 90, harness 85, design and stack 170, workflow 120, M9 90,
  M6 85, M8 or M7 80, M10 95, M3 and M4 together 150, mocked time 60. About
  1,025.
- **B, the user's calls** (led by decisions in the user's words): where 90,
  harness 80, design and stack 160, workflow 110, M1 110, M13 or M12 85, M3
  100, M6 85, M5 70, M15 80. About 970.
- **C, the stack paid off** (led by early decisions meeting late work):
  where 90, harness 80, stack 200 with M3, M2, M11 and M14 in it, workflow
  150 with M9, M4 80, mocked time 70, logs 70, what was never measured 60.
  About 1,000.

## Stale in the current `PROCESS.md`

- "This is week 11, the final project's third crit": it's the final
  submission.
- "New since crit 9: ...": the list is crit 10's.
- "Crit 10 is a demo by the logs alone": past.
- "Rust's compiler catches a class of agent mistakes before any test runs":
  no example from rustc since crit 10. The perch clash was caught by `tsc` on
  ts-rs-generated types, so word it that way.

## Open before writing

- **`main` is red at its head.** CI run 42515669553 on `8a59266` (notes only)
  failed slice 16's phone-pan check in `spec/fill.test.ts`, which also failed
  the first attempt of `2714714`'s run. The deploy was skipped, so the live
  café serves `0085c3c`'s build, the same code. `slice-17-demo.md` says the
  check's timing gets fixed, test first, if it fails again.
  `PROCESS.md` can't say CI is green until it is.
- **Slice 17 part 1's live record is off `main`.** `5bc1c3b` (the demo
  accounts seeded on Fly and checked live) and its log entry `4e63cba` are
  only on `worktree-slice-17-live`. `main`'s `slice-17-demo.md` still lists
  the seed under "Still to do".
- Three worktrees remain (`/private/tmp/s17p2wt`,
  `.claude/worktrees/sitting-pose`, `.claude/worktrees/slice-17-live`), and
  19 branches on GitHub.
