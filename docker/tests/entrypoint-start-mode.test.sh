#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENTRYPOINT="$ROOT_DIR/docker/scripts/entrypoint.sh"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

grep -q 'SUI_FORCE_REGENESIS' "$ENTRYPOINT" ||
  fail "entrypoint must expose SUI_FORCE_REGENESIS"

grep -q 'should_force_regenesis' "$ENTRYPOINT" ||
  fail "entrypoint must centralize force-regenesis parsing"

grep -q 'SUI_START_ARGS' "$ENTRYPOINT" ||
  fail "entrypoint must build sui start arguments conditionally"

if grep 'sui start' "$ENTRYPOINT" | grep -q -- '--force-regenesis'; then
  fail "sui start must not include --force-regenesis unconditionally"
fi

grep -q 'RESET_INDEXER_DB=0' "$ENTRYPOINT" ||
  fail "entrypoint must default to keeping the indexer database"

grep -q 'RESET_INDEXER_DB=1' "$ENTRYPOINT" ||
  fail "entrypoint must request indexer reset when creating a fresh genesis"

grep -q 'if \[ "$RESET_INDEXER_DB" -eq 1 \]; then' "$ENTRYPOINT" ||
  fail "indexer database reset must be gated by RESET_INDEXER_DB"

grep -q "Keeping existing indexer database" "$ENTRYPOINT" ||
  fail "entrypoint must explicitly keep the indexer database on persisted starts"

printf 'PASS: entrypoint start mode is configurable\n'
