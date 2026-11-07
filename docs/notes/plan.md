# Plan

The settled design is [`docs/design.md`](../design.md). This is the root plan
for building it: the project as a whole, and every slice in order. The work is
built in vertical slices
([ADR 0014](../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md)),
which on 2026-10-12 replaced the phases of
[ADR 0012](../adr/0012-plan-in-phases-and-build-each-phase-natively.md).

## The project

- **What:** a 2D pixel-art cat café, one shared room where up to six people
  sit with three cats who each have a character and remember everyone they
  meet. The brief's "multi-user, real-time website that's good".
- **Dates:** crit 9 cutoff Wed 14 Oct, 13:30 (passed); crit 10 cutoff
  Wed 21 Oct, 13:30, inferred from the crit group, which the user hasn't
  confirmed ([brief-and-crits.md](brief-and-crits.md)); final submission
  Mon 9 Nov, 12:00; showcase Wed 11 Nov.
- **Done means:** everything in `docs/design.md` is built, held by its
  checks and live, and `README.md`, `PROCESS.md` and the three reflections
  are in place.

## Built as phases

Phases 1 to 3 were built under ADR 0012. Each phase's plan, execution log and
review stay as the record.

| Phase | Crit | Delivered | Plan | Status |
| --- | --- | --- | --- | --- |
| 1. It's alive | C8 | Accounts with recovery codes; the room, with six inside and a line at the window; walking by mouse, touch and keyboard; public, fleeting bubbles; Mochi, Burakku and Tora with a first set of behaviours; pet and call; trust that grows, persists and shows; `/readme/`; deployed. | [plan-phase-1.md](plan-phase-1.md) | done 2026-10-09: deployed 2026-10-07 as a cut version (tag `crit-8`, see [crit-8-mvp.md](crit-8-mvp.md)), then closed and reviewed ([reviews/phase-1-findings.md](reviews/phase-1-findings.md)) |
| 2. All at once | C9 | The quiet-seat rule; rearranging furniture together, first grab wins; sitting; emotes; phone layout B; browser checks at both sizes. | [plan-phase-2.md](plan-phase-2.md) | done 2026-10-09: built, reviewed ([reviews/phase-2-findings.md](reviews/phase-2-findings.md)), deployed through CI |
| 3. Fly by instruments | C10 | Logging every action and the narrating log tail; treats and bowls; play, picking up, carrying and passing cats; laps; knocking things over and tidying; anger, scratches and bans. | [plan-phase-3.md](plan-phase-3.md) | done 2026-10-10: built, reviewed ([reviews/phase-3-findings.md](reviews/phase-3-findings.md)), deployed through CI |

## Slices

The rest of the old roadmap's phases 4 and 5, as slices. Each spec is
`Proposed` until the user approves it. Its plan is written when the slice
starts, from the code as it then stands, and it ends with a fresh review.

