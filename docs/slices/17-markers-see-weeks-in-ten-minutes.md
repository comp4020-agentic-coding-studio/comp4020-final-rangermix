# 17. Markers see weeks of the café in ten minutes

- **Status:** Part 1 live 2026-11-08: built and reviewed 2026-11-06 (4
  major and 9 minor findings, each fixed or answered:
  [findings](../notes/reviews/slice-17-findings.md)), merged and deployed,
  the demo accounts seeded on Fly and checked live
  ([notes](../notes/slice-17-demo.md)). Part 2 to come. Approved 2026-11-06 by the user's answers to its questions
  (below). Built in two parts: **part 1**, everything but the furniture
  sets, alongside slice 16; **part 2**, the three furniture sets, after
  slice 16, since it changes the floor they're laid out on. What's still
  marked "proposed" below is the agent's call, which the user's approval
  covers.
- **Plan:** part 1, [plan-slice-17-demo.md](../notes/plan-slice-17-demo.md);
  part 2's is written when it starts
- **Design:** "The café" (Canberra time), "The cats" (trust), "Accounts and
  safety", "The client", and the new "Showing it to markers" in
  `docs/design.md`;
  [ADR 0022](../adr/0022-let-markers-drive-the-cafe-through-public-demo-accounts.md);
  the replay of
  [ADR 0006](../adr/0006-fast-forward-the-world-when-the-server-wakes.md)
  and slices 01 and 07

## Story

A marker has about ten minutes, two windows and a new account. The café's
point is slower than that: cats that come to trust you over days, and a
café that lives on through the night. So the README gives the marker a
second way in, a regular's account the cats already know, and with it a
bar of controls at the top of the room. From it they move the café's clock
on to the night or the next morning and watch the cats keep their hours,
lay out the furniture for laps or for play, and fill the café with bots
until their own newcomer waits at the window. Side by side, the newcomer
and the regular show what weeks of visits change.

The user's answers, 2026-11-06:

> 1. consider markers only. what i meant for demo is actually how markers receive this.
> 2. the page should take it's clock from the server. given we already use websocket we can send synced clock to all users at once. whenever the clock is changed the server will fast forward time to the target clock for at most 24 hours. the ability to set time will be limited to demo accounts only, who will have control for server clock etc. the control should be a floating bar at top.
> 3. Trust choice: a
> 4. furniture: make 3 set of furniture with arrangement, available for demo account to choose from. this sets the furniture immediately without rate limit.
> 5. Bots: add option to add/remove bots for demo account.
> 6. How do markers get the regular's login? A in the README
> 7. given the answer above, adjust the marker's flow.
> 8. create instructions for markers in readme

Trust choice "a" was the operator's seed for demo accounts, logged, under
an ADR that limits the exception to them.

Their answers to the spec's questions, the same day:

> 1A; 2 demo1 demo2 same simple password; 3A; 4A; 5 build the floor presets after slice 16, others at the same time with 16

So: "Canberra time" jumps forward; the demo accounts are `demo1` and
`demo2`, with one simple password, which the agent chose:
`catppuccino`, the café's own name; the bar on a phone is one slim row;
the three sets are as proposed; and the sets wait for slice 16.

## In this slice

### The page keeps the café's clock

- The page sets its clock from the welcome's `now` (the server's), and
  keeps it running from there. The light, the street, the window, the
  music set and the board's times all follow the café's clock, not the
  device's. *Why:* the café's hour is one hour for everyone in it, and
  the server's clock is the only one a demo account can move.
- Every welcome resets it, so a jump (below), a reconnect and a wake all
  bring every page to the same time.

### A demo account moves the clock forward

- A demo account asks for a time of day. The server moves the café to the
  next time it's that time in Canberra, never more than 24 hours ahead and
  never back.
- The café lives through the gap: the server replays it in one-second
  steps with the same rules and the same replay a sleep uses (slices 01 and
  07), so the cats keep their rhythms, the bowls refill at 7:00, 12:00 and
  18:00, midnight brings new treats and a new trust day, bans and grudges
  run down, and the board gets what the cats did. The replay writes
  nothing and logs nothing on the way, and its end is saved before the café
  takes another action.
