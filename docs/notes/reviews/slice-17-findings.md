# Findings: review of slice 17, part 1, "Markers see weeks of the café in ten minutes"

Brief: [slice-17-brief.md](slice-17-brief.md). Read cold on 2026-11-06,
reviewing `5a3a1df..8ea4b90`: the code to `03a6fc0`, then `faea3bd` and
`8ea4b90`, which landed during the review. Built and run only in throwaway
copies (`git archive 03a6fc0` and `git archive 8ea4b90`, outside the repo),
never in this checkout. Nothing live was touched: not the café, not Fly.
`f2fb9a5`, which landed as this was written, changes only the plan's
execution log.

**Count:** 0 critical, 4 major, 9 minor.

## What was run

- **`cargo test -p cafe`** in the `03a6fc0` copy: 338 unit tests (1
  ignored), and every binary test, `tests/jumps.rs` included, passed. The
  server code is the same at `8ea4b90`.
- **`pnpm -C client check`**: 309 tests in 27 files passed.
- **The spec.** The server ran from the copy's root on port 18917, each
  time with a fresh `DATA_DIR` seeded first with
  `CAFE_DEMO_PASSWORD=catppuccino cafe demo seed`, and with `CLIENT_DIR`
  set to the copy's `client/dist`. It was stopped by its own PID each time.
  - **At `03a6fc0`:** `demo`, `accounts` and `narrate` passed (22 tests).
    `browser.test.ts` failed 2 of 36: the night light, and the street by
    night. Both still faked only the device's clock. `faea3bd` fixes both.
  - **At `8ea4b90`**, the whole spec, with `APP_DEMO_PASSWORD=catppuccino`:
    94 passed, and `restart.test.ts` was skipped (no `APP_RESTART`).
- **`scripts/check-logs.ts`** over that run's server log (427 lines), with
  the CI's words plus `catppuccino`, passed. `catppuccino` appears in none
  of the three servers' logs, nor in the seed's output.
- **Probes**, as throwaway scripts outside the repo, against those
  servers:
  - `probe-silent.mjs`: two sockets, a jump, then 30 s of waiting.
  - `probe-treat.mjs`: a visitor hands a bot a treat.
  - `probe-readme7.mjs`: the README's step 7.
  - `probe-lag.mjs`: the welcome's clock after a long jump.
  - `probe-focus.mjs`: Playwright's Chromium at 1920×1080, then 390×844.
  - A unit test, `review_probe.rs`, added in the copy only: a treat on the
    floor when a jump begins, and `next_time_of_day` in April's repeated
    hour.

## Findings

### 1. Major: every connection in the café is cut within 25 seconds of a jump

- **Where:** `server/src/ws.rs:271`, `:285`, `:309` and `:312`. A
  connection's `last_heard` and its silence check read `now_ms()`, the
  café's clock. A jump moves that clock on by the gap (`ws.rs:169`). At
  the connection's next ping tick (every 25 s), `gone_silent` sees "silent
  for hours" and closes the socket. This happens to every connection that
  hasn't sent a frame since the jump. The page sends nothing after a
  welcome, and the pong to the server's ping comes after the check.
- **What I saw:** `probe-silent.mjs`, with a visitor and demo1 on a café at
  06:55, and demo1 moving it on to 08:00.
  - Both sockets got `jumping`, then the welcome, at 1.6 to 2.0 s.
  - Both were closed by the server at 25.0 s (code 1005), with nothing sent
    or received in between but pings.
- **Why it matters:**
  - Every page in the café flashes "Reconnecting to the café…" after every
    jump.
  - Each person's seat drops into its grace period. `drop_connection`
    (`people.rs:112`) puts back what they carry and makes a held cat jump
    down (`holder_left`).
  - The marker's path does exactly this in the 25 s after a jump. In step 2
    the regular picks Mochi up after Afternoon. In step 4 the regular walks
    out and back in after Morning.
  - No check catches it: every spec and browser check of a jump finishes
    within a few seconds of the welcome.
  - The connection's speech and action buckets (`ws.rs:266-268`) also read
    the café's clock, so a jump refills them. That's harmless, but it's the
    same mix-up.
