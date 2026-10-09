# Findings: review of phase 1

Brief: phase-1-brief.md. Method: six reviewers by dimension, two skeptics per finding. A finding is kept if at least one skeptic could not refute it.

## Findings

### 1. Major: half-open connection holds its seat past the grace period

- Where: server/src/ws.rs:180-221
- Scenario: A phone sleeps or loses its network without sending a TCP FIN. The connection loop breaks only when a write errors or a close frame arrives. The 25 s ping is a write into the kernel buffer and succeeds until TCP retransmit gives up, which usually takes several minutes. There is no pong or idle-read timeout. So Command::Leave never reaches the world, away_since is never set and the grace timer never starts. The ghost keeps an Inside seat while real people queue at the window, because promote() only runs when someone is removed. This undermines Review Focus 2. If the phone returns, the new socket's Join replaces the dead one.
- Test: A real socket that goes silent (stops reading and answering pings), asserting the person is removed within grace_secs plus a margin. None exists. A unit test of an idle-read timeout would also catch it.
- Skeptics: 0 of 2 refuted. Both confirmed no pong tracking or idle-read timeout exists in server/src, and the design does not exclude the case.

### 2. Major: rate-limit keys use the unvalidated name, so huge names exhaust memory

- Where: server/src/api.rs:62-72 (guard), server/src/limits.rs:53-63
- Scenario: guard() runs before valid_username and inserts name.to_lowercase() as a by_name key. Axum's default Json limit is 2 MB and no DefaultBodyLimit is set. One address can send 60 requests a minute, each with a distinct ~2 MB name. Keyed::take prunes only above 10,000 keys, and only keys idle for 10 minutes, so about 600 keys (about 1.2 GB) stay live. The 256 MB machine is OOM-killed and everyone is dropped. Login and recover never check name length either.
- Test: An api test that posts a 1 MB name to /api/login, asserts a 400 or 413, and asserts by_name has no new key. Or the same test with DefaultBodyLimit.
- Skeptics: 0 of 2 refuted. Both confirmed guard() runs before validation and no body limit is set. The 1.2 GB figure is an estimate.

### 3. Major: anyone can lock a named user out of log-in and recovery

- Where: server/src/api.rs:62-72, content/tuning.toml:28
- Scenario: The per-name bucket (5 a minute) is spent by any request naming that user, from any address, genuine or not. An attacker sends 5 bad logins a minute for "victim", and the victim's real login and recovery share the emptied bucket. The same applies to signup: a squatter can block a name from being claimed.
- Test: 5 failed logins for a name from IP A, then a correct login from IP B, expecting success. This needs a design change, for example counting only failures, or keying the name bucket on name plus IP.
- Skeptics: 0 of 2 refuted. Both confirmed nothing mitigates it. Both also noted the design only says limits are per name and per address.
- Note: A separate reviewer's version of this finding was dropped as "as designed" (see Refuted). The skeptics here judged that the design does not accept third-party lockout, so it is kept.

### 4. Major: after leaving and coming back, the talk box sends nothing

- Where: client/src/talk.ts:13 with client/src/main.ts:52
- Scenario: enter() builds a new Talk each call, and the constructor adds a submit listener to the persistent #talk form. After Leave then Come back (or sign out and in), two Talk instances listen. The old one fires first. Its Connection was stopped (ws=null), so send() is a silent no-op, and it then clears the input. The new Talk sees an empty input and returns. Every message in the second visit vanishes with no error. The chip click listener is doubled too, which is harmless.
- Test: A jsdom test that builds a form, constructs two Talks (the first on a stopped Cafe), submits once, and expects the live Cafe's send to be called. The fix is a single listener, or a cleanup called in stop().
- Skeptics: 0 of 2 refuted. Both confirmed nothing removes the listener.

### 5. Minor: rate-limit buckets belong to the connection, so reconnecting resets them

- Where: server/src/ws.rs:176-178
- Scenario: Each connection() creates fresh speech, actions and furniture buckets. A client that reconnects gets a fresh burst of 5 bubbles and 10 actions, and Join is not throttled. A script can reconnect in a loop to bypass the 2 s bubble refill. Each reconnect costs a session lookup and a full snapshot.
- Test: A ws integration test that spends a burst, reconnects, and expects the next say to still be rate limited.
- Skeptics: 1 of 2 refuted. One said per-connection buckets are the settled design (docs/design.md lines 232-234). The other said the design elsewhere says limits are per person, and the case is not out of scope. Kept as minor.

### 6. Minor: the furniture rate limit is per connection, so a reconnect resets it

- Where: server/src/ws.rs:178 and 203-205, content/tuning.toml:13-14
- Scenario: The furniture bucket is burst 3, then one move every 20 s, created per websocket. After "Slow down", a new tab or reload gives 3 more moves. Each accepted move broadcasts FurnitureMoved and writes the arrangement to SQLite. The by_name and by_ip limits cover the auth endpoints, not a websocket reconnect with an existing session.
- Test: A ws test that disconnects, reconnects and sends 3 more moves.
- Skeptics: 1 of 2 refuted. One cited ADR 0004 (per-connection buckets are settled). The other found that the join-endpoint limits do not cover a reconnect with a live session. Same root cause as finding 5.

