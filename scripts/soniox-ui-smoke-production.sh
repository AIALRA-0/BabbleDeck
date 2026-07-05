#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BASE_URL="${BABBLEDECK_BASE_URL:-https://babbledeck.aialra.online}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
SONIOX_UI_SMOKE_LOG="${BABBLEDECK_SONIOX_UI_SMOKE_LOG:-$LOG_DIR/soniox-ui-smoke.jsonl}"
LOCK_FILE="${BABBLEDECK_SONIOX_UI_SMOKE_LOCK:-$LOG_DIR/soniox-ui-smoke.lock}"
EXPECTED_TEXT="${BABBLEDECK_SONIOX_UI_SMOKE_EXPECTED_TEXT:-Brooklyn}"
SMOKE_TEXT="${BABBLEDECK_SONIOX_UI_SMOKE_TEXT:-Brooklyn bridge speech test for BabbleDeck realtime captions. Brooklyn viewers read live captions on a phone.}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command ffmpeg
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
  echo "SEED_ADMIN_PASSWORD is required for Soniox UI smoke." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck Soniox UI smoke is already active." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fake_audio="$tmp_dir/babbledeck-soniox-ui-smoke.wav"
output_file="$tmp_dir/playwright-output.txt"
record_file="$tmp_dir/record.json"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

safe_text="${SMOKE_TEXT//\\/ }"
safe_text="${safe_text//\'/ }"
safe_text="${safe_text//:/ }"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "flite=text='${safe_text}'" \
  -ar 48000 -ac 1 -sample_fmt s16 "$fake_audio"

duration_seconds=""
if command -v ffprobe >/dev/null 2>&1; then
  duration_seconds="$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$fake_audio" || true)"
fi

cd "$APP_DIR"
set +e
E2E_BASE_URL="$BASE_URL" \
  E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" \
  E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  E2E_RUN_SONIOX_UI_TEST=true \
  E2E_FAKE_AUDIO_FILE="$fake_audio" \
  E2E_SONIOX_EXPECTED_TEXT="$EXPECTED_TEXT" \
  pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "soniox provider streams" \
  >"$output_file" 2>&1
status=$?
set -e

cat "$output_file"
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export started_at finished_at BASE_URL status EXPECTED_TEXT duration_seconds output_file
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
    grep: "soniox provider streams",
    passed,
  },
  fakeAudio: {
    generated: true,
    expectedText: process.env.EXPECTED_TEXT,
    durationSeconds: process.env.duration_seconds
      ? Number(process.env.duration_seconds)
      : null,
  },
};
if (status !== 0) {
  record.error = `Playwright exited with status ${status}.`;
}
process.stdout.write(`${JSON.stringify(record)}\n`);
NODE

cat "$record_file" >>"$SONIOX_UI_SMOKE_LOG"
cat "$record_file"
exit "$status"
