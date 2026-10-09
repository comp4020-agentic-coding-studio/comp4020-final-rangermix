# Brief: the client's answers to phase 3's review

Phase 3's review ([phase-3-findings.md](phase-3-findings.md)) found five
faults in the client and two missing browser checks. This brief settles
what each answer is; build them test first. The server's findings are being
answered in parallel on `main`, so stay inside the files listed under
"Yours".

## Read first

- [phase-3-findings.md](phase-3-findings.md): findings 2, 3, 31, 32, 33
  and 34, each with its scenario and the test that would catch it.
- `docs/design.md`, "People" (point, then act; every action by keyboard,
  touch and mouse at 390×844 and 1920×1080, surviving a resize) and "The
  cats" (carrying, laps).
- `AGENTS.md`, "What the app must keep".

## What each answer is

1. **Finding 2, the held cat.** A cat in someone's arms is where its holder
   is. On `catHeld` with `by` set, the client stops using the cat's old `at`:
   wherever the client works out a cat's tile (`input.ts`'s `everyone`,
   `targetsAt`, `cycleOrder`, and anything else reading `cat.at` for a held
   cat), a held cat counts as being on its holder's current tile. A held cat
   is **not a target of its own** for anyone. Clicking or tapping its holder
   gives the person menu as before. For the holder, carrying a cat shows a
   carrying bar like the furniture's (reuse `#carrying` or add a sibling)
   saying "Holding {name}." with a "Put {name} down" button that sends
   `{type: "putDown"}`. Escape puts the held cat down (as it puts furniture
   back). When `catHeld` has `by: null`, the server follows it with
   `catPosed` carrying the cat's new `at`; check the client takes the tile
   from that.
2. **Finding 3, the panel's button.** `renderYourCats` must not destroy a
   control that has focus. Keep "Put a treat down" as one element that
   survives re-renders (update text and visibility in place, or rebuild only
   when what the panel shows has changed), so focus and a half-finished
   click survive every `catMoved`. A client test: render, focus the button,
   render again with a changed cat position, and the same element still has
   focus.
3. **Finding 31, the lap cat.** A cat napping on a seated person's tile is
   that person's lap cat (the server now lets only a lap cat nap on a
   sitter's tile). Draw it over its person, as a held cat is.
4. **Finding 32, menus.** With your arms full (a cat held, or furniture
   carried) don't offer "Move the {piece}" or open "Add furniture" (disable
   the button, with a note, or show the menu with only "Your arms are full."
   as its note). A cat someone else holds offers nothing, and with answer 1
   it isn't a target anyway. The window case (someone at the window sees
   actions the server refuses) is by design: the client leaves it to the
   server's "From the window you can only talk."
5. **Finding 33, layout B's ring.** While a ring menu is open in layout B,
   the room keeps the ring's tile in view: the camera doesn't pan back to
   your avatar when the canvas loses focus to the ring's first button. The
   ring circles its tile. When the ring closes, the camera goes back to
   following you.
6. **Finding 34, browser checks.** Add to `spec/browser.test.ts`:
   - offering a treat by keyboard: Tab to a cat, Enter, reach "Offer
     {name} a treat", Enter, and the server answers (a `catReacted`, a
     `yourTreats`, a refusal or a walk over: any answer to that request);
   - picking up and putting down a cat by touch, at 390×844, through the
     new "Put {name} down" button (pick up may be refused by the cat; retry
     a few times, or pick a cat the test can get welcomed by, and keep the
     check honest about what it proves);
   - the treat button keeps focus: focus "Put a treat down", wait for at
     least one `catMoved` frame, press Enter, and a `treatPlaced` frame
     arrives;
   - in layout B at 390×844, a ring opened by keyboard on a target well away
     from you circles that target's tile (its buttons' centre lies within
     about a tile of the tile's centre on screen).

## Yours

`client/src/**`, `client/test/**`, `client/index.html`, the client's styles,
and `spec/browser.test.ts`. Don't touch `server/`, `scripts/`, `content/`,
other `spec/` files or `docs/`, except the result file below.
`client/src/protocol/` is generated and never edited by hand; if you find
you need a protocol change, stop and say so in the result file.

## How to run things

- Client: `pnpm -C client check` (typecheck and tests).
- Root: `pnpm typecheck`.
- The browser checks run against a built image. Build and run your own on
  a port nobody else uses:
  `docker build -q -t cafe-p3c . && docker rm -f cafe-p3c; docker run -d --init --name cafe-p3c -p 127.0.0.1:18083:8080 -e PORT=8080 --tmpfs /data cafe-p3c`
  then `APP_URL=http://localhost:18083 pnpm vitest run spec/browser.test.ts`.
  The whole spec is `APP_URL=http://localhost:18083 pnpm check`. Sign-up is
  rate limited to 60 a minute per address, so leave 60 s between whole-spec
  runs. Remove the container (`docker rm -f cafe-p3c`) and image
  (`docker rmi cafe-p3c`) when you're done.
- Never sign up or act on the live café (`*.fly.dev`); test accounts only
  on your local image.

## When you're done

Commit on your worktree's branch in small steps (don't push to `main`;
the main session cherry-picks your commits). End each commit message with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Then write
`docs/notes/reviews/phase-3-client-result.md` and commit it last: per
finding, what you changed and which test holds it, the commands you ran
and their results (counts of passing tests), anything you couldn't do and
why, and your commits' SHAs in order.
