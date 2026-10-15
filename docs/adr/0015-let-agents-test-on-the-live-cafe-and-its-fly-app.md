# 0015. Let agents test on the live café and its Fly app

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Until now agents checked the deployed café read-only: the page answers,
the logs say what happened. They didn't sign up there, because an account
can't be deleted, and they didn't touch the Fly machine beyond reading its
logs. That left some things unchecked except by the user: what a visitor
on the live machine sees, how it wakes from a real idle stop, and how Fly's
proxy behaves while it does. Slice 02's judged line, reading the live
board, needs a signed-in visitor too. On 2026-10-15 the user said agents
may create accounts for testing and do whatever they need with them, and
may do whatever testing needs with the Fly deployment.

## Options

1. **Keep live checks read-only.** Nothing on the live café that a real
   visitor didn't do. It costs every check that needs a signed-in visitor
   or a stopped machine, which then waits on the user, or isn't made.
2. **Test on the live café with agent accounts, and on the Fly app.** An
   agent signs up the accounts a check needs, uses them as a visitor would,
   and stops, starts, restarts, reads, deploys to or opens a console on the
   machine as testing needs. It costs accounts that stay forever, and test
   visits that real visitors can see while they happen. Who's inside shows
   them, and a cat that meets one writes "Mochi met agent_… for the first
   time" on the board for a day.
3. **A second Fly app for staging.** Tests touch nothing real. But it's
   outside the course's fixed shape (one app, one machine, one volume), and
   it wouldn't test the live machine's own wakes or data.

## Decision

We will let agents test on the live café with accounts of their own, and
use the Fly app as testing needs, within the course's fixed shape. The
rules are in `AGENTS.md`'s "Testing on the live café".

## Consequences

- An agent account's name starts `agent_`, so it can be told from a real
  visitor in the logs, on the board and in who's here. Its password is a
  fresh test value that's never written down, since the repo goes public.
- Test visits are kept short and few, and recorded in `docs/notes/`.
- The Fly app's fixed shape in `fly.toml` (one machine, 256 MB, the volume,
  auto-stop) is never changed, the volume and the app are never destroyed,
  and the machine is left serving `main`'s build.
- Revisit if test visits start to crowd real ones, for example at the
  showcase, or if the café gets a way to delete an account.
