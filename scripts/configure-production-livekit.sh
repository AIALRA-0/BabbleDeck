#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
CONFIGURE_LOG="${BABBLEDECK_LIVEKIT_CONFIGURE_LOG:-$LOG_DIR/livekit-configure.jsonl}"
LOCK_FILE="${BABBLEDECK_LIVEKIT_CONFIGURE_LOCK:-$LOG_DIR/livekit-configure.lock}"
RUN_PREFLIGHT="${BABBLEDECK_LIVEKIT_CONFIGURE_PREFLIGHT:-1}"

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
  printf '[livekit-configure] %s\n' "$*"
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
  echo "Another BabbleDeck LiveKit configure run is already active." >&2
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

function first(name, fallback = "") {
  const value = process.env[name];
  return value != null && value.trim() !== "" ? value.trim() : fallback;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function setEnvLine(content, key, value) {
  const line = `${key}=${shellQuote(value)}`;
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${key}=).*$`, "m");
  if (pattern.test(content)) return content.replace(pattern, line);
  const separator = content.endsWith("\n") ? "" : "\n";
  return `${content}${separator}${line}\n`;
}

try {
  const updates = new Map();
  const missing = [];
  const url = first("LIVEKIT_URL");
  const apiKey = first("LIVEKIT_API_KEY");
  const apiSecret = first("LIVEKIT_API_SECRET");
  const ttl = first("LIVEKIT_TOKEN_TTL_SECONDS", "900");
  const rateLimit = first("LIVEKIT_TOKEN_RATE_LIMIT_PER_MINUTE", "60");

  if (!url) missing.push("LIVEKIT_URL");
  if (!apiKey) missing.push("LIVEKIT_API_KEY");
  if (!apiSecret) missing.push("LIVEKIT_API_SECRET");
  if (!/^(wss?|https?):\/\//i.test(url)) {
    missing.push("LIVEKIT_URL with wss, ws, https, or http scheme");
  }
  if (!/^[0-9]+$/.test(ttl) || Number(ttl) <= 0) {
    missing.push("positive LIVEKIT_TOKEN_TTL_SECONDS");
  }
  if (!/^[0-9]+$/.test(rateLimit) || Number(rateLimit) <= 0) {
    missing.push("positive LIVEKIT_TOKEN_RATE_LIMIT_PER_MINUTE");
  }
  if (missing.length > 0) {
    throw new Error(`Missing LiveKit target values: ${missing.join(", ")}.`);
  }

  updates.set("LIVEKIT_URL", url);
  updates.set("LIVEKIT_API_KEY", apiKey);
  updates.set("LIVEKIT_API_SECRET", apiSecret);
  updates.set("LIVEKIT_TOKEN_TTL_SECONDS", ttl);
  updates.set("LIVEKIT_TOKEN_RATE_LIMIT_PER_MINUTE", rateLimit);

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
      livekitHost: new URL(url).host,
      keysUpdated: [...updates.keys()].sort(),
    })}\n`,
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "LiveKit env preparation failed.",
  );
  process.exit(1);
}
NODE

status_line "prepared $(node -e 'const fs=require("node:fs"); const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(`${s.livekitHost} with ${s.keysUpdated.length} env keys`)' "$summary_file")"

if [[ "$RUN_PREFLIGHT" == "1" ]]; then
  status_line "running LiveKit preflight against patched env"
  if ! BABBLEDECK_ENV_FILE="$patched_env" pnpm livekit:preflight:production; then
    echo "Preflight failed; production env was not changed." >&2
    exit 1
  fi
else
  status_line "skipping preflight because BABBLEDECK_LIVEKIT_CONFIGURE_PREFLIGHT=$RUN_PREFLIGHT"
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
    livekitHost: summary.livekitHost,
    keysUpdated: summary.keysUpdated,
    envFile,
    backupFile,
    preflight: preflight === "1" ? "passed" : "skipped",
  })}\n`,
);
NODE

status_line "production env updated; run pnpm deploy:production next"
