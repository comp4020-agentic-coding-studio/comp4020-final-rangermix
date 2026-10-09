# Findings: review of phase 2

Brief: phase-2-brief.md. Method: six reviewers by dimension, two skeptics per finding; a finding is kept if at least one skeptic could not refute it.

## Findings

### 1. Major: Reconnecting inside the grace period doesn't reset quiet state, and a pending nudge is not resent

- Where: server/src/world/people.rs:42-45 (join reconnect branch), quiet.rs:12-31
- Scenario: (a) A phone user backgrounds the tab, so the socket drops while hidden_since is set. They return within the 30s grace period. join() only clears away_since. The client's welcome handler sends presence only when document.hidden, so a visible reconnect never sends hidden:false and hidden_since stays old. With someone waiting, they are nudged on the next tick even though they just came back. (b) If a nudge was outstanding (nudged=Some) when they reload, the new Cafe has no dialog, because the Welcome and snapshot do not carry the nudge and the server never resends StillThere. The server still has nudged=Some, so an active person walks out 60s after the original nudge without ever seeing a question. Join is not treated as a sign of life, since heard_from is not called for it.
- Test: Rust test: full(), nudge player 1 at 10*MIN, then Drop and Join player 1 at 10*MIN+10s (or Presence hidden:true, Drop, Join). Assert that either NudgeOver or a fresh StillThere is sent to 1, and that hidden_since and last_input are reset. A browser test could reload while the dialog is showing.
- Skeptics: both could not refute it.

### 2. Major: A carrier can end up holding two pieces (take or grab during a grab walk)

- Where: server/src/world/furniture.rs:130-155 (pick_up), :158-180 (take)
- Scenario: A sends Grab(P) from across the room and is walking, with pending Grab(P). Before arrival A sends Take{kind}. take() passes because holding(A) is None, pushes a new Held and never calls start_walk, so the pending Grab stays. When the walk ends, pick_up() has no holding check and lifts P as well. A now has two Held entries, but holding() sees only the first. put_back, put_away and place remove one, and the other stays held indefinitely, hidden from the UI and locked out for everyone else. It also uses up furniture_max slots.
- Test: World test: grab(far piece), then take, then tick past walk_end and assert held.len()==1 for that person.
- Skeptics: both could not refute it.

### 3. Major: PutBack with nothing in hand clears the reservation but not the pending grab, so the first grab no longer wins

- Where: server/src/world/furniture.rs:208-210 (put_back) with :130-133 (pick_up) and people.rs:216-236
- Scenario: A sends Grab(P) and starts walking, with P reserved to A. A sends PutBack. put_back runs reserved.retain(..) and returns, but p.pending is still Grab(P). B then grabs P, which is no longer reserved, so B reserves it and walks. A arrives first and pick_up lifts P regardless, since pick_up only checks that the reservation is A's before removing it. B's walk later fails with a "not here" error. The walk was never cancelled and the reservation was dropped, so the two disagree.
- Test: World test: grab(A), put_back(A), grab(B), tick A to arrival. Assert that A holds nothing, or that A is refused.
- Skeptics: both could not refute it. The shipped client probably sends PutBack only when carrying, but a stale or modified client can send it at any time.

### 4. Major: Layout B pan follows only your avatar, so the keyboard pointer and Tab targets go off-screen

- Where: client/src/stage.ts:88-105 with client/src/input.ts:96-109,115-124
- Scenario: At 390x844 in layout B (3x, 8 tiles visible across), a keyboard user presses ArrowRight several times, or Tabs to a cat 10 tiles away (cycleOrder is nearest-first across the whole room). pointer.tile moves, but pan() keeps centring on the avatar, so the highlighted tile is outside the viewport. The user cannot see where Enter will act. For a carried piece the pointer starts at the piece's old tile, which can also be off-screen. If the tile has a target, ringPositions clamps the ring to the screen edge, so it appears detached from its target. This breaks the "every action works by keyboard at 390x844" rule.
- Test: Browser test in layout B that presses Arrow keys or Tab and asserts the pointer tile's screen rect (tileToCss plus canvas rect) is inside the viewport.
- Skeptics: both could not refute it. Neither ran a browser test.

### 5. Minor: Pressing Leave can show the "you'd gone quiet" message instead of "You've left"

