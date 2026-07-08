#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
BASE_URL="${BABBLEDECK_BASE_URL:-https://babbledeck.aialra.online}"
WEB_SERVICE="${BABBLEDECK_WEB_SERVICE:-aialra-babbledeck.service}"
WS_SERVICE="${BABBLEDECK_WS_SERVICE:-aialra-babbledeck-ws.service}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
DEPLOY_LOG="${BABBLEDECK_DEPLOY_LOG:-$LOG_DIR/deployments.jsonl}"
WRAPPER_ARTIFACT_LOG="${BABBLEDECK_WRAPPER_ARTIFACT_LOG:-$LOG_DIR/wrapper-artifacts.jsonl}"
LOCK_FILE="${BABBLEDECK_DEPLOY_LOCK:-$LOG_DIR/deploy.lock}"
ALLOW_DIRTY="${BABBLEDECK_DEPLOY_ALLOW_DIRTY:-0}"
SKIP_BUILD="${BABBLEDECK_DEPLOY_SKIP_BUILD:-0}"
SKIP_E2E="${BABBLEDECK_DEPLOY_SKIP_E2E:-0}"
SKIP_LOGIN_SMOKE="${BABBLEDECK_DEPLOY_SKIP_LOGIN_SMOKE:-0}"
SKIP_WRAPPER_REFRESH="${BABBLEDECK_DEPLOY_SKIP_WRAPPER_REFRESH:-0}"
CHECK_SONIOX_LIVE="${BABBLEDECK_DEPLOY_CHECK_SONIOX_LIVE:-1}"
STRICT_READINESS="${BABBLEDECK_DEPLOY_STRICT:-0}"
HTTP_WAIT_SECONDS="${BABBLEDECK_DEPLOY_HTTP_WAIT_SECONDS:-60}"
USE_RELEASE_DIR="${BABBLEDECK_DEPLOY_USE_RELEASE_DIR:-1}"
RELEASE_ROOT="${BABBLEDECK_RELEASE_ROOT:-/srv/aialra/releases/babbledeck}"
RELEASE_CURRENT_LINK="${BABBLEDECK_RELEASE_CURRENT_LINK:-$RELEASE_ROOT/current}"
WEB_SERVICE_DROPIN_DIR="${BABBLEDECK_WEB_SERVICE_DROPIN_DIR:-/etc/systemd/system/$WEB_SERVICE.d}"
WEB_SERVICE_RELEASE_DROPIN="${BABBLEDECK_WEB_SERVICE_RELEASE_DROPIN:-$WEB_SERVICE_DROPIN_DIR/release.conf}"
RELEASE_PRUNE="${BABBLEDECK_RELEASE_PRUNE:-1}"
RELEASES_KEEP="${BABBLEDECK_RELEASES_KEEP:-5}"
MIN_FREE_MB="${BABBLEDECK_DEPLOY_MIN_FREE_MB:-3072}"
DISK_PATHS="${BABBLEDECK_DEPLOY_DISK_PATHS:-$APP_DIR:$RELEASE_ROOT:$LOG_DIR:/tmp}"

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