- **The people inside live through it too** (proposed). Before the replay,
  a held cat is put down, a lap ends, and a piece being carried goes back
  where it was, as when its carrier leaves. During it, people keep their
  places but the cats live the gap as if the café were empty, as they do
  asleep. After it, a cat left on someone's tile moves to the nearest free
  floor, and the timers that belong to people inside (the grace period,
  the quiet seat, a nudge waiting for an answer) start again, so nobody is
  walked out by a jump.
- **Every page waits and comes back together.** While it replays, every
  page in the café, and any page that opens, shows the waking screen with
  who moved the clock and to when ("demo1 moved the café on to
  23:30", proposed wording), and nothing can be done, as while waking.
  At the end the server sends everyone a fresh welcome at the new time.
- **The clock never goes back.** How far the café is ahead of the wall
  clock is saved in the `world` table and loaded at start, so a restart
  or a redeploy keeps it; the café's clock reads the wall clock plus that.
  `CAFE_CLOCK_START` stays as it is: for tests, refused on Fly.
- **One jump at a time**, and at most one a minute in the whole café
  (proposed), refused with the time left. 24 hours replays in about 4 to 5
  seconds at the machine's baseline CPU (slice 01's measures: 1.3 s for
  eight hours, 13 to 15 s for three days).
- **Back to Canberra time** (proposed, question 1): a jump to the wall
  clock's time of day, which leaves the café a whole number of days ahead
  but showing Canberra's hour.
- One `cafe` log line per jump, `what = "jumped"`: who asked, from, to,
  the steps, how long it took, the bowls' refills; and one line per
  refused ask, with its code.

### Demo accounts and the operator's seed

- An account is a demo account when the store says so (a new `demo`
  column, by a numbered migration). Only the operator sets it.
- **`cafe demo seed`**, a subcommand of the server's binary, run over
  `fly ssh console`, reads `content/demo.toml`: the demo accounts' names,
  their look, and the trust each cat starts with in them. It creates any
  account that's missing, sets each one's password to the one the
  operator gives it (`CAFE_DEMO_PASSWORD`) on every run, marks each a
  demo account, and sets each cat's trust in it to the seed. A demo
  account's recovery code is made at random and never shown, so nobody
  holds one and nobody can change the password but the operator, by
  running the seed again. It refuses to touch an account of that name
  that isn't already a demo account, so it can never take over a
  visitor's. One `operator` log line per account and cat. Then the
  operator restarts the machine, and the café loads it. Running it again
  puts the seed back, after anyone has been unkind to the regular's cats.
- **The seed:** `demo1` and `demo2`, so two markers at once don't move
  each other out, with the password `catppuccino`, each with Mochi at 85
  (devoted: naps on your lap), Tora at 55 (friend: greets you at the door)
  and Burakku at 25 (familiar: comes when called). That's the order their
  trust rates would give a regular of a few weeks.
- **Otherwise a demo account is anyone.** From the seed, its trust moves by
  what it does, under the usual rules.
- **Sign-up refuses `demo` followed only by digits** (`demo1`, `demo42`)
  **and names starting `bot_`**, ignoring case, so no visitor can pass for
  a demo account or a bot.

### Three furniture sets (part 2, after slice 16)

- **Three arrangements in `content/layouts/`**, data like
  `content/room.toml`'s furniture, as the user approved (question 4).
  Laid out on the floor slice 16 settles:
  - **Opening day:** the starting room, as `content/room.toml` lays it
    out. It doubles as putting the room back.
  - **Lap time:** the sofa, chairs, cushion and window seat gathered round
    the rug near the cat bed, for sitting together and for laps.
  - **Play room:** the cat tower, the scratching post, the box and the toys
    out in the open, and the lamp and the plants where a cat can knock
    them over.
- **Each passes every placement rule**, held by `cargo test`: on the floor,
  never on the door's walkway, no overlap except on a rug, no floor cut
  off from the door, every cat bed in reach, no more than the floor holds.
