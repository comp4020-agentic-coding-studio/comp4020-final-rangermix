# Brief: review of slice 17, part 1, "Markers see weeks of the café in ten minutes"

By [ADR 0014](../../adr/0014-build-the-rest-in-vertical-slices-each-with-a-spec.md):
a reviewer who didn't build the slice reads it cold. Work read-only: change
no file except the findings file below. Build and run code only in a
throwaway copy (`git archive <head> | tar -x -C <tmpdir>`, then
`pnpm install` and `pnpm -C client build` there), never in this checkout.
Don't use ports 8080 or 8091 (other cafés run on them); run the café on
port 18917 with a fresh `DATA_DIR`, from the copy's root (it reads
`content/` from the working directory), with `CLIENT_DIR` pointing at the
copy's `client/dist`. Seed it first, as CI does:
`DATA_DIR=<dir> CAFE_DEMO_PASSWORD=catppuccino <copy>/target/debug/cafe demo seed`,
then point the spec at it with `APP_URL` and `APP_DEMO_PASSWORD=catppuccino`.
Stop only the servers you start, by their own process IDs (never `pkill`
by name). Don't touch the live café or the Fly app.

Review what part 1 of slice 17 adds: `5a3a1df..HEAD` on branch
`worktree-slice-17-demo` (the first commits are the spec, the ADR and the
plan; the code starts at `b32d747`).

## What to read

- **The spec:** [`docs/slices/17-markers-see-weeks-in-ten-minutes.md`](../../slices/17-markers-see-weeks-in-ten-minutes.md):
  the user's answers quoted in it, every "done when" line and how it's
  held (part 2's lines, the furniture sets, aren't built yet and are out
  of scope), its numbers, and the marker's path.
- **Why:** [ADR 0022](../../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md),
  and how it sits beside [ADR 0016](../../adr/0016-hold-long-gaps-with-mocked-time-not-a-real-night.md)
  (mocked time for tests) and [ADR 0006](../../adr/0006-fast-forward-the-world-when-the-server-wakes.md)
  (the replay).
- **The rules:** `AGENTS.md`'s "What the app must keep", including the two
  lines this slice changed (trust's one exception, and only a demo account
  holding the controls), and its "Testing on the live café" line about the
  demo accounts' public password.
- **The design:** `docs/design.md`, "Showing it to markers", "Logging",
  "Checks" and "Numbers to tune".
- **The plan** [`docs/notes/plan-slice-17-demo.md`](../plan-slice-17-demo.md),
  its Review Focus and its execution log, which records where the build
  departed from it; the notes [`slice-17-demo.md`](../slice-17-demo.md).
- **The code:** `server/src/time.rs` (the lead, `next_time_of_day`,
  `realign_gap`), `server/src/main.rs` (loading the lead, `cafe demo seed`),
  `server/src/demo.rs`, `server/src/store.rs` (migration 4), `auth.rs` and
  `api.rs` (reserved names), `server/src/world/jump.rs`,
  `server/src/world/bots.rs`, the hooks in `world/{mod,people,quiet,cat_life}.rs`,
  `server/src/ws.rs` (the world task running a jump), `server/src/wake.rs`
  (`saved_ahead`), `server/src/test_logs.rs` (the second dispatcher);
  `client/src/canberra.ts`, `state.ts`, `cafe.ts`, `stage.ts`, `demoBar.ts`,
  `main.ts`, `index.html`, `style.css`; `content/demo.toml`,
  `content/tuning.toml`; `scripts/narrate.ts`; `.github/workflows/checks.yml`;
  `README.md`'s "For markers". Their tests: `world/{demo,jump,bots}_tests.rs`,
  `demo.rs`'s, `server/tests/jumps.rs`, `client/test/{demoBar,canberra,state}.test.ts`,
  `spec/demo.test.ts`, the demo bar's checks at the end of
  `spec/browser.test.ts`, `spec/accounts.test.ts`, `spec/narrate.test.ts`.
- **The screens:** `docs/notes/screens/slice-17/`.

## Out of scope

Part 2 (the furniture sets). Slice 16's floor and bars. Earlier work this
slice doesn't make worse.

## What to look for

Whether each "done when" line of part 1 is truly held, or only appears to
be, and whether the kept rules hold. The plan's Review Focus, first:

1. **A jump while someone is mid-walk, carrying a piece, holding a cat, on
   a lap, or dropped within their grace period.** Do walks end where they
   are, does the piece go back, is the cat put down and the lap ended,
   and is nobody walked out or timed out by the jump itself?
2. **An action in flight when the jump began.** Is everything a page sent
   before it heard of the jump refused (`movedOn`), and is nothing applied
   at the new hour? What about a Join, a Leave or a Shutdown that queued
   during the replay?
3. **A restart after a jump.** Is the café's clock always at or after its
   last save, so no cat's timers sit in the future? What if the machine
   stops during a jump's replay, or the replay panics?
4. **Bots when their demo account drops or leaves, or fills the café.** Do
   they leave with it, does the line work as for people, and can a bot
   ever get a trust row, a board line, a lap, a sniff, a greeting, or a
   place in a snapshot after a restart?
5. **The seed against a name a visitor already holds.** Refused loudly with
   nothing changed?

Then:

- **The clock.** Daylight saving (the October gap, the April repeat),
  "Canberra time" from every lead, a jump asked at HH:MM:59, two demo
  accounts asking at once, the one-a-minute limit across a restart, and
  `CAFE_CLOCK_START` together with a saved lead. Does anything still read
  the device's clock where the café's should be (the music's set, the
  board's times, the street, the logged-out page)?
- **The replay as a jump.** Is a jump's hours the same as the same hours
  asleep (bowls, midnight's treats, trust days, bans running down, the
  board), and does anything the replay assumes about an empty café break
  with the people set aside and put back?
- **Abuse.** The password is public. What can anyone who reads the README
  do to the café, and to other visitors, with it: push the clock days
  ahead, hold seats with bots, lock the regular out of a cat with bans? Is
  anything here worse than the spec and ADR say they accept?
- **Privacy.** The password and every recovery code never logged, by the
  seed or the server; bubble text still never logged; bots never stored.
- **The bar.** Keyboard, touch and mouse at 390×844 and 1920×1080, layouts
  A and B, a resize across 960 px, Escape, focus order, disabled states
  with their reason, its text against what's behind it, and that a
  visitor who isn't a demo account never sees it or anything of it.
- **The checks themselves.** Would each new test fail if the behaviour it
  names broke? Are the spec's demo checks order-safe against each other
  and the rest of `spec/` (one jump a minute, bots left behind)?

## Findings

Write them to [`slice-17-findings.md`](slice-17-findings.md), numbered,
most serious first. For each: what's wrong, where (file and line), how
you saw it (a command, a check, a screenshot), and what "fixed" would
look like. Say plainly what you checked and found sound, so a line that
holds is known to have been looked at. Leave the answers section for the
builder.
