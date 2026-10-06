#!/usr/bin/env bash
# Regenerates the TypeScript protocol types from the Rust types and fails if
# they differ from what's committed: client/src/protocol is never edited by
# hand (AGENTS.md).
set -euo pipefail
cargo test --quiet -p cafe export_bindings > /dev/null
git diff --exit-code -- client/src/protocol
untracked=$(git ls-files --others --exclude-standard client/src/protocol)
if [ -n "$untracked" ]; then
  echo "generated but not committed: $untracked" >&2
  exit 1
fi
