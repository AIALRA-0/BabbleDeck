#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
CONFIGURE_LOG="${BABBLEDECK_AUDIO_CONFIGURE_LOG:-$LOG_DIR/audio-storage-configure.jsonl}"
LOCK_FILE="${BABBLEDECK_AUDIO_CONFIGURE_LOCK:-$LOG_DIR/audio-storage-configure.lock}"
RUN_PREFLIGHT="${BABBLEDECK_AUDIO_STORAGE_CONFIGURE_PREFLIGHT:-1}"

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
  printf '[audio-configure] %s\n' "$*"
}

need_command flock
need_command mktemp
need_command node
need_command pnpm

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR is not a git repository: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck audio storage configure run is already active." >&2
  exit 1
fi

cd "$APP_DIR"

patched_env="$(mktemp)"
summary_file="$(mktemp)"
tmp_files+=("$patched_env" "$summary_file")

status_line "preparing patched env without printing secrets"
ENV_FILE="$ENV_FILE" \
  OUTPUT_ENV_FILE="$patched_env" \
  SUMMARY_FILE="$summary_file" \
  node <<'NODE'
const fs = require("node:fs");

const envFile = process.env.ENV_FILE;
const outputFile = process.env.OUTPUT_ENV_FILE;
const summaryFile = process.env.SUMMARY_FILE;

function first(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value != null && value.trim() !== "") return value.trim();
  }
  return "";
}

function boolHint(...names) {
  return names.some((name) => {
    const value = process.env[name];
    return value != null && value.trim() !== "";
  });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function setEnvLine(content, key, value) {
  const line = `${key}=${shellQuote(value)}`;
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${key}=).*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const separator = content.endsWith("\n") ? "" : "\n";
  return `${content}${separator}${line}\n`;
}

