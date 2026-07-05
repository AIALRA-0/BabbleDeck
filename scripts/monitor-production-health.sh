#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BABBLEDECK_HEALTH_BASE_URL:-https://babbledeck.aialra.online}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
HEALTH_LOG="${BABBLEDECK_HEALTH_LOG:-$LOG_DIR/health-monitor.jsonl}"
ALERT_LOG="${BABBLEDECK_HEALTH_ALERT_LOG:-$LOG_DIR/health-alerts.jsonl}"
ALERT_STATE="${BABBLEDECK_HEALTH_ALERT_STATE:-$LOG_DIR/health-monitor-state.json}"
LOCK_FILE="${BABBLEDECK_HEALTH_LOCK:-$LOG_DIR/health-monitor.lock}"
TIMEOUT_SECONDS="${BABBLEDECK_HEALTH_TIMEOUT_SECONDS:-10}"
ALERT_THRESHOLD="${BABBLEDECK_HEALTH_ALERT_THRESHOLD:-3}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command curl
need_command flock
need_command node
need_command mktemp

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "Another BabbleDeck health monitor run is already active." >&2
  exit 1
fi

body_file="$(mktemp)"
err_file="$(mktemp)"
cleanup() {
  rm -f "$body_file" "$err_file"
}
trap cleanup EXIT

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
health_url="${BASE_URL%/}/api/health"

set +e
curl_meta="$(
  curl -sS \
    --max-time "$TIMEOUT_SECONDS" \
    -o "$body_file" \
    -w '%{http_code} %{time_total}' \
    "$health_url" 2>"$err_file"
)"
curl_status=$?
set -e

http_status="${curl_meta%% *}"
time_total="${curl_meta##* }"
curl_error=""
if [[ -s "$err_file" ]]; then
  curl_error="$(tr '\n' ' ' <"$err_file" | sed 's/[[:space:]]*$//')"
fi

export started_at BASE_URL health_url http_status time_total curl_status curl_error body_file ALERT_LOG ALERT_STATE ALERT_THRESHOLD
node <<'NODE' >>"$HEALTH_LOG"
const fs = require("node:fs");

function readState() {
  try {
    const raw = fs.readFileSync(process.env.ALERT_STATE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(process.env.ALERT_STATE, `${JSON.stringify(state)}\n`);
}

function appendAlert(record) {
  fs.appendFileSync(process.env.ALERT_LOG, `${JSON.stringify(record)}\n`);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const readBody = () => {
  try {
    return fs.readFileSync(process.env.body_file, "utf8");
  } catch {
    return "";
  }
};

const parseBody = () => {
  const raw = readBody();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const body = parseBody();
const health = body?.data ?? {};
const checks = health.checks ?? {};
const record = {
  app: "babbledeck",
  checkedAt: process.env.started_at,
  baseUrl: process.env.BASE_URL,
  url: process.env.health_url,
  httpStatus: Number(process.env.http_status || 0),
  responseMs: Math.round(Number(process.env.time_total || 0) * 1000),
  ok: body?.ok === true,
  healthStatus: health.status ?? "unknown",
  databaseOk: checks.database?.ok === true,
  audioStorageOk: checks.audioStorage?.ok === true,
  audioStorageDriver: checks.audioStorage?.driver ?? "unknown",
  offHostAudioReady: checks.audioStorage?.offHostReady === true,
  sonioxConfigured: checks.providers?.soniox?.configured === true,
  curlStatus: Number(process.env.curl_status || 0),
  error: process.env.curl_error || undefined,
};
const unhealthy =
  record.curlStatus !== 0 ||
  record.httpStatus < 200 ||
  record.httpStatus >= 300 ||
  !record.ok ||
  !record.databaseOk ||
  !record.audioStorageOk;

const previous = readState();
const previousFailureStreak = Number(previous.failureStreak ?? 0);
const threshold = positiveInteger(process.env.ALERT_THRESHOLD, 3);
const failureStreak = unhealthy ? previousFailureStreak + 1 : 0;
const alertWasActive = previous.alertActive === true;
const alertActive = unhealthy && (alertWasActive || failureStreak >= threshold);

if (unhealthy && failureStreak >= threshold && !alertWasActive) {
  appendAlert({
    app: "babbledeck",
    event: "health_alert_opened",
    checkedAt: record.checkedAt,
    baseUrl: record.baseUrl,
    failureStreak,
    threshold,
    httpStatus: record.httpStatus,
    curlStatus: record.curlStatus,
    healthStatus: record.healthStatus,
    databaseOk: record.databaseOk,
    audioStorageOk: record.audioStorageOk,
    error: record.error,
  });
}

if (!unhealthy && alertWasActive) {
  appendAlert({
    app: "babbledeck",
    event: "health_alert_recovered",
    checkedAt: record.checkedAt,
    baseUrl: record.baseUrl,
    previousFailureStreak,
    threshold,
    httpStatus: record.httpStatus,
    healthStatus: record.healthStatus,
  });
}

writeState({
  app: "babbledeck",
  checkedAt: record.checkedAt,
  baseUrl: record.baseUrl,
  alertActive,
  failureStreak,
  threshold,
  lastOk: !unhealthy,
  lastHttpStatus: record.httpStatus,
  lastCurlStatus: record.curlStatus,
  lastHealthStatus: record.healthStatus,
});

process.stdout.write(`${JSON.stringify(record)}\n`);

if (unhealthy) {
  process.exitCode = 1;
}
NODE
