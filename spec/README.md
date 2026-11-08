# The spec

The [final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
and its spec are on the course website, along with the specs for crits 8, 9 and
10, which run in this repo. The brief poses the problem; the spec is the fixed
contract.

## What ships

`invariants.test.ts` checks the two things the course relies on:

- `/` answers with a 200, which is what the deploy and the crit capture read
- `/readme/` publishes `README.md`. Markdown renderers all differ slightly, so
  it checks the README's headings rather than every word: each one has to
  appear, in order, in the HTML the server sends, since no script runs. Render
  it however you like, as long as it's there in full; the marker reads it there.

Both run against the **running** app over HTTP, so they hold whatever it's built
with. `pnpm check` (`scripts/check.sh`) builds and starts its own fresh copy of
the app and runs them against it, the same way in CI and locally: the image
your `Dockerfile` builds, with a throwaway `/data` on a Docker volume, or,
where no Docker daemon answers, the release binary with a throwaway data
directory (`scripts/check-app.sh`). In CI a red run blocks the deploy. CI's two
jobs run the script's two halves, `pnpm check web` and `scripts/check.sh rust`,
and `spec/check-alignment.test.ts` holds them to it. To run the spec alone
against an app that's already running, use `pnpm test`, which finds it at
`APP_URL` (default `http://localhost:8080`). Keep them; don't delete them.

## Your checks

Everything else in `spec/` is yours to write. Any `spec/*.test.ts` runs with
`pnpm check`, against the same copy of the app. Some lines of a spec only a person
can judge; those are left to the crit and the marker.

At a crit, a green `check` job is half the shipped mark, but it's never the
judgement of the work: your tutor checks what you deployed against the published
spec.

## Stopping and starting the app

`restart.test.ts` stops the app, lets it sleep, starts it again, and reads the
restart's own wake-up line (slice 01), so it needs to be told how: `pnpm check`
sets `APP_RESTART` to `bash scripts/check-app.sh restart` (a stop, 30 seconds,
a start, keeping the data) and `APP_LOGS` to `bash scripts/check-app.sh logs`.
Without both it's skipped, as it is under `pnpm test`.
