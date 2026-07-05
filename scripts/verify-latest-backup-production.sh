#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
VERIFY_LOG="${BABBLEDECK_BACKUP_VERIFY_LOG:-$LOG_DIR/backup-verify.jsonl}"
LOCK_FILE="${BABBLEDECK_BACKUP_VERIFY_LOCK:-$LOG_DIR/backup-verify.lock}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command flock
need_command node
need_command mktemp

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR is not a git repository: $APP_DIR" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck backup verification is already active." >&2
  exit 1
fi

output_file="$(mktemp)"
err_file="$(mktemp)"
cleanup() {
  rm -f "$output_file" "$err_file"
}
trap cleanup EXIT

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
set +e
"$APP_DIR/scripts/verify-backup.sh" latest >"$output_file" 2>"$err_file"
verify_status=$?
set -e
finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export started_at finished_at verify_status output_file err_file
node <<'NODE' >>"$VERIFY_LOG"
const fs = require("node:fs");

const output = fs.readFileSync(process.env.output_file, "utf8");
const error = fs.readFileSync(process.env.err_file, "utf8").trim();
const fields = Object.fromEntries(
  output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=");
      return index === -1
        ? [line, ""]
        : [line.slice(0, index), line.slice(index + 1)];
    }),
);

const record = {
  app: "babbledeck",
  checkedAt: process.env.started_at,
  finishedAt: process.env.finished_at,
  ok: Number(process.env.verify_status) === 0,
  status: Number(process.env.verify_status),
  backupDir: fields.verified_backup,
  verifiedDatabase: fields.verified_database,
  verifiedAudioFiles:
    fields.verified_audio_files == null
      ? undefined
      : Number(fields.verified_audio_files),
  error: error || undefined,
};

process.stdout.write(`${JSON.stringify(record)}\n`);
if (!record.ok) process.exitCode = record.status || 1;
NODE
