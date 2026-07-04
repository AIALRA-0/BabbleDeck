#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
POSTGRES_CONTAINER="${BABBLEDECK_POSTGRES_CONTAINER:-2026-07-04-babbledeck-postgres-1}"

usage() {
  cat >&2 <<'EOF'
Usage:
  TARGET_DATABASE_URL=postgresql://... scripts/restore-backup.sh /path/to/backup

Optional:
  RESTORE_AUDIO=1 TARGET_AUDIO_STORAGE_DIR=/tmp/babbledeck-audio-restore scripts/restore-backup.sh /path/to/backup

Safety:
  The script refuses to restore into production DATABASE_URL or AUDIO_STORAGE_DIR unless
  ALLOW_PRODUCTION_RESTORE=I_UNDERSTAND is set.
EOF
}

backup_dir="${1:-}"
if [[ -z "$backup_dir" ]]; then
  usage
  exit 1
fi

if [[ ! -d "$backup_dir" || ! -f "$backup_dir/db.dump" ]]; then
  echo "Backup directory with db.dump is required." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "TARGET_DATABASE_URL is required." >&2
  exit 1
fi

if [[ "${TARGET_DATABASE_URL}" == "${DATABASE_URL:-}" && "${ALLOW_PRODUCTION_RESTORE:-}" != "I_UNDERSTAND" ]]; then
  echo "Refusing to restore into production DATABASE_URL without ALLOW_PRODUCTION_RESTORE=I_UNDERSTAND." >&2
  exit 1
fi

target_db_name="$(node -e 'const u=new URL(process.env.TARGET_DATABASE_URL); console.log(u.pathname.slice(1));')"
target_db_user="$(node -e 'const u=new URL(process.env.TARGET_DATABASE_URL); console.log(decodeURIComponent(u.username || ""));')"
target_host="$(node -e 'const u=new URL(process.env.TARGET_DATABASE_URL); console.log(u.hostname);')"
target_port="$(node -e 'const u=new URL(process.env.TARGET_DATABASE_URL); console.log(u.port);')"

if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --clean --if-exists --no-owner --no-acl --dbname "$TARGET_DATABASE_URL" "$backup_dir/db.dump"
elif [[ "$target_host" == "127.0.0.1" && "$target_port" == "55432" ]]; then
  docker exec -i "$POSTGRES_CONTAINER" pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    --username "$target_db_user" \
    --dbname "$target_db_name" <"$backup_dir/db.dump"
else
  echo "pg_restore is not installed and target DB is not the local BabbleDeck Postgres container." >&2
  exit 1
fi

if [[ "${RESTORE_AUDIO:-0}" == "1" ]]; then
  if [[ ! -f "$backup_dir/audio.tar.gz" ]]; then
    echo "RESTORE_AUDIO=1 was requested but audio.tar.gz is missing." >&2
    exit 1
  fi
  if [[ -z "${TARGET_AUDIO_STORAGE_DIR:-}" ]]; then
    echo "TARGET_AUDIO_STORAGE_DIR is required when RESTORE_AUDIO=1." >&2
    exit 1
  fi
  if [[ "${TARGET_AUDIO_STORAGE_DIR}" == "${AUDIO_STORAGE_DIR:-}" && "${ALLOW_PRODUCTION_RESTORE:-}" != "I_UNDERSTAND" ]]; then
    echo "Refusing to restore into production AUDIO_STORAGE_DIR without ALLOW_PRODUCTION_RESTORE=I_UNDERSTAND." >&2
    exit 1
  fi
  mkdir -p "$TARGET_AUDIO_STORAGE_DIR"
  if find "$TARGET_AUDIO_STORAGE_DIR" -mindepth 1 -print -quit | grep -q . && [[ "${RESTORE_AUDIO_OVERWRITE:-0}" != "1" ]]; then
    echo "Target audio directory is not empty. Set RESTORE_AUDIO_OVERWRITE=1 to continue." >&2
    exit 1
  fi
  tar -C "$TARGET_AUDIO_STORAGE_DIR" -xzf "$backup_dir/audio.tar.gz"
fi

echo "restore_completed=true"
