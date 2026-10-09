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
