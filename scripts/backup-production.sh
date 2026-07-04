#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-/srv/aialra/apps/codexapp/state/browser-workspaces/2026-07-04-babbledeck}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BACKUP_ROOT="${BABBLEDECK_BACKUP_ROOT:-/srv/aialra/backups/babbledeck}"
POSTGRES_CONTAINER="${BABBLEDECK_POSTGRES_CONTAINER:-2026-07-04-babbledeck-postgres-1}"
RETENTION_DAYS="${BABBLEDECK_BACKUP_RETENTION_DAYS:-14}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required in $ENV_FILE" >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_ROOT"
LOCK_FILE="$BACKUP_ROOT/.backup.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck backup is already running." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$BACKUP_ROOT/$timestamp"
mkdir -p "$backup_dir"

db_name="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(u.pathname.slice(1));')"
db_user="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(decodeURIComponent(u.username || ""));')"
git_commit="$(git -C "$APP_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

dump_file="$backup_dir/db.dump"
counts_file="$backup_dir/db-counts.json"
audio_file="$backup_dir/audio.tar.gz"
manifest_file="$backup_dir/manifest.json"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump --format=custom --no-owner --no-acl --file "$dump_file" "$DATABASE_URL"
else
  docker exec "$POSTGRES_CONTAINER" pg_dump \
    --format=custom \
    --no-owner \
    --no-acl \
    --username "$db_user" \
    --dbname "$db_name" >"$dump_file"
fi

counts_query="
select json_build_object(
  'users', (select count(*) from users),
  'live_sessions', (select count(*) from live_sessions),
  'audio_chunks', (select count(*) from audio_chunks),
  'provider_usage', (select count(*) from provider_usage),
  'transcript_events', (select count(*) from transcript_events),
  'transcript_segments', (select count(*) from transcript_segments),
  'translations', (select count(*) from translations),
  'exports', (select count(*) from exports),
  'audit_logs', (select count(*) from audit_logs)
)::text;
"

if command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -Atc "$counts_query" >"$counts_file"
else
  docker exec "$POSTGRES_CONTAINER" psql \
    --username "$db_user" \
    --dbname "$db_name" \
    -Atc "$counts_query" >"$counts_file"
fi

audio_driver="${AUDIO_STORAGE_DRIVER:-local}"
audio_dir="${AUDIO_STORAGE_DIR:-}"
audio_included=false
if [[ "$audio_driver" == "local" && -n "$audio_dir" && -d "$audio_dir" ]]; then
  tar -C "$audio_dir" -czf "$audio_file" .
  audio_included=true
fi

sha256sum "$dump_file" >"$backup_dir/db.dump.sha256"
if [[ -f "$audio_file" ]]; then
  sha256sum "$audio_file" >"$backup_dir/audio.tar.gz.sha256"
fi

export backup_dir timestamp git_commit db_name audio_driver audio_included
node <<'JS' >"$manifest_file"
const fs = require("node:fs");
const path = require("node:path");

const backupDir = process.env.backup_dir;
const statOrNull = (name) => {
  const file = path.join(backupDir, name);
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  return { bytes: stat.size };
};

const manifest = {
  app: "babbledeck",
  createdAt: process.env.timestamp,
  gitCommit: process.env.git_commit,
  database: process.env.db_name,
  backupDir,
  databaseDump: statOrNull("db.dump"),
  databaseCounts: JSON.parse(fs.readFileSync(path.join(backupDir, "db-counts.json"), "utf8")),
  audio: {
    driver: process.env.audio_driver,
    included: process.env.audio_included === "true",
    archive: statOrNull("audio.tar.gz"),
  },
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
JS

find "$BACKUP_ROOT" \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -name '20??????T??????Z' \
  -mtime "+$RETENTION_DAYS" \
  -exec rm -rf {} +

echo "backup_dir=$backup_dir"
