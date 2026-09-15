#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8081}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
  echo "Stopping process(es) on port $PORT: $pids"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 1
  # Force anything that ignored SIGTERM
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
    sleep 1
  fi
fi

echo "Starting Expo web on port $PORT (cache cleared)…"
exec npx expo start --web --port "$PORT" --clear
