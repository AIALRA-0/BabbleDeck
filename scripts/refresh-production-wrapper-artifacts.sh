#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
ARTIFACT_LOG="${BABBLEDECK_WRAPPER_ARTIFACT_LOG:-$LOG_DIR/wrapper-artifacts.jsonl}"
LOCK_FILE="${BABBLEDECK_WRAPPER_ARTIFACT_LOCK:-$LOG_DIR/wrapper-artifacts.lock}"
REFRESH_ANDROID="${BABBLEDECK_WRAPPER_REFRESH_ANDROID:-1}"
DESKTOP_BUILD="${BABBLEDECK_WRAPPER_REFRESH_DESKTOP_BUILD:-auto}"
DESKTOP_SMOKE="${BABBLEDECK_WRAPPER_REFRESH_DESKTOP_SMOKE:-1}"

tmp_files=()
cleanup() {
  for file in "${tmp_files[@]}"; do
    rm -f "$file"
  done
}
trap cleanup EXIT

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

status_line() {
  printf '[wrapper-artifacts] %s\n' "$*"
}

need_command flock
need_command git
need_command node
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

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck wrapper artifact refresh is already active." >&2
  exit 1
fi

cd "$APP_DIR"

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
commit="$(git rev-parse --short=12 HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
android_apk="$APP_DIR/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
desktop_binary="$APP_DIR/apps/desktop/src-tauri/target/release/babbledeck-desktop"
android_build_ran=0
desktop_build_ran=0
desktop_smoke_ran=0

if [[ "$REFRESH_ANDROID" == "1" ]]; then
  status_line "building Android debug APK"
  pnpm --filter @babbledeck/mobile native:build:android
  android_build_ran=1
else
  status_line "skipping Android debug APK build"
fi

if [[ "$DESKTOP_BUILD" == "1" || ( "$DESKTOP_BUILD" == "auto" && ! -x "$desktop_binary" ) ]]; then
  status_line "building desktop release binary"
  pnpm --filter @babbledeck/desktop native:build
  desktop_build_ran=1
else
  status_line "using existing desktop release binary"
fi

if [[ "$DESKTOP_SMOKE" == "1" ]]; then
  status_line "running desktop headless launch smoke"
  pnpm --filter @babbledeck/desktop native:smoke:headless
  desktop_smoke_ran=1
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export started_at finished_at commit branch ARTIFACT_LOG
export android_apk desktop_binary android_build_ran desktop_build_ran desktop_smoke_ran
node <<'NODE'
const fs = require("node:fs");
const crypto = require("node:crypto");

function artifact(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const contents = fs.readFileSync(filePath);
    return {
      path: filePath,
      exists: stat.isFile(),
      sizeBytes: stat.size,
      sha256: crypto.createHash("sha256").update(contents).digest("hex"),
    };
  } catch {
    return {
      path: filePath,
      exists: false,
    };
  }
}

const record = {
  app: "babbledeck",
  startedAt: process.env.started_at,
  finishedAt: process.env.finished_at,
  commit: process.env.commit,
  branch: process.env.branch,
  actions: {
    androidBuildRan: process.env.android_build_ran === "1",
    desktopBuildRan: process.env.desktop_build_ran === "1",
    desktopSmokeRan: process.env.desktop_smoke_ran === "1",
  },
  artifacts: {
    androidDebugApk: artifact(process.env.android_apk),
    desktopReleaseBinary: artifact(process.env.desktop_binary),
  },
};

fs.appendFileSync(process.env.ARTIFACT_LOG, `${JSON.stringify(record)}\n`);
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);

if (!record.artifacts.androidDebugApk.exists) {
  console.error("Android debug APK is missing after wrapper artifact refresh.");
  process.exitCode = 1;
}
if (!record.artifacts.desktopReleaseBinary.exists) {
  console.error(
    "Desktop release binary is missing after wrapper artifact refresh.",
  );
  process.exitCode = 1;
}
NODE
