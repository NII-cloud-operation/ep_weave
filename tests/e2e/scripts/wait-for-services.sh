#!/usr/bin/env bash
set -euxo pipefail

ETHERPAD_URL="${ETHERPAD_URL:-http://localhost:9001/health}"
MAX_RETRIES=60
SLEEP_SECONDS=5

for attempt in $(seq 1 "${MAX_RETRIES}"); do
  if curl -vvv --fail --show-error "${ETHERPAD_URL}"; then
    echo "Etherpad is accepting connections at ${ETHERPAD_URL}"
    exit 0
  fi
  echo "Waiting for Etherpad... attempt ${attempt}/${MAX_RETRIES}" >&2
  sleep "${SLEEP_SECONDS}"
done

docker compose ps >&2 || true
>&2 echo "Timed out waiting for Etherpad at ${ETHERPAD_URL}"
exit 1
