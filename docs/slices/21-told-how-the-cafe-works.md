# 21. Told how the café works, on the way in

- **Status:** Deployed and checked live 2026-11-09 ([notes](../notes/slice-21-guide.md));
  live once the user has judged the words and the shrink; reviewed 2026-11-09, 14 findings (1 major, 7 minor, 6
  nits), 13 fixed and 1 answered ([findings](../notes/reviews/slice-21-findings.md));
  built 2026-11-09 ([notes](../notes/slice-21-guide.md), [screens](../notes/screens/slice-21/));
  approved 2026-11-09, with the user's answers below ("leans");
  proposed 2026-11-09 from the user's ask of that day
- **Plan:** [`docs/notes/plan-slice-21-guide.md`](../notes/plan-slice-21-guide.md)
- **Design:** The client ("Desktop", "Phone", "The guide"); People
  ("Arriving")

## Story

A visitor walks into the café for the first time and doesn't know what to
click. A short guide opens over the room: how to get about by mouse,
keyboard or touch, how talking works, what the cats remember, the café's
clock, the panels and the furniture. At its foot, "Got it, no pop-up next
time". They close it, and it shrinks into a small ⓘ button at the top
right, just left of Add furniture, so they see where it went. Whenever
they want it again, the ⓘ brings it back, growing out of the button.

The user, 2026-11-09: "add an information button top right, left to "Add
furniture". The button should show an overlay when clicked, explain the
basics of the game, like how control work with mouse or keyboard, cat and
time machenism, floating panel, etc. keep it simple. the overlay shows on
entering the cafe by default. a "got it, no pop-up next time" checkbox at
the end of the information overlay stops it being pop-up automatically
again. on closing the overlay, animate it to shrink to the top right info
button."

Asked five questions, each with a lean, the user answered "leans":

1. **Remembered in this browser**, as the layout, the panels and the music
   are, not on the account. No server change, and a marker ticking it on
   `demo1` doesn't hide it from the next marker on `demo1`.
2. **It opens every time you go in** (Walk in at the door, Come back in
   after Leave) until the box is ticked, but not when the café reloads
   itself for a new build, which goes straight back in.
3. **It says only what fits the screen in use:** mouse and keyboard and the
   floating panels at 960 px and wider; tapping, the two layouts and where
   the panels are below that. It names no cat, so a new cat in `content/`
   leaves it true.
4. **A demo account gets one more line**, on what the demo bar does.
5. **It's modal**, as the chalkboard's dialog is: the café behind is dimmed
   and inert, Close, Escape or a click beside it shrinks it into the ⓘ, and
   opened from the ⓘ it grows out of it. With reduced motion it only
   fades.

## In this slice

The client only: no server change, no protocol change.

- **The ⓘ button** in the status bar, before Add furniture and kept with
  it where the bar wraps: round, an "i" drawn in it, its name "How the
  café works" for a screen reader and as its tooltip, at every size and
  in both phone layouts. On a phone the status line keeps room for "2/6
  inside" on one line, so a button wraps instead.
- **The guide**, a dialog over the café, outside it in the page as the
  chalkboard's dialog is. Its heading is "How the café works". Its words:
  - *(lede)* A room to sit in with the cats, and whoever else is here.
    When it's full, you wait at the window, where you can still talk.
  - **Getting around.** *(960 px and wider)* Click the floor to walk.
    Click a cat, a person or a piece of furniture to see what you can do.
    By keyboard, from the room: an arrow brings up a pointer and moves it,
    then Tab steps through what's there, Enter acts, and Escape puts the
    pointer away.
    *(narrower)* Tap the floor to walk. Tap a cat, a person or a piece of
    furniture to see what you can do. Bigger room follows you about; Whole
    room shows all of it.
  - **Talking.** Type in the talk box and press Say. Your bubble
    shows over your head for everyone here, then goes: nothing anyone says
    is kept. To talk to one person, choose them in the room, then Talk to.
  - **The cats.** Each has a character of its own, and remembers you.
    Trust grows only from what you do with it: petting, playing, a treat.
    Push too far, and it scratches. They carry on while you're away, and
    the chalkboard on the wall says what they got up to.
  - **Time.** The café keeps Canberra's time, so it's day or night here as
    it is there, and the music changes with it. The bowls fill themselves,
    and you have a few treats a day to put down or give.
  - **The panels.** *(960 px and wider)* Your cats, who's here, the
    chalkboard and the music float over the room. Drag one by its title,
    or pin it to let clicks through to the room. Unpinned, it fades when
    left alone. *(narrower)* Your cats, who's here and the music are under the
    room, or behind Who's here in the bigger room.
  - **Furniture.** Add furniture puts a piece in your hands: choose where
    it goes. To move one, choose it in the room.
  - *(a demo account only)* **On a demo account,** the bar at the top
    moves the café's clock on, lays out a furniture set, and adds or
    removes bots.
  - *(the foot, always in view)* "The ⓘ at the top brings this back.", the
    checkbox **Got it, no pop-up next time**, and **Close**.
