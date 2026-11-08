# 20. Welcomed back by name, or someone else

- **Status:** Approved 2026-11-08, with the user's answers below;
  proposed 2026-11-08 from the user's ask of that day
- **Plan:** [`docs/notes/plan-slice-20-welcome.md`](../notes/plan-slice-20-welcome.md)
- **Design:** People ("Arriving", "Leaving"); Accounts and safety
  ("Sign-up", "Storage", "Protection");
  [ADR 0007](../adr/0007-use-password-accounts-with-a-recovery-code.md)
  (accounts and sessions), [ADR 0009](../adr/0009-free-a-quiet-seat-only-when-someone-is-waiting.md)
  (walked out when someone's waiting),
  [ADR 0023](../adr/0023-greet-a-returning-visitor-at-the-door.md)
  (the door, and one way in)

## Story

A visitor who leaves sees who they were signed in as, "Hi, mochi_fan.",
above "You've left the café. The cats will remember you.", with Come back
in and a second way out, "I'm not mochi_fan", for whoever sits down at
the computer next. That signs the session out and shows the way in.

A visitor who opens the café while still signed in isn't walked straight
in any more. The door greets them by the hour, "Good evening,
mochi_fan.", with their avatar, Walk in and the same "I'm not
mochi_fan". Nobody inside sees them, and no seat is taken, until they
press Walk in.

The way in is one short form for everyone: a name and a password, Walk
in for someone who's been before and "I'm new" for someone who hasn't.
"I'm new" checks the name is free, then asks for a look, then shows the
recovery code as now.

The user, 2026-11-08, from a screenshot of the page after Leave: "after
log out, show "hi <name>" above current text, give option to log in as
another person "I'm not <name>", and do not log in directly when
opening the cafe - it should show a similar come back or someone else
page, with different text in welcoming way." Asked where "I'm not
*name*" leads: "unify log in and sign up, show unified name / password
form with separate buttons".

Today the page after Leave says nothing of who you are, and the only way
to be someone else is to clear the browser's cookies. Opening the café
with a session (a reload, a new tab, a shared computer) puts you in the
room at once: the next person at a shared computer arrives as you.

## In this slice

The user's answers, 2026-11-08: "I'm not *name*" leads to one name and
password form with separate buttons; the look is a step after "I'm new";
the door greets by Canberra's hour, at 5, 12, 18 and 22; the avatar
shows.

- **The door.** One page in two moods, in place of the page after Leave:
  - **Opening the café signed in:** the visitor's avatar, "Good
    morning, *name*." (afternoon from 12:00, evening from 18:00, and
    "Still up, *name*?" from 22:00 to 4:59, since "good night" means
    goodbye), by Canberra's hour on the device's clock; then "The cats
    are about. Come in when you're ready."; Walk in; and "I'm not
    *name*". Nothing joins the café until Walk in is pressed: no
    connection, no seat, no place in the line, nothing in who's here or
    on the board.
  - **After Leave, or walked out:** the avatar, "Hi, *name*.", the text
    there now ("You've left the café. The cats will remember you.", or
    why the seat went to someone waiting), Come back in, and "I'm not
    *name*".
  - The focus starts on Walk in or Come back in. The name is set as
    text, never as markup.
- **"I'm not *name*":** signs the session out through `/api/logout`,
  then shows the way in, its fields empty and the name focused. A
  refusal or no answer says so and leaves the door as it was, still
  signed in, rather than seeming to sign out.
- **One way in.** The two tabs, "New here" and "I've been before", give
  way to one form:
  - a name (with "everyone in the café sees it") and a password;
  - **Walk in**, the form's first button, so Enter logs in;
  - **I'm new**, which checks the name is free (below), then shows the
    look step: "Choose your look, *name*", the avatars and colours as
    now, Walk in, which signs up, and Back;
  - "I've forgotten my password", to the recovery form as now, with
    Back;
  - a log-in refused for a wrong name or password adds "New here? Press
    I'm new.";
  - the recovery code, after sign-up and recovery, as now.

  Signing up, logging in and recovering walk you straight into the
  café, as now: you've just said who you are.
- **The name check (server):** `POST /api/check-name` with a name
  answers 204 if it's free to sign up with, or the refusal sign-up would
  give: a bad name, a taken one, or one of the café's own. It's guarded
  as sign-up is, by the Origin check and the same per-name and per-IP
  limits, and its refusals are logged by code only, never the name. It
  tells nobody anything sign-up doesn't already tell them. Sign-up still
  refuses a taken name, for a name taken between the check and the look
  step; then the look step goes back to the first with the reason.
