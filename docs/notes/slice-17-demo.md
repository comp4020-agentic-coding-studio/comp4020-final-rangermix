# Slice 17: what was checked, and how the live café gets its demo accounts

Working notes for [slice 17](../slices/17-markers-see-weeks-in-ten-minutes.md)
([plan](plan-slice-17-demo.md),
[ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md)).
Part 1 was built on the branch `worktree-slice-17-demo` and is live;
part 2, the furniture sets, was built on `slice-17-sets` on 2026-11-09
([plan](plan-slice-17-sets.md)); see "Part 2" below.

## Checked on the branch (2026-11-06, session `f6949123`)

- **`cargo test -p cafe`**: every unit and binary test, including the new
  `demo::tests` (the seed), `world::demo_tests`, `world::jump_tests`,
  `world::bots_tests`, `ws::tests::actions_queued_during_a_jump_are_refused`
  and `server/tests/jumps.rs` (a jump on a mocked clock, a stop, and a
  start five minutes later with the clock still ahead). Clippy and
  `cargo fmt` clean.
- **`pnpm -C client check`**: typecheck and the client's tests, including
  `demoBar.test.ts` and the café's hour from the server in
  `canberra.test.ts`.
- **`spec/` against a local café** seeded with `cafe demo seed`
  (`APP_DEMO_PASSWORD=catppuccino`): `demo.test.ts`, the new browser checks
  of the bar, `accounts.test.ts` (the café's own names), and
  `narrate.test.ts`. The whole suite, after the review's fixes: 94 passed,
  `restart.test.ts` skipped (it needs `APP_RESTART`, which CI gives).
  Its first whole run caught three checks that faked only the device's
  clock, fixed in `faea3bd` (see the plan's execution log).
- **CI** on the pull request
  ([#2](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/pull/2)):
  the `check` job (the image, the seed on its volume, the whole spec with
  `APP_DEMO_PASSWORD`, the log check with `catppuccino` never logged) and
  the `rust` job passed at `8ea4b90`.
- **The seed by hand:** without `CAFE_DEMO_PASSWORD` it stops with one
  error line; with it, it makes `demo1` and `demo2` and logs one
  `operator` line per account and per cat, and no line holds the
  password. `scripts/check-logs.ts` passes on the local café's log with
  `catppuccino` among the words that must never appear.
- **Looked at in a browser** at 1920×1080 and 390×844 (layouts A and B):
  the screens are in [screens/slice-17/](screens/slice-17/).

## Seeding the live café (after the merge deploys)

The live café has no demo accounts until the operator seeds them. Once
`main`'s build with slice 17 is deployed:

```sh
fly ssh console -a comp4020-final-rangermix -C "sh -c 'CAFE_DEMO_PASSWORD=catppuccino /app/cafe demo seed'"
fly machine restart -a comp4020-final-rangermix   # the café loads the seed
```

If `demo1` or `demo2` was signed up by a visitor before the seed, the seed
refuses, naming it, and touches nothing: then choose other names in
`content/demo.toml` (`demo` and digits) and the README together. Run the
seed again whenever someone has been unkind to the regular's cats; it puts
the trust back and lifts any bans.

## The review

A reviewer who didn't build it read part 1 cold
([brief](reviews/slice-17-brief.md), [findings](reviews/slice-17-findings.md)):
4 major and 9 minor findings, each fixed test first or answered in the
findings' Answers. The majors: every page was dropped 25 s after a jump
(silence measured by the café's clock); the README's bots step let the
newcomer straight back in; trust a cat gave during a jump's replay wasn't
stored; and jumps spent everyone's session.

## Checked on the live café (2026-11-08, session `f6949123`)

The user merged the pull request on 2026-11-06 (`4740c3b`), and CI
deployed it. The live machine (version 120) had no demo accounts: a
log-in as `demo1` answered 401.

- **The seed**, over `fly ssh console` with the command above: `demo1`
  (uid 30) and `demo2` (uid 31) created, each with Burakku 25, Mochi 85
  and Tora 55, one `operator` line per account and cat, none holding the
  password. Then `fly machine restart`, which loaded it; `demo1` logs in.
- **demo1 at 1920×1080**: its welcome says `demo: true`, the lead 0, and
  its trust Burakku 25 (familiar), Mochi 85 (devoted), Tora 55 (friend);
  your cats read "Burakku knows you. Mochi adores you. Tora is your
  friend."; the bar shows.
- **A newcomer at 390×844, by touch** (an `agent_s17…` account, its
  password random and never written down): no bar; a stranger to all three
  cats.
- **Two bots**: added from demo1's bar ("2 bots"), the newcomer's page saw
  `bot_1` and `bot_2` come in; both removed ("No bots").
- **One jump, two minutes on** (to 12:24): the newcomer's page heard
  `jumping` from demo1 and got a welcome at the new time; demo1's bar then
  read 12:24, "2 min ahead", "Next move in 60 s", and the keyboard's focus
  was on the bar's clock. The live café now runs two minutes ahead of
  Canberra, which nobody will notice. Both visitors left.
- Screens: [live-desktop-demo1.png](screens/slice-17/live-desktop-demo1.png),
  [live-desktop-after-jump.png](screens/slice-17/live-desktop-after-jump.png),
  [live-phone-newcomer.png](screens/slice-17/live-phone-newcomer.png).

Not walked live: the longer jumps of the marker's path (Afternoon, Night,
Morning), which would leave the live café a day or more ahead for every
visitor; the same path is held on the local café by `spec/` and the
binary tests on mocked time, and markers will walk it themselves.

## Still to do

- ~~The merge (the user's), the deploy, then the seed and a restart on
  Fly.~~ Done 2026-11-08: "Checked on the live café", above.
- ~~Part 2, the furniture sets, after slice 16.~~ Built 2026-11-09: below.

## Part 2: the furniture sets (2026-11-09, session `cb735744`)

Built on `slice-17-sets` from `600e41a`, test first per task
([plan](plan-slice-17-sets.md)).

### Checked on the branch

- **`cargo test -p cafe`**: 378 unit tests and the binary tests, with
  the new set tests in `content.rs` (each set passes every rule; a set
  breaking each rule in turn stops the café naming its file; Opening day
  equals `room.toml`) and `world::layout_tests` (9 tests: who may, at
  once for everyone, no allowance spent, errands called off, nobody left
  on a blocking piece, cats jump off, a fresh room, saved, the welcome
  names the sets). Each was seen failing first. Clippy and `cargo fmt`
  clean; the protocol regenerated (`LayoutName.ts` new).
- **`pnpm -C client check`**: 425 tests, with `laidOut` and the bar's set
  buttons, each seen failing first.
- **`spec/` against a local café** on port 8181, seeded with `cafe demo
  seed`: the whole suite, 124 passed, `restart.test.ts` skipped (it needs
  CI's `APP_RESTART`). The new checks: a visitor's `layOut` refused, a
  second page sees `laidOut` within a second, sets back to back with no
  rate limit, a late page wakes in the last set; the bar by touch on a
  phone (Play room, the toast heard, the group closed) and by keyboard on
  a desktop (Lap time, seen and told on the visitor's page).
  `narrate.test.ts`'s new lines were seen failing with `narrate.ts` put
  back.
- **The log check** over that café's 704 lines, with `catppuccino` among
  the words never to appear: passed. 16 `lay_out` lines, each with `who`,
  `uid` and the set's name or the refusal's code.
- **Looked at in a browser**, the screens in
  [screens/slice-17-sets/](screens/slice-17-sets/): each set at
  1920×1080, and the Furniture group on a phone in layout B. The first
  look found the bar wrapping to three rows on a desktop with a stray rule
  before the third, and the phone's slim row wrapping Bots to a second
  line; both fixed (`d5e74d8`): two rows on a desktop, the times on their
  own, and snugger toggles on a phone.

### Review

See [reviews/slice-17-sets-findings.md](reviews/slice-17-sets-findings.md)
([brief](reviews/slice-17-sets-brief.md)).

### Live (2026-11-09, 06:49 AEDT)

Merged in `2714714`. Its CI run failed twice on older timing checks:
slice 16's street-at-the-edges pan on a phone, then slice 14's panels
after a reload, which each passed every time locally (on its own five
times, in CI's file order, and with the café's clock at 05:59). Every
check this slice added passed on both runs. The next run on `main`,
`0085c3c` (the sitting pose on top of this), passed every job and
deployed. If either check fails again, its timing gets fixed, test first.

On the live café, with the two demo accounts and nobody else's account,
by `screens/slice-17-sets/live.mjs`: `demo1` at 1920×1080 by mouse,
`demo2` at 390×844 by touch in layout B.

- The welcome offered Opening day, Lap time and Play room.
- The phone's bar was one row ("13:59 +7h").
- Lap time and Play room, each laid out by `demo1`, reached `demo2`'s
  page 40 to 50 ms after the click, with its notice ("demo1 laid out Lap
  time.").
- At once after each, the set buttons were off and the bar said "Next set
  in 10 s".
- Tora slept on through Lap time on the window seat, which the set
  leaves where it is ([screen](screens/slice-17-sets/live-desktop-lap-time.png)).
- `demo2` laid out Opening day by touch, and `demo1`'s page said so; the
  room was left as it opens. Both accounts left.
