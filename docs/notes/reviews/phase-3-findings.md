# Findings: review of phase 3

Brief: phase-3-brief.md. Method: six reviewers by dimension, two skeptics per finding; a finding is kept if at least one skeptic could not refute it. Findings raised in more than one dimension are merged into one.

## Findings

### 1. Major: A held cat that refuses or scratches its holder stays in their arms and walks off while still held

- Where: server/src/world/handling.rs:197-223 (answer, Refuse/Scratch arm: walk_away, no jump_down) and 138-160 (sit_still on a held cat); reached from client/src/menus.ts:38, which offers Pet for the cat you hold.
- Scenario: Sam holds Tora and picks "Pet Tora" from the menu. handle_cat refuses only a holder who isn't the sender, and Sam is on the cat's tile, so answer() runs. handling_outcome treats Pose::Held like any awake pose, so Tora can refuse, or scratch once she is angry or Sam is pushing. The Refuse/Scratch arm never calls jump_down, so she stays in Sam's arms. That contradicts design.md ("scratch and jump down") and plan decision 7 ("a held cat jumps down"). Held isn't a resting pose, so the arm then calls walk_away. walk_cat sets a walk and pose Walk and broadcasts CatMoved while held_by is still Sam. cats_tick skips taken cats, so the walk never settles. held_tick moves `at` but not `walk`, so tile() and view() put her several tiles away while every client draws her in Sam's arms. Sam's arms stay full until held_until (up to about 60 s), when jump_down puts her back beside him. Pushing on gives a ban, and she is still held. A welcomed Pet, Play or Offer from the holder calls sit_still, which re-poses a held cat as Sit or Play. On a lap, a scratch and a ban leave the cat asleep on the lap, since resting() skips walk_away and nothing clears lap.
- Test: Not caught. No test in world/cats_tests.rs handles the cat you hold, and client/test/menus.test.ts asserts Pet is offered for it. World test: carrying_mochi(), set anger to 0.9 and record a refusal from 1 s earlier, send Pet, then assert a Scratch, a CatHeld{by: None}, held_by == None and no walk. Also assert a welcomed pet leaves the pose Held.
- Skeptics: none of the six could refute it (the handling, carrying and client reviewers each raised it). Four reproduced it in a throwaway copy: after the pet the cat was still held, with pose Walk and tile() several tiles from its holder. Three noted the walk is bounded, since held_until still ends it within about a minute, and that the client doesn't draw the cat walking.

### 2. Major: A held cat stays clickable at the floor tile where it was picked up, the only place "Put it down" appears

- Where: client/src/state.ts:264-270 (catHeld keeps the old `at`), client/src/input.ts:20 (targets from cat.at and cat.walk), client/src/main.ts:124-130 (the carrying bar covers furniture only)
- Scenario: Sam at (5,5) picks up Mochi at (6,5). The server moves mochi.at to Sam's tile and held_tick keeps moving it, but sends no message about it. The client's catHeld case sets heldBy, pose "held" and walk null, and leaves `at` at (6,5). If she was walking, `at` is the start of that walk. render.ts draws her in Sam's arms, but everyone() still puts her target at (6,5). Sam walks to (9,7). Clicking himself gives nothing, because everyone() leaves out "you". There is no holding bar for a cat, and Escape only puts back furniture. "Put Mochi down" appears only on the empty-looking tile (6,5), or if Tab reaches her there. By mouse or touch the action is effectively hidden, which breaks "every action works by keyboard, touch and mouse". Jo, clicking the empty floor at (6,5) to walk there, gets Mochi's menu instead, and Pet, Offer and Play are refused with "sam is holding Mochi." The phantom stays until she jumps down.
- Test: Not caught. menus.test.ts builds the held-cat menu from a made-up target, and state.test.ts checks only heldBy and pose. A client test that applies catHeld and expects the cat's target only on its holder's tile, in targetsAt and cycleOrder, would catch it. So would a browser test that picks up a cat and puts it down by touch.
- Skeptics: both could not refute it. One corrected a detail: after a pass the phantom stays at the original tile; it doesn't move to the new holder's old spot.

### 3. Major: The "Put a treat down" button is rebuilt on every server message, so keyboard focus on it is lost within seconds

- Where: client/src/main.ts:226 with client/src/panels.ts:17-29 and 42 (box.replaceChildren on every message)
- Scenario: cafe.receive calls notify() after every message, including catMoved, catPosed, personMoved and yourTrust. The listener calls renderYourCats, which replaces every child of #your-cats, the button included. A keyboard or screen-reader user Shift+Tabs to "Put a treat down". Before they press Enter, a cat starts a walk (cats choose every few seconds). The focused button is removed, focus falls to <body>, and Enter does nothing. When a press does land, the server's yourTreats and treatPlaced replies rebuild the panel and focus is lost again. A mouse click can also be lost if a rebuild lands between pointerdown and pointerup. The ring menus never offer putTreat, so this button is the only way to put a treat down. This breaks "every action works by keyboard". Before phase 3 the panels held no controls, so nothing showed it.
- Test: Not caught. The browser keyboard pass only Shift+Tabs past the button, and the treat check clicks it with the mouse. A browser test that focuses the button, waits for one catMoved and presses Enter, expecting treatPlaced, would catch it.
- Skeptics: both could not refute it.

### 4. Major: People can walk through a blocking piece that stands on a rug