### 7. Minor: an explicit leave leaves the connection registered in conns

- Where: server/src/ws.rs:71-77 and world/people.rs:92-103
- Scenario: ClientMsg::Leave removes the person and broadcasts PersonLeft, but conns still holds the connection, which keeps receiving broadcasts. The server relies on the client closing the socket 100 ms later (cafe.ts leave()). If the message is sent while the socket is reconnecting, send is a no-op and the person keeps the seat for the full grace period although the UI said they left. World state stays consistent.
- Test: A ws integration test that sends leave and asserts the server closes the socket and a window person is promoted.
- Skeptics: 0 of 2 refuted. One skeptic did not read send() itself.

### 8. Minor: cats are restored against the starting layout, before the saved furniture is applied

- Where: server/src/main.rs:30-39 with server/src/world/cat_life.rs:83-86
- Scenario: main.rs builds World::new, which calls place_cat and checks each saved cat tile with room.pettable, and only then calls restore_arrangement. A cat can come back on a tile no person can stand next to in the restored layout, so it cannot be petted until it wanders off. The reverse also happens: a cat whose tile was pettable only in the moved layout is sent to a random floor tile.
- Test: A world test that saves a cat on a tile, restores an arrangement that encloses it, then re-places the cat. Better: restore the arrangement before placing cats, and assert the tile is pettable.
- Skeptics: 0 of 2 refuted.

### 9. Minor: a negative trust change creates a "met" record

- Where: server/src/trust.rs:56-62 with server/src/world/cat_life.rs:296-311, 363-365
- Scenario: TrustBook::apply inserts a record before checking the sign of delta, and has_met is true whenever a record exists. A person pets a hiding cat they have never met. The cat refuses. They pet it again within 10 seconds, which counts as pushing, and change_trust(-1.0) creates a zero-value record. has_met is now true and the cat never sniffs this person's hand. After a restart the record is gone, so the first-meeting behaviour depends on whether the server restarted.
- Test: A trust unit test: apply(cat, rate, person, -1.0, day), then assert !has_met. Add a cat_life test that pets a hiding cat twice and then again after it comes out, expecting a Sniff.
- Skeptics: 0 of 2 refuted.

### 10. Minor: the talk box counts UTF-16 units, so emoji messages are cut at 50

