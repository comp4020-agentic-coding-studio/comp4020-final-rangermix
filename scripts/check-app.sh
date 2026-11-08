#!/usr/bin/env bash
# The copy of the app that `pnpm check` runs the spec against, the same way in
# CI and locally: built fresh, with fresh state, the demo accounts seeded by
# the operator's own command before the café starts, and a stop and a start
# that keep the database, as Fly's volume does.
#
#   check-app.sh build | seed | start | restart | logs | down
#
# CHECK_RUNNER says how it runs:
#   docker  the image Fly deploys, with a Docker volume at /data (CI's way)
#   native  the release binary from the repo root, with a fresh data dir in
#           CHECK_DIR, for a machine without Docker
# CHECK_PORT is the port it answers on. scripts/check.sh sets all three.
set -euo pipefail
cd "$(dirname "$0")/.."

runner="${CHECK_RUNNER:?CHECK_RUNNER is docker or native}"
port="${CHECK_PORT:?CHECK_PORT is not set}"
name=cafe-check
# The demo accounts' password for this throwaway copy only; the live café's
# is set by the operator's seed (CLAUDE.md).
demo_password=catppuccino

native_dir() {
  echo "${CHECK_DIR:?CHECK_DIR is not set}"
}

native_start() {
  local dir
  dir="$(native_dir)"
  PORT="$port" DATA_DIR="$dir/data" ./target/release/cafe </dev/null >>"$dir/app.log" 2>&1 &
  echo $! >"$dir/pid"
}

native_stop() {
  local dir pid
  dir="$(native_dir)"
  [ -f "$dir/pid" ] || return 0
  pid="$(cat "$dir/pid")"
  rm -f "$dir/pid"
  kill -TERM "$pid" 2>/dev/null || return 0
  # as `docker stop` does: ten seconds to go, then killed
  for _ in $(seq 50); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.2
  done
  kill -KILL "$pid" 2>/dev/null || true
}

case "$runner:${1:?say build, seed, start, restart, logs or down}" in
  docker:build) docker build -t "$name" . ;;
  native:build) pnpm -C client build && cargo build --release -p cafe ;;

  docker:seed)
    docker run --rm -e CAFE_DEMO_PASSWORD="$demo_password" -v "$name-data:/data" "$name" /app/cafe demo seed ;;
  native:seed)
    mkdir -p "$(native_dir)/data"
    DATA_DIR="$(native_dir)/data" CAFE_DEMO_PASSWORD="$demo_password" ./target/release/cafe demo seed ;;

  docker:start)
    docker run -d --init --name "$name" -p "$port:8080" -e PORT=8080 -v "$name-data:/data" "$name" >/dev/null ;;
  native:start) native_start ;;

  docker:restart) docker stop "$name" >/dev/null && sleep 30 && docker start "$name" >/dev/null ;;
  native:restart) native_stop && sleep 30 && native_start ;;

  docker:logs) docker logs "$name" 2>&1 ;;
  native:logs) cat "$(native_dir)/app.log" ;;

  docker:down)
    docker rm -f "$name" >/dev/null 2>&1 || true
    docker volume rm "$name-data" >/dev/null 2>&1 || true ;;
  native:down)
    native_stop
    rm -rf "$(native_dir)" ;;

  *) echo "check-app.sh: unknown runner or command: $runner $1" >&2; exit 2 ;;
esac