- Where: server/src/room.rs:398-408 (piece_at, walkable), room.rs:361-374 (restore puts rugs first), server/src/world/furniture.rs:254 (put appends)
- Scenario: Sam grabs a chair and places it at (5,5) on the rug. check_place allows the overlap because the rug is `under`, and room.put appends the chair after the rug. piece_at((5,5)) returns the first covering piece, the rug, so walkable((5,5), Person) is true. path() routes people through the chair, walk_to can stand someone on it, and around() and pettable count the tile as standable. all_reachable uses the same rule, so check_place's "never cut floor off" check never counts a blocking piece on a rug. restore() sorts rugs first, so after any restart every piece on a rug is hidden behind it. The bug dates from phase 2, when rugs came in. The behaviours reviewer found it while tracing log_cat, which uses the same piece_at (finding 28).
- Test: Not caught. The room tests only put a non-blocking cushion on the rug. Room test: place a chair on the rug and assert !walkable(tile, Person) and that path goes round it. Repeat after restore(arrangement()).
- Skeptics: both could not refute it. One reproduced it in a throwaway copy, before and after restore. Both judged it in scope, since the brief lists room.rs and the restores and excludes only phase 4 and 5 work.

### 5. Major: Passing a cat skips its bans and anger, so a banned or angry person gets it in their arms

- Where: server/src/world/handling.rs:285-322 (pass_cat)
- Scenario: Burakku is furious at person 2 and has banned pick_up for 48 h. 2's trust is still at least 20, which is likely for a regular, since a scratch costs only 2. Person 1, whom Burakku trusts, picks her up, stands beside 2 and sends PassCat{to: 2}. pass_cat checks only that 2 is inside, beside 1, has empty hands and has trust of at least trust_levels[0]. It never calls banned_until, never reads self.anger and never rolls handling_outcome. So held_by becomes 2 with a full hold, and the log says "taken". This is the cat that tells 2 she "won't be picked up by you for another 47 h". An angry cat likewise goes quietly into the arms of the person it is angry at, with no scratch. Plan decision 7 lists pass under the one handling rule (character, state, trust, anger). design.md's carrying line gives only the trust-20 gate.
- Test: Not caught. The pass test covers only trust above or below 20. World test: restore a pick_up ban for 2 on Mochi, set trust 30, pass from 1, and assert held_by != Some(2). Repeat with anger at 0.6 or more, expecting a scratch or a jump-down.
- Skeptics: both could not refute it. Both noted design.md's narrower wording ("Pet, play, offer and pick up answer by one rule") supports the code, so the plan and design.md disagree and the execution log records no reason. A similar finding from the handling reviewer was refuted by both its skeptics on that reading (see Refuted). Deciding this means deciding which document holds.

### 6. Major: Cats nap and perch on a seated stranger's tile, which looks exactly like a trust-80 lap

