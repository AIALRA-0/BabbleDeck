#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BASE_URL="${BABBLEDECK_BASE_URL:-https://babbledeck.aialra.online}"
WEB_SERVICE="${BABBLEDECK_WEB_SERVICE:-aialra-babbledeck.service}"
WS_SERVICE="${BABBLEDECK_WS_SERVICE:-aialra-babbledeck-ws.service}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
DEPLOY_LOG="${BABBLEDECK_DEPLOY_LOG:-$LOG_DIR/deployments.jsonl}"
LOCK_FILE="${BABBLEDECK_DEPLOY_LOCK:-$LOG_DIR/deploy.lock}"
ALLOW_DIRTY="${BABBLEDECK_DEPLOY_ALLOW_DIRTY:-0}"
SKIP_BUILD="${BABBLEDECK_DEPLOY_SKIP_BUILD:-0}"
SKIP_E2E="${BABBLEDECK_DEPLOY_SKIP_E2E:-0}"
SKIP_LOGIN_SMOKE="${BABBLEDECK_DEPLOY_SKIP_LOGIN_SMOKE:-0}"
CHECK_SONIOX_LIVE="${BABBLEDECK_DEPLOY_CHECK_SONIOX_LIVE:-1}"
STRICT_READINESS="${BABBLEDECK_DEPLOY_STRICT:-0}"
HTTP_WAIT_SECONDS="${BABBLEDECK_DEPLOY_HTTP_WAIT_SECONDS:-60}"

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
  printf '[deploy] %s\n' "$*"
}

wait_for_https() {
  local deadline=$((SECONDS + HTTP_WAIT_SECONDS))
  local status=0
  while true; do
    if curl -fsSI "$BASE_URL" >/dev/null; then
      return 0
    fi
    status=$?
    if ((SECONDS >= deadline)); then
      echo "HTTPS did not become ready within ${HTTP_WAIT_SECONDS}s." >&2
      return "$status"
    fi
    sleep 2
  done
}

need_command curl
need_command flock
need_command git
need_command node
need_command pnpm
need_command rg
need_command systemctl

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
  echo "Another BabbleDeck deployment is already running." >&2
  exit 1
fi

cd "$APP_DIR"
commit="$(git rev-parse --short=12 HEAD)"
branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$ALLOW_DIRTY" != "1" && -n "$(git status --short)" ]]; then
  echo "Working tree is dirty; set BABBLEDECK_DEPLOY_ALLOW_DIRTY=1 to override." >&2
  git status --short >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [[ -z "${SEED_ADMIN_PASSWORD:-}" ]]; then
  echo "SEED_ADMIN_PASSWORD is required for login smoke." >&2
  exit 1
fi

status_line "deploying commit $commit from $branch to $BASE_URL"

if [[ "$SKIP_BUILD" != "1" ]]; then
  status_line "building standalone output"
  pnpm build --force
fi

status_line "restarting $WEB_SERVICE and $WS_SERVICE"
systemctl restart "$WEB_SERVICE" "$WS_SERVICE"
systemctl is-active "$WEB_SERVICE" "$WS_SERVICE" >/dev/null

status_line "checking service state"
systemctl show "$WEB_SERVICE" -p ActiveState -p SubState -p ExecMainPID -p ExecMainStartTimestamp
systemctl show "$WS_SERVICE" -p ActiveState -p SubState -p ExecMainPID -p ExecMainStartTimestamp

status_line "waiting for HTTPS readiness"
wait_for_https

status_line "checking homepage content"
homepage_file="$(mktemp)"
tmp_files+=("$homepage_file")
curl -fsS "$BASE_URL" >"$homepage_file"
rg -q "BabbleDeck" "$homepage_file"
rg -q "Live multilingual captions" "$homepage_file"
rg -q "Open portal" "$homepage_file"

status_line "running production readiness"
readiness_file="$(mktemp)"
readiness_err="$(mktemp)"
tmp_files+=("$readiness_file" "$readiness_err")
readiness_args=(scripts/check-production-readiness.ts "--base-url=$BASE_URL")
if [[ "$CHECK_SONIOX_LIVE" == "1" ]]; then
  readiness_args+=(--check-soniox-live)
fi
if [[ "$STRICT_READINESS" == "1" ]]; then
  readiness_args+=(--strict)
fi
set +e
pnpm tsx "${readiness_args[@]}" >"$readiness_file" 2>"$readiness_err"
readiness_status=$?
set -e
if [[ -s "$readiness_err" ]]; then
  cat "$readiness_err" >&2
fi

