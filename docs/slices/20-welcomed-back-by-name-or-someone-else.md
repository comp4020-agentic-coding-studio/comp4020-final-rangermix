# 20. Welcomed back by name, or someone else

- **Status:** Proposed 2026-11-08, from the user's ask of that day
- **Plan:** written when the slice starts, as `docs/notes/plan-slice-20-welcome.md`
- **Design:** People ("Arriving", "Leaving"); Accounts and safety
  ("Storage": the session cookie);
  [ADR 0007](../adr/0007-use-password-accounts-with-a-recovery-code.md)
  (accounts and sessions), [ADR 0009](../adr/0009-free-a-quiet-seat-only-when-someone-is-waiting.md)
  (walked out when someone's waiting)

## Story

A visitor who leaves sees who they were signed in as, "Hi, mochi_fan.",
above "You've left the café. The cats will remember you.", with Come back
in and a second way out, "I'm not mochi_fan", for whoever sits down at
the computer next. That signs the session out and shows the way in.

A visitor who opens the café while still signed in isn't walked straight
in any more. A welcome greets them by name, with Walk in and the same
"I'm not mochi_fan". Nobody inside sees them, and no seat is taken,
until they press Walk in.

The user, 2026-11-08, from a screenshot of the page after Leave: "after
log out, show "hi <name>" above current text, give option to log in as
another person "I'm not <name>", and do not log in directly when
opening the cafe - it should show a similar come back or someone else
page, with different text in welcoming way."

Today the page after Leave says nothing of who you are, and the only way
to be someone else is to clear the browser's cookies. Opening the café
with a session (a reload, a new tab, a shared computer) puts you in the
room at once: the next person at a shared computer arrives as you.

## In this slice

Only the page changes. The server and the protocol stay as they are:
`/api/me` already names who's signed in, and `/api/logout` already ends
the session and clears its cookie.

- **After Leave, and after being walked out:** the page that offers to
  come back starts with "Hi, *name*." above the text it shows now, which
  stays ("You've left the café. The cats will remember you.", or why your
  seat went to someone waiting). Under Come back in, a quieter button,
  "I'm not *name*".
- **Opening the café signed in:** a welcome page in the same place and
  style, greeting the visitor by name with different, welcoming words
  (question 2), a Walk in button, and the same "I'm not *name*". The
  focus starts on Walk in. Nothing joins the café until Walk in is
  pressed: no connection, no seat, no place in the line, nothing in
  who's here or on the board.
- **"I'm not *name*":** signs the session out on the server through
  `/api/logout`, then shows the way in (question 1), its fields empty. A
  refusal or no answer says so, and leaves the visitor where they were,
  still signed in, rather than seeming to sign them out.
- **Signing up, logging in or recovering** still walk you straight in:
  you've just said who you are.
- **The visitor's avatar** above the greeting on both pages, in their
  colour, drawn as the sign-up form's look picker draws it (question 3).
- **The music:** remembered on, it plays when Walk in is pressed, since
  that's a press. A reload no longer arrives in the café before any
  press, so the case where the music waits for the first press after a
  reload becomes the case where it starts at Walk in; the music's checks
  that reload straight into the café are turned to press Walk in.
- **The checks** that open the café with a session (reloads, Leave and
  Come back in) are turned to the welcome, and new ones hold the rows
  below.

## Not in this slice

- **How many are inside, on the welcome.** It would need the café's
  state before joining: a new public endpoint or a connection that
  doesn't take a seat. Walk in shows it, at the door or in the line.
- **The second-tab page** ("You opened the café in another tab.")
  stays as it is.
- **Signed out by the server** (a session expired or ended by a
  recovery elsewhere) shows the way in, as now.
- **Remembering several accounts** on one browser, or switching between
  them without a password.

## Done when

| What must be true | Held by |
| --- | --- |
| After Leave, the page says "Hi, *name*." above "You've left the café. The cats will remember you.", with Come back in focused and "I'm not *name*" under it | `spec/` (browser), at 390×844 and 1920×1080 |
| After being walked out for someone waiting, the same greeting and both buttons, above the text saying why | `spec/` (browser) |
| Opening the café with a session shows the welcome, by name, with Walk in focused and "I'm not *name*"; no WebSocket opens and nobody inside sees the visitor until Walk in | `spec/` (browser: no `/ws` before Walk in, and a second visitor's who's here unchanged) |
| Walk in enters the café, by keyboard, touch and mouse | `spec/` (browser), keyboard at 1920×1080, touch at 390×844 |
| "I'm not *name*" ends the session (`/api/me` then answers signed out, and a reload shows the way in, not the welcome) and shows the way in with empty fields; someone else can then log in | `spec/` (browser) |
| A failed sign-out says why and leaves the welcome, still signed in | `client/test/` (vitest, the sign-out failing) |
| Signing up, logging in and recovering still go straight into the café | `spec/` (the existing sign-up checks, unchanged) |
| The welcome and the left page survive a resize from 390×844 to 1920×1080 and back, their buttons on screen and working | `spec/` (browser) |
| Remembered-on music plays at Walk in | `spec/music.test.ts` |
| The greeting is set as text, never as markup | `client/test/` (a name with `<b>` shows the characters) |
| The two pages read well and welcoming, on a phone and a desktop, light and dark | judged: the user, from screens the slice makes at 390×844 and 1920×1080 in Latte and Mocha |

## Rules it touches

- **Every action works by keyboard, touch and mouse**, at 390×844 and
  1920×1080, and survives a resize mid-use: the new buttons, and the new
  welcome page, are held by the rows above.
- **Never store or log what anyone says**: untouched. The sign-out logs
  what `/api/logout` logs today, that the account logged out.
- **The cap is enforced on the server**: untouched, and helped: an open
  tab no longer takes a place in the line before its visitor chooses to
  come in.

## Numbers

None.

## Open questions

1. **Where "I'm not *name*" leads.** A: signs out and shows the way in on
   "I've been before", ready for another person's name and password
   (the user's words: "log in as another person"). B: on "New here", as
   a stranger's first visit sees it. *Lean: A*, since the person at the
   keyboard has most likely been before, and "New here" is one tap away.
2. **The welcome's words.** A: "Welcome back, *name*." then "The cats
   are in. Come and sit with them." and Walk in. B: "Good morning,
   *name*." (afternoon, evening or night by Canberra's hour) then "The
   cats are about. Come in when you're ready." and Walk in; a demo
   account whose café runs ahead of Canberra would be greeted by the
   wall clock's hour, not the café's, since the page hasn't joined yet.
   C: words of the user's own. *Lean: A*: short, warm, and true at any
   hour.
3. **The avatar.** A: their avatar in their colour above the greeting on
   both pages, so "is this me?" is answered at a glance. B: the name
   only. *Lean: A*; it's drawn the way the look picker already draws
   one.