- **The music:** remembered on, it plays when Walk in is pressed, since
  that's a press. The music's checks that reload straight into the café
  are turned to press Walk in first.
- **The checks** that sign up through the page, log in through it, or
  open the café with a session, are turned to the new form and the
  door, and new ones hold the rows below.

## Not in this slice

- **How many are inside, on the door.** It would need the café's state
  before joining: a new public endpoint or a connection that takes no
  seat. Walk in shows it, at the door or in the line.
- **The second-tab page** ("You opened the café in another tab.")
  stays as it is.
- **Signed out by the server** (a session expired, or ended by a
  recovery elsewhere) shows the way in, as now.
- **Remembering several accounts** on one browser, or switching between
  them without a password.
- **The old screens' scripts** in `docs/notes/screens/slice-*/` drive the
  old tabs; they stay as the record of their slices.

## Done when

| What must be true | Held by |
| --- | --- |
| Opening the café with a session shows the door: the avatar, the hour's greeting by name, "The cats are about…", Walk in focused, "I'm not *name*"; no WebSocket opens, and a visitor inside sees nobody new, until Walk in | `spec/welcome.test.ts` (browser) |
| The greeting by the hour: morning 5:00–11:59, afternoon 12:00–17:59, evening 18:00–21:59, "Still up" 22:00–4:59 | `client/test/door.test.ts`; `spec/welcome.test.ts` at one faked hour |
| Walk in enters the café, by keyboard at 1920×1080, touch at 390×844 and mouse | `spec/welcome.test.ts` |
| After Leave, the door says "Hi, *name*." above "You've left the café. The cats will remember you.", Come back in focused, "I'm not *name*" under it | `spec/browser.test.ts` (the keyboard check that leaves), `spec/welcome.test.ts` |
| After being walked out for someone waiting, the same greeting and both buttons above the text saying why | `client/test/door.test.ts` (the door in its left mood with that text); the walk-out itself is held by `spec/realtime.test.ts` as now |
| "I'm not *name*" ends the session (`/api/me` answers signed out, a reload shows the way in) and shows the way in, fields empty, name focused; someone else then logs in | `spec/welcome.test.ts` |
| A failed sign-out says why and leaves the door, still signed in | `client/test/door.test.ts` |
| One form: Walk in logs in, by Enter too; "I'm new" checks the name, then the look step's Walk in signs up and shows the recovery code; Back returns with the fields kept | `spec/welcome.test.ts`, and every check that signs up through the page |
| "I'm new" with a taken name, or one of the café's own, stays on the first step and says why; a wrong password adds "New here? Press I'm new." | `spec/welcome.test.ts`; `client/test/auth.test.ts` |
| `/api/check-name`: 204 for a free name; the sign-up's refusal for a bad, taken or reserved one; the Origin check; the per-name limit; refusals logged by code, never the name | `cargo test` (`server/src/api.rs`) |
| Recovery still works from "I've forgotten my password" | `client/test/auth.test.ts` |
| The door and the form survive a resize from 390×844 to 1920×1080 and back, their buttons on screen and working | `spec/welcome.test.ts` |
| Remembered-on music plays at Walk in | `spec/music.test.ts` |
| The name is set as text, never as markup | `client/test/door.test.ts` (a name with `<b>` shows the characters) |
| The door and the form read well and welcoming, on a phone and a desktop, light and dark | judged: the user, from screens the slice makes at 390×844 and 1920×1080 in Latte and Mocha |

## Rules it touches

- **Every action works by keyboard, touch and mouse**, at 390×844 and
  1920×1080, and survives a resize mid-use: the door's buttons and the
  new form, held by the rows above.
- **Never store email addresses or IP addresses**: the name check's
  per-IP limit is the sign-up's, counted in memory only.
- **The server decides every outcome**: the name check is advice to the
  form; sign-up decides, and still refuses a taken name.
- **The cap is enforced on the server**: untouched, and helped: an open
  tab no longer takes a place in the line before its visitor chooses to
  come in.
- **Never store or log what anyone says**: untouched. The sign-out logs
  what `/api/logout` logs today.

## Numbers

None new. The name check spends the sign-up's limits (5 tries a name and
60 an address, a minute).

## Open questions

None: answered 2026-11-08 (above).
