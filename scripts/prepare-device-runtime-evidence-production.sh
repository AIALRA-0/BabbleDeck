#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
OUTPUT_DIR="${BABBLEDECK_DEVICE_RUNTIME_CHECKLIST_DIR:-$LOG_DIR/device-runtime-checklists}"
LOCK_FILE="${BABBLEDECK_DEVICE_RUNTIME_CHECKLIST_LOCK:-$LOG_DIR/device-runtime-checklist.lock}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command flock
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

mkdir -p "$OUTPUT_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck device runtime checklist run is already active." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output_file="$OUTPUT_DIR/$timestamp.md"

cd "$APP_DIR"
pnpm exec tsx scripts/prepare-device-runtime-evidence.ts "$@" >"$output_file"
cat "$output_file"
echo "checklist_file=$output_file"
