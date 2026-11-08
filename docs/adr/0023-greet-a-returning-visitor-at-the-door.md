# 0023. Greet a returning visitor at the door, and give everyone one way in

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

Since phase 1 ([ADR 0007](0007-use-password-accounts-with-a-recovery-code.md)),
opening the café with a session cookie puts you straight in the room: a
connection opens, you take a seat or a place in the line, and everyone
inside sees you arrive. The page after Leave says "You've left the café.
The cats will remember you." and offers Come back in, but not who you
are, and there's no way to be someone else short of clearing the
browser's cookies. On a shared computer (a lab, a showcase stand, a
marker's machine after `demo1`), the next person arrives as the last.

The way in has two tabs, "New here" (name, password, look) and "I've
been before" (name, password). The user, 2026-11-08, asked for the page
after Leave to say "hi *name*" and offer "I'm not *name*", for opening
the café not to walk in directly, and, asked where "I'm not *name*"
leads: "unify log in and sign up, show unified name / password form with
separate buttons". Sign-up needs a look that log-in doesn't, and a name
already taken is only found out when sign-up is sent.

## Options

1. **Keep walking straight in; add the greeting and "I'm not *name*" to
   the page after Leave only.** The smallest change. A reload still
   takes a seat before the visitor has chosen to, and a shared computer
   still walks the next person in as the last; it doesn't do what the
   user asked.
2. **A door: opening the café signed in shows a greeting by name, with
   Walk in and "I'm not *name*", and joins nothing until Walk in.** One
   more press for every returning visit, including every reload. In
   return, nobody arrives by accident, an open tab takes no place in the
   line before its visitor wants one, and a shared computer offers the
   next person a way to be themselves. The page after Leave becomes the
   same door with different words.
3. **One way in, the look on the same form, marked "if you're new".**
   One step to sign up, but every returning visitor scrolls past six
   colours and four avatars to reach the button, and a phone's form
   doubles in height.
4. **One way in, the look as a step after "I'm new".** The form is a
   name, a password and two buttons, the same for everyone. "I'm new"
   needs to know the name is free before it asks for a look, or a
   newcomer chooses a look and only then hears the name is taken; that
   needs a small server endpoint that answers what sign-up would.
5. **Keep the two tabs.** No server change. Not what the user asked for.

## Decision

We will greet a returning visitor at a door (option 2), by name and by
Canberra's hour, with their avatar, and join the café only at Walk in;
the page after Leave is the same door, saying "Hi, *name*." and what it
says now. "I'm not *name*" signs out through `/api/logout` and shows the
way in. The way in is one form (option 4): a name, a password, Walk in
to log in and "I'm new" to sign up, the look a step after it, checked
first by `POST /api/check-name`, which is guarded and rate-limited as
sign-up is and tells nobody more than sign-up does.

## Consequences

- Every return is one press more, a reload included. The music's
  "plays at the first press after a reload" becomes "plays at Walk in".
- Signing up, logging in and recovering still go straight in: the
  visitor has just said who they are.
- The name check is a new public endpoint. It spends the sign-up's
  per-name and per-IP limits, so it can't be used to test names faster
  than sign-up could, and it logs refusals by code only. Sign-up still
  decides: a name taken between the check and the look step is refused
  there, and the form goes back to say so.
- The review found the check and its sign-up spent two tries each,
  halving what a venue on one address could sign up and pushing the
  spec suite past the limit. A check that finds a name free now pays
  for the sign-up after it, once (slice 20's review, finding 4).
- Every check and screens script that signed up through the old tabs
  is turned to the new form; the old slices' scripts stay as their
  record.
- Built as [slice 20](../slices/20-welcomed-back-by-name-or-someone-else.md).