| # | Slice | Delivers | Spec | Status |
| --- | --- | --- | --- | --- |
| 01 | The café keeps living while it sleeps | Fast-forward on wake, with the saved clock and random state; the schedule during a replay; loud failures | [01](../slices/01-the-cafe-keeps-living-while-it-sleeps.md) | live ([plan](plan-slice-01-fast-forward.md), [findings](reviews/slice-01-findings.md)); its night line held by slice 08's tests since 2026-10-17 |
| 02 | What the night left behind | The chalkboard over a rolling 24 hours, readable on both layouts; scattered toys as traces until tidied | [02](../slices/02-what-the-night-left-behind.md) | live 2026-10-21, its judged line passed by the user on the board slice 08's night test prints ([plan](plan-slice-02-chalkboard.md), [findings](reviews/slice-02-findings.md), [notes](slice-02-board.md)) |
| 03 | Keeping it kind | Mute, the slur blocklist, the admin ban | [03](../slices/03-keeping-it-kind.md) | spec proposed |
| 04 | The showcase room | A load check at forty connections inside 256 MB; the window's count | [04](../slices/04-the-showcase-room.md) | spec proposed |
| 05 | The art pass | Every sprite reads at both scales; a pose for every behaviour | [05](../slices/05-the-art-pass.md) | superseded 2026-10-21 by 09 to 11, when the user chose the look ([ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)) |
| 06 | The accessibility pass | Every action by keyboard, touch and screen reader, held by browser checks | [06](../slices/06-the-accessibility-pass.md) | spec proposed |
| 07 | Getting in while the café wakes | The port opens at once; the page and accounts work during a replay; the café shows "Dusting off the café…" until it's ready; a dead world task restarts the machine | [07](../slices/07-getting-in-while-the-cafe-wakes.md) | reviewed and live ([plan](plan-slice-07-waking.md), [findings](reviews/slice-07-findings.md), [notes](slice-07-waking.md)) |
| 08 | Long gaps held by mocked time | A clock the tests start at a chosen instant (never on Fly); the built café lives through a night, a midnight and nine days in `cargo test`; the night lines of 01 and 02 no longer wait on a real night ([ADR 0016](../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)) | [08](../slices/08-long-gaps-held-by-mocked-time.md) | live 2026-10-21 ([plan](plan-slice-08-mocked-time.md), [findings](reviews/slice-08-findings.md)) |
| 09 | The room seen at an angle | The isometric camera on the same grid, with plain blocks for sprites; picking and the browser checks through the stage; layout B the phone's default ([ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)) | [09](../slices/09-the-room-seen-at-an-angle.md) | live 2026-10-22, turned 90° at the user's asking so the street wall is on the left ([plan](plan-slice-09-isometric.md), [findings](reviews/slice-09-findings.md), [notes](slice-09-isometric.md)) |
| 10 | Catppuccin by day and by night | Catppuccin-led day and night palettes in place of the tint, the window lit at night; the page in Latte and Mocha | [10](../slices/10-catppuccin-by-day-and-by-night.md) | reviewed and deployed 2026-10-22, checked live ([plan](plan-slice-10-palette.md), [findings](reviews/slice-10-findings.md), [notes](slice-10-palette.md)); live once the user has judged it |
| 11 | Cats you can tell apart | The agent's PNG sprites at 24-px cats and 32 to 36-px people, a pose for every behaviour; replaces 05 | [11](../slices/11-cats-you-can-tell-apart.md) | live 2026-11-05 ([plan](plan-slice-11-art.md), [findings](reviews/slice-11-findings.md), [notes](slice-11-art.md), [screens](screens/slice-11/)); Mochi approved, the princess hug at the user's asking, the open looks accepted for now |
| 12 | Walking where you look | Walkers face their direction on screen, with back views, and move by screen pixels; the phone's camera follows the same way ([ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md)) | [12](../slices/12-walking-where-you-look.md) | live 2026-11-05, its judged line passed by the user ("slice 12 looks good") ([plan](plan-slice-12-walking.md), [findings](reviews/slice-12-findings.md)) |
| 13 | A café on its street | The room as a diorama, with the street behind it by day and by night; the room crisp, with self outlines, shadows cast from the windows and ambient occlusion ([ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)) | [13](../slices/13-a-cafe-on-its-street.md) | reviewed and merged 2026-11-05 ([plan](plan-slice-13-street.md), [findings](reviews/slice-13-findings.md), [screens](screens/slice-13/)); judged "mostly good", clouds and a warm sky added at the user's asking; live once the user has seen them |
| 14 | Panels over the room | The desktop's panels float over the room, half see-through, draggable and pinnable, dimming when idle; the room at 4×; the treat button beside the emotes | [14](../slices/14-panels-over-the-room.md) | reviewed and merged 2026-11-05 ([plan](plan-slice-14-panels.md), [findings](reviews/slice-14-findings.md), [screens](screens/slice-14/)); the glass more see-through at the user's asking; live once the user has judged the screens, the light theme's white glass, and a real Safari |
| 15 | Music while you sit | Six CC0 lofi tracks by HoliznaCC0, three for day and three for night by the Canberra hour; each visitor's own player, with Play or Pause, Previous, Next and a volume in a fourth floating panel ([ADR 0020](../adr/0020-play-public-domain-lofi-each-visitor-their-own.md)) | [15](../slices/15-music-while-you-sit.md) | reviewed and deployed 2026-11-05, checked live ([plan](plan-slice-15-music.md), [findings](reviews/slice-15-findings.md), [notes](slice-15-music.md), [screens](screens/slice-15/)); live once the user has listened to the sets and judged the panel; a real iPhone's first tap still to try |
| 16 | The café fills the window | A bigger floor at 32-px tiles, so at 1920×1080 the room fills the window; on a desktop the status and talk bars float over the room; the street across the whole window; a terrace in the room's bottom corners ([ADR 0021](../adr/0021-grow-the-floor-and-float-the-bars.md)) | [16](../slices/16-the-cafe-fills-the-window.md) | proposed 2026-11-06, from the user's three asks of that day, with a study ([notes](slice-16-study.md), [screens](screens/slice-16-study/)); reviewed and deployed 2026-11-06, checked live ([plan](plan-slice-16-fill.md), [findings](reviews/slice-16-findings.md), [notes](slice-16-fill.md), [screens](screens/slice-16/)); the terrace kept low at the review's finding 2; live 2026-11-06, its judged line passed by the user ("slice 16 looks great") |
| 17 | Markers see weeks of the café in ten minutes | The page keeps the server's clock; demo accounts, their login in the README, move it forward up to 24 hours through a replay, lay out one of three furniture sets at once, and add or remove bots, from a floating bar at the top; their trust seeded by the operator; the README's "For markers" ([ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md)) | [17](../slices/17-markers-see-weeks-in-ten-minutes.md) | part 1 (all but the furniture sets) built and reviewed 2026-11-06 ([plan](plan-slice-17-demo.md), [findings](reviews/slice-17-findings.md), [notes](slice-17-demo.md), [screens](screens/slice-17/)), in [pull request #2](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/pull/2); live once merged, deployed and the demo accounts seeded on Fly. Part 2 (the sets) after slice 16 |
| 18 | A balcony under the terrace | A deck of stone tiles in the room's angle round its two front edges, so the terrace stands on something; a glass balustrade at its edge, as the user suggested; below it the café's own building carried on down, as data in `street.toml` | [18](../slices/18-a-balcony-under-the-terrace.md) | approved 2026-11-07: the glass 18 px high, the café's own building below; proposed from the user's question of 2026-11-06, with a study ([notes](slice-18-study.md), [screens](screens/slice-18-study/)); building on `slice-18-balcony` ([plan](plan-slice-18-balcony.md)) |

What the crits and reviews turn up becomes new slices here, each with a spec
before its plan.

## What the agent writes and what the user writes

`PROCESS.md` is written by the agent, with the user choosing what goes in it
([ADR 0013](../adr/0013-let-the-agent-write-process-md-and-the-user-choose-its-content.md)).
`README.md` and the reflections are the user's; the agent drafts them only
when asked.

Crit 9 (Wed 14 Oct, 13:30) has passed. `reflections/crit-9.md` is the
user's, `PROCESS.md` was rewritten for it, including the switch to slices
and ADR 0013
([`8960bd4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8960bd4)),
and its multi-user decision is ADR 0009 (the quiet seat). The repo has no
`crit-9` tag; `crit-8` is the only crit tag on the remote (read 17 Oct).

Crit 10 (Wed 21 Oct, 13:30) has passed. `reflections/crit-10.md` is the
user's
([`385f13b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/385f13b)),
and `PROCESS.md` was rewritten for it, with the logs as the crit's
instruments and mocked time
([`06727de`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/06727de)).
Both landed before the cutoff. Whether the demo by the logs alone was
rehearsed isn't recorded. There's still no `crit-9` or `crit-10` tag.

## Where it stands (2026-10-22)

Updated by session `a4e69a46` (2026-11-05).

- **Done and live:** phases 1 to 3, and slices 01, 02, 07, 08 and 09.
- **The look is chosen** (2026-10-21,
  [ADR 0017](../adr/0017-draw-the-cafe-isometric-in-catppuccin-led-colours.md)):
  an isometric camera, 32-px tiles with 24-px cats, Catppuccin-led day and
  night palettes, layout B the phone's default, sprites drawn by the agent,
  and the page in Latte and Mocha. It's built as slices 09 to 11, which
  replace slice 05.
- **Slice 09, the room at an angle:** live. The user judged it on
  2026-10-22 and had it turned 90°, so the street wall stands on the left
  ([notes](slice-09-isometric.md)).
- **Slice 10, Catppuccin by day and by night:** built, reviewed (1 major and
  5 minor findings, all fixed) and merged on 2026-10-22
  ([notes](slice-10-palette.md)); its judged line, from the screenshots, is
  the user's, and so is the README's Catppuccin credit, proposed there.
- **Slices 12 and 13, walking and the street:** built, reviewed (3 major
  and 6 minor findings on 12, 5 major and 8 minor on 13, each answered,
  most fixed test first) and merged on 2026-11-05. Their judged lines are
  the user's: walks watched live, and the café on its street from
  [the screens](screens/slice-13/).
- **Slice 14, the panels:** built, reviewed (4 major and 7 minor findings,
  each answered, most fixed test first) and merged on 2026-11-05.
- **Approved, not yet built:** slice 11, after 14.
- **Specs waiting for the user's approval:** slices 03, 04 and 06. None is
  planned.

## What's left, in order

1. **The look, as settled on 2026-11-04**
   ([ADR 0018](../adr/0018-keep-the-isometric-room-and-fix-its-walking-and-corners.md),
   from [art-style.md](art-style.md)): isometric stays, at 32-px tiles,
   and the room is drawn crisp with self outlines, cast shadows and
   ambient occlusion
   ([ADR 0019](../adr/0019-draw-the-room-crisp-with-outlines-and-shadows.md)).
   Slices 12 to 14 are approved, and the user asked for 11 to 14 built
   (2026-11-04), in this order: 12, the walking, which every sprite's
   back view waits on; 13, the street and the crisp room; 14, the panels;
   then 11, the art, at the new density with back views. **Slice 15, the
   music** (spec proposed 2026-11-05,
   [ADR 0020](../adr/0020-play-public-domain-lofi-each-visitor-their-own.md)),
   goes between 14 and 11 at the user's asking, since its desktop panel
   is one of 14's floating panels.
1a. **Slice 17, how markers receive the café** (approved 2026-11-06,
   [ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md)):
   demo accounts with the clock, the furniture sets and bots, and the
   README's "For markers". The user said to "consider markers only", so
   this comes before the showcase's slices 04 and 03. At the user's
   asking, part 1 (everything but the furniture sets) is built alongside
   slice 16, and part 2 (the sets) after slice 16 settles the floor.
2. **Approve and build slices 04, then 03.** The showcase puts a full room
   of strangers in the café, so the load check and the window's count come
   first, then mute, the blocklist and the admin ban. This order is the
   agent's suggestion; the user hasn't chosen one, nor where these fall
   against the look.
3. **Approve and build slice 06**, the accessibility pass, after the camera,
   since its browser checks find tiles the way slice 09 makes them.
4. **Final submission (Mon 9 Nov, 12:00).** `PROCESS.md` rewritten again,
   and the user's `README.md`. The README promises soothing music, which
   slice 11 settled would come out and slice 15 would make true again;
   the line, and a credit for HoliznaCC0 in its sources, are the user's
   to write. It has no sources yet;
   [readme-material.md](readme-material.md) gathers them.