try {
const requestedDriver = first("BABBLEDECK_AUDIO_STORAGE_DRIVER");
const ambientDriver = first("AUDIO_STORAGE_DRIVER").toLowerCase();
const r2Hints = boolHint(
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
);
const s3Hints = boolHint(
  "S3_BUCKET",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
);
const genericHints = boolHint(
  "AUDIO_STORAGE_BUCKET",
  "AUDIO_STORAGE_ENDPOINT",
  "AUDIO_STORAGE_ACCESS_KEY_ID",
  "AUDIO_STORAGE_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
);

let targetDriver = requestedDriver.toLowerCase();
if (!targetDriver) {
  if (ambientDriver === "r2" || ambientDriver === "s3") {
    targetDriver = ambientDriver;
  } else if (r2Hints) {
    targetDriver = "r2";
  } else if (s3Hints || genericHints) {
    targetDriver = "s3";
  }
}

if (targetDriver !== "r2" && targetDriver !== "s3") {
  throw new Error(
    "Set BABBLEDECK_AUDIO_STORAGE_DRIVER to r2 or s3, or provide R2/S3 target variables.",
  );
}

const updates = new Map();
const missing = [];
updates.set("AUDIO_STORAGE_DRIVER", targetDriver);

if (targetDriver === "r2") {
  const accountId = first("R2_ACCOUNT_ID");
  const endpoint = first("R2_ENDPOINT", "AUDIO_STORAGE_ENDPOINT");
  const bucket = first("R2_BUCKET", "AUDIO_STORAGE_BUCKET");
  const accessKey = first(
    "R2_ACCESS_KEY_ID",
    "AUDIO_STORAGE_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  );
  const secretKey = first(
    "R2_SECRET_ACCESS_KEY",
    "AUDIO_STORAGE_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  );

  if (!accountId && !endpoint) missing.push("R2_ACCOUNT_ID or R2_ENDPOINT");
  if (!bucket) missing.push("R2_BUCKET or AUDIO_STORAGE_BUCKET");
  if (!accessKey) {
    missing.push("R2_ACCESS_KEY_ID or AUDIO_STORAGE_ACCESS_KEY_ID");
  }
  if (!secretKey) {
    missing.push("R2_SECRET_ACCESS_KEY or AUDIO_STORAGE_SECRET_ACCESS_KEY");
  }

  if (accountId) updates.set("R2_ACCOUNT_ID", accountId);
  if (endpoint) updates.set("R2_ENDPOINT", endpoint);
  if (bucket) updates.set("R2_BUCKET", bucket);
  if (accessKey) updates.set("R2_ACCESS_KEY_ID", accessKey);
  if (secretKey) updates.set("R2_SECRET_ACCESS_KEY", secretKey);
  updates.set("AUDIO_STORAGE_REGION", "auto");
} else {
  const bucket = first("AUDIO_STORAGE_BUCKET", "S3_BUCKET");
  const endpoint = first("AUDIO_STORAGE_ENDPOINT", "S3_ENDPOINT");
  const region = first("AUDIO_STORAGE_REGION", "AWS_REGION") || "us-east-1";
  const accessKey = first(
    "AUDIO_STORAGE_ACCESS_KEY_ID",
    "S3_ACCESS_KEY_ID",
    "AWS_ACCESS_KEY_ID",
  );
  const secretKey = first(
    "AUDIO_STORAGE_SECRET_ACCESS_KEY",
    "S3_SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  );
  const forcePathStyle = first("AUDIO_STORAGE_FORCE_PATH_STYLE");

  if (!bucket) missing.push("AUDIO_STORAGE_BUCKET or S3_BUCKET");
  if (!accessKey) {
    missing.push("AUDIO_STORAGE_ACCESS_KEY_ID or S3_ACCESS_KEY_ID");
  }
  if (!secretKey) {
    missing.push("AUDIO_STORAGE_SECRET_ACCESS_KEY or S3_SECRET_ACCESS_KEY");
  }

  if (bucket) updates.set("AUDIO_STORAGE_BUCKET", bucket);
  if (endpoint) updates.set("AUDIO_STORAGE_ENDPOINT", endpoint);
  updates.set("AUDIO_STORAGE_REGION", region);
  if (accessKey) updates.set("AUDIO_STORAGE_ACCESS_KEY_ID", accessKey);
  if (secretKey) updates.set("AUDIO_STORAGE_SECRET_ACCESS_KEY", secretKey);
  if (forcePathStyle) {
    updates.set("AUDIO_STORAGE_FORCE_PATH_STYLE", forcePathStyle);
  }
}

if (missing.length > 0) {
  throw new Error(`Missing audio storage target values: ${missing.join(", ")}.`);
}

let content = fs.readFileSync(envFile, "utf8");
for (const [key, value] of updates.entries()) {
  content = setEnvLine(content, key, value);
}
fs.writeFileSync(outputFile, content, { mode: 0o600 });
fs.writeFileSync(
  summaryFile,
  `${JSON.stringify({
    app: "babbledeck",
    preparedAt: new Date().toISOString(),
    targetDriver,
    keysUpdated: [...updates.keys()].sort(),
  })}\n`,
);
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Audio storage env preparation failed.",
  );
  process.exit(1);
}
NODE

status_line "prepared $(node -e 'const fs=require("node:fs"); const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(`${s.targetDriver} target with ${s.keysUpdated.length} env keys`)' "$summary_file")"

if [[ "$RUN_PREFLIGHT" == "1" ]]; then
  status_line "running off-host storage preflight against patched env"
  if ! BABBLEDECK_ENV_FILE="$patched_env" pnpm audio:preflight:production; then
    echo "Preflight failed; production env was not changed." >&2
    exit 1
  fi
else
  status_line "skipping preflight because BABBLEDECK_AUDIO_STORAGE_CONFIGURE_PREFLIGHT=$RUN_PREFLIGHT"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="${ENV_FILE}.${timestamp}.bak"
status_line "backing up current env to $backup_file"
cp -p "$ENV_FILE" "$backup_file"
chmod go-rwx "$backup_file" || true

status_line "installing patched production env"
cp "$patched_env" "$ENV_FILE"
chmod go-rwx "$ENV_FILE" || true

node - "$summary_file" "$CONFIGURE_LOG" "$ENV_FILE" "$backup_file" "$RUN_PREFLIGHT" <<'NODE'
const fs = require("node:fs");
const [summaryFile, configureLog, envFile, backupFile, preflight] =
  process.argv.slice(2);
const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
fs.appendFileSync(
  configureLog,
  `${JSON.stringify({
    app: "babbledeck",
    configuredAt: new Date().toISOString(),
    targetDriver: summary.targetDriver,
    keysUpdated: summary.keysUpdated,
    envFile,
    backupFile,
    preflight: preflight === "1" ? "passed" : "skipped",
  })}\n`,
);
NODE

status_line "production env updated; run pnpm audio:cutover:production next"