node - <<'NODE' "$readiness_file" "$readiness_status" "$STRICT_READINESS"
const fs = require("node:fs");
const [file, statusText, strictText] = process.argv.slice(2);
let result;
try {
  result = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Could not parse readiness JSON: ${error.message}`);
  process.exit(1);
}
const status = Number(statusText);
const strict = strictText === "1";
const summary = {
  requiredOk: result.requiredOk,
  externalOk: result.externalOk,
  productionReady: result.productionReady,
  status,
};
console.log(JSON.stringify(summary, null, 2));
if (!result.requiredOk) process.exit(1);
if (strict && !result.productionReady) process.exit(1);
NODE

if [[ "$SKIP_LOGIN_SMOKE" != "1" ]]; then
  status_line "running seed-admin login smoke"
  cookie_jar="$(mktemp)"
  login_body="$(mktemp)"
  me_body="$(mktemp)"
  logout_body="$(mktemp)"
  tmp_files+=("$cookie_jar" "$login_body" "$me_body" "$logout_body")
  login_payload="$(node -e 'process.stdout.write(JSON.stringify({email: process.env.SEED_ADMIN_EMAIL || "admin@example.invalid", password: process.env.SEED_ADMIN_PASSWORD}))')"
  login_status="$(
    curl -sS -o "$login_body" -w '%{http_code}' -c "$cookie_jar" \
      -H 'Content-Type: application/json' \
      -X POST "$BASE_URL/api/auth/login" \
      --data "$login_payload"
  )"
  me_status="$(
    curl -sS -o "$me_body" -w '%{http_code}' -b "$cookie_jar" \
      "$BASE_URL/api/auth/me"
  )"
  logout_status="$(
    curl -sS -o "$logout_body" -w '%{http_code}' -b "$cookie_jar" -c "$cookie_jar" \
      -H "Origin: $BASE_URL" \
      -H 'Content-Type: application/json' \
      -X POST "$BASE_URL/api/auth/logout" \
      --data '{}'
  )"
  node - <<'NODE' "$login_status" "$me_status" "$logout_status" "$login_body" "$me_body" "$logout_body"
const fs = require("node:fs");
const [loginStatus, meStatus, logoutStatus, loginPath, mePath, logoutPath] =
  process.argv.slice(2);
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const login = read(loginPath);
const me = read(mePath);
const logout = read(logoutPath);
const summary = {
  loginStatus,
  loginOk: login.ok === true,
  meStatus,
  meOk: me.ok === true,
  meEmail: me.data?.user?.email,
  logoutStatus,
  logoutOk: logout.ok === true,
};
console.log(JSON.stringify(summary, null, 2));
if (
  loginStatus !== "200" ||
  meStatus !== "200" ||
  logoutStatus !== "200" ||
  login.ok !== true ||
  me.ok !== true ||
  logout.ok !== true
) {
  process.exit(1);
}
NODE
fi

if [[ "$SKIP_E2E" != "1" ]]; then
  status_line "running anonymous protected-route Playwright smoke"
  E2E_BASE_URL="$BASE_URL" \
    E2E_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@example.invalid}" \
    E2E_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
    pnpm e2e e2e/mvp.spec.ts --project=chromium-desktop --grep "anonymous users"
fi

deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
web_started="$(systemctl show "$WEB_SERVICE" -P ExecMainStartTimestamp)"
ws_started="$(systemctl show "$WS_SERVICE" -P ExecMainStartTimestamp)"
web_active="$(systemctl show "$WEB_SERVICE" -P ActiveState)"
web_sub="$(systemctl show "$WEB_SERVICE" -P SubState)"
web_restarts="$(systemctl show "$WEB_SERVICE" -P NRestarts)"
web_result="$(systemctl show "$WEB_SERVICE" -P Result)"
ws_active="$(systemctl show "$WS_SERVICE" -P ActiveState)"
ws_sub="$(systemctl show "$WS_SERVICE" -P SubState)"
ws_restarts="$(systemctl show "$WS_SERVICE" -P NRestarts)"
ws_result="$(systemctl show "$WS_SERVICE" -P Result)"
export deployed_at commit branch BASE_URL WEB_SERVICE WS_SERVICE
export web_started web_active web_sub web_restarts web_result
export ws_started ws_active ws_sub ws_restarts ws_result
export readiness_file readiness_status STRICT_READINESS
node <<'NODE' >>"$DEPLOY_LOG"
const fs = require("node:fs");

let readiness = null;
try {
  const result = JSON.parse(fs.readFileSync(process.env.readiness_file, "utf8"));
  readiness = {
    requiredOk: result.requiredOk === true,
    externalOk: result.externalOk === true,
    productionReady: result.productionReady === true,
    strict: process.env.STRICT_READINESS === "1",
    status: Number(process.env.readiness_status ?? 0),
  };
} catch {
  readiness = {
    requiredOk: false,
    externalOk: false,
    productionReady: false,
    strict: process.env.STRICT_READINESS === "1",
    status: Number(process.env.readiness_status ?? 1),
    parseError: true,
  };
}

const record = {
  app: "babbledeck",
  deployedAt: process.env.deployed_at,
  commit: process.env.commit,
  branch: process.env.branch,
  baseUrl: process.env.BASE_URL,
  readiness,
  services: {
    web: {
      name: process.env.WEB_SERVICE,
      startedAt: process.env.web_started,
      activeState: process.env.web_active,
      subState: process.env.web_sub,
      result: process.env.web_result,
      restarts: Number(process.env.web_restarts ?? 0),
    },
    websocket: {
      name: process.env.WS_SERVICE,
      startedAt: process.env.ws_started,
      activeState: process.env.ws_active,
      subState: process.env.ws_sub,
      result: process.env.ws_result,
      restarts: Number(process.env.ws_restarts ?? 0),
    },
  },
};
process.stdout.write(`${JSON.stringify(record)}\n`);
NODE

status_line "deployment smoke passed for $commit"
