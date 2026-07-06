#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
CLEANUP_LOG="${BABBLEDECK_BUILD_CACHE_CLEANUP_LOG:-$LOG_DIR/build-cache-cleanups.jsonl}"
LOCK_FILE="${BABBLEDECK_BUILD_CACHE_CLEANUP_LOCK:-$LOG_DIR/build-cache-cleanup.lock}"
DEPLOY_LOCK_FILE="${BABBLEDECK_DEPLOY_LOCK:-$LOG_DIR/deploy.lock}"
DRY_RUN="${BABBLEDECK_BUILD_CACHE_CLEANUP_DRY_RUN:-0}"
CACHE_HOME="${BABBLEDECK_BUILD_CACHE_HOME:-${HOME:-/root}}"
ROOT_CACHE_HOME="${BABBLEDECK_BUILD_CACHE_ROOT_HOME:-/root}"
declare -A SEEN_CLEANUP_PATHS=()

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

path_size_mb() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    printf '0'
    return
  fi
  du -sm "$target" 2>/dev/null | awk '{print $1}'
}

available_mb() {
  df -Pm / | awk 'NR == 2 {print $4}'
}

record_path() {
  local target="$1"
  local reason="$2"
  local size_mb
  size_mb="$(path_size_mb "$target")"
  node - "$paths_file" "$target" "$reason" "$size_mb" "$DRY_RUN" <<'NODE'
const fs = require("node:fs");
const [file, path, reason, sizeMb, dryRun] = process.argv.slice(2);
fs.appendFileSync(
  file,
  `${JSON.stringify({
    path,
    reason,
    existed: Number(sizeMb) > 0,
    sizeMb: Number(sizeMb),
    removed: dryRun !== "1" && Number(sizeMb) > 0,
  })}\n`,
);
NODE
}

remove_path() {
  local target="$1"
  local reason="$2"
  if [[ -n "${SEEN_CLEANUP_PATHS[$target]:-}" ]]; then
    return
  fi
  SEEN_CLEANUP_PATHS[$target]=1
  record_path "$target" "$reason"
  if [[ "$DRY_RUN" != "1" ]]; then
    rm -rf "$target"
  fi
}

need_command df
need_command du
need_command flock
need_command node
need_command pnpm

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR is not a git repository: $APP_DIR" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck build-cache cleanup is already active." >&2
  exit 1
fi

exec 8>"$DEPLOY_LOCK_FILE"
if ! flock -n 8; then
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node - "$CLEANUP_LOG" "$now" <<'NODE'
const fs = require("node:fs");
const [cleanupLog, now] = process.argv.slice(2);
const record = {
  app: "babbledeck",
  startedAt: now,
  finishedAt: now,
  dryRun: false,
  skipped: true,
  reason: "deployment lock is active",
  disk: null,
  paths: [],
};
fs.appendFileSync(cleanupLog, `${JSON.stringify(record)}\n`);
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
NODE
  exit 0
fi

paths_file="$(mktemp)"
trap 'rm -f "$paths_file"' EXIT

cd "$APP_DIR"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
before_available_mb="$(available_mb)"

if [[ -x "$APP_DIR/apps/mobile/android/gradlew" && "$DRY_RUN" != "1" ]]; then
  "$APP_DIR/apps/mobile/android/gradlew" -p "$APP_DIR/apps/mobile/android" --stop >/dev/null 2>&1 || true
fi

remove_path "$APP_DIR/.turbo" "turbo task cache"
remove_path "$APP_DIR/apps/web/.next" "local Next build output; production serves immutable release directories"
remove_path "$CACHE_HOME/.cache/pnpm" "pnpm HTTP metadata cache"
remove_path "$ROOT_CACHE_HOME/.cache/pnpm" "root pnpm HTTP metadata cache"
remove_path "$CACHE_HOME/.gradle/caches" "Gradle dependency/build cache"
remove_path "$CACHE_HOME/.gradle/daemon" "Gradle daemon state"
remove_path "$CACHE_HOME/.gradle/.tmp" "Gradle temporary cache"
remove_path "$CACHE_HOME/.gradle/wrapper/dists" "Gradle wrapper distribution cache"
remove_path "$ROOT_CACHE_HOME/.gradle/caches" "root Gradle dependency/build cache"
remove_path "$ROOT_CACHE_HOME/.gradle/daemon" "root Gradle daemon state"
remove_path "$ROOT_CACHE_HOME/.gradle/.tmp" "root Gradle temporary cache"
remove_path "$ROOT_CACHE_HOME/.gradle/wrapper/dists" "root Gradle wrapper distribution cache"
remove_path "$APP_DIR/apps/desktop/src-tauri/target/release/deps" "Rust release dependency artifacts; release binary is preserved"
remove_path "$APP_DIR/apps/desktop/src-tauri/target/release/.fingerprint" "Rust release fingerprint artifacts"

if [[ "$DRY_RUN" != "1" ]]; then
  pnpm store prune >/dev/null 2>&1 || true
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
after_available_mb="$(available_mb)"
node - "$paths_file" "$CLEANUP_LOG" "$started_at" "$finished_at" "$before_available_mb" "$after_available_mb" "$DRY_RUN" <<'NODE'
const fs = require("node:fs");
const [
  pathsFile,
  cleanupLog,
  startedAt,
  finishedAt,
  beforeAvailableMb,
  afterAvailableMb,
  dryRun,
] = process.argv.slice(2);
const paths = fs
  .readFileSync(pathsFile, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const plannedRemovedMb = paths
  .filter((item) => item.removed)
  .reduce((total, item) => total + Number(item.sizeMb ?? 0), 0);
const record = {
  app: "babbledeck",
  startedAt,
  finishedAt,
  dryRun: dryRun === "1",
  disk: {
    beforeAvailableMb: Number(beforeAvailableMb),
    afterAvailableMb: Number(afterAvailableMb),
    freedMb: Number(afterAvailableMb) - Number(beforeAvailableMb),
    plannedRemovedMb,
  },
  paths,
};
fs.appendFileSync(cleanupLog, `${JSON.stringify(record)}\n`);
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
NODE