- **What fixed looks like:**
  - Silence is measured with `std::time::Instant`, a duration, which
    `only_this_file_reads_the_wall_clock` already allows, and so are the
    buckets.
  - **Test first:** a binary test in `tests/jumps.rs` that keeps a second
    socket open 30 s past a jump and expects it still open, still getting
    the café's messages. A unit test of `gone_silent` alone can't see this:
    the bug is in which clock is passed to it.

### 2. Major: the README's step 7 doesn't put the newcomer at the window

- **Where:** `README.md:38`: "Bar: four **bots**. Leave and come back: you
  wait at the window". The spec's path, step 6
  (`docs/slices/17-markers-see-weeks-in-ten-minutes.md:247`), says the
  same.
- **What I saw:** `probe-readme7.mjs` followed the step.
  - demo1 and the newcomer were inside, and demo1 added four bots: six
    inside.
  - The newcomer left, which freed a seat, then came back. It came back
    **inside**, with six inside again.
  - Closing the tab instead of Leave would hold the same seat through the
    grace period.
- **Why it matters:**
  - A marker who follows the README sees the café break its word.
  - The line at the window is the step that shows the cap.
  - The "done when" line "The README's 'For markers' matches what's built"
    doesn't hold.
  - `spec/demo.test.ts` tests a different flow: it fills the free seats,
    then brings in a *new* visitor. Nothing tests the flow the README
    gives.
- **What fixed looks like:**
  - "Bar: five bots". The fifth waits at the window, takes the seat the
    newcomer leaves, and the newcomer comes back to the window. Step 8's
    "Remove a bot" then lets them in.
  - Or the regular adds a bot after the newcomer has left.
  - The same change goes into the spec's step 6 and the README together.
  - A spec check of that exact flow: four bots, leave, a fifth, come back,
    at the window.

### 3. Major: trust a cat gives during a jump's replay is shown but never stored

- **Where:**
  - `server/src/world/replay.rs:58` takes the store for the replay.
  - `cat_life.rs:815` writes a trust row only when there is a store.
  - `World::save_with` (`mod.rs:490`) saves no trust.
- **The cause:** a sleep's replay never meets a treat on the floor, since
  floor treats aren't saved. A jump's replay does, because the people are
  only set aside. A cat that eats someone's treat during the jump
  (`treats.rs:127-141`) changes their trust in memory only.
- **What I saw:** `review_probe.rs`, in the copy.
  - sam put a treat down at 14:00:10, and demo1 moved the café on to 23:30.
  - In sam's welcome after the jump, Burakku's trust in sam was 0.3.
  - After a flush, the store held **no** trust row for sam.
- **Why it matters:**
  - The trust stays in memory until that cat's trust in that person
    changes again, which writes the whole row.
  - If the café restarts first, the gain is gone. Fly's auto-stop restarts
    it whenever it's empty.
  - "Trust never fades with absence" is broken in effect: a visitor sees
    trust the next day's café no longer has.
  - The jump's tests have no store, so they can't see it.
- **What fixed looks like:**
  - Trust changed during a replay is written with the replay's end save.
    For example, `change_trust` notes the (cat, person) pairs it touched
    while `self.store` is taken, and `replay` writes those rows in its final
    job.
  - Or the treats on the floor are put back into their givers' hands
    before the jump, as a carried piece is.
  - **Test first:** the probe's test, kept as `wake.rs`'s or `jump_tests`'s
    with a real store.

### 4. Major: each jump spends every visitor's session, and the lead has no ceiling

- **Where:** `server/src/api.rs:130-131` and `:152-153`. Sessions are made,
  checked and extended against `now_ms()`, the café's clock.
