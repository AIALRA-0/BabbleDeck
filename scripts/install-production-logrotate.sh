#!/usr/bin/env bash
set -euo pipefail

LOGROTATE_CONFIG="${BABBLEDECK_LOGROTATE_CONFIG:-/etc/logrotate.d/aialra-babbledeck}"
LOG_DIR="${BABBLEDECK_LOG_DIR:-/srv/aialra/logs/babbledeck}"
ROTATE_DAYS="${BABBLEDECK_LOGROTATE_ROTATE_DAYS:-14}"
MAX_SIZE="${BABBLEDECK_LOGROTATE_MAX_SIZE:-50M}"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_command install
need_command logrotate
need_command mktemp

if [[ ! "$ROTATE_DAYS" =~ ^[0-9]+$ ]] || [[ "$ROTATE_DAYS" -lt 1 ]]; then
  echo "BABBLEDECK_LOGROTATE_ROTATE_DAYS must be a positive integer." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
tmp_config="$(mktemp)"
cleanup() {
  rm -f "$tmp_config"
}
trap cleanup EXIT

cat >"$tmp_config" <<CONF
$LOG_DIR/*.log $LOG_DIR/*.jsonl {
  daily
  rotate $ROTATE_DAYS
  maxsize $MAX_SIZE
  missingok
  notifempty
  compress
  delaycompress
  copytruncate
  create 0640 root root
}
CONF

install -m 0644 "$tmp_config" "$LOGROTATE_CONFIG"
logrotate -d "$LOGROTATE_CONFIG" >/dev/null

echo "installed_logrotate=$LOGROTATE_CONFIG"
