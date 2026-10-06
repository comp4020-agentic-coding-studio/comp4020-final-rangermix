#!/usr/bin/env bash
# Builds the client and runs the server from the repo root, where the spec
# looks for it (APP_URL defaults to http://localhost:8080). The database goes
# in .data/, which git ignores.
set -euo pipefail
pnpm -C client build
cargo run -p cafe
