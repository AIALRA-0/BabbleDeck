#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BASE_URL="${BABBLEDECK_BASE_URL:-https://babbledeck.aialra.online}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
SONIOX_TRACE_LOG="${BABBLEDECK_SONIOX_TRACE_LOG:-$LOG_DIR/soniox-trace.jsonl}"
LOCK_FILE="${BABBLEDECK_SONIOX_TRACE_LOCK:-$LOG_DIR/soniox-trace.lock}"
TRACE_TEXT="${BABBLEDECK_SONIOX_TRACE_TEXT:-Brooklyn long trace for BabbleDeck captions. The speaker names Spanish and French language checks. Viewers follow captions on a phone while the recording continues. Brooklyn captions remain steady through another Spanish and French sentence. The final Brooklyn sentence confirms the long trace stayed connected.}"
EXPECTED_TEXTS="${BABBLEDECK_SONIOX_TRACE_EXPECTED_TEXTS:-Brooklyn,Spanish,French}"
RECORD_SECONDS="${BABBLEDECK_SONIOX_TRACE_RECORD_SECONDS:-24}"
MIN_USAGE_MS="${BABBLEDECK_SONIOX_TRACE_MIN_USAGE_MS:-10000}"
MIN_AUDIO_CHUNKS="${BABBLEDECK_SONIOX_TRACE_MIN_AUDIO_CHUNKS:-5}"
MIN_SEGMENTS="${BABBLEDECK_SONIOX_TRACE_MIN_SEGMENTS:-1}"

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
  echo "SEED_ADMIN_PASSWORD is required for Soniox trace." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck Soniox trace is already active." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

fake_audio="$tmp_dir/babbledeck-soniox-trace.wav"
output_file="$tmp_dir/playwright-output.txt"
record_file="$tmp_dir/record.json"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
title="Soniox trace $started_at"

safe_text="${TRACE_TEXT//\\/ }"
safe_text="${safe_text//\'/ }"
safe_text="${safe_text//:/ }"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "flite=text='${safe_text}'" \
  -ar 48000 -ac 1 -sample_fmt s16 "$fake_audio"

duration_seconds=""
if command -v ffprobe >/dev/null 2>&1; then
  duration_seconds="$(ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "$fake_audio" || true)"
fi

first_expected="${EXPECTED_TEXTS%%,*}"
e2e_expected_texts="${BABBLEDECK_SONIOX_TRACE_E2E_EXPECTED_TEXTS:-$first_expected}"

cd "$APP_DIR"
set +e
E2E_BASE_URL="$BASE_URL" \
  E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" \
  E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
  E2E_RUN_SONIOX_UI_TEST=true \
  E2E_FAKE_AUDIO_FILE="$fake_audio" \
  E2E_SONIOX_SESSION_TITLE="$title" \
  E2E_SONIOX_EXPECTED_TEXT="$first_expected" \
  E2E_SONIOX_EXPECTED_TEXTS="$e2e_expected_texts" \
  E2E_SONIOX_RECORD_SECONDS="$RECORD_SECONDS" \
  pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "soniox provider streams" \
  >"$output_file" 2>&1
playwright_status=$?
set -e

cat "$output_file"
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

set +e
pnpm exec tsx scripts/soniox-trace-summary.ts \
  "--base-url=$BASE_URL" \
  "--title=$title" \
  "--checked-at=$started_at" \
  "--finished-at=$finished_at" \
  "--playwright-status=$playwright_status" \
  "--playwright-output=$output_file" \
  "--audio-duration-seconds=${duration_seconds:-0}" \
  "--record-seconds=$RECORD_SECONDS" \
  "--expected-texts=$EXPECTED_TEXTS" \
  "--min-usage-ms=$MIN_USAGE_MS" \
  "--min-audio-chunks=$MIN_AUDIO_CHUNKS" \
  "--min-segments=$MIN_SEGMENTS" \
  >"$record_file"
summary_status=$?
set -e

cat "$record_file" >>"$SONIOX_TRACE_LOG"
cat "$record_file"
if [[ "$playwright_status" -ne 0 || "$summary_status" -ne 0 ]]; then
  exit 1
fi
