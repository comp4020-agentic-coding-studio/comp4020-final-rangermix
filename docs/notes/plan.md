# Implementation roadmap

The settled design is [`docs/design.md`](../design.md); this is the order it gets
built in. Each phase leaves something usable, is lined up with a crit, gets its
own plan file when it starts (so later phases are planned with what earlier
ones taught), and ends with a whole-phase review. How the work is run is
[ADR 0012](../adr/0012-plan-in-phases-and-build-each-phase-natively.md).

| Phase | Crit | Delivers | Plan | Status |
|---|---|---|---|---|
| 1. It's alive | C8, week 9 | Accounts with recovery codes; the room, with six inside and a line at the window; walking by mouse, touch and keyboard; public, fleeting bubbles; Mochi, Burakku and Tora with a first set of behaviours (wander, nap, come over, hide from noise, look up at their name, greet a friend at the door); pet and call; trust that grows, persists and shows; `/readme/`; deployed. | [plan-phase-1.md](plan-phase-1.md) | done 2026-10-09: deployed 2026-10-07 (`659952a`, tag `crit-8`) as a deliberately cut version, then closed with Task 17 (README material), Task 19 (what the cut skipped; see [crit-8-mvp.md](crit-8-mvp.md)) and Task 18 (the review, answered in [reviews/phase-1-findings.md](reviews/phase-1-findings.md)) |
| 2. All at once | C9, week 10 | The quiet-seat rule (nudge, walk-out); rearranging furniture (catalogue, grab and place, first grab wins, the walkway rule, the floor limit, cats jumping off); sitting on furniture; emotes; phone layout B and the switch; browser checks for the keyboard pass, both marking sizes and a resize mid-use. Rearranging also takes over the cushion's cut-down move and closes crit 8's items 16 to 24: every piece but the fixed ones moves, blocking pieces included (with the cut-off and standing-there checks); a catalogue to add and remove; carrying, seen by everyone, dropped back on a disconnect; cats jumping off (coming to look is phase 3's "investigating new furniture"); flat pieces on rugs; a piece under a cat still reachable by click; a preview while placing; an arrangement saved by something steadier than a piece's place in `room.toml`; and the phone checked by touch. | [plan-phase-2.md](plan-phase-2.md) | done 2026-10-09: built, reviewed (see [reviews/phase-2-findings.md](reviews/phase-2-findings.md)) and deployed through CI |
| 3. Fly by instruments | C10, week 11 | Complete action logging and the narrating log tail; treats and bowls; giving treats and passing cats; picking up and carrying; the full character system (hunger, play, comfort, toys, perching at the window, knocking things over, investigating new furniture, cats noticing each other); anger and bans with grudges. | [plan-phase-3.md](plan-phase-3.md) | in progress since 2026-10-09 |
| 4. Never stops | before the deadline | Fast-forward on wake with the saved random state; traces that stay until tidied; the chalkboard and its readable panel; mute; the slur blocklist; the admin ban; persistence hardening. | written when phase 3 is done | not started |
| 5. The showcase | the deadline, 9 Nov | An art pass, an accessibility pass, a load check at forty connections, and whatever the crits and reviews turned up. | written when phase 4 is done | not started |

## What the user writes

The brief asks for `README.md`, `PROCESS.md` and the crit reflections to be the
user's own words, so no phase writes them. Each phase can gather material for
them in `docs/notes/` (sources found, what was enforced and what was judged)
and says when a crit needs one.

For crit 9 (Wed 14 Oct, 13:30), the user's, as of 2026-10-09:

- `reflections/crit-9.md`.
- `PROCESS.md` brought up to phase 2.
- `README.md`: its first lines are still the template's (`# Your app` and
  the "Replace everything" comment), it promises music the design doesn't
  have, and it has no sources yet; [readme-material.md](readme-material.md)
  gathers sources and lists what's enforced and what's judged.
- The multi-user decision crit 9 asks for is ADR 0009 (the quiet seat),
  built and linked; "first grab wins" (ADR 0004) is the other the pod may
  argue with.
