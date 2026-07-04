#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BACKUP_ROOT="${BABBLEDECK_BACKUP_ROOT:-/srv/aialra/backups/babbledeck}"
POSTGRES_CONTAINER="${BABBLEDECK_POSTGRES_CONTAINER:-2026-07-04-babbledeck-postgres-1}"

backup_dir="${1:-latest}"
if [[ "$backup_dir" == "latest" ]]; then
  backup_dir="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' | sort | tail -n 1)"
fi

if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
  echo "No backup directory found." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

source_db_user="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(decodeURIComponent(u.username || ""));')"
temp_db="babbledeck_restore_verify_$(date -u +%Y%m%d%H%M%S)_$$"
target_url="$(node -e 'const u=new URL(process.env.DATABASE_URL); u.pathname = `/'"$temp_db"'`; console.log(u.toString());')"
audio_target="$(mktemp -d /tmp/babbledeck-audio-restore.XXXXXX)"

cleanup() {
  docker exec "$POSTGRES_CONTAINER" dropdb --if-exists --username "$source_db_user" "$temp_db" >/dev/null 2>&1 || true
  rm -rf "$audio_target"
}
trap cleanup EXIT

docker exec "$POSTGRES_CONTAINER" createdb --username "$source_db_user" "$temp_db"

TARGET_DATABASE_URL="$target_url" \
RESTORE_AUDIO=1 \
TARGET_AUDIO_STORAGE_DIR="$audio_target" \
"$(dirname "$0")/restore-backup.sh" "$backup_dir" >/dev/null

counts_query="
select json_build_object(
  'users', (select count(*) from users),
  'live_sessions', (select count(*) from live_sessions),
  'audio_chunks', (select count(*) from audio_chunks),
  'provider_usage', (select count(*) from provider_usage),
  'transcript_events', (select count(*) from transcript_events)
)::text;
"

docker exec "$POSTGRES_CONTAINER" psql --username "$source_db_user" --dbname "$temp_db" -Atc "$counts_query" >"$backup_dir/verify-counts.last.json"

audio_files="$(find "$audio_target" -type f | wc -l)"
echo "verified_backup=$backup_dir"
echo "verified_database=$temp_db"
echo "verified_audio_files=$audio_files"
