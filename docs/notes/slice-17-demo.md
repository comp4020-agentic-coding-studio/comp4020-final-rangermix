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
  `narrate.test.ts`. The full suite's run is below.
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

## Still to do

- The fresh review of part 1, its findings answered.
- The merge, the deploy, the seed and a restart on Fly, then the marker's
  path walked on the live café at both sizes, recorded here.
- Part 2, the furniture sets, after slice 16.
