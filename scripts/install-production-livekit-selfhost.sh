#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-/srv/aialra/apps/codexapp/state/browser-workspaces/2026-07-04-babbledeck}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
SECRET_ENV="${BABBLEDECK_LIVEKIT_SECRET_ENV:-/srv/aialra/config/secrets/babbledeck-livekit.env}"
NGINX_SITE="${BABBLEDECK_NGINX_SITE:-/etc/nginx/sites-available/babbledeck.aialra.online}"
SERVICE_FILE="${BABBLEDECK_LIVEKIT_SERVICE_FILE:-/etc/systemd/system/aialra-babbledeck-livekit.service}"
SERVICE_NAME="${BABBLEDECK_LIVEKIT_SERVICE:-aialra-babbledeck-livekit.service}"
SIGNAL_PORT="${LIVEKIT_SIGNAL_PORT:-11972}"
RTC_TCP_PORT="${LIVEKIT_RTC_TCP_PORT:-7881}"
RTC_PORT_RANGE_START="${LIVEKIT_RTC_PORT_RANGE_START:-50000}"
RTC_PORT_RANGE_END="${LIVEKIT_RTC_PORT_RANGE_END:-50020}"
REDIS_ADDRESS="${LIVEKIT_REDIS_ADDRESS:-127.0.0.1:6379}"
IMAGE="${BABBLEDECK_LIVEKIT_IMAGE:-livekit/livekit-server:latest}"

status_line() {
  printf '[livekit-selfhost] %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '%s is required.\n' "$1" >&2
    exit 1
  fi
}

require_command docker
require_command nginx
require_command systemctl
require_command openssl

mkdir -p "$LOG_DIR"

if [[ -e "$SECRET_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$SECRET_ENV"
fi

api_key="${LIVEKIT_API_KEY:-babbledeck-livekit}"
api_secret="${LIVEKIT_API_SECRET:-$(openssl rand -hex 32)}"

if [[ ! "$api_key" =~ ^[A-Za-z0-9._:-]+$ ]]; then
  echo "LIVEKIT_API_KEY contains unsupported characters." >&2
  exit 1
fi
if [[ ! "$api_secret" =~ ^[A-Za-z0-9._:-]+$ ]]; then
  echo "LIVEKIT_API_SECRET contains unsupported characters." >&2
  exit 1
fi

status_line "writing LiveKit secret env"
install -d -m 700 "$(dirname "$SECRET_ENV")"
umask 077
cat >"$SECRET_ENV" <<EOF
LIVEKIT_API_KEY=$api_key
LIVEKIT_API_SECRET=$api_secret
LIVEKIT_SIGNAL_PORT=$SIGNAL_PORT
LIVEKIT_RTC_TCP_PORT=$RTC_TCP_PORT
LIVEKIT_RTC_PORT_RANGE_START=$RTC_PORT_RANGE_START
LIVEKIT_RTC_PORT_RANGE_END=$RTC_PORT_RANGE_END
LIVEKIT_REDIS_ADDRESS=$REDIS_ADDRESS
BABBLEDECK_LIVEKIT_IMAGE=$IMAGE
EOF
chmod 600 "$SECRET_ENV"

status_line "pulling LiveKit image"
docker pull "$IMAGE" >/dev/null

status_line "installing systemd service"
cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=AIALRA BabbleDeck LiveKit self-hosted room audio
After=network-online.target docker.service redis-server.service
Wants=network-online.target docker.service redis-server.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$SECRET_ENV
ExecStart=/usr/bin/bash $APP_DIR/scripts/start-production-livekit.sh
Restart=always
RestartSec=5
TimeoutStopSec=30
KillMode=control-group
StandardOutput=append:$LOG_DIR/livekit.log
StandardError=append:$LOG_DIR/livekit.log

[Install]
WantedBy=multi-user.target
EOF

status_line "installing nginx /livekit/ proxy"
backup="$NGINX_SITE.bak.$(date -u +%Y%m%dT%H%M%SZ)"
cp "$NGINX_SITE" "$backup"
node - <<'NODE' "$NGINX_SITE" "$SIGNAL_PORT"
const fs = require("node:fs");
const file = process.argv[2];
const port = process.argv[3];
let text = fs.readFileSync(file, "utf8");
if (!text.includes("location /livekit/")) {
  const marker = "    location /ws/recorder {";
  const block = `    location = /livekit {\n        return 308 /livekit/;\n    }\n\n    location /livekit/ {\n        proxy_pass http://127.0.0.1:${port}/;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection $connection_upgrade;\n        proxy_buffering off;\n        proxy_cache off;\n        proxy_read_timeout 300s;\n        proxy_send_timeout 300s;\n    }\n\n`;
  if (!text.includes(marker)) {
    throw new Error(`Could not find insertion marker in ${file}`);
  }
  text = text.replace(marker, block + marker);
  fs.writeFileSync(file, text);
}
NODE

nginx -t
systemctl reload nginx

status_line "starting LiveKit service"
systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"

status_line "waiting for local LiveKit signal port"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$SIGNAL_PORT" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

systemctl show "$SERVICE_NAME" --property=ActiveState,SubState,NRestarts,ExecMainPID,ExecMainStartTimestamp

status_line "installed; configure BabbleDeck with LIVEKIT_URL=wss://babbledeck.aialra.online/livekit"