- **When it opens:** as the café is entered, unless the box was ticked in
  this browser or the opening is the café's own reload for a new build;
  and whenever the ⓘ is pressed. The café's own reload brings it back if
  it was open as the page reloaded, as it is on a newcomer's first entry
  after a deploy (the review's finding 3). The box shows what's remembered, and
  unticking it brings the pop-up back. The choice is saved as it changes,
  so Escape or a click beside keeps it too. A browser that won't store it
  shows the guide on each new page, and a tick holds until the page is
  reloaded (the review's finding 6).
- **While it's open:** the café behind is dimmed and inert, the page
  doesn't scroll under it, a menu left open closes, and the focus
  stays in the guide: Tab and Shift+Tab go round its words (so arrows
  scroll them), the box and Close. Escape, Close, or a press that starts
  and ends beside it closes it. The words scroll inside it if the window
  is short; the foot never scrolls away. A resize mid-use keeps it inside
  the window, its lines changing with the width.
- **Closing:** the guide shrinks into the ⓘ, its middle onto the button's
  and small enough to fit inside it, fading as it lands, in about a third
  of a second; the backdrop fades with it. It takes no presses as it goes, and lands at
  once on a resize. The focus goes back to the ⓘ if
  it was opened from there, otherwise to the room. Opened from the ⓘ, it
  grows out of it the same way back. With reduced motion, it fades, with
  no shrinking. Leaving, being signed out or walked out closes it at once;
  so does the "Still there?" nudge, which must be seen, as it closes the
  chalkboard.
- **The checks' own visitors** start with the guide off, set in their
  browsers before the page loads, so every check that walks in finds the
  café as before. The two checks that block storage on purpose close the
  guide themselves.

## Not in this slice

- **Remembering it on the account,** across devices (answer 1).
- **A tour** that points at each control in turn. The guide is one page of
  words.
- **The README's "For markers"**, which is the user's: it doesn't mention
  the ⓘ unless they add it.
- **Numbers in the words** (six inside, three treats, the bowls' hours),
  which live in `content/` and `docs/design.md`'s numbers: the guide says
  "full", "a few" and "fill themselves", so tuning them leaves it true.

## Done when

| What must be true | Held by |
| --- | --- |
| Whether the guide pops up is remembered in this browser, defaults to yes, and a browser that won't store it gets yes | `client/test/guide.test.ts` |
| Closing moves the card's middle onto the button's and scales it to fit inside it | `client/test/guide.test.ts` (the shrink's numbers); `spec/guide.test.ts` (the last frame, measured, at both sizes) |
| A visitor walking in sees the guide over an inert café, the focus in it, at 1920×1080 by mouse and at 390×844 by touch | `spec/guide.test.ts` |
| Close, Escape, and a press beside it each close it; the focus goes to the room, or to the ⓘ when opened from there | `spec/guide.test.ts`; `client/test/guide.test.ts` |
| Tab and Shift+Tab never leave the guide while it's open | `spec/guide.test.ts`; `client/test/guide.test.ts` |
| Ticked, it doesn't pop up on Come back in or on a reload; the ⓘ opens it with the box ticked; unticked, it pops up again | `spec/guide.test.ts` |
| The café's own reload for a new build doesn't pop it up | `spec/guide.test.ts` |
| At 960 px and wider it shows the mouse, keyboard and floating-panel lines and not the touch ones, and the other way round below; a resize mid-use swaps them and keeps the card and its Close inside the window | `spec/guide.test.ts` |
| A demo account sees the demo line, and nobody else does | `spec/guide.test.ts` |
| With reduced motion it closes with no transform | `spec/guide.test.ts` |
| The ⓘ sits just left of Add furniture, inside the window, in the status bar at 1920×1080 and in both phone layouts at 390×844 and 320×568, and the status line stays on one line | `spec/guide.test.ts` |
| Open as the café reloads itself, it's back after the reload | `spec/guide.test.ts`; `client/test/guide.test.ts` |
| The page doesn't scroll under it, it takes no presses as it shrinks, and closed mid-grow it shrinks from where it was | `spec/guide.test.ts`; `client/test/guide.test.ts` |
| Every existing check still walks into the café as before | `pnpm check` |
| The words are right and short enough, and the shrink reads as going into the button | judged: the user, from the screens in `docs/notes/screens/slice-21/` and the live café |

## Rules it touches

- **Every action works by keyboard, touch and mouse**, at 390×844 and at
  1920×1080, and survives a resize mid-use: the guide's own checks.
- **Cats change through `content/`, not code:** the guide names no cat and
  quotes no number from `content/`.
- **Never store or log what anyone says; never store email or IP
  addresses:** the browser stores only whether the guide pops up.

## Numbers

None from "Numbers to tune". The shrink takes 350 ms, the agent's call.

## Open questions

None: the user's answers are above.