- Where: client/src/main.ts:228-231,53-62 with client/src/cafe.ts:57-60,152-155
- Scenario: leave() sends {type:leave} and keeps the connection open for 100ms. The server's personLeft for you arrives inside that window, and state.ts returns youLeft for any own personLeft. Cafe.handle then calls hooks.onWalkedOut(), which calls showLeft("You'd gone quiet while someone was waiting..."). The Leave click handler's own showLeft() runs first, and the late personLeft overwrites the text. The same message also appears for a grace-period timeout or any other removal.
- Test: Client test: call cafe.leave() with a fake connection that echoes personLeft and assert that #left-text still reads "You've left the café". Or track a "leaving on purpose" flag in Cafe.
- Skeptics: both could not refute it.

### 6. Minor: A window person whose connection dropped still counts as waiting

- Where: server/src/world/quiet.rs:34
- Scenario: waiting is any person with Place::Window and does not check away_since. G at the window drops (a phone locks). For up to the 30s grace period every idle inside person is nudged, with a 60s answer timer, for a seat nobody is there to take. If the nudge goes out just before G's grace expires, it is cancelled by the !waiting branch, and the inside person saw a spurious dialog. promote() has the same flaw.
- Test: Rust test: full(), Drop for 7, then others_active and a tick at 10*MIN. Assert no nudges while 7 has away_since set.
- Skeptics: both could not refute it.

### 7. Minor: Arrival actions do not check the person still exists or is not leaving

- Where: server/src/world/furniture.rs:130 (pick_up) and server/src/world/mod.rs:203-212, 216-218
- Scenario: In one tick, people_tick collects arrived=(id,Grab(P)) and then removes the same person (grace expired, or walked out). The tick loop then calls pick_up for the removed id. It lifts P into a Held owned by a person who no longer exists, nobody can put it back, and the piece vanishes from the room until restart. It needs the walk's end and the expiry to land in the same tick, so it is rare.
- Test: Set away_since so the grace expires on the tick where the grab walk ends, then assert that held is empty and P is still in room.pieces.
- Skeptics: both could not refute it.

### 8. Minor: A disconnected or walking-out carrier keeps the piece locked for the whole grace period or walk

- Where: server/src/world/people.rs:92-97 (drop_connection) and quiet.rs:66-80 (walk_out)
- Scenario: A takes a table, then closes the tab. The piece stays in A's hands for grace_secs, and for the walk-out duration when A is nudged. Other visitors get "A has it" for that time, and the piece counts towards furniture_max. docs/design.md says a disconnected carrier's piece drops back where it was, so the code departs from the design's wording. The lock is bounded, not permanent. Putting the piece back when the connection drops, or at walk_out, would remove it.
- Test: take, then Drop, then grab by another person during the grace period, and assert whichever behaviour the design chooses.
- Skeptics: one could not refute it. The other refuted it as deliberate and bounded (seat held for a reconnect).

### 9. Minor: A blocking piece can be put down across a walker's remaining path (and on a cat)

- Where: server/src/world/furniture.rs:37-46 (occupied), :182-196 (put_down); server/src/room.rs:225 (check_place)
- Scenario: occupied() lists only each person's current tile and final destination, never mid-path tiles and never any cat. A person whose planned path crosses T before its end is not protected, so a table placed on T is accepted with no repath, and on screen the walker passes through furniture. A cat on T is also not moved, since cats_jump_off is called only from pick_up. The brief names "a piece placed where a cat or a person is walking" as an input to trace.
- Test: World test with a walker whose path crosses T and a person placing a table at T; assert the walk is re-planned or the placement refused. Add a test with a cat idling on T.
- Skeptics: both could not refute it. One judged the cat half probably by design, since room.rs lets cats walk over all furniture. Only the walker part is clearly a bug.

### 10. Minor: Sitting is not exclusive with carrying

- Where: server/src/world/furniture.rs:76-102 (grab), :145-173 (take), :260-275 (put_away), :277-296 (sit), with go_beside :65-74 and people.rs:216-226 (start_walk)
- Scenario: A person sits on a bench, then sends Grab for an adjacent movable piece. go_beside sees !walking and beside(piece, seat), so pick_up runs at once and no start_walk runs. start_walk is the only place sitting is cleared, so p.sitting stays Some and person_view still reports sitting=true while they carry the piece. take() and put_away() never stand the person up. take() also leaves an earlier Pending::Sit in place, so sit_down can later run with a piece in hand, even though sit() refuses to start while carrying.
- Test: furniture_tests.rs: sit, then Grab an adjacent piece, then assert p.sitting is None or the grab is refused. Second case: Sit then Take while walking, then tick, then assert not (sitting && holding).
- Skeptics: both could not refute it.

