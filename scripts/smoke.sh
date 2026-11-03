#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"

echo "Health:"
curl -fsS "$BASE_URL/actuator/health/readiness"
echo
echo "Status:"
curl -fsS "$BASE_URL/api/status"
echo
echo "Events:"
curl -fsS "$BASE_URL/api/events" | head -c 300
echo
echo "OK"