- **The arithmetic:**
  - A session idle for 30 *café* days expires (`session_days = 30`).
  - A jump moves every session up to a day nearer its end.
  - A marker who follows the README moves the café on about a day:
    Afternoon, Night, Morning, then Canberra time to a whole day ahead.
  - So about 30 marker visits log out everyone who hasn't been in since.
  - Anyone holding the public password can do it on purpose in 30 minutes,
    at one jump a minute.
  - Nothing bounds `ahead`. At a day a minute, the café is a year ahead of
    Canberra in six hours.
- **Why it matters:**
  - "A session resumes the next day" is the band markers check
    ([ADR 0022](../../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md),
    option 1).
  - The ADR accepts that "the café's clock can be pushed days ahead". It
    doesn't say that doing so logs every visitor out. Nor does it say the
    lead is unbounded: the one-year bound slice 08 set on
    `CAFE_CLOCK_START` (`time.rs:86`) has no counterpart here.
  - The browser's cookie still lives 30 *wall* days, so the cookie and the
    session disagree.
- **What fixed looks like:**
  - Session expiry doesn't move with jumps. Either the jump extends every
    live session by its gap, in the same job as the replay's end save, or
    sessions are dated by the café's clock minus `ahead`.
  - And either a ceiling on the lead (`jump_max_ahead_days`, refused with
    `badTime` past it) or the ADR names "unbounded" as accepted.
  - **Tests:** a session made before a jump of 24 h is still good after it,
    and a jump past the ceiling is refused.

### 5. Minor: after a long jump, every page's clock runs behind the café's by the replay's length

- **Where:** `server/src/world/jump.rs:85-90` and `:116`, and
  `server/src/ws.rs:157-171`.
  - The lead grows by `to - now`, taken when the replay *starts*.
  - The replay then takes T seconds.
  - The café's clock reads `to + T` when it ends, but everyone's welcome
    says `now: to`.
  - The page keeps its clock from the welcome (`state.ts`, `fromWelcome`),
    so it runs T seconds behind until its next welcome.
- **What I saw:** `probe-lag.mjs`, a jump of about 23 h 47 m on the debug
  build.
  - The jump took 1.47 s from `jumping` to the welcome.
  - A walk the server started just after had a `start` 1.47 s ahead of the
    page's clock as that welcome set it.
  - On Fly the spec puts 24 h at 4 to 5 s.
- **Why it matters:**
  - Every walk, cat move and bubble the server starts appears T seconds
    late on every page.
  - The bar's clock and its "Next move in N s" are T seconds out.
  - Today finding 1's reconnect resyncs within 25 s. Once that's fixed,
    this stays until the next welcome.
- **What fixed looks like:** the welcome says the café's real time after
  `set_ahead`, and the world is ticked from `to` up to it first. Or the
  lead is set at the end so the clock reads `to`, never less than before,
  since the clock mustn't go back. A binary-test assertion: the welcome's
  `now` is within 100 ms of a fresh `now_ms()` when it's sent.

### 6. Minor: a visitor can hand a treat to a bot, and the café tries to store it

