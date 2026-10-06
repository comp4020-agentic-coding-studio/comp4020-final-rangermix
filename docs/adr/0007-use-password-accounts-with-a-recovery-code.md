# 0007. Use password accounts with a recovery code

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The brief lets the app decide what counts as a person, as long as it can tell
people apart. Here the lasting trace is each cat's trust in each person, which
never fades ([ADR 0002](0002-make-a-cat-cafe-where-company-forms-around-the-cats.md)),
so an identity has to survive a cleared browser and a new device. The user
asked for a simple password system, kept minimal. The app shouldn't hold
personal data it doesn't need, and the machine has 256 MB of memory.

## Options

1. **A name and a look remembered by the browser.** No friction at all, but
   the identity dies with cleared storage or a new device, anyone can claim a
   name, and a regular's cats forget them.
2. **Username and password, no recovery.** Minimal, but a forgotten password
   costs a regular every cat's trust, for good.
3. **Username and password, plus a one-time recovery code shown at
   sign-up.** Recovery without email, at the cost of asking people to keep the
   code and storing one more hash.
4. **Email accounts**, with magic links or email resets. Familiar recovery, but
   it stores personal data, needs an email provider, and is more than minimal.

## Decision

We will use username-and-password accounts with a one-time recovery code shown
at sign-up, both hashed with argon2id, and sessions held in a cookie whose token
the server stores only as a hash.

## Consequences

- argon2id at OWASP's minimum configuration (19 MiB of memory, 2 iterations,
  1 degree of parallelism; checked in OWASP's Password Storage Cheat Sheet on
  2026-10-07), with at most two hashes running at once so a burst of log-ins
  can't exhaust the machine.
- Sign-up, log-in and recovery are rate-limited per name and per IP address,
  and `/api/*` and `/ws` check the Origin header.
- The cookie is HttpOnly, Secure and SameSite=Lax, and a session lasts 30 days
  from last use. A second tab on the same account takes over from the first.
- Recovery issues a fresh code and signs out other sessions.
- No email addresses and no IP addresses are stored.
- Markers testing two sessions side by side need two accounts, so sign-up has
  to be quick.
- The commits that carry it out will be linked here as they land.
