# Phase 3, "Fly by instruments": Implementation Plan

> Method fixed by [ADR 0012](../adr/0012-plan-in-phases-and-build-each-phase-natively.md):
> built natively, test first, committed and pushed per task (a push to `main`
> deploys through CI), with a whole-phase review at the end.

**Goal:** the logs tell the story of a dozen visitors, for crit 10 (Wed 21
Oct, 13:30: "fly by instruments", narrated from the logs alone); and the
cats become the characters the design describes: hungry, playful, curious
and moody, with treats, play, carrying, and grudges that last.

**Spec:** [`docs/design.md`](../design.md) ("The cats", "People", "Logging"),
ADR 0011, `AGENTS.md`'s kept rules. Roadmap: [plan.md](plan.md). Written
2026-10-09, after phase 2.

## Global constraints

Phases 1 and 2's still hold. Added: every log line is one JSON object with
`timestamp`, `target`, and for people `uid`, `who` and `what`; nothing said
is ever logged (a `say` line has the length and who it was to); trust never
fades with absence, and a grudge cools with time but never changes trust by
itself.

## Not in this phase

Phase 4's: fast-forward on wake, the night's traces and scattered toys, the
chalkboard, mute, the blocklist, the admin ban. Phase 5's: the art pass.

## Decisions made in this plan

1. **One line per action, refusals included.** Every message a person sends
   that does something logs one `action` line: `uid`, `who`, `what` and the
   `outcome`; a refused one logs `outcome = "refused"` and the error code,
   in one place in `World::handle`, so no handler can forget. Presence and
   "still here" pings are not actions. Calling a cat logs `call`.
2. **The cats' story, not their steps.** A `cat` line when a cat starts
   something worth narrating (nap, hide, eat, play, perch, investigate,
   knock over, come to someone, greet, lap, jump down), never per step.
3. **The live view is `pnpm logs`**: `flyctl logs` piped through
   `scripts/narrate.ts`, which turns each JSON line into a sentence ("19:42
   sam petted Mochi: she purred"). No stats page.
4. **Needs:** hunger and play join tiredness and company, drifting by the
   cat's appetite and playfulness; all four are saved with the cat.
5. **New behaviours**, each scoring itself like the old: eat (from a bowl
   or a treat on the floor), play with the toys, groom, perch on the window
   seat while someone waits at the window, investigate a piece placed in
   the last two minutes (Tora first), knock over a small piece when the café
   is empty or it's her prowling hour, and nap on a lap at trust 80. Cats
   notice each other: a sociable cat would rather nap near another, a shy
   one keeps two tiles away.
6. **Bowls and treats.** The bowls hold three portions, refilled at 7:00,
   12:00 and 18:00 Canberra time; a hungry cat eats a portion. Each visitor
   has three treats a Canberra day, plus any they're given: put one down at
   your feet, offer one by hand, or give one to someone inside. Treats used
   and received are stored per day; treats on the floor are not (a cat eats
   them soon enough).
7. **Handling** follows one rule for pet, play, offer, pick up and pass: the
   cat answers from its character, its state, its trust in the person and
   its anger at them. Unwelcome handling (a refusal, pushing) raises anger
   by the cat's temper; anger cools away over the cat's grudge. Angry, a
   cat scratches (trust down, and a held cat jumps down); furious, it bans
   that action from that person for its grudge (Mochi 2 hours, Tora 4,
   Burakku 2 days). Bans are stored until they expire; trying a banned
   action says how long is left. Anger is memory only.
8. **Carrying a cat.** A cat that agrees is held: it moves with its holder,
   who can't carry furniture at the same time, and it jumps down when it has
   had enough (longer with more trust and affection), at the door, or when
   its holder leaves. Passing it to someone beside you works if it knows
   them (trust 20).
9. **Knocking over** topples a plant, lamp or the toys; a toppled piece is
   drawn on its side, saved, and stood back up by anyone with "Stand it up"
   (logged as `tidy`). Toys scattered across the floor are phase 4's traces.

## Tasks

1. **Logging and the narrator.** Rust test first: every `ClientMsg` that is
   an action, accepted or refused, produces one `action` line with `uid`,
   `who`, `what` and `outcome`, and a `say` line never holds the text. Cat
   lines for the notable behaviours. `scripts/narrate.ts` with a pure
   `narrate(line)` tested in `spec/narrate.test.ts`; `pnpm logs`.
2. **Anger, scratches and bans.** `server/src/anger.rs` (pure, tested):
   rise, cool, scratch and ban thresholds. A `bans` table (migration 2) and
   its restore; `ErrorCode::Banned`; pet goes through it.
3. **Needs and behaviours.** `cats.rs` scores eat, play, groom, perch,
   investigate, knock and lap; `cat_life.rs` carries them out. Tests per
   cat character (Mochi first to food, Tora first to new furniture and to
   play, Burakku knocks things over at night).
4. **Bowls and treats.** Tuning, schedule, per-day treats in the store
   (migration 2), put down, offer by hand, give to someone; cats eat.
5. **Play, pick up, carry, put down, pass, laps.** Server, test first.
6. **Knocking over and tidying.** Toppled state saved with the
   arrangement; "Stand it up".
7. **The client.** Menus for the new actions, your treats in the panel,
   the held cat in its holder's arms, poses, bowls full or empty, treats on
   the floor, a toppled piece on its side, banned and scratched notes,
   announcements for each. Client tests for state and menus.
8. **Spec and browser checks.** Black-box: a treat put down reaches others,
   a give moves a treat, three a day, a banned pet says how long, the log
   line rules hold for an action sent by a visitor (by the app's own
   output in CI). Browser: offering a treat by keyboard.
9. **design.md and the ADRs.** Record decisions 1 to 9; numbers to tune.
10. **Whole-phase review**, as before, then everything green, deployed and
    checked live read-only.

## Execution log

Where carrying out this plan departed from it, task by task, and why.

- **Task 1 (2026-10-09).** As planned. Refusals and walk-starts are logged
  centrally in `World::handle` by comparing the messages and the pending
  action before and after; Put it back with empty hands is now refused, so
  even that leaves a line. Checked end to end: a local server driven by the
  spec, its log piped through `scripts/narrate.ts`, read as a story.
- **Tasks 2 to 6.** Built together, as one change to the protocol. The pure
  rules (`anger.rs`, the scoring and handling in `cats.rs`, the store's
  migration 2) went test first. The world's side (`handling.rs`,
  `treats.rs`, and `cat_life.rs` rewritten around the new plans) was
  written before its tests, a departure from the method; the tests in
  `world/cats_tests.rs` followed straight after, and caught two things:
  being already loaded answered with the wrong code (now `HandsFull`
  whatever you carry), and a ban's time left rounds up to whole minutes,
  so "2 h" is right where the test had guessed "1 h 59 min". The anger
  rise was set to 0.3 + temper / 2, so Mochi is furious at the third
  unwelcome try in a row and Burakku and Tora at the second. `CatView` was
  the one wire type without camelCase names; it has them now.