- **A demo account lays one out at once, without the rate limit.** The
  server first puts any carried piece back and stands everyone up, walks
  anyone standing where a blocking piece will go to the nearest free
  floor, then replaces every movable piece with the set's. A cat lying on
  a piece that moves jumps off; knocked-over pieces stand up and the toys
  are gathered, since it's a fresh room. Everyone's page redraws it at
  once, it's saved like any arrangement, and it doesn't spend anyone's
  furniture allowance. The cats notice the new pieces, as when anyone
  places one.
- One `furniture` log line: who laid out which set.

### Bots

- **A demo account adds and removes bots**, up to six (proposed): visitors
  the server runs, named `bot_1` to `bot_6`, each with a look from the
  presets.
- **A bot is a visitor, without words or hands.** It walks in through the
  door, or joins the line at the window if the café is full. Now and then
  it walks to a free tile or emotes. It never sits, talks, handles a cat
  or touches furniture: a bot on the sofa would take the seat the regular
  needs for a lap (the agent's call, 2026-11-06, in the plan).
- **Bots count toward the six inside.** When a seat frees, the first in
  line walks in, bot or person.
- **A bot is never stored or met.** It isn't an account, it can't log in,
  and a restart drops it. The cats never sniff it or build trust in it, and
  it never reaches the board.
- **Bots leave** when removed (the newest first), when the demo account
  that added them leaves the café, or after 15 minutes (proposed),
  whichever comes first, so a forgotten demo doesn't hold real visitors'
  seats. They're never "quiet", so the nudge passes them by.
- One `bot` log line as each is added or leaves: who added it, and why it
  left.

### The demo bar

- **A floating bar at the top of the room**, shown only to a demo account,
  at every size, in the panels' glass:
  - the café's time, and how far it is ahead of Canberra ("23:30 · a day
    ahead");
  - **Time:** Morning 07:00, Afternoon 13:30, Evening 18:30, Night 23:30,
    one hour on, any time typed, and Canberra time;
  - **Furniture:** the three sets (part 2: the bar has no Furniture
    button until then);
  - **Bots:** remove, how many, add.
- The four times are picked for the cats (proposed): at 07:00 the bowls
  refill and Mochi and Tora are up; at 13:30 Mochi naps after lunch; at
  18:30 the lamps are on and Mochi and Tora are up; at 23:30 only Burakku
  is, the window is lit and the night music plays.
- On a desktop the bar spans the top of the room's middle. On a phone it's
  one slim row: the time, and Time, Furniture and Bots buttons, each opening
  its choices just below. In layout B it floats with the other controls; in
  layout A it sits above the room.
- **Every control is a real button**, in the page's tab order, by
  keyboard, touch and mouse; Escape closes what a button opened; it
  survives a resize; its text is 4.5:1 over anything behind it. A control
  that can't be used yet says why ("next jump in 40 s").
- **Everyone else sees what it did**, not the bar: the waking screen for a
  jump, and a short notice and a screen-reader line for a furniture set
  ("demo1 laid out Lap time") and for bots coming and going as
  people do.

### The README's section for markers

- **"For markers"**, at the end of `README.md` before the credits: why the
  demo accounts exist, their login, and the path below in a few lines.
  The README is the user's; this section is the agent's draft, at the
  user's asking, and the user decides its final text. It stays under the
  brief's 600 words with the rest.
- It ships with the slice, not before: `/readme/` is live, and a README
  that promises what isn't built is marked down. Part 1's README names no
  furniture set; part 2 adds Lap time to step 2 and Play room to step 7.

### The marker's path

About ten minutes. Window 1 at 1920×1080: sign up as yourself, the
newcomer. Window 2 at 390×844: log in as `demo1` (or
`demo2` if the first says it's open elsewhere). The bar appears
in window 2 only.

1. **Arriving.** The newcomer walks in; each window sees the other within
   a second. A cat comes to sniff the newcomer's hand, and the board says
   so. "Your cats": a stranger to all three, beside the regular's Mochi 85,
   Tora 55 and Burakku 25.
2. **Trust.** Both say "Mochi". She looks up at the newcomer and comes to
   the regular. The regular picks her up and tries to pass her to the
   newcomer: she won't go to a stranger. Bar: Afternoon (and Lap time,
   from part 2). The regular sits on the sofa, and Mochi, napping after
   lunch, takes their lap.
3. **Night.** Bar: Night. Both windows wait while the café lives the hours
   between, then come back at 23:30: the window lit, stars over the
   street, the night music. Mochi and Tora sleep; Burakku is up. Talk a
   lot and she hides; go quiet and she comes out. The board shows what
   the cats did in the hours you skipped.
4. **Morning.** Bar: Morning, the next day. The bowls are full and the
   treats are back. The regular walks out and back in, and Tora greets
   them at the door.
5. **Boundaries.** The newcomer keeps picking Tora up: she refuses, then
   scratches, then bans it, and says for how long.
6. **A full café.** Bar: bots until six are inside (four, with the regular
   and the newcomer), then one more, who waits at the window. The newcomer
   leaves and comes back: the bot has taken the seat, so the newcomer waits
   at the window, where they can only talk. Remove a bot, and the newcomer
   walks in. (Four bots alone, as first written, let the newcomer straight
   back in: slice 17's review, finding 2.)
7. **Together.** Both reach for the same chair: the first grab wins, and
   the other is told who has it. A piece on the door's walkway is refused.
   From part 2, bar: Play room, and Tora goes to the new pieces first.
8. **Every way in.** Resize window 1 to phone width mid-use, switch the
   phone's layout, and do a lap by keyboard alone.
9. **The next day.** Come back as the newcomer: the cats still know you.
   Bar: Canberra time puts the hour back.

## Not in this slice

- Moving the clock back, or to more than 24 hours on in one jump.
- Anything for visitors who aren't demo accounts, beyond the page keeping
  the café's clock and the notices of what a demo account did.
- Bots that talk, handle cats or move furniture, or that go quiet to show
  the nudge.
- Showing the logs to markers: the narrated tail stays the operator's
  (`pnpm logs`).
- A preview for one viewer. The clock is the café's.
- Mute, the blocklist and the admin ban (slice 03); the load check
  (slice 04).

## Done when

| What must be true | Held by |
| --- | --- |
| The page's light, street, window, music set and board times follow the café's clock from the welcome, not the device's | client unit tests (the clock from `now`) and a browser check (a device clock at noon shows night when the café's is 23:30) |
| A demo account's jump goes to the next time of day it asked for, at most 24 hours on, never back; anyone else's ask is refused | `cargo test` and `spec/` (a new account's ask refused) |
| A jump replays the gap with the café's rules: the cats' rhythms, the 7:00, 12:00 and 18:00 refills, midnight's treats and trust day, bans running down, the board's lines; the same save and the same jump make the same café | `cargo test` on mocked time |
| People inside come through a jump: nothing held, carried or on a lap, no cat on their tile, nobody walked out by it | `cargo test` |
| Every page in the café waits during a jump and gets the new time within a second of its end; a page that opens meanwhile is told at once; the welcome's time is the café's own; an action that reached the café while it jumped is refused (`movedOn`) | `spec/demo.test.ts` (two clients), `server/tests/jumps.rs` (a page opened mid-jump; the next walk within 500 ms of the welcome's time) and `ws::tests::what_queued_during_a_jump_is_refused_and_told` |
| A jump cuts no connection, and spends nobody's session | `server/tests/jumps.rs` (a page still answered 31 s after a jump; a day-long session good after two jumps of nearly a day) |
| How far ahead the café is survives a restart; its clock never goes back | `server/tests/jumps.rs` (the binary on mocked time: a jump, a stop, a start five minutes later) |
| One jump at a time, at most one a minute | `cargo test` |
| Part 2: each of the three furniture sets passes every placement rule | `cargo test` (every file in `content/layouts/`) |
| Part 2: a demo account's set is laid out at once for everyone, without spending the rate limit; carried pieces go back, nobody is left on a blocking piece, cats jump off what moves | `cargo test` and `spec/` (a second client sees the set within a second) |
| Bots: up to six, counted in the cap; the seventh in the café waits at the window; they leave when removed, when their demo account leaves, or after 15 minutes; no trust, no board line, no treat or cat handed them, nothing stored | `cargo test` (`world::bots_tests`) and `spec/demo.test.ts` (the README's path: bots until six are inside and one more, the newcomer leaves and comes back to the window, a bot removed lets them in) |
| `cafe demo seed` creates and marks the demo accounts and sets their trust from `content/demo.toml`, logged per account and cat; no other account's trust changes | `cargo test` |
| Sign-up refuses `demo` followed only by digits, and names starting `bot_`, ignoring case | `spec/accounts.test.ts` |
| The demo bar shows only to a demo account; every control works by keyboard, touch and mouse at 390×844 (layouts A and B) and 1920×1080, through a resize; the keyboard's focus survives a jump; its text is 4.5:1 or better over anything behind it | browser checks, and client unit tests (`contrast` for ink and muted on a card; `demoBar.test.ts` holds the bar's card opaque) |
| One log line per jump, set laid out and bot, and per refused ask; nothing anyone said | `cargo test` (log tests) and CI's log check |
| On the live café, the demo accounts exist with their seed, and the marker's path works end to end at both sizes | judged: an agent walks the path on the live café after the deploy, recorded in `docs/notes/slice-17-demo.md` with screens |
| The README's "For markers" matches what's built | judged: the user, reading `/readme/` on the live café |

## Rules it touches

- **Trust never fades with absence.** The operator's seed is the one change
  to trust that isn't a person's doing, limited to demo accounts
  (`AGENTS.md`, ADR 0022).
- **The server decides every outcome.** Each demo action is an intent the
  world checks: the account, the timing, the rules of placement and the
  cap. The page's clock comes from the server.
- **The cap is enforced on the server.** Bots count toward it.
- **The door's walkway is never blocked.** Every set is checked against
  it, and a set lands by the same placement rules.
- **Never store or log what anyone says.** Bots never talk; the jump's
  replay logs nothing on the way.
- **Every action works by keyboard, touch and mouse.** The bar and its
  choices.
- **Cats change through `content/`, not code.** The seed names cats in
  `content/demo.toml`, and the sets are `content/layouts/`.
- **It keeps Canberra time** (`docs/design.md`): until a demo account moves
  it, and its time of day can be put back.

## Numbers

New, *tunable*, in `content/tuning.toml` (proposed):

- `jump_max_hours = 24`: the furthest one jump goes.
- `jump_every_secs = 60`: the café's shortest gap between jumps.
- `bots_max = 6`, `bot_stay_mins = 15`.

Used: `cap = 6`; `trust_levels = [20, 50, 80]`; `trust_daily_cap = 10`;
`bowl_refills` (7:00, 12:00, 18:00); `treats_per_day = 3`;
`furniture_max = 30`; `grace_secs`, `quiet_hidden_secs`, `quiet_idle_secs`
and `nudge_answer_secs`, which start again after a jump. The seed (Mochi
85, Tora 55, Burakku 25) is data in `content/demo.toml`.

## Open questions

None. Answered by the user on 2026-11-06 ("1A; 2 demo1 demo2 same simple
password; 3A; 4A; 5 build the floor presets after slice 16, others at the
same time with 16"):

1. **Putting the hour back:** A. "Canberra time" jumps forward to the next
   time the café's time of day matches Canberra's, leaving it a whole
   number of days ahead, which shows only in the bar.
2. **The demo accounts:** `demo1` and `demo2`, one simple password for
   both, in the README: `catppuccino`, the agent's pick.
3. **The bar on a phone:** A. One slim row: the time, and Time, Furniture
   (part 2) and Bots buttons, each opening its choices just below.
4. **The three sets:** A. Opening day, Lap time and Play room.
5. **The order:** the furniture sets after slice 16; the rest alongside it.