### 11. Minor: A person and a cat can share one tile: seats ignore cats and cat spots ignore sitters

- Where: server/src/world/furniture.rs:298-327 (free_seat/sit_down) and cat_life.rs:~205-215 (spot choice uses cat_on only), settle :250-295
- Scenario: Mochi is napping on a one-tile cushion, which has seats=true. A visitor sits there, and free_seat only checks other sitters, so sit_down puts them on the cat's tile. In the other direction, a cat picks a nap or hide spot filtered only by cat_on, so it can nap on the tile where a person is seated. The client draws them overlapping. cats_jump_off runs only on lift, and sitters block lifting, so the cat is never moved off.
- Test: Put a cat in Pose::Nap at a cushion tile, call sit/sit_down on that cushion, and assert the seat is refused, the cat is moved, or the tiles differ.
- Skeptics: both could not refute it.

### 12. Minor: Placing, or restoring, a blocking piece onto a standing cat leaves the cat inside it

- Where: server/src/world/furniture.rs:184 and :200 (check_place called with occupied people only), room.rs:245-257; room.rs:352-364 (restore) with cat_life.rs:83-90 (place_cat)
- Scenario: A cat is idle or napping at (x,y). Another visitor places a blocking table on that tile. occupied() lists people only, and check_place accepts it. Nothing moves the cat. After a restart the same happens, since restore() passes &[] for occupied before place_cat. Plan item 5 says a blocking piece may not cover "anyone" standing or heading there.
- Test: Put a cat on a tile, place a blocking piece there, and assert the cat is displaced or the placement refused. Or record in the plan that cats on furniture is accepted.
- Skeptics: one could not refute it. The other refuted it, because room.rs lets cats walk any Floor tile, so a cat on a table is a normal state. This overlaps finding 9.

### 13. Minor: Sitting on a piece someone is walking to grab wastes their walk; a lone sitter can lock a piece

- Where: server/src/world/furniture.rs:76-102 and :104-115 (can_lift), :277-296 (sit)
- Scenario: A starts Grab on a chair, which reserves it, and walks over. B sends Sit on the same chair. sit() does not consult self.reserved, so B walks over and sits. When A arrives, pick_up fails can_lift with "Someone's sitting on it." and A's walk is wasted. Separately, a connected but idle sitter keeps the piece unliftable. Quiet nudges happen only when someone waits at the window, so with no queue it is never freed.
- Test: Partly. A test could check that sit is refused on a reserved piece. The lock-in is a design question rather than a unit-testable bug.
- Skeptics: both could not refute it. Neither verified the idle-sitter lock-in.

### 14. Minor: Arrow keys while carrying start from the avatar, not the piece's old place

- Where: client/src/main.ts:164-172 with client/src/input.ts:92-99
- Scenario: Pick up a piece with Move. The carrying hook sets stage.pointer.tile to the piece's old spot but leaves pointer.visible false. The first arrow press in onKey sees pointer.visible false, so it uses myTile() as the origin with step [0,0]. The pointer jumps to the avatar's tile and the stored piece tile is discarded. The ghost preview uses stage.pointer.hover while the pointer is hidden, so a keyboard-only carrier sees no preview until the first arrow. The code comment says otherwise.
- Test: Unit test of the key handler with a held piece and a hidden pointer.
- Skeptics: both could not refute it.

### 15. Minor: Hard-coded 100-character limit, and the box is cleared before the server accepts the line

- Where: client/src/talk.ts:12 and 41-47
- Scenario: MAX_CHARS is a client constant while the server limit is tuning.bubble_max_chars, so the two drift when the tuning changes. The input is cleared as soon as the message is sent. If the server refuses it (the person left, or the line was empty after trim), only a toast appears and the typed text is lost, although the not-connected path promises "Your words are still here".
- Test: Unit test with a fake Speaker that refuses the line.
- Skeptics: both could not refute it.

### 16. Minor: state.emotes entries are never removed when a person leaves

- Where: client/src/state.ts:109-116 and the emotes map
- Scenario: personLeft deletes the person but not state.emotes[id]. The map grows with every visitor who emoted during a long-lived tab. It is bounded by the number of visitors and is harmless to rendering.
- Test: Unit test on apply for personLeft.
- Skeptics: both could not refute it.

### 17. Minor: Ring is positioned once and goes stale after pan, walking or resize