- **Where:** `server/src/world/treats.rs:104-123` (`give_treat`) and
  `handling.rs:380` (`present`, which doesn't exclude bots).
- **What I saw:** `probe-treat.mjs`.
  - demo2 added bot_1, and a visitor sent `giveTreat` to it.
  - The visitor's treats went 3 → 2, and everyone got `treatGiven`.
  - The server logged `"level":"ERROR" … "a write failed, and none of it
    was kept","error":"FOREIGN KEY constraint failed","target":"store"`.
    `keep_treats` had fired a `treats` row for id 4000000001.
- **Why it matters:**
  - "A bot is never stored" holds only because of a foreign key.
  - The visitor wastes a treat on something that can't use it.
  - An ordinary action produces an ERROR line.
  - `PassCat` to a bot also goes through: the cat jumps down `wont_go`,
    since nobody trusts a bot. That's harmless, but the bot is still a
    target.
- **What fixed looks like:** `giveTreat` and `passCat` to a bot are
  refused, for example "bot_1 can't take that". A `bots_tests` case
  (test first) for each, asserting no store job and no treat spent.

### 7. Minor: the bar's countdown speaks every second, and a jump drops keyboard focus

- **Where:** `client/index.html:85` (`#demo-wait`, `role="status"`) and
  `client/src/demoBar.ts:179-187`.
- **What I saw:** `probe-focus.mjs`, at 1920×1080.
  - **The countdown:** after a jump, `#demo-wait` read "Next move in 60 s",
    then 59, 58, 57 … at one-second steps. It's visible on a desktop, so a
    polite live region queues a reading every second for a minute.
  - **The focus:** Evening was pressed by Tab and Enter. After the jump,
    `document.activeElement` was `BODY`: the button had been disabled
    under it. Chromium's next Tab went on to the time field, so a sighted
    keyboard user isn't lost. A screen reader hears the page's focus go
    nowhere.
  - **The bots' buttons:** `−` with no bots and `+` with six are never
    disabled. Each says why only after a press, as an error. The spec
    asks: "A control that can't be used yet says why."
- **What fixed looks like:**
  - The countdown is not a live region. A one-off line, "The clock can
    move again at 18:31", is announced when the jump lands.
  - Focus goes to the bar's clock (`tabindex="-1"`) or the Time group after
    a jump.
  - The bots' buttons are disabled at 0 and at `bots_max`, with the count
    saying why ("6 bots, the most").
  - A browser check of `document.activeElement` after a keyboard jump.

### 8. Minor: the clock's edges: daylight saving, the repeated hour, and "24 h ahead"

- **A whole-day lead isn't Canberra's hour across a daylight-saving
  change.**
  - A lead of 24 h shows 13:00 when Canberra's wall reads 12:00 on 3
    October 2026, and 11:00 on 3 April 2027 (computed with
    `Intl.DateTimeFormat`).
  - It stays an hour out for as many days as the café is ahead.
  - "Canberra time" refuses then ("already"), since `realign_gap` only
    looks at `ahead % DAY_MS` (`time.rs:69-72`, `jump.rs:31`).
- **April's repeated hour.** `next_time_of_day` takes `.earliest()`
  (`time.rs:62`). Asked at 02:45 AEDT on 4 April 2027 for 02:30, it skips
  the 02:30 AEST 45 minutes later. It gives the next day's, 24 h 45 m on,
  refused "That time isn't within a day." (Run in the copy: 1485 minutes
  on.)
- **The realign can land a millisecond short.**
  - The lead grows by `to - now_at_run`, and `to` was set from `now` at
    the ask.
  - When the ask and the run fall in different milliseconds, "Canberra
    time" leaves `ahead` at whole days minus 1 ms. My probe got exactly
    86 400 000, so this is by reading, not seen.
  - Then the bar says "24 h ahead", and "Canberra time" is accepted again
    for a 1 ms jump that covers every page.
- **`aheadText` rounds hours** (`demoBar.ts:40-42`).
  - From 23.5 h it says "24 h ahead", and past a day "a day and 24 h
    ahead".
  - That's realistic: Night pressed at 23:40 is 23 h 50 m on.
  - It also says 9.5 h is "10 h ahead".
- **What fixed looks like:**
  - "Canberra time" targets the next instant whose Canberra time of day is
    the wall's, by local date and time, not by `ahead % DAY_MS`.
  - `next_time_of_day` considers both instants of an ambiguous time.
  - The lead after a realign is rounded to whole days, or the gap is
    carried in `Jump`.
  - `aheadText` floors.
  - `time.rs` and `demoBar.test.ts` cases for each.

### 9. Minor: a page that opens during a jump isn't told about it

- **Where:** `server/src/ws.rs:247`. `Waking` is sent only while
  `app.awake` is false, and a jump never clears it.
- **What happens:** the new connection's `Join` waits in the queue behind
  the replay. The page shows "Reconnecting to the café…" until the replay
  ends, up to 4 to 5 s on Fly. The spec says "every page in the café,
  **and any page that opens**, shows the waking screen with who moved the
  clock and to when."
- **What fixed looks like:** the world task publishes the running jump
  (who, to) in `AppState`, as `awake` is published, and a new connection
  sends `Jumping` at once. A binary test opens a socket mid-jump.

### 10. Minor: an action sent before the page heard of a short jump can still be done at the new hour

- **Where:** `server/src/ws.rs:62-72`.
- **The cause:** only what queued *during* the replay is refused
  (`movedOn`). Something sent before the page heard of the jump, but
  reaching the server after a short replay ended, is done at the new hour.
  An hour on replayed in 128 ms locally, about one network round trip.
- **Why it's minor:** the plan's Review Focus 2 expects "refused with
  `movedOn`, not applied to the new hour". The world still checks every
  action against the café as it is then, so nothing breaks a rule. The
  guarantee is only weaker than written.
- **What fixed looks like:** either the plan and design say "an action that
  reached the café while it jumped", or each connection refuses actions
  until its page has had the jump's welcome. For the second, the page
  would echo a jump counter.

### 11. Minor: some "done when" lines are held by less than they say

- **"Nothing held … or on a lap".**
  `a_jump_settles_people_and_walks_nobody_out` holds no cat and has no lap.
  By reading, the replay's first step lets both go (`held_tick` and
  `laps_tick` find the person gone), but no test would notice if it
  didn't.
