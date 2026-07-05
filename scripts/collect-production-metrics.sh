#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
METRICS_LOG="${BABBLEDECK_METRICS_LOG:-$LOG_DIR/metrics.jsonl}"
LOCK_FILE="${BABBLEDECK_METRICS_LOCK:-$LOG_DIR/metrics.lock}"

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
  echo "Another BabbleDeck metrics collection is already active." >&2
  exit 1
fi

metrics_file="$(mktemp)"
cleanup() {
  rm -f "$metrics_file"
}
trap cleanup EXIT

cd "$APP_DIR"
pnpm exec tsx scripts/collect-production-metrics.ts >"$metrics_file"
cat "$metrics_file" >>"$METRICS_LOG"
cat "$metrics_file"
