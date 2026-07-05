#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BASE_URL="${BABBLEDECK_BASE_URL:-https://babbledeck.aialra.online}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
LIVEKIT_UI_SMOKE_LOG="${BABBLEDECK_LIVEKIT_UI_SMOKE_LOG:-$LOG_DIR/livekit-ui-smoke.jsonl}"
LOCK_FILE="${BABBLEDECK_LIVEKIT_UI_SMOKE_LOCK:-$LOG_DIR/livekit-ui-smoke.lock}"

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

if [[ -z "${SEED_ADMIN_PASSWORD:-}" ]]; then
  echo "SEED_ADMIN_PASSWORD is required for LiveKit UI smoke." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck LiveKit UI smoke is already active." >&2
  exit 1
fi

output_file="$(mktemp)"
record_file="$(mktemp)"
cleanup() {
  rm -f "$output_file" "$record_file"
}
trap cleanup EXIT

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cd "$APP_DIR"
set +e
E2E_BASE_URL="$BASE_URL" \
  E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" \
  E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  E2E_RUN_LIVEKIT_UI_TEST=true \
  pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "livekit room audio" \
  >"$output_file" 2>&1
status=$?
set -e

cat "$output_file"
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export started_at finished_at BASE_URL status output_file
node <<'NODE' >"$record_file"
const fs = require("node:fs");

const status = Number(process.env.status);
const output = fs.readFileSync(process.env.output_file, "utf8");
const passed = status === 0 && /\b1 passed\b/.test(output);
const record = {
  app: "babbledeck",
  checkedAt: process.env.started_at,
  finishedAt: process.env.finished_at,
  baseUrl: process.env.BASE_URL,
  ok: status === 0,
  playwright: {
    status,
    project: "chromium-desktop",
    grep: "livekit room audio",
    passed,
  },
};
if (status !== 0) {
  record.error = `Playwright exited with status ${status}.`;
}
process.stdout.write(`${JSON.stringify(record)}\n`);
NODE

cat "$record_file" >>"$LIVEKIT_UI_SMOKE_LOG"
cat "$record_file"
exit "$status"
