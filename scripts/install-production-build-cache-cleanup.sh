#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
SERVICE_NAME="${BABBLEDECK_BUILD_CACHE_CLEANUP_SERVICE:-aialra-babbledeck-build-cache-cleanup.service}"
TIMER_NAME="${BABBLEDECK_BUILD_CACHE_CLEANUP_TIMER:-aialra-babbledeck-build-cache-cleanup.timer}"
UNIT_DIR="${BABBLEDECK_SYSTEMD_UNIT_DIR:-/etc/systemd/system}"
ON_CALENDAR="${BABBLEDECK_BUILD_CACHE_CLEANUP_ON_CALENDAR:-*-*-* 02:20:00}"
RANDOMIZED_DELAY="${BABBLEDECK_BUILD_CACHE_CLEANUP_RANDOMIZED_DELAY:-20m}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command install
need_command mktemp
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
service_tmp="$(mktemp)"
timer_tmp="$(mktemp)"
cleanup() {
  rm -f "$service_tmp" "$timer_tmp"
}
trap cleanup EXIT

cat >"$service_tmp" <<UNIT
[Unit]
Description=AIALRA BabbleDeck production build-cache cleanup
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
Group=root
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/bash $APP_DIR/scripts/cleanup-production-build-cache.sh
StandardOutput=append:$LOG_DIR/build-cache-cleanup.log
StandardError=append:$LOG_DIR/build-cache-cleanup.log

[Install]
WantedBy=multi-user.target
UNIT

cat >"$timer_tmp" <<UNIT
[Unit]
Description=Daily AIALRA BabbleDeck production build-cache cleanup

[Timer]
OnCalendar=$ON_CALENDAR
Persistent=true
RandomizedDelaySec=$RANDOMIZED_DELAY
Unit=$SERVICE_NAME

[Install]
WantedBy=timers.target
UNIT

install -m 0644 "$service_tmp" "$UNIT_DIR/$SERVICE_NAME"
install -m 0644 "$timer_tmp" "$UNIT_DIR/$TIMER_NAME"
systemctl daemon-reload
systemctl enable --now "$TIMER_NAME"
systemctl start "$SERVICE_NAME"
systemctl is-active "$TIMER_NAME" >/dev/null

echo "installed_service=$SERVICE_NAME"
echo "installed_timer=$TIMER_NAME"
