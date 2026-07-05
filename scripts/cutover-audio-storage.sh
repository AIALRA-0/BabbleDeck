#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BASE_URL="${BABBLEDECK_BASE_URL:-https://babbledeck.aialra.online}"
SOURCE_DIR="${BABBLEDECK_AUDIO_SOURCE_DIR:-/srv/aialra/storage/babbledeck}"
BATCH_SIZE="${BABBLEDECK_AUDIO_CUTOVER_BATCH_SIZE:-500}"
APPLY="${BABBLEDECK_AUDIO_CUTOVER_APPLY:-0}"
RUN_DEPLOY="${BABBLEDECK_AUDIO_CUTOVER_DEPLOY:-1}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

status_line() {
  printf '[audio-cutover] %s\n' "$*"
}

json_field() {
  local file="$1"
  local expr="$2"
  node - <<'NODE' "$file" "$expr"
const fs = require("node:fs");
const [file, expr] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const value = expr.split(".").reduce((current, key) => current?.[key], data);
if (typeof value === "boolean") {
  process.stdout.write(value ? "true" : "false");
} else if (value != null) {
  process.stdout.write(String(value));
}
NODE
}

need_command node
need_command pnpm
need_command mktemp

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR is not a git repository: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [[ "$BATCH_SIZE" -lt 1 ]]; then
  echo "BABBLEDECK_AUDIO_CUTOVER_BATCH_SIZE must be a positive integer." >&2
  exit 1
fi

cd "$APP_DIR"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

SOURCE_AUDIO_STORAGE_DIR="${SOURCE_AUDIO_STORAGE_DIR:-$SOURCE_DIR}"
export SOURCE_AUDIO_STORAGE_DIR

driver="${AUDIO_STORAGE_DRIVER:-local}"
case "${driver,,}" in
  r2 | s3) ;;
  *)
    echo "AUDIO_STORAGE_DRIVER must be r2 or s3 for off-host audio cutover; current value is ${driver}." >&2
    exit 1
    ;;
esac

bucket="${AUDIO_STORAGE_BUCKET:-${R2_BUCKET:-${S3_BUCKET:-}}}"
endpoint="${AUDIO_STORAGE_ENDPOINT:-${R2_ENDPOINT:-${R2_ACCOUNT_ID:-${S3_ENDPOINT:-}}}}"
access_key="${AUDIO_STORAGE_ACCESS_KEY_ID:-${R2_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}}}"
secret_key="${AUDIO_STORAGE_SECRET_ACCESS_KEY:-${R2_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}}}"
requires_endpoint=0
if [[ "${driver,,}" == "r2" ]] ||
  [[ -n "${R2_BUCKET:-}" ]] ||
  [[ -n "${R2_ENDPOINT:-}" ]] ||
  [[ -n "${R2_ACCOUNT_ID:-}" ]] ||
  [[ -n "${AUDIO_STORAGE_ENDPOINT:-}" ]] ||
  [[ -n "${S3_ENDPOINT:-}" ]]; then
  requires_endpoint=1
fi

missing=()
if [[ -z "$bucket" ]]; then
  missing+=("AUDIO_STORAGE_BUCKET/R2_BUCKET/S3_BUCKET")
fi
if [[ "$requires_endpoint" == "1" && -z "$endpoint" ]]; then
  missing+=("AUDIO_STORAGE_ENDPOINT/R2_ENDPOINT/R2_ACCOUNT_ID/S3_ENDPOINT")
fi
if [[ -z "$access_key" ]]; then
  missing+=("AUDIO_STORAGE_ACCESS_KEY_ID/R2_ACCESS_KEY_ID/S3_ACCESS_KEY_ID/AWS_ACCESS_KEY_ID")
fi
if [[ -z "$secret_key" ]]; then
  missing+=("AUDIO_STORAGE_SECRET_ACCESS_KEY/R2_SECRET_ACCESS_KEY/S3_SECRET_ACCESS_KEY/AWS_SECRET_ACCESS_KEY")
fi
if (( ${#missing[@]} > 0 )); then
  printf 'Off-host audio target is incomplete; missing:\n' >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_AUDIO_STORAGE_DIR" ]]; then
  echo "Source audio directory does not exist: $SOURCE_AUDIO_STORAGE_DIR" >&2
  exit 1
fi

status_line "source directory: $SOURCE_AUDIO_STORAGE_DIR"
status_line "target driver: ${driver,,}"
status_line "batch size: $BATCH_SIZE"

dry_run_file="$(mktemp)"
apply_file=""
audit_file=""
cleanup() {
  rm -f "$dry_run_file"
  if [[ -n "$apply_file" ]]; then rm -f "$apply_file"; fi
  if [[ -n "$audit_file" ]]; then rm -f "$audit_file"; fi
}
trap cleanup EXIT

status_line "running migration dry run"
pnpm tsx scripts/migrate-audio-storage.ts --dry-run "--limit=$BATCH_SIZE" | tee "$dry_run_file"
if [[ "$(json_field "$dry_run_file" missingChunks)" != "0" ]] ||
  [[ "$(json_field "$dry_run_file" sizeMismatches)" != "0" ]] ||
  [[ "$(json_field "$dry_run_file" checksumMismatches)" != "0" ]]; then
  echo "Dry run found source audio problems; fix them before cutover." >&2
  exit 1
fi

if [[ "$APPLY" != "1" ]]; then
  status_line "dry run passed; set BABBLEDECK_AUDIO_CUTOVER_APPLY=1 to migrate and deploy"
  exit 0
fi

while true; do
  apply_file="$(mktemp)"
  status_line "migrating next batch"
  pnpm tsx scripts/migrate-audio-storage.ts "--limit=$BATCH_SIZE" | tee "$apply_file"
  if [[ "$(json_field "$apply_file" missingChunks)" != "0" ]] ||
    [[ "$(json_field "$apply_file" sizeMismatches)" != "0" ]] ||
    [[ "$(json_field "$apply_file" checksumMismatches)" != "0" ]]; then
    echo "Migration batch failed validation; inspect the JSON output above." >&2
    exit 1
  fi
  if [[ "$(json_field "$apply_file" hasMore)" != "true" ]]; then
    break
  fi
done

audit_file="$(mktemp)"
status_line "auditing migrated target"
pnpm tsx scripts/audit-audio-storage.ts "--limit=$BATCH_SIZE" --all --require-current-target | tee "$audit_file"
if [[ "$(json_field "$audit_file" ok)" != "true" ]]; then
  echo "Target audit failed; inspect the JSON output above." >&2
  exit 1
fi
if [[ "$(json_field "$audit_file" hasMore)" == "true" ]]; then
  echo "Target audit hit the batch limit; increase BABBLEDECK_AUDIO_CUTOVER_BATCH_SIZE and rerun." >&2
  exit 1
fi

if [[ "$RUN_DEPLOY" == "1" ]]; then
  status_line "running strict production deployment smoke"
  BABBLEDECK_BASE_URL="$BASE_URL" BABBLEDECK_DEPLOY_STRICT=1 pnpm deploy:production
else
  status_line "skipping deploy because BABBLEDECK_AUDIO_CUTOVER_DEPLOY=$RUN_DEPLOY"
fi

status_line "off-host audio cutover passed"
