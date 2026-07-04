#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/apps/web"
STANDALONE_WEB_DIR="$WEB_DIR/.next/standalone/apps/web"

if [[ ! -d "$STANDALONE_WEB_DIR" ]]; then
  echo "Standalone output is missing. Run next build first." >&2
  exit 1
fi

rm -rf "$STANDALONE_WEB_DIR/.next/static" "$STANDALONE_WEB_DIR/public"
mkdir -p "$STANDALONE_WEB_DIR/.next"
cp -R "$WEB_DIR/.next/static" "$STANDALONE_WEB_DIR/.next/static"

if [[ -d "$WEB_DIR/public" ]]; then
  cp -R "$WEB_DIR/public" "$STANDALONE_WEB_DIR/public"
fi