- **"An action sent meanwhile is refused".**
  `actions_queued_during_a_jump_are_refused` tests only `moved_on`'s
  classification. Deleting the drain loop in `world_task`, or passing
  `false`, leaves every test green. `spec/demo.test.ts` sends nothing
  during a jump.
- **"Survives a restart … `spec/restart.test.ts`".** That file is
  unchanged by this slice. The binary test `tests/jumps.rs` holds it
  alone.
- **The contrast line.** "client unit tests (`contrast`)": the token pair
  muted on card is tested. Nothing ties `.demo-bar` to an opaque
  `var(--card)`, so it could turn to glass unnoticed.
- **Keyboard, touch and mouse.** The bar's browser checks use the
  keyboard (one Enter) and touch. No mouse click, and layout A on a phone
  isn't exercised (the screens show it).
- **"The replay of the gap".** The jump's tests check the refills and
  treats. Midnight's trust day, bans running down and the board's lines
  rely on the replay's own tests for a sleep. That's fair, since it's the
  same `replay`, but finding 3 is a way the two differ.
- **What fixed looks like:** a held cat and a lap in that test; a test of
  the drain itself (a jump, then a queued `walkTo` gets `movedOn`); the
  spec's table naming what really holds each line; a contrast test that
  reads `.demo-bar`'s background.

### 12. Minor: two things the public password allows that the ADR doesn't name

- **Seats.** `bot_stay_mins` frees seats from a *forgotten* demo. A
  scripted demo connection re-adds its bots every 15 minutes and answers
  its own nudges, so it holds the café full for as long as it likes.
  Bots are never nudged, so the quiet seat frees only real visitors' seats
  around them. Six sign-ups could do much the same, so this is a small
  step past what's possible already.
- **Trust.** Every jump past midnight is a new trust day for everyone, so
  `trust_daily_cap` resets. A newcomer beside a demo account can bank up
  to a day's trust a minute, so a lap with Mochi (8 days' cap) is minutes
  away, not days.
  The spec lists "a new trust day" among what a jump brings. The ADR's
  context is that "trust takes days", and it doesn't say jumps undo that
  for anyone.
