#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${BABBLEDECK_LIVEKIT_APP_NAME:-aialra-babbledeck-livekit}"
IMAGE="${BABBLEDECK_LIVEKIT_IMAGE:-livekit/livekit-server:latest}"
RUNTIME_DIR="${BABBLEDECK_LIVEKIT_RUNTIME_DIR:-/run/aialra-babbledeck-livekit}"
CONFIG_FILE="$RUNTIME_DIR/livekit.yaml"
SIGNAL_PORT="${LIVEKIT_SIGNAL_PORT:-11972}"
RTC_TCP_PORT="${LIVEKIT_RTC_TCP_PORT:-7881}"
RTC_PORT_RANGE_START="${LIVEKIT_RTC_PORT_RANGE_START:-50000}"
RTC_PORT_RANGE_END="${LIVEKIT_RTC_PORT_RANGE_END:-50020}"
REDIS_ADDRESS="${LIVEKIT_REDIS_ADDRESS:-127.0.0.1:6379}"

require_safe_value() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    printf '%s is required.\n' "$name" >&2
    exit 1
  fi
  if [[ ! "$value" =~ ^[A-Za-z0-9._:-]+$ ]]; then
    printf '%s contains unsupported characters.\n' "$name" >&2
    exit 1
  fi
}

require_safe_number() {
  local name="$1"
  local value="${!name:-}"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    printf '%s must be numeric.\n' "$name" >&2
    exit 1
  fi
}

require_safe_value LIVEKIT_API_KEY
require_safe_value LIVEKIT_API_SECRET
require_safe_number SIGNAL_PORT
require_safe_number RTC_TCP_PORT
require_safe_number RTC_PORT_RANGE_START
require_safe_number RTC_PORT_RANGE_END

mkdir -p "$RUNTIME_DIR"
chmod 700 "$RUNTIME_DIR"

cat >"$CONFIG_FILE" <<EOF
port: $SIGNAL_PORT
log_level: info
rtc:
  tcp_port: $RTC_TCP_PORT
  port_range_start: $RTC_PORT_RANGE_START
  port_range_end: $RTC_PORT_RANGE_END
  use_external_ip: true
redis:
  address: $REDIS_ADDRESS
keys:
  $LIVEKIT_API_KEY: $LIVEKIT_API_SECRET
turn:
  enabled: false
EOF
chmod 600 "$CONFIG_FILE"

docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
exec docker run \
  --rm \
  --name "$APP_NAME" \
  --network host \
  --volume "$CONFIG_FILE:/livekit.yaml:ro" \
  "$IMAGE" \
  --config /livekit.yaml