check_deploy_disk_space() {
  disk_summary_file="$(mktemp)"
  tmp_files+=("$disk_summary_file")

  DEPLOY_DISK_PATHS="$DISK_PATHS" \
    DEPLOY_MIN_FREE_MB="$MIN_FREE_MB" \
    node <<'NODE' >"$disk_summary_file"
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const parsedMin = Number.parseInt(process.env.DEPLOY_MIN_FREE_MB ?? "3072", 10);
const minFreeMb =
  Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : 3072;
const inputPaths = (process.env.DEPLOY_DISK_PATHS ?? "")
  .split(":")
  .map((item) => item.trim())
  .filter(Boolean);

function existingAncestor(inputPath) {
  let current = path.resolve(inputPath);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function filesystemFor(inputPath) {
  const checkedPath = existingAncestor(inputPath);
  const output = execFileSync("df", ["-Pm", checkedPath], {
    encoding: "utf8",
  });
  const [, row] = output.trim().split(/\r?\n/);
  const columns = row.trim().split(/\s+/);
  return {
    inputPath,
    checkedPath,
    filesystem: columns[0],
    totalMb: Number(columns[1]),
    usedMb: Number(columns[2]),
    availableMb: Number(columns[3]),
    usePercent: columns[4],
    mountedOn: columns.slice(5).join(" "),
  };
}

const filesystems = [];
const seen = new Set();
for (const inputPath of inputPaths.length ? inputPaths : [process.cwd()]) {
  const status = filesystemFor(inputPath);
  const key = `${status.filesystem}\n${status.mountedOn}`;
  if (seen.has(key)) continue;
  seen.add(key);
  filesystems.push(status);
}

const low = filesystems.filter(
  (status) => Number.isFinite(status.availableMb) && status.availableMb < minFreeMb,
);
const result = {
  minFreeMb,
  ok: low.length === 0,
  filesystems,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
if (low.length > 0) {
  for (const status of low) {
    console.error(
      `Deployment disk preflight failed: ${status.mountedOn} has ${status.availableMb}MB free, below required ${minFreeMb}MB.`,
    );
  }
  process.exit(1);
}
NODE
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

prepare_release_dir() {
  local release_id="$commit-$(date -u +%Y%m%dT%H%M%SZ)"
  local source_dir="$APP_DIR/apps/web/.next/standalone"
  local release_dir="$RELEASE_ROOT/releases/$release_id"
  local tmp_link="$RELEASE_ROOT/.current-$release_id"

  if [[ ! -f "$source_dir/apps/web/server.js" ]]; then
    echo "Standalone server output is missing: $source_dir/apps/web/server.js" >&2
    exit 1
  fi

  mkdir -p "$RELEASE_ROOT/releases"
  rm -rf "$release_dir"
  mkdir -p "$release_dir"
  cp -a "$source_dir/." "$release_dir/"

  if [[ ! -f "$release_dir/apps/web/server.js" ]]; then
    echo "Release server output is missing after copy: $release_dir/apps/web/server.js" >&2
    exit 1
  fi

  ln -sfn "$release_dir" "$tmp_link"
  mv -Tf "$tmp_link" "$RELEASE_CURRENT_LINK"
  release_path="$release_dir"
}

install_web_release_dropin() {
  mkdir -p "$WEB_SERVICE_DROPIN_DIR"
  cat >"$WEB_SERVICE_RELEASE_DROPIN" <<UNIT
[Service]
WorkingDirectory=$RELEASE_CURRENT_LINK/apps/web
ExecStart=
ExecStart=/usr/bin/node server.js
UNIT
  systemctl daemon-reload
}

prune_release_dirs() {
  prune_summary_file="$(mktemp)"
  tmp_files+=("$prune_summary_file")

  if [[ "$USE_RELEASE_DIR" != "1" || "$RELEASE_PRUNE" != "1" ]]; then
    node - <<'NODE' >"$prune_summary_file"
process.stdout.write(
  `${JSON.stringify({
    enabled: false,
    pruned: [],
  })}\n`,
);
NODE
    return
  fi

  RELEASES_DIR="$RELEASE_ROOT/releases" \
    RELEASE_CURRENT_LINK="$RELEASE_CURRENT_LINK" \
    RELEASES_KEEP="$RELEASES_KEEP" \
    node <<'NODE' >"$prune_summary_file"
const fs = require("node:fs");
const path = require("node:path");

const releasesDir = process.env.RELEASES_DIR;
const currentLink = process.env.RELEASE_CURRENT_LINK;
const parsedKeep = Number.parseInt(process.env.RELEASES_KEEP ?? "5", 10);
const keep = Number.isFinite(parsedKeep) && parsedKeep > 0 ? parsedKeep : 5;

function realpathOrNull(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

const summary = {
  enabled: true,
  keep,
  releasesDir,
  current: realpathOrNull(currentLink),
  pruned: [],
};

if (!releasesDir || !fs.existsSync(releasesDir)) {
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  process.exit(0);
}

const entries = fs
  .readdirSync(releasesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const releasePath = path.join(releasesDir, entry.name);
    const stat = fs.statSync(releasePath);
    return {
      name: entry.name,
      path: releasePath,
      mtimeMs: stat.mtimeMs,
    };
  })
  .sort((left, right) => {
    const byTime = right.mtimeMs - left.mtimeMs;
    return byTime === 0 ? right.name.localeCompare(left.name) : byTime;
  });

const protectedPaths = new Set(
  entries.slice(0, keep).map((entry) => realpathOrNull(entry.path) ?? entry.path),
);
if (summary.current) protectedPaths.add(summary.current);

for (const entry of entries) {
  const resolved = realpathOrNull(entry.path) ?? entry.path;
  if (protectedPaths.has(resolved)) continue;
  fs.rmSync(entry.path, { recursive: true, force: true });
  summary.pruned.push({
    name: entry.name,
    path: entry.path,
  });
}

process.stdout.write(`${JSON.stringify(summary)}\n`);
NODE
}

need_command curl
need_command df
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

status_line "checking deployment disk space"
check_deploy_disk_space

status_line "deploying commit $commit from $branch to $BASE_URL"
release_path="$APP_DIR/apps/web/.next/standalone"

if [[ "$SKIP_BUILD" != "1" ]]; then
  status_line "generating Prisma client"
  pnpm db:generate
  status_line "building standalone output"
  BABBLEDECK_RELEASE_COMMIT="$commit" \
    BABBLEDECK_RELEASE_BRANCH="$branch" \
    BABBLEDECK_RELEASE_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    pnpm build --force
fi

if [[ "$SKIP_WRAPPER_REFRESH" != "1" ]]; then
  status_line "refreshing production wrapper artifacts"
  pnpm wrappers:refresh:production
fi

if [[ "$USE_RELEASE_DIR" == "1" ]]; then
  status_line "preparing immutable web release directory"
  prepare_release_dir
  status_line "installing web service release drop-in"
  install_web_release_dropin
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
readiness_args=(
  scripts/check-production-readiness.ts
  "--base-url=$BASE_URL"
  "--expected-release-commit=$commit"
)
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
const expectedEmail = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
const actualEmail =
  typeof me.data?.user?.email === "string"
    ? me.data.user.email.toLowerCase()
    : "";
const summary = {
  loginStatus,
  loginOk: login.ok === true,
  meStatus,
  meOk: me.ok === true,
  meEmailMatchesExpected: Boolean(expectedEmail && actualEmail === expectedEmail),
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

status_line "pruning old immutable web releases"
prune_release_dirs

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
export USE_RELEASE_DIR release_path RELEASE_CURRENT_LINK
export prune_summary_file
export disk_summary_file
export WRAPPER_ARTIFACT_LOG
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

let prune = null;
try {
  prune = JSON.parse(fs.readFileSync(process.env.prune_summary_file, "utf8"));
} catch {
  prune = {
    enabled: false,
    parseError: true,
    pruned: [],
  };
}

let disk = null;
try {
  disk = JSON.parse(fs.readFileSync(process.env.disk_summary_file, "utf8"));
} catch {
  disk = {
    ok: false,
    parseError: true,
  };
}

let wrapperArtifacts = null;
try {
  const records = fs
    .readFileSync(process.env.WRAPPER_ARTIFACT_LOG, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((record) => record.commit === process.env.commit)
    .sort((a, b) =>
      String(b.finishedAt ?? "").localeCompare(String(a.finishedAt ?? "")),
    );
  wrapperArtifacts = records[0] ?? {
    ok: false,
    missingForCommit: process.env.commit,
  };
} catch {
  wrapperArtifacts = {
    ok: false,
    parseError: true,
  };
}

const record = {
  app: "babbledeck",
  deployedAt: process.env.deployed_at,
  commit: process.env.commit,
  branch: process.env.branch,
  baseUrl: process.env.BASE_URL,
  release: {
    mode:
      process.env.USE_RELEASE_DIR === "1"
        ? "standalone_release"
        : "workspace_standalone",
    path: process.env.release_path,
    currentLink:
      process.env.USE_RELEASE_DIR === "1"
        ? process.env.RELEASE_CURRENT_LINK
        : null,
    prune,
  },
  disk,
  wrapperArtifacts,
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