- **What fixed looks like:** an answer. Either the ADR's consequences name
  both as accepted, or limits follow, for example bots capped per demo
  account per hour, or trust days kept on Canberra's own day.

### 13. Minor: loose ends in the docs and the log

- **`docs/design.md:62`** still says "(… decided 2026-11-06, not yet
  built)". Part 1 is built.
- **`docs/notes/slice-17-demo.md:23`** says "The full suite's run is
  below", and nothing is below.
- **The bot's log line.** The spec asks for "one `bot` log line as each is
  added or leaves: who added it, and why it left". The leave line
  (`what = "leave"`, `why`) doesn't say who added it.
- **Names that pass for bots.** Bots are shown to everyone else only by
  their names. `bot-1`, `bot1` and `b0t_1` can still be signed up, so a
  visitor can still pass for a bot, which the reserved names were meant to
  stop. Either the client marks bots (it has `PersonView.bot`), or the
  spec says only `bot_` is kept.
- **The plan's task 10** names a narration for `demo_seed` that wasn't
  written. That's probably moot: the seed's lines go to the `fly ssh`
  console, not `fly logs`.

## Checked and found sound

- **Only a demo account holds the controls.**
  - `demo_or_refuse` guards all three asks.
  - The demo flag comes from the store on each connection (`ws.rs`,
    `user.demo`).
  - A visitor's `setClock` is `notDemo` (spec and unit).
  - A visitor's page never shows the bar (browser check). The welcome's
    `ahead` and `nextJump` are data only.
- **The jump's rules.**
  - It goes to the next HH:MM:00 and is refused past `jump_max_hours`. A
    time in October's gap is the next day's and refused.
  - `set_ahead` keeps the larger, so the clock never goes back.
  - One jump at a time: a held `jump` answers `tooSoon`.
  - One a minute by the café's clock.
  - Two demo accounts at once: the second ask is `movedOn` in the drain,
    or `tooSoon`.
  - A jump asked at HH:MM:59 is a one-second jump, and harmless.
- **The lead across a stop.**
  - `ahead` is saved in the same job as the replay's end: cats, bowls,
    rng, arrangement, chalk and `saved_at`.
  - It's loaded before the clock is first read, in both `run` and
    `cafe demo seed`.
  - After a restart the clock is the jump's `to` plus the wall's time
    since, never behind the save.
  - A stop mid-replay exits after 3 s with the previous save and its lead
    still a pair.
  - A replay that panics ends the process. Fly restarts it from the last
    save, as designed. A wake's replay is caught instead.
- **People through a jump.**
  - Walks end where they are, and every pending errand is called off,
    grabs' reservations included.
  - Carried pieces go back.
  - Timers move on by the gap: `joined`, `last_input`, `away_since`,
    `hidden_since`, `nudged`, and the bots' `until` and `next`.
  - `cats_off_people` runs.
  - Someone dropped in their grace period is still there after, and leaves
    when the grace runs out (unit test).
  - A Join, a Leave or a Shutdown queued during the replay is handled in
    order at the new time. Shutdown saves there and stops.
- **Bots.**
  - Counted in the cap, and they join the line; the first in line walks
    in, bot or person.
  - Filtered out of the cats' `choose`, laps, `greet` (via `arrivals`) and
    the quiet seat.
  - Never welcomed after a jump. `personJoined` shows `bot: true`.
  - They leave on `removeBot` (newest first), with their demo account
    (`remove` → `bots_follow`, the grace expiry included), or after 15
    minutes. The jump doesn't spend those minutes.
  - Never stored (finding 6 aside).
  - Ids start at 4 000 000 000, far above any account's.
- **The seed.**
  - It refuses a name a visitor holds, ignoring case (`name_key`), inside
    one transaction, before anything is written.
  - Recovery codes are random, hashed and never shown.
  - Trust rows are dated on the café's day, and bans are deleted.
  - One `operator` line per account and per cat, and none holds the
    password (unit test, my seed output and `check-logs`).
  - Sign-up refuses `demo` plus digits and `bot_`, ignoring case (unit and
    spec).
