# `pnpm check` aligned with CI

Working notes for one change on 9 November 2026: `pnpm check` and CI's
`checks.yml` now run the same script, so a check can't pass in one and be
missing from the other.

## Why

Before the final submission's preflight, `APP_URL=https://comp4020-final-rangermix.fly.dev pnpm check`
ran the spec against the live café (10:04 to 10:15 AEDT). 25 of 136 checks
failed, and none of them for a reason in the code. The same commit,
`fae133b`, was green in CI. The spec is written for the copy of the app CI
starts: built fresh, with an empty café, demo accounts seeded, and a
container it can stop and start. The live café is none of those things, and
it rate-limits sign-ups per IP.

The run also did what CLAUDE.md's live-testing rules forbid. The spec signs up
a fresh account for nearly every check, named `t…` or `r…` with the password
`correct horse`, which is written in the repo. So the live café now has
test accounts, one for each such check that got that far (not counted), that aren't named `agent_`, that anyone reading the
repo can log in as, and that real visitors may have seen come and go. Accounts
can't be deleted. The demo checks were skipped, since `APP_DEMO_PASSWORD`
wasn't set, so the café's clock, furniture sets and bots weren't touched.

The run happened because `pnpm check` and CI meant different things. CI built
the image, seeded it, started it and passed the spec its restart and log
commands, then checked the log lines, the process evidence and, in a second
job, the Rust. Locally, `pnpm check` was only the TypeScript, the client and
the spec against whatever answered at `APP_URL`, with the restart check
skipped. The old local default, `localhost:8080`, also held a stale debug
server from 4 November.

## What changed

- `scripts/check.sh` is `pnpm check`. It has two halves, `web` and `rust`.
  CI's check job runs `pnpm check web`, and its rust job runs
  `bash scripts/check.sh rust`. `pnpm check` with no argument runs both.
  Only the secret scans and the deploy stay in CI alone.
- `scripts/check-app.sh` builds, seeds, starts, restarts, prints the logs of
  and removes the copy of the app the spec runs against. It does this under
  Docker where a daemon answers, the image Fly deploys on a Docker volume as
  CI did. Otherwise it uses the release binary from the repo root with a
  throwaway data directory, which is how this machine, without Docker, now
  runs the restart check too. `CHECK_RUNNER=docker|native` forces one, and
  CI forces `docker`.
- The copy listens on port 8081, not `pnpm dev`'s 8080. The script refuses
  to start if anything already answers there. It ignores `APP_URL` and says
  so. `pnpm test` is the spec alone against `APP_URL`.
- `spec/check-alignment.test.ts` holds it:
  - `package.json`'s `check` is the script;
  - CI's steps call its two halves and run no Docker, Cargo, log check,
    evidence check or Playwright install of their own;
  - the script runs every check CI used to run.

  It failed before the script existed and passed after.
- `docs/design.md` (Checks) and `spec/README.md` now say how the checks run.

## Checked

- Locally, without Docker, `pnpm check` passed on the native runner,
  11:00 to 11:06 AEDT: Rust format, lints, tests and protocol drift; the
  TypeScript; 472 client tests; 139 spec checks with none skipped, the
  restart and demo checks included; 689 log lines; the evidence. Its first
  run had stopped at the app's start, on the script's own quoting bug.
- CI on [`7dbbf87`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-rangermix/commit/7dbbf87), run 42537745282: `rust` green
  (2m18s), `check` green on the Docker runner (the same 472 and 139, and 690
  log lines), and the deploy green. The live café answered 200 afterwards.

## Left over

- `spec/guide.test.ts` rewrites the six screenshots in
  `docs/notes/screens/slice-21/` on every spec run, so a local `pnpm check`
  leaves the working tree dirty. That predates this change and was left as
  it is.
