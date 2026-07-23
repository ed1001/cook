#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=8770
SUBDOMAIN=ed-cook

node "$ROOT/bin/build.mjs"

python3 -m http.server "$PORT" --directory "$ROOT/site" >/dev/null 2>&1 &
HTTP_PID=$!
LT_PID=""
cleanup() {
  [ -n "$HTTP_PID" ] && kill "$HTTP_PID" 2>/dev/null || true
  [ -n "$LT_PID" ] && kill "$LT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npx --yes localtunnel --port "$PORT" --subdomain "$SUBDOMAIN" &
LT_PID=$!

echo "Serving: https://$SUBDOMAIN.loca.lt   (local: http://localhost:$PORT)"
echo "Ctrl-C to stop."
wait