- **Privacy.**
  - The replay logs nothing (`NoSubscriber`), and the `jumped` line has no
    words.
  - Bots never talk.
  - `check-logs` passed with `catppuccino` among the words.
- **The page's clock.**
  - The light, the street, the window and the board's times follow the
    welcome's offset. The music set follows it at Play and every 30 s.
  - The logged-out page has no clock.
  - The browser check with the device 12 h out holds it.
- **The bar.**
  - It's in the tab order after the status bar.
  - Escape closes a phone group and returns focus to its toggle.
  - The groups stand in one row after a resize from 390 to 1920, and wrap
    between the corner panels (`8ea4b90`).
  - It's opaque, in the tested muted-on-card colours.
  - At 390×844 after a resize from a desktop, it's one slim row under the
    status bar (probe screenshot).
- **The spec's demo checks are order-safe.**
  - Each waits out `nextJump` by the café's clock.
  - The bot check counts bots already there and fills only the free seats.
  - demo2 leaving takes its bots.
  - The whole spec passed in one run on one café.

## Also noticed (not counted)

- At `03a6fc0` two browser checks failed: the night light, and the street
  by night. `faea3bd` fixes them, and the whole spec passes at `8ea4b90`.
- Before its first welcome, and during a jump's cover, `cafeHour(null)`
  falls back to the device's hour. For up to 30 s the music panel can
  name the device-hour set's track. Play settles to the café's hour first,
  so what plays is right.
- A jump that ends someone's walk on the door's walkway, or in the
  doorway, leaves them standing there until they walk. A newcomer then
  walks in onto the same door tile.
- An unreadable saved lead wakes at 0, a clock going back, with a
  warning. That's acceptable for a corrupted row.
- The seed's refusal is logged as "stopping: the café can't go on", the
  server's wording. Its error text does name the account.

## Not checked

- The live café and Fly: out of bounds for this review. So is the replay's
  time on Fly's CPU; the 4 to 5 s figure is the spec's.
- A real screen reader, for finding 7's live region: inferred from
  `role="status"`.
- Safari and iOS.
- `spec/restart.test.ts`, which needs `APP_RESTART`.

## Answers

By the builder, session `f6949123`, 2026-11-06. Every finding is fixed,
test first where it's behaviour, or answered. After the fixes: `cargo test
-p cafe` (344 unit tests and every binary test), the client's 312 tests,
and the whole `spec/` against a seeded local café pass.

1. **Fixed** in [`ed0556e`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/ed0556e). A connection's silence and its rate limits
   are measured by its own monotonic time, never the café's clock. Test
   first: `tests/jumps.rs`'s `a_jump_cuts_nobody_off` keeps a page open
   31 s past a jump and is still answered; it failed with the socket closed
   under it.
2. **Fixed** in [`086fb45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/086fb45). The README's step 7 and the spec's step 6:
   bots until six are inside, then one more, who waits at the window and
   takes the seat the newcomer leaves. `spec/demo.test.ts` now follows
   exactly that path.
3. **Fixed** in [`20a93b0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/20a93b0). Trust changed while a replay holds the
   store back is noted and written in the replay's end save. Test first:
   `jump_tests::trust_a_cat_gives_during_a_jump_is_stored`, with a real
   store (it failed: Burakku's 0.3 in p1 missing from the store).
4. **Fixed and answered** in [`065cc7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/065cc7a). Sessions and the accounts'
   rate limits keep Canberra's own clock (`time::canberra_now_ms`), so a
   jump spends nobody's session; test first in `tests/jumps.rs`: a
   day-long session still good after two jumps of nearly a day (it failed
   with a 401). The lead stays unbounded, now said in ADR 0022's
   consequences: a ceiling would end jumps for good once reached, since
   the lead never shrinks, and with sessions on Canberra's clock nothing
   else breaks with a long lead.