- Where: server/src/world/cat_life.rs:350-381 (nap_spot), 343-346 (free_spot), 250-255 (laps), 447 (settle's lap check); server/src/room.rs:490-496 (spots); server/src/world/furniture.rs:399-405 (free_seat)
- Scenario: nap_spot and free_spot skip only tiles other cats are on, never tiles where people sit. The sofa's nap spot is (0,5), its first pettable tile, and free_seat picks the first of several equally near seats, so Sam sitting from (1,6) lands on (0,5). The cushion's one tile and the window seat's (2,1) are each both a seat and a nap or perch spot. A tired Mochi, a stranger to Sam, naps on Sam's tile for 2 to 10 minutes. settle accepts it, because a nap piece covers the tile. CatView has no lap field, so everyone sees Mochi asleep on a stranger's lap: the top step of the trust ladder, given for nothing. Her lap stays None, so choose still offers Sam's lap to a cat that trusts him 80, and that cat walks onto the same tile.
- Test: Not caught. World test: seat a person at the sofa's (0,5) with trust 0, make the cats tired, tick about 20 minutes, and assert no cat settles on a seated person's tile unless lap == Some(them) and trust >= 80.
- Skeptics: both could not refute it. Both reproduced the stranger nap on all three seats in a throwaway copy. One pointed to phase 2's triage of finding 11, which ruled a cat napping beside or under a sitter "by design" before laps existed, and said phase 3 never revisited it. Both questioned whether it is major. The race that puts two cats on one lap is finding 26.

### 7. Major: At Canberra midnight nobody inside is sent their new treat allowance

- Where: server/src/world/treats.rs:24-30 (treats_left) and 52-64 (keep_treats, the only YourTreats push); client/src/menus.ts:44 and 52, client/src/panels.ts:19-25
- Scenario: A visitor uses their third treat at 23:50 and stays inside. At 00:00 the server's treats_left gives 3 again, but nothing pushes it. YourTreats goes out only after a put, give or offer, and your_treats only in the join snapshot. Unlike the bowls, no tick watches for the day changing. The client keeps yourTreats = 0, shows "No treats left today." and hides "Put a treat down", "Offer X a treat" and "Give Y a treat". So the visitor can't use treats the server would accept until they reload or someone gives them one. It goes wrong the other way too: someone given 2 treats at 23:55 still sees "Treats today: 5" after midnight while the server allows 3. Nothing removes an active visitor, so staying across midnight is easy. The brief names "treats across a Canberra midnight" as an input to trace.
- Test: Not caught. cats_tests::three_treats_a_day_to_put_down_or_give_away jumps a day and then sends a PutTreat, which gets a fresh YourTreats. A world test that ticks across Canberra midnight and expects a YourTreats for each person inside would catch it.
- Skeptics: none of the four could refute it (the treats and client reviewers both raised it). The client reviewer rated it minor, since the server stays correct and a reconnect fixes the count.

### 8. Major: An action refused when the walk over ends never gets a log line

- Where: server/src/world/mod.rs:266 (arrived_with; log_request runs only in handle, mod.rs:238-240), with the unlogged refusals at handling.rs:89-97 (handle_on_arrival, MovedAway at 93), handling.rs:62-69 via 96, furniture.rs:236-240 (put_down), 274-277 (stand_up_piece) and 413-414 (sit_down)
- Scenario: design.md's "Logging" says an action that starts with a walk is logged when it starts and again when it happens, and a refused action is logged with its code. Only World::handle detects refusals. When a walk ends, tick runs arrived_with, then handle_on_arrival, pick_up, put_down, sit_down or stand_up_piece. These push an Error to the person and write no line. (a) Sam taps Pet on Tora from across the room ("sam is walking over to pet"). Tora wanders off, and MovedAway goes out unlogged. (b) Ana and Ben both pick up Mochi from afar. Ana arrives first and holds her. Ben gets Taken or MovedAway with no line. HandsFull, and a ban that started mid-walk, go the same way. (c) Two people head for a one-seat chair, and the second's Taken from sit_down is unlogged. (d) A carried lamp's spot is taken on the way, and put_down's CantPlace or RateLimited is unlogged. (e) Two people tidy the same toppled lamp. The second hits stand_up_piece's silent return, with no error and no line. The narrated log leaves each of these walks unfinished.
- Test: Not caught. log_tests::a_walk_over_to_do_something_is_logged_when_it_starts checks only the start, and the cat_life.rs test that drives "Tora moved away." (around line 1000) doesn't capture logs. Wrapping that test's tick in capture_logs and asserting a refused pet line with code movedAway would catch it, as would two people picking up the same cat from afar.
- Skeptics: none of the six could refute it (the logging, handling and carrying reviewers each raised it). The handling and carrying reviewers rated it minor. Case (e) conflicts with a refuted finding about tidy (see Refuted), whose skeptics said the broadcast already tells the second person and that arrival failures go unlogged by design.

### 9. Major: A pet, play or pick-up that ends in a ban logs three lines, and one falsely says it was refused

- Where: server/src/world/handling.rs:219 (ban called inside answer), 234, 259 and 267, with server/src/world/mod.rs:251-257 (log_request takes any Error to the sender as a refusal); scripts/narrate.ts:30-79 (no "banned" case)
- Scenario: Sam stands beside Mochi and pets her repeatedly within 10 s while she refuses, as in cats_tests::pushing_a_cat_angers_it_into_scratching_and_then_a_ban_that_says_how_long. On the furious pet, answer() calls ban(), which logs {what: "banned"} with no outcome and pushes Error{Banned} to Sam. answer() then logs {what: "pet", outcome: "pushed" or "scratch"}. Back in World::handle, log_request finds the Banned error and logs {what: "pet", outcome: "refused", code: "banned"}. Narrated, that reads "sam: banned (ok)", then "sam petted Mochi, who scratched them", then "sam tried to pet, refused: banned". One action gives three lines. The last claims a refusal that didn't happen, and the first names neither the cat nor the action. The same ban reached by walking over goes through tick, not handle, so it logs two lines.
- Test: Not caught. log_tests only asserts that lines exist, never that there is exactly one, and the ban test doesn't capture logs. Running the quarrel inside capture_logs and asserting one pet line with no outcome "refused" would catch it.
- Skeptics: none of the four could refute it (the logging and handling reviewers both raised it). One reproduced the three lines in a throwaway copy. The separate "banned" line is planned, since design.md lists bans as logged; the false "refused" line is not. Two said major may be generous for a log-accuracy bug.

### 10. Major: The narrator has no wording for any phase 3 action, so the cat, the other person and the reason are dropped

- Where: scripts/narrate.ts:36-79 (action switch), 96-97 (cat default) and 116 (fallback)
- Scenario: narrate.ts was last changed in a086231, before phase 3 added play, offer, pick_up, put_down, pass_cat, put_treat, give_treat, tidy and banned. Each reaches the fallback `${who}: ${what} (${outcome ?? "ok"})`, which ignores the cat, to and piece fields the server logs. Piping real lines through the script prints "sam: offer (welcome)", "sam: pick_up (tolerate)", "sam: pass_cat (taken)" (no cat, no receiver), "sam: give_treat (ok)" (no receiver), "sam: tidy (ok)" (no piece) and "sam: banned (ok)", which names no cat or action and calls the ban ok. The cat line {what: "jump_down", why: ...} hits cat()'s default and prints "Mochi: jump down", dropping whether she was put down, wouldn't go, lost her holder or had enough. For crit 10, narrated from the logs alone with a dozen visitors and three cats, treats, play, carrying and grudges can't be told apart.
- Test: Not caught. spec/narrate.test.ts covers only phase 2 `what` values, plus a check that an unknown line still prints something. A table test over every `what` the server emits, asserting the cat and receiver are named and a jump_down says why, would catch it.
- Skeptics: none of the four could refute it (the logging and carrying reviewers both raised it). All four piped real lines through the script and got the output above. The carrying reviewer rated it minor. One noted that a jump at the door would still read "had_enough" after a fix, because held_tick logs that reason (finding 15).

### 11. Minor: "Put it back" on a catalogue piece logs nothing, and a dropped connection's put-back reads as the person's own action

- Where: server/src/world/furniture.rs:321-327 and 347-350 (put_back); server/src/world/people.rs:104 and quiet.rs:74 (put_back on a drop or walk-out)
- Scenario: (a) Sam takes a lamp from the catalogue ("sam took a lamp from the catalogue") and presses Escape, which sends putBack (client/src/main.ts:216). put_back finds from == None, pushes FurnitureRemoved and returns with no line. log_request sees no error and no new walk, so nothing is written. In the narrated log Sam carries the lamp forever. The same happens when a piece no longer fits anywhere (the None branch at 347). (b) Sam's phone drops while carrying the plant. drop_connection calls put_back, which logs {uid: sam, what: "put_back"}, narrated as "sam put the plant back". Drops aren't logged, so the reader can't tell Sam did nothing.
- Test: Not caught. log_tests' PutBack step runs with empty hands, so it only exercises NotHolding. Logging Take then PutBack and asserting a put_back line would catch (a).
- Skeptics: both could not refute it. Both called (b) weaker but accurate.

### 12. Minor: Account refusals narrate as "refused: undefined", and several account actions log nothing

- Where: server/src/api.rs:210, 214 and 269 (refused lines with no code), 221-238 (logout), 159, 178 and 264-266 (unlogged refusals); scripts/narrate.ts:34
- Scenario: A wrong password logs {what: "login", outcome: "refused"} with no code. narrate.ts:34 prints "someone tried to login, refused: undefined", and a wrong recovery code gives "someone tried to recover, refused: undefined". Logout writes no line, though the narrator has a logout case. Signup refusals (name taken, bad input) and guard()'s origin and rate-limit refusals write nothing. Recover with an unknown name is silent, while a wrong code is logged.
- Test: Not caught. narrate.test.ts has no refused line without a code, and nothing captures the API handlers' logs.
- Skeptics: both could not refute it. Both reproduced the "undefined" output. The api.rs lines date from phase 1, but narrate.ts is phase 3 code. One noted that leaving `who` off a failed login may be deliberate, since people sometimes type a password into the name field.

### 13. Minor: Refusal and walking-over lines don't say which cat or piece

- Where: server/src/world/mod.rs:256 and 261 (log_request)
- Scenario: log_request writes only uid, who, what, outcome and code. With a dozen visitors and three cats the narrated log reads "ben tried to pick up, refused: taken", "sam tried to pet, refused: banned" and "ana is walking over to grab", with no cat or piece named. The detail the person sees ("ana is holding Mochi.") isn't logged. After a restart, a refusal from a restored ban has no earlier "banned" line to tie it to a cat.
- Test: Not caught. log_tests::a_refused_action_is_logged_with_why checks only what, outcome and code.
- Skeptics: both could not refute it. Both called the walking half weaker, since a successful arrival names the target later.

### 14. Minor: Repeating a request mid-walk logs nothing

- Where: server/src/world/mod.rs:260 (log_request's pending check)
- Scenario: Sam is walking over to pet Mochi and clicks Pet on her again, maybe because she moved. handle_cat sees walking == true and calls approach, which starts a new walk with an equal Pending and broadcasts a new PersonMoved. log_request's `pending != pending_before` is false and there is no error, so no line is written. Re-clicking Sit on the same sofa, or Grab on the same piece, while walking to it is the same. The client still offers these while you walk.
- Test: Not caught. Both log tests send a single request from a standstill.
- Skeptics: both could not refute it. The arrival still logs the outcome, so the story stays coherent.

### 15. Minor: Cat lines misreport play and jump-downs, and a cat leaving a lap gets no line

- Where: server/src/world/cat_life.rs:513 (log_cat), 221 (held_tick's catch-all) and 233-237 (laps_tick); scripts/narrate.ts:97
- Scenario: (a) Sam plays with Tora in a far corner. handling.rs:152 calls sit_still(Plan::Play), then settle, then log_cat, which hard-codes on="toys". The log says "Tora: play (the toys)" though she's nowhere near them, and Sam isn't named (see also finding 24). (b) Sam carries Mochi onto the door tile. held_tick hits its catch-all and logs jump_down with why "had_enough", the wrong reason. The narrator drops `why` anyway (finding 10). (c) When a lap ends because the person stands, laps_tick settles with Plan::Idle and logs nothing, though design.md lists "jump down" as a cat line.
- Test: Not caught. log_tests::the_cats_story_is_logged_but_not_their_steps checks only field types and a count bound.
- Skeptics: both could not refute it. One called (c) weak: design.md ties "jump down" to carrying, and a lap ending is arguably going idle.

### 16. Minor: The narrator does nothing, silently, from a path with a space or through a symlink

- Where: scripts/narrate.ts:126
- Scenario: The script runs only when import.meta.url equals `file://${process.argv[1]}`. import.meta.url is the percent-encoded real path, and argv[1] is the raw path as given. In a clone under a directory with a space, or reached through a symlink, `pnpm logs` prints nothing and exits 0, which looks like an idle café. Verified on this machine: through a symlinked parent directory it printed nothing, and through the real path it printed "19:42:07  sam left". `pnpm logs` from the repo root works today because the working directory resolves to the real path.
- Test: Not caught. spec/narrate.test.ts imports narrate() and never runs the script as a filter.
- Skeptics: both could not refute it. Both reproduced it with a space and with a symlink.

### 17. Minor: A ban wipes the cat's anger, so a furious cat is instantly calm toward the person's other handling

- Where: server/src/world/handling.rs:260 (self.anger.remove in ban)
- Scenario: Tora bans Sam's pet. Her anger at Sam is about 1.2, and ban() deletes it. Sam waits 11 s (past PUSHING_MS) and tries Pick up. angry is now false, so a refusal is a plain refusal: no scratch, no trust -2, and anger only reaches 0.6. Without the reset, anger would still be about 1.2, the refusal would be a scratch, and pick-up would be banned at once. design.md says anger cools by grudge, "most of it gone by the end of the grudge". Nothing in design.md, ADR 0011 or the plan says a ban discharges it. So Burakku's 48-hour grudge is gone in seconds for every action but the one banned.
- Test: Not caught. The ban test checks only an Offer afterwards, which never scratches. Asserting that anger at (mochi, 1) is still at least SCRATCH right after the ban would fail.
- Skeptics: both could not refute it. Both said the reset may be a deliberate way to stop one quarrel banning every action in turn, and if so it belongs in design.md.

### 18. Minor: Every scratch is also a ban, and "quick to swat" Tora never scratches in a run of refusals

- Where: server/src/world/handling.rs:124 and 131-132 with server/src/anger.rs:25-30 and content/cats/*.toml (temper 0.2, 0.5, 0.6)
- Scenario: A scratch needs anger of at least 0.6 before the try, and each provocation adds 0.3 + temper/2, at least 0.4. So every scratch lands at 1.0 or more and bans in the same instant, and design.md's "scratch at 0.6" stage is never seen without a ban. Tora: the first refusal sets anger to exactly 0.6. A push 2 s later sees 0.59975, so the outcome is Refuse, anger reaches 1.2, and she bans with no scratch. Burakku goes the same way (0.55, then a ban). Only Mochi, the sweetest cat, scratches, on her third try. The character table calls Tora "quick to swat".
- Test: Not caught. pushing_a_cat_angers_it_into_scratching_and_then_a_ban_that_says_how_long uses only Mochi. The same loop on Tora sees no Scratch before Banned.
- Skeptics: one could not refute it. The other refuted it: the numbers are design.md's, the plan's execution log records the ban counts knowingly, and Tora does scratch on a different action in the same run (anger is per person, bans per action) or after a cool-off of about 32 minutes. Both called it a tuning question.

### 19. Minor: You can end up seated with a cat in your arms, and a second cat can then take your lap

- Where: server/src/world/handling.rs:68-76 (PickUp while seated) and 289-303 (pass to a seated receiver); server/src/world/furniture.rs:408-421 (sit_down doesn't re-check holding_cat); server/src/world/cat_life.rs:250-255 (laps filter)
- Scenario: (a) Person 1 sits on the sofa with Mochi idle beside them and sends PickUp. handle_cat checks only full hands, walking and distance, so 1 holds Mochi while still seated. take() and grab() both stand you up ("nobody carries seated"), but this doesn't. (b) 2 sends Sit from across the room. As 2 passes, 1 passes the cat to 2. pass_cat ignores sitting and pending, and sit_down never re-checks holding_cat, so 2 sits holding the cat. The reverse order is refused HandsFull by sit(), so the outcome depends on order. choose's laps list counts anyone sitting with no lap cat, so a trust-80 Tora can then settle on 1's lap: one cat in arms and one on the lap, on one tile.
- Test: Not caught. The lap test never picks up while seated. Sit 1, pick up Mochi beside them, and assert !(sitting && holding_cat). Repeat with a pass to a seated person and a pass during a Sit walk.
- Skeptics: both could not refute it. Both noted the state ends by itself within about 60 s and the client draws it sensibly, so the harm is to consistency.

### 20. Minor: A cat can be passed to someone walking out or whose connection dropped

- Where: server/src/world/handling.rs:289-292 (pass receiver filter); server/src/world/cat_life.rs:216-222 (held_tick's single "had_enough")
- Scenario: Person 2 goes unanswered after "still there?", and walk_out sets leaving and walks them to the door. Or 2's tab drops and away_since is set while the seat is kept. Either way 2 is still Inside. Person 1, beside them, sends PassCat{to: 2}. pass_cat checks only place == Inside, so 2 "takes" Mochi: a CatHeld broadcast and an action line with outcome "taken". On the next tick held_tick's `here` check fails, and jump_down logs why "had_enough", not "holder_left". So the log tells of a cat passed to someone who isn't there, which then had enough. The door case also logs "had_enough" (finding 15).
- Test: Not caught. Put 2 into walk_out (or send Input::Drop for 2), pass to 2, and expect a refusal with held_by unchanged.
- Skeptics: both could not refute it. One noted give_treat has the same receiver filter.

### 21. Minor: On the day daylight saving ends, the bowls refill at 02:00

- Where: server/src/world/treats.rs:197 (refill_key's "yesterday")
- Scenario: refill_key finds yesterday as now minus (minute_of_day + 1) minutes. On 2027-04-04 Canberra goes from 03:00 AEDT back to 02:00 AEST. From the second 02:00 on, real time since midnight is 60 minutes more than minute_of_day, so the subtraction lands at 00:59 the same day. The key becomes "2027-04-04@1080" instead of "2027-04-03@1080", and bowls_tick fills the bowls at 02:00, an unscheduled refill before 7:00. Checked with the same arithmetic in Python against Australia/Sydney. The October change is fine.
- Test: Not caught. the_bowls_fill_on_the_cafes_schedule uses times near epoch 0, in AEST. A refill_key test at 2027-04-04 02:30 AEST expecting "2027-04-03@1080" would catch it. The fix is to take the previous day from the date (date minus one day).
- Skeptics: both could not refute it. Both re-ran the arithmetic. It happens once a year and costs one extra refill.

### 22. Minor: A cat with no hunger still takes an offered treat at least 35% of the time, and trying again costs nothing

- Where: server/src/cats.rs:288 and 306-312 (handling_outcome for Offer), reached from server/src/world/handling.rs:154
- Scenario: A cat has just eaten (hunger 0). A visitor offers a treat. The welcome chance is 0.15 + 0.2 x trust/100, and Tolerate adds 0.2 more, so the cat takes it 35% to 55% of the time. If refused, the visitor offers again at once: Offer is excluded from pushing and its refusals add no anger. Within a few tries the full cat eats and trust rises. design.md says "a cat that isn't hungry just doesn't take it". A treat on the floor is gated by hunger (Eat scores 0 at hunger 0), so the hand offer is the odd one out.
- Test: Not caught. Offer is tested only at need 1.0 and in Nap. Asserting handling_outcome(mochi, Offer, Idle, 0.0, 0.0, false, 0.1) == Refuse would fail.
- Skeptics: both could not refute it. Three treats a day and the daily trust cap limit the harm.

### 23. Minor: Investigate sends cats to a new piece after it's gone, and to its top-left tile even when that is out of reach

- Where: server/src/world/cat_life.rs:285 (Investigate target) and 441-457 (settle has no check for Investigate); server/src/world/furniture.rs:253 (new_pieces is only pushed to)
- Scenario: Sam places a lamp at (3,3), then grabs it again 20 s later or puts it away. pick_up and put_away never prune new_pieces. For the rest of two minutes Tora's Investigate (her top option at 2.2) targets (3,3), and settle doesn't check the piece is still there. She sits on empty floor and logs "investigate on=floor". The target is also the piece's raw (x, y), not a pettable tile as spots() picks. Someone moves the cat tower and places it back at (0,1), whose neighbours are all wall or tower. Tora sits there for 10 s, and a pet answers "You can't get next to that cat from here", breaking the reach rule that cats_only_go_where_someone_can_reach_them guards. That test never moves furniture.
- Test: Not caught. Place a piece, grab it, and assert no cat settles into Investigate on the empty tile. Place the tower at (0,1) and assert every CatMoved end tile has a walkable neighbour.
- Skeptics: both could not refute it. Both reproduced both halves over 40 seeds in a throwaway copy.

### 24. Minor: A cat that came to play plays even if the toys were carried off, and every play is logged on=toys

- Where: server/src/world/cat_life.rs:452-455 (settle's Play arm), 283 and 513 (log_cat); server/src/world/handling.rs:152
- Scenario: Tora chooses Play and walks to the toys at (7,8). Sam grabs the toys. cats_jump_off skips walking cats, so Tora arrives on empty floor. Unlike Eat, Knock and Lap, settle's Play arm doesn't check the toys are still there, so she plays for 15 s, her play need reset, and logs "play on=toys". She'd also play with toys someone knocked over. Separately, a welcomed play with Sam logs "Tora: play (the toys)" wherever she is (finding 15).
- Test: Not caught. Lift the toys while Tora walks to them, tick to the walk's end, and assert her pose isn't Play. Add a log test that a handled play doesn't log on=toys.
- Skeptics: both could not refute it.

### 25. Minor: A cat that chooses again what it's already doing logs it again

- Where: server/src/world/cat_life.rs:302-313 with 395-421 (walk_cat: a one-tile path goes straight to settle) and 502-521 (log_cat)
- Scenario: Investigate scores 2.2 for Tora and doesn't drop once she has looked, and new_pieces keeps a piece for two minutes. With one person inside it wins about 60% of her choices. After each 10 s Investigate she chooses again. The target is her own tile, walk_cat gets a one-tile path and calls settle, and settle logs another line. One placement gives about 6 to 10 lines of "Tora: investigate (the lamp)". Perch repeats every 20 to 60 s while anyone waits at the window, and a still-tired cat logs "curled up on the sofa" again. Plan decision 2 asks for a line when a cat starts something, not each time it carries on.
- Test: Not caught. Place a piece with one person inside, tick two minutes under capture_logs, and assert at most one investigate line per cat per piece.
- Skeptics: both could not refute it. One estimated 4 to 6 lines from Tora per placement, since wander steps fall between the repeats.

### 26. Minor: Targets for the new behaviours ignore other cats, so two cats end up on one tile or one lap

- Where: server/src/world/cat_life.rs:282-299 (food_for at 322-331, Play at 283, Investigate at 285, Knock at 286-298, Lap at 299), 250-255 (laps filter) and 447-450 (settle's Lap arm)
- Scenario: Every target from phases 1 and 2 skips tiles with another cat. None of the phase 3 targets do. At the 12:00 refill Mochi and Tora are both hungry. food_for gives both the bowls' top-left tile (10,9), and both eat there for 15 s, one drawn over the other. The same happens at the toys, a new piece or a plant. Laps race too: the laps list excludes only people whose lap is already set, and lap is set only on arrival. So two trusting cats can both choose one seated person, settle checks only that the person still sits there, and both set lap = Some(1).
- Test: Not caught. The lap test has one trusted cat. Two hungry cats with full bowls should settle on different tiles, and two cats at trust 90 with one seated person should never both have lap == Some(1). A "no two settled cats share a tile" check in the long seeded runs would cover both.
- Skeptics: none of the four could refute it (the behaviours and carrying reviewers both raised it). Two reproduced the double lap in a throwaway copy, in 5 and 12 of 40 seeds, once with all three cats. A skeptic on finding 6 saw it in 8 of 30 seeds.

### 27. Minor: Picking up a knocked-over piece stands it up in memory but doesn't save, so a restart while it's carried brings it back on its side

- Where: server/src/world/furniture.rs:159-162 (pick_up) and 441-452 (arrangement_json); server/src/world/mod.rs:311-332 (save doesn't write the arrangement)
- Scenario: Burakku knocks over the lamp, and knock_over saves toppled: true. Sam grabs it. pick_up sets toppled false and broadcasts it upright, but never calls save_arrangement. The periodic save and the save on stop write cats, bowls and saved_at, not the arrangement. If a deploy happens while Sam carries the lamp, restore puts it back at its old place, toppled. Had Sam's connection dropped instead, put_back would have put it down upright and saved. Any other furniture change while it's carried would also save it upright, so the bug needs a restart with no furniture change in between.
- Test: Not caught. Knock a piece over, grab it, and assert the stored arrangement has it upright.
- Skeptics: both could not refute it.

### 28. Minor: Cat lines name the rug instead of the piece standing on it

- Where: server/src/world/cat_life.rs:505 (log_cat uses piece_at), with server/src/room.rs:398-400 and 361-365
- Scenario: log_cat takes `on` from piece_at(cat.at), the first piece covering the tile. Pieces put on the rug come after it in the list, because put appends and restore puts rugs first. When Burakku knocks over a plant on the rug, the line is "knock_over on=rug", narrated "Burakku: knock over (the rug)". A nap on a cushion on the rug gives "Mochi curled up on the rug", and a box on the rug gives "Burakku hid in the rug". For a knock, the plan already holds the piece id. The root cause is the same as finding 4's.
- Test: Not caught. Put a plant on the rug, force a Knock, and assert the line has on=plant.
- Skeptics: both could not refute it.

### 29. Minor: The lap threshold is a hard-coded 80, not the tuned trust level

- Where: server/src/cats.rs:189-190 and 231-233; content/tuning.toml (trust_levels); server/src/trust.rs:87
- Scenario: tuning.toml labels trust_levels[2] "naps on your lap", and TrustBook shows Devoted at that level, but options() checks the constant LAP_TRUST = 80.0. Greeting, coming when named and passing all read their level from tuning. Retune trust_levels to [20, 50, 70] and a visitor at 75 is told Mochi adores them, but she never takes their lap.
- Test: Not caught. only_trust_of_eighty_earns_a_lap pins the constant. Use a tuning whose third level is 70, set trust 75, and expect a lap.
- Skeptics: both could not refute it. With today's tuning the two numbers match, so it only shows after a retune.

### 30. Minor: Cats knock things over only in an empty café, not in Burakku's prowling hours, and the test credits any cat's knock to her

- Where: server/src/cats.rs:228-230; server/src/world/cats_tests.rs:338
- Scenario: Plan decision 5 says a cat knocks over a small piece "when the café is empty or it's her prowling hour". options() offers Knock only when nobody is inside, scored by curiosity x alone_activity: Tora 0.3325, Burakku 0.336. At 23:00 with two visitors inside, Burakku (awake 21:00 to 05:00) never knocks anything over, and per choice Tora is as likely to knock as she is. burakku_knocks_something_over_in_an_empty_cafe_and_anyone_can_stand_it_up runs 10:00 to 11:00 and accepts any FurnitureToppled. The plan's "Burakku knocks things over at night" test doesn't exist.
- Test: Not caught. Assert from the cat line that the knocker is Burakku, and add an options() test at 23:00 with someone inside.
- Skeptics: one could not refute it. The other refuted it: design.md, the settled spec, gives Burakku "when the café is empty: prowls and knocks things over" and never adopted the plan's wording. In 6-hour empty-café runs Burakku knocked 60 times to Tora's 25 by day and 531 to 81 at night, and the test's first knock was Burakku's. What is left is test robustness.

### 31. Minor: A cat napping on a lap is drawn under its person

- Where: client/src/render.ts:96-103 and 113-114 (draw order); compare the held cat at 118
- Scenario: Burakku naps on Jo's lap, with pose Nap on Jo's seat tile. render.ts sorts by row, the cat at spot.y + 0.1 and the person at spot.y + 0.2, so Jo is painted over Burakku. A held cat is drawn over its holder on purpose, but a lap cat isn't, and CatView has no lap field to tell one apart. Laps are the top trust unlock.
- Test: Not caught. Nothing tests the client's drawing.
- Skeptics: one could not refute it. Both overlaid the sprites and found about 30 of the nap sprite's 85 pixels still show, head and ears included, so the cat peeks out from behind the person rather than vanishing. The other refuted it on that basis, and as art-pass work for phase 5.

### 32. Minor: Menus offer several new actions the server always refuses

- Where: client/src/menus.ts:38-46 and 63 (armsFull used only for Pick up); client/src/panels.ts:19
- Scenario: (1) While holding a cat, a chair's menu still offers "Move the chair", though menuFor works out armsFull, and grab refuses with "Your arms are full." "Add furniture" does the same through take. (2) For a cat someone else holds, reached in practice through its phantom tile (finding 2), the menu offers Pet, Offer and Play, each refused with "sam is holding Mochi." (3) Someone at the window sees "Put a treat down", and put_treat refuses them. The server is right every time, but each costs a click and an error toast.
- Test: Partly. menus.test.ts checks only that Pick up is hidden with full arms.
- Skeptics: both could not refute it. Case (3) was also raised alone by another reviewer and refuted by both its skeptics, who said the client never hides actions from someone at the window and leaves them to the server's "From the window you can only talk." (see Refuted).

### 33. Minor: In layout B a ring opened by keyboard is pushed away from its target

- Where: client/src/main.ts:117-121 with client/src/input.ts:134-136 and client/src/stage.ts:100-108
- Scenario: On a 390-wide phone in layout B you stand at x=10. Arrow and Tab move the pointer to a cat at x=1, and the room pans to show it. Enter opens the ring and focus moves to its first button. The canvas blur handler hides the pointer, so the next frame pans back to your avatar, an offset of 186 px, which puts tile 1 at about -114 px. The pan hook calls moveRing, and ringPositions clamps the ring's centre to the screen edge, so the ring circles something around tile 6 or 7. The pointer outline is gone too. The new "follow the tile" fix keeps the ring on screen but loses which thing it belongs to when the target is far from you.
- Test: Not caught. browser.test.ts checks only that ring buttons lie on screen and between the bars, not that the ring surrounds its tile.
- Skeptics: both could not refute it. The buttons still act on the right target, so the fault is where the ring is drawn.

### 34. Minor: Three checks that Task 8 planned are missing, and the execution log doesn't say so

- Where: spec/cats.test.ts, spec/browser.test.ts:158-165, docs/notes/plan-phase-3.md (execution log, Task 8)
- Scenario: Plan Task 8 asks for black-box checks that "a banned pet says how long" and that "the log line rules hold for an action sent by a visitor (by the app's own output in CI)", and a browser check of "offering a treat by keyboard". spec/cats.test.ts tests welcome treats, put-down and give, and its header leaves grudges to cargo test. CI prints docker logs only on failure and checks no line. The only browser treat check clicks the panel button with the mouse, and no browser test offers, plays with, picks up, puts down or passes a cat. The Task 8 log entry mentions only the keyboard pass, so the dropped checks look done. These gaps let findings 2 and 3 through CI.
- Test: Not applicable. This is the missing coverage.
- Skeptics: both could not refute it. Both noted cargo test covers the ban's time left and the log rules, so the behaviour isn't unchecked. Neither checked the claim about findings 2 and 3. A narrower finding about the ban check alone was refuted by both its skeptics, who read design.md's "Checks" section as giving bans to cargo test on purpose (see Refuted).

## Refuted

- Actions from someone walking out after a nudge are dropped with no line and no reply (server/src/world/mod.rs:204): both refuted. Dropping them is a phase 1 decision (ADR 0009) with its own test. A dropped message does nothing, so plan decision 1 asks no line for it, and the walk_out and departure lines already tell the story.
- Passing a cat ignores the recipient's bans and anger, and each pass resets the cat's patience (handling.rs:305-318): both refuted. design.md limits the one handling rule to pet, play, offer and pick up, and gives passing its own trust-20 rule. A pick_up ban covers the banned person picking up, not someone else passing. Finding 5 keeps the same issue on plan decision 7's wording.
- The plan's black-box check that a banned pet says how long is missing: both refuted. design.md's "Checks" gives ban lengths to cargo test, spec/cats.test.ts says why, and the world and store tests cover the time left and a restart. Only the execution log's silence remains (finding 34).
- Each pass restarts the hold clock, so two people can keep a cat held as long as they like: both refuted. design.md bases the hold on trust in the current holder and sets no total across holders. It is a balance question, not a defect.
- Standing a toppled piece up works with your arms full: both refuted. The arms-full rule is about carrying, and tidying stands the piece up where it is. Plan decision 9 lets anyone tidy.
- refill_key needs bowl_refills sorted and non-empty, and tuning.toml is never checked: both refuted. The shipped list is sorted and matches design.md, and no tuning number is range-checked. It needs a bad future edit, so it is hardening, not a bug.
- Someone at the window is shown a "Put a treat down" button the server refuses: both refuted. The client never hides actions from the window and leaves them to the server's "From the window you can only talk.", which is the designed feedback. The same case survives as part of finding 32.
- A tidy that arrives after someone else stood the piece up ends silently: both refuted. The broadcast already tells the second person what happened, and every arrival failure goes unlogged alike. Finding 8 keeps that wider logging gap.
- How full the bowls are is hard-coded to three portions, and the drawing can't tell three from two: both refuted. bowl_portions is 3 in tuning and in design.md, and the plan asks the room only for full or empty. The coupling bites only after a retune.