- **Task 7.** The menus test first; the drawing and the panel checked in
  the client and by the browser spec.
- **Task 8.** The keyboard pass now steps past the panel's "Put a treat
  down" button on its way back to Leave, which is the right order.
- **A layout B fault the new checks found.** The phase 2 review's fix closed
  a ring whenever the view panned; but Tab moves the keyboard pointer and
  the view pans to follow it on the next frame, so Tab then Enter opened a
  ring that vanished at once. The ring now follows its tile as the room
  pans. Two browser checks leaned on finding a still cat, and with the
  cats busier in phase 3 none was found: the ring is now opened by
  keyboard on whatever the pointer settles on, and the touch check taps a
  chair.
- **Task 9.** Done with Tasks 2 to 6 (`0a08fca`): design.md records
  decisions 1 to 9 and the new numbers to tune. No new ADR: the decisions
  sit inside ADR 0011's data-defined cats and ADR 0012's method.
- **Task 10, the whole-phase review (2026-10-09 and 10).** Six reviewers by
  dimension and two skeptics per finding kept 34 findings, 10 major
  ([reviews/phase-3-findings.md](reviews/phase-3-findings.md)). The session
  ran out of the course key's weekly budget during triage, with finding 4's
  fix written but not committed, and the agent briefed with the client's
  answers ([reviews/phase-3-client-brief.md](reviews/phase-3-client-brief.md))
  stopped before it had changed anything. The next session (2026-10-10)
  picked up from the transcript and answered all 34 itself, test first, in
  seven commits; the findings file's "Answered" table says how. Where it
  departed from this plan:
  - Two rules changed, both in design.md: a pass follows the pick-up's bans
    and anger (decision 7's reading, over design.md's narrower trust-20
    line), and a cat bans only once it is already furious, so a scratch
    comes before a ban, and a ban no longer wipes the anger. Tora's temper
    went from 0.6 to 0.65 in `content/`, so "quick to swat" swats first.
  - Decision 5's "or it's her prowling hour" never reached design.md,
    which holds: cats knock things over in an empty café. The test now
    shows Burakku is the one who does it most at night.
  - Task 8's missing checks are in: a treat offered by keyboard in the
    browser, and the log-line rules for real visitors as a CI step
    (`scripts/check-logs.ts` over the container's output after the spec)
    rather than a spec file, since only CI can read that output. Whether a
    cat lets itself be picked up is the cat's to say: a browser check that
    waited for one, retrying as fresh visitors for 200 seconds, failed in
    CI with all three cats asleep for over three minutes (the app's own log
    showed it), and its retries were spaced from the ask rather than from
    the refusal, so one counted as pushing. Now the touch check proves the
    way to "Pick {name} up" and that the café answers, putting the cat down
    from the bar when it does agree, and the bar itself is a client test
    (`client/test/arms.test.ts`).
  - A fault found by the checks, not the review: Tab's cycle kept each
    target's tile from the first press, so after a cat had moved, Tab named
    it but pointed where it had been. Each Tab now looks up where its
    target is (`25ff89d`).
  - Closed with 250 Rust tests and 76 client tests green, and the spec's
    47 (9 in a browser) green twice against the image on fresh containers,
    each followed by the log check over the app's own lines.
