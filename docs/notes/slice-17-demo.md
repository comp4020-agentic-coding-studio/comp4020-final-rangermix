# Slice 17: what was checked, and how the live café gets its demo accounts

Working notes for [slice 17](../slices/17-markers-see-weeks-in-ten-minutes.md)
([plan](plan-slice-17-demo.md),
[ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md)).
Part 1 is built on the branch `worktree-slice-17-demo`; part 2, the
furniture sets, waits for slice 16.

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

- Part 2, the furniture sets, after slice 16 (now built).
