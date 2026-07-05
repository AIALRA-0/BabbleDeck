#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${BABBLEDECK_APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="${BABBLEDECK_ENV_FILE:-/srv/aialra/config/secrets/babbledeck.env}"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "APP_DIR is not a git repository: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

cd "$APP_DIR"

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

pnpm tsx scripts/check-audio-cutover-readiness.ts "$@"