5. **Fixed** in [`065cc7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/065cc7a). The world task moves the clock on, catches
   the world up to the café's time as it is after the replay, and
   welcomes everyone at that time. Test first: the next walk starts
   within 500 ms of the welcome's time (it was 1508 ms behind).
6. **Fixed** in [`5a5b2ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5a5b2ba). Giving a bot a treat, or passing it a cat,
   is refused ("bot_1 is a bot: it can't take that."), nothing spent, no
   store job. Test first: `bots_tests::a_bot_takes_no_treat_and_no_cat`.
7. **Fixed** in [`702a610`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/702a610). The countdown is plain text, no live
   region; the page says once "The clock can move on again at 23:31." A
   control disabled under the keyboard's focus hands it to the bar's
   clock (`tabindex="-1"`); the browser check now asserts the focus after
   a keyboard jump. With no bots, − is disabled and the count says why.
   **Answered** for + at six: it stays pressable and says why when
   pressed ("The café takes no more bots."); the client isn't told
   `bots_max`, and six bots is a state a marker reaches only on purpose.
8. **Fixed** in [`065cc7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/065cc7a). The lead grows by exactly the gap asked
   for (`Jump.from`); "Canberra time" aims for what Canberra's own clock
   reads, by the local date and time (`time::realign_target`), so
   daylight saving can't leave it an hour out; `next_time_of_day` takes
   both instants of April's repeated hour; the bar's hours round down.
   Tests: `time::tests::the_repeated_hour_counts_both_times`,
   `canberra_time_is_canberras_hour_by_the_calendar`, and
   `demoBar.test.ts`.
9. **Fixed** in [`065cc7a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/065cc7a). The running jump's message is published
   beside `awake`, and a page that opens meanwhile gets it at once. Test
   first in `tests/jumps.rs`: a socket opened mid-jump hears `jumping`
   first.
10. **Answered.** An action that arrives after a short jump has ended is
    done at the new hour, checked against the café as it is then, so no
    rule is broken; making each page echo a jump counter would add a
    protocol round for no visitor's gain. The design and the spec now say
    "an action that reached the café while it jumped is refused", which is
    what holds, and `ws::tests::what_queued_during_a_jump_is_refused_and_told`
    tests the drain itself.
11. **Fixed** in [`8b42a46`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/8b42a46) and [`702a610`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/702a610): a held cat and a lap
    in a jump (`a_jump_puts_a_held_cat_down_and_ends_a_lap`), the drain's
    routing, the bar's card held opaque by a client test, and the browser
    checks adding a mouse click, layout A on a phone, the focus after a
    keyboard jump, and − disabled with no bots. The spec's "done when"
    table now names what holds each line (the restart by `tests/jumps.rs`,
    not `spec/restart.test.ts`). **Answered** for the replay's own rules
    (midnight's trust day, bans running down, the board): they are the
    same `replay` a sleep uses, held by its tests, and finding 3 was the
    one way the two differed.
12. **Answered** in ADR 0022's consequences, both accepted: a scripted
    demo connection can hold seats with bots for as long as it runs, a
    small step past six sign-ups; and every jump past midnight is a new
    trust day for everyone inside, which, for markers, is the point.
13. **Fixed** in [`5a5b2ba`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/5a5b2ba) and with these answers: `design.md`'s
    "not yet built" corrected; the notes' full-suite line filled in; a
    bot's leave line carries `added_by`, kept on the bot so it's there even
    when it leaves with its demo account; who's here marks each bot
    "(a bot)", so `bot-1` can't pass for one. **Answered** for the seed's
    narration: its lines go to the `fly ssh` console, not `fly logs`, so
    `pnpm logs` never sees them; the plan's mention of it is dropped.
