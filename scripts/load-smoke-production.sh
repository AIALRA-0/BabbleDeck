#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
LOAD_SMOKE_LOG="${BABBLEDECK_LOAD_SMOKE_LOG:-$LOG_DIR/load-smoke.jsonl}"
LOCK_FILE="${BABBLEDECK_LOAD_SMOKE_LOCK:-$LOG_DIR/load-smoke.lock}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command flock
need_command mktemp
need_command pnpm

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR is not a git repository: $APP_DIR" >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck load smoke is already active." >&2
  exit 1
fi

output_file="$(mktemp)"
cleanup() {
  rm -f "$output_file"
}
trap cleanup EXIT

cd "$APP_DIR"
set +e
pnpm exec tsx scripts/load-smoke-production.ts "$@" >"$output_file"
status=$?
set -e
cat "$output_file" >>"$LOAD_SMOKE_LOG"
cat "$output_file"
exit "$status"