- Where: client/src/menu.ts:68-82
- Scenario: A ring opens round a cat in layout B. Menus are not repositioned and nothing closes them on resize or when the bars change height (for example when the carrying bar appears). The room pans under the ring, so its buttons no longer sit round the cat, and the free-area clamp computed from the bars' old rects can leave buttons under them. Escape or choosing an action still works, so it is cosmetic.
- Test: Open a ring, resize or move the avatar, assert the ring centre still matches the target's tileToCss.
- Skeptics: both could not refute it.

### 18. Minor: Ring buttons overlap when a tile has 5 or more actions

- Where: client/src/menu.ts:81 and client/src/style.css (.menu.ring button)
- Scenario: menuFor can list Pet and Call per cat, Talk per person, and Move and Sit per piece, so a tile with a cat, a person and a piece gives 5 and two cats plus a piece gives 6. Buttons are 88px wide on a fixed radius of 72. At n=5 the two bottom buttons are about 84px apart, so they overlap by about 3px. At n=6 the overlap is about 16px, and labels become partly covered or hard to tap.
- Test: Unit test on ringPositions asserting no two button boxes overlap for n up to 6, or that the radius scales with n.
- Skeptics: both could not refute it.

## Refuted

- A test gap: Layout B checks cover only the toggle. One skeptic upheld it as in scope (the brief names layout B at 390x844 with a resize). The other refuted it, since a missing test is not wrong code. It is kept as finding 19 below.
- A promoted person keeps stale last_input and hidden_since: both refuted. A stale tab being nudged and walked out is the quiet seat working as designed (ADR 0009), and resetting timers would give an away tab extra seat time.
- If the walk-out path to the door can't be found, the leaver teleports: both refuted. check_place and all_reachable keep every tile connected to the door, so the fallback is defensive code that should not run.
- Restore drops pieces that no longer fit: both refuted. Dropping is the documented behaviour of restore(), and the scenario needs a later content change.
- Touch and layout B give no placement preview: both refuted. It is a deliberate tap-to-act model; the server validates and refuses bad drops. At most polish.

### 19. Minor: Layout B checks cover only the toggle, not pan, ring, resize or keyboard

- Where: spec/browser.test.ts:111-124
- Scenario: The only layout B test taps the switch, checks the room width is 576px and that it persists after a reload. Nothing checks that the avatar stays centred, that the room is clamped at its edges, that a ring opens by touch within the bars, or that resizing 390x844 to 1920x1080 and back from layout B restores the right layout. A regression in any of these ships green.
- Test: Add browser tests for those cases. The pan maths in layout.ts is also easy to unit test.
- Skeptics: one could not refute it. The other refuted it as a test gap rather than wrong code.

## Answered

Triaged 2026-10-09, each confirmed by reading the code first; behaviour
fixes went in test first.

| # | Outcome |
|---|---|
| 1 | Fixed: coming back on a new connection answers "still there?" and forgets an old hidden tab (`4595f6f`). |
| 2, 3 | Fixed: a grab on the way is called off by a take, a put back or a dropped connection, and a pickup happens only on its own reservation (`4595f6f`). |
| 4 | Fixed: layout B follows the keyboard's pointer while it's out (`fc32dc5`). |
| 5 | Fixed: Leave keeps its own note (`fc32dc5`). |
| 6 | Fixed: a dropped connection at the window isn't waiting (`4595f6f`). |
| 7 | Fixed: nothing happens on arrival for someone gone or walking out (`4595f6f`). |
| 8 | Fixed: a dropped connection or a walk-out puts back what was carried at once, as design.md says (`4595f6f`). |
| 9 | The walker half fixed: a blocking piece can't land on any tile left on someone's way (`4595f6f`). The cat half is by design: cats walk and sit on all furniture. |
| 10 | Fixed: taking or grabbing gets you up first (`4595f6f`). |
| 11 | By design: a cat may nap on a seat beside or under a sitter; laps are phase 3's. |
| 12 | Sitting on a piece someone is coming to carry is now refused (`4595f6f`). A seat in use can't be carried, by decision 8; the sitter moves it by getting up. |
| 13 | Fixed: carrying, a keyboard user's pointer starts on the piece (`fc32dc5`). |
| 14 | Not taken up: the box's 100 matches the tuning, and the server's refusal is shown; keeping the text until the server accepts it would need an acknowledgement message, for little gain. |
| 15, 17, 18, 19 | Fixed (`fc32dc5`). |
