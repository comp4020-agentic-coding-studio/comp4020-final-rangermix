#!/usr/bin/env bash
# `pnpm check`: every check CI runs, run the same way. CI's two jobs each run
# one half of this script (.github/workflows/checks.yml: `pnpm check web` and
# `bash scripts/check.sh rust`), and `pnpm check` runs both, so a check can't
# be in one and missing from the other (spec/check-alignment.test.ts). Only
# the secret scans and the deploy are CI's own.
#
#   pnpm check        both halves
#   pnpm check web    the TypeScript, the client, the spec against a fresh
#                     copy of the app, its log lines, the process evidence
#   pnpm check rust   the server's format, lints and tests, and the generated
#                     TypeScript against the Rust types
#
# The spec runs against a copy of the app this script starts itself
# (scripts/check-app.sh), never against one already running: under Docker
# when a daemon answers, as CI does, or else as the release binary with the
# same fresh state. CHECK_RUNNER=docker or native picks one. `pnpm test` runs
# the spec against whatever answers at APP_URL instead.
set -euo pipefail
cd "$(dirname "$0")/.."

rust() {
  cargo fmt --check
  cargo clippy --all-targets -- -D warnings
  cargo test
  bash scripts/check-protocol.sh
}

web() {
  pnpm typecheck
  pnpm -C client check

  if [ -n "${APP_URL:-}" ]; then
    echo "pnpm check runs the spec against its own fresh copy of the app, as CI does, not APP_URL=$APP_URL;" >&2
    echo "pnpm test runs it against APP_URL." >&2
  fi
  if [ -z "${CHECK_RUNNER:-}" ]; then
    if docker info >/dev/null 2>&1; then CHECK_RUNNER=docker; else CHECK_RUNNER=native; fi
  fi
  # 8081, not the 8080 `pnpm dev` serves on, so the spec never meets a
  # stale local run by mistake
  export CHECK_RUNNER CHECK_PORT="${CHECK_PORT:-8081}"
  if curl -s -o /dev/null "http://localhost:$CHECK_PORT"; then
    echo "something is already answering on port $CHECK_PORT: stop it, or set CHECK_PORT" >&2
    exit 1
  fi
  if [ "$CHECK_RUNNER" = native ]; then
    CHECK_DIR="$(mktemp -d)"
    export CHECK_DIR
  fi
  echo "the spec runs against the app on $CHECK_RUNNER, at port $CHECK_PORT" >&2

  # Chromium for the spec's browser checks; CI's runner needs its system
  # libraries too
  if [ -n "${CI:-}" ]; then
    pnpm exec playwright install --with-deps chromium
  else
    pnpm exec playwright install chromium
  fi

  if [ "$CHECK_RUNNER" = docker ]; then bash scripts/check-app.sh down; fi
  trap 'bash scripts/check-app.sh down' EXIT
  bash scripts/check-app.sh build
  bash scripts/check-app.sh seed
  bash scripts/check-app.sh start

  # spec/demo.test.ts logs in as demo1 (slice 17); spec/restart.test.ts stops
  # the app, lets it sleep, starts it again, and reads the restart's own
  # wake-up line (slice 01)
  if ! APP_URL="http://localhost:$CHECK_PORT" \
    APP_DEMO_PASSWORD=catppuccino \
    APP_RESTART="bash scripts/check-app.sh restart" \
    APP_LOGS="bash scripts/check-app.sh logs" \
    pnpm test; then
    # what the app printed, so a crash or slow boot is visible
    echo "--- the app's output" >&2
    bash scripts/check-app.sh logs >&2
    exit 1
  fi

  # After the spec's visitors have been and gone, across both of the app's
  # starts: every line says when, what and who, every start logs its wake-up
  # on the wall clock as Fly runs it (slice 08), and none holds what the spec
  # said in a bubble or its password (CLAUDE.md: never log what anyone says).
  bash scripts/check-app.sh logs | node scripts/check-logs.ts --wall "hello by keyboard" "hello there" "remember me?" "can I come in?" "correct horse" "catppuccino"

  pnpm check:evidence
}

case "${1:-all}" in
  rust) rust ;;
  web) web ;;
  # one after the other, not `rust && web`, which would turn off set -e
  # inside rust
  all) rust; web ;;
  *) echo "pnpm check [web|rust]" >&2; exit 2 ;;
esac