- Where: client/index.html:83 (maxlength="100" on #talk-input)
- Scenario: The server counts characters (chars().count()) and accepts 100 emoji. The input's maxlength counts UTF-16 units, so 100 emoji are cut to about 50, silently. The Review Focus 4 promise that emoji count as one character each is not met in the UI. One skeptic noted the brief file does not mention emoji.
- Test: A jsdom or Playwright test that pastes 100 emoji and expects 100 to be accepted. The fix is to drop maxlength and check [...text].length in Talk.send(), or leave it to the server's TooLong error.
- Skeptics: 0 of 2 refuted.

### 11. Minor: speech is dropped silently while disconnected, and the addressee chip is not cleared

- Where: client/src/talk.ts:32-37 with client/src/net.ts:35-37
- Scenario: While the Connection is reconnecting or replaced, Connection.send() does nothing, yet Talk clears the input, so the text is lost. Walk, pet and call clicks are swallowed too. Talk.to is never reset when the addressed person leaves, so the next say gets "They've left." after the text was already cleared.
- Test: Send while the connection is closed and expect the input to be kept or an error shown. Expect the chip to clear on personLeft.
- Skeptics: 0 of 2 refuted.

### 12. Minor: a reconnect welcome wipes "said this visit"

- Where: client/src/cafe.ts:111 with client/src/state.ts fromWelcome
- Scenario: A phone sleeps and reconnects within the grace period. fromWelcome replaces the whole state with said: [] and bubbles: [], so the panel the person was reading is emptied. The seat is kept but the visit history is lost. The server never stores speech, so only the client can keep it.
- Test: Apply "said", then a second welcome, and expect the lines to survive.
- Skeptics: 0 of 2 refuted.

### 13. Minor: saved cushion positions are keyed by list position

- Where: server/src/room.rs:123-170 (id: i as u32 + 1), restore at room.rs:249-255
- Scenario: Pieces get their id from their index in room.toml. restore() accepts a saved entry when id and kind match. If two cushions are reordered, or a piece is inserted before them, a saved position lands on the wrong cushion. Latent with one cushion.
- Test: Restore a saved arrangement into a room with two same-kind pieces in swapped order.
- Skeptics: 0 of 2 refuted.

### 14. Minor: a refused placement still uses a rate-limit token

- Where: server/src/ws.rs:196-205 with server/src/world/furniture.rs:13, and client/src/main.ts:66-70
- Scenario: The bucket is taken before the world validates the move. Three clicks on the walkway (7,1-3) are refused with CantPlace but use all 3 tokens. The 4th move onto a valid tile gets RateLimited, and the next token takes 20 s. The client also calls stopPlacing() as soon as it sends, so each retry means reopening the menu.
- Test: A bucket-plus-world test that sends 3 refused moves and then 1 valid one.
- Skeptics: 1 of 2 refuted. The refuting skeptic called it a tuning and UX trade-off. The other confirmed the token is not refunded.

### 15. Minor: restore() applies saved placements one at a time against default positions

- Where: server/src/room.rs:249-255
- Scenario: With two or more movable pieces, if piece A was saved on piece B's default tile and B was saved elsewhere, applying A first fails with "Something's already there" and A is skipped. Latent: the cushion is the only movable piece today.
- Test: A room test with two movable pieces that swap places and are then restored.
- Skeptics: 1 of 2 refuted. The refuting skeptic called it hypothetical. The other confirmed the code path.

### 16. Minor: fly-client-ip is trusted from any caller

- Where: server/src/http.rs:81-87 (client_ip)
- Scenario: The header is used without checking the request came through Fly's proxy. Anyone who reaches the app port directly (local runs, the docker image on :8080, an internal Fly address) can send a different value each request and get a fresh per-IP bucket. On Fly's public edge the proxy overwrites the header.
- Test: Two requests with different fly-client-ip and the same peer, limited as one client when not behind the proxy. This needs a config flag for trusting the proxy.
- Skeptics: 1 of 2 refuted. The refuting skeptic said the public path is safe and this is hardening.

### 17. Minor: expired sessions are never deleted

- Where: server/src/store.rs:206-221, server/src/api.rs:104-117
- Scenario: session_user only filters on expires_at. Sessions are created on every signup, login and recovery with no cap per user, so the table grows without bound. The effect is slow database growth, not a security hole.
- Test: A store test that inserts an expired session, runs a purge, and checks the row is gone.
- Skeptics: 0 of 2 refuted.

## Refuted

- Speech, action and furniture limits reset on every reconnect (ws.rs): both skeptics said per-connection buckets are the settled design. Findings 5 and 6 were kept because another pass found one skeptic who could not refute them.
- Per-name auth bucket lets anyone lock a victim out (api.rs:64-81): both skeptics said the per-name bucket is specified in docs/design.md line 284. Finding 3 was kept on a separate pass.
- fly-client-ip trusted from any peer (http.rs:90-96): both skeptics said Fly's proxy overwrites the header on the public path. Finding 16 was kept on a separate pass.
- The "replaced" notice sent with try_send can be lost (ws.rs:63-67): the tab that missed it reconnects once, and the other tab then gets the notice, so no ping-pong.
- Session cookie is Secure only, so plain-http browsers drop it (auth.rs:78-80): settled in docs/design.md line 282 and ADR 0007, and production is https.
- Tab trapped on the canvas with no targets (input.ts:109-116): the cycle list always includes the local person, and Escape and blur hide the pointer.
- A bubble to someone who has left loses its "to" label (bubbles.ts:75): the window is about one animation frame, and the effect is cosmetic.

## Answered

Triaged 2026-10-09, each confirmed by reading the code before it was fixed.

| # | Outcome |
|---|---|
| 1 | Fixed: a connection silent for 60 s (two pings unanswered) is let go, so the grace period starts (`b21b06c`). |
| 2 | Fixed: a name too long to exist is refused before it becomes a limit key; request bodies capped at 16 KB (`b21b06c`). |
| 3 | Fixed: the per-name limit counts per name from one address; design.md's row changed with it (`b21b06c`). |
| 4 | Fixed: the talk box lets go of its form when a visit ends (`02ba73f`). |
| 5, 6 | Not taken up: design.md ("Real-time", "Limits before the world") makes the buckets per connection, and a reconnect costs a session check and a full snapshot, which the 60-a-minute address limit doesn't cover but Fly's connection limits do. Revisit if the logs show it. |
| 7 | Fixed: Leave lets go of the connection on the server (`b21b06c`). |
| 8 | Folded into phase 2 Task 5, which rewrites how the arrangement is saved and restored; cats will be placed after it. |
| 9 | Fixed: a dip in trust before a first meeting isn't a meeting (`b21b06c`). |
| 10, 11, 12 | Fixed in the client (`02ba73f`). |
| 13, 15 | Folded into phase 2 Task 5: the arrangement is saved by kind and place and restored as a whole. |
| 14 | Folded into phase 2 Task 5: placing becomes walk-then-put-down, and only an accepted change spends the furniture bucket. |
| 16 | Fixed: fly-client-ip is believed only on Fly (`b21b06c`). |
| 17 | Fixed: expired sessions are cleared when a new one starts (`b21b06c`). |
