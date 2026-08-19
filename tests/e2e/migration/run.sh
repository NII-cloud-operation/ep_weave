#!/usr/bin/env bash
# Requires port 9001. Set COMPOSE_PROJECT_NAME to isolate containers/volumes.
set -euxo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "${REPO_ROOT}"

BASE="-f docker-compose.yml"
OLD="${BASE} -f tests/e2e/migration/docker-compose.solr8.yml"
RESULT_DIR="${RESULT_DIR:-tests/e2e/artifacts/migration}"
TRANSITION_TIMEOUT="${E2E_TRANSITION_TIMEOUT:-30000}"
export ETHERPAD_URL="${ETHERPAD_URL:-http://localhost:9001/health}"
mkdir -p "${RESULT_DIR}"
INDEXED_RECORD_PATH="$(cd "${RESULT_DIR}" && pwd)/pad-indexed.txt"

run_nb() {
  python3 -m papermill "tests/e2e/migration/$1.ipynb" "${RESULT_DIR}/$1-result.ipynb" \
    --cwd tests/e2e/notebooks \
    -p etherpad_url "${ETHERPAD_URL%health}" \
    -p transition_timeout "${TRANSITION_TIMEOUT}" \
    -p indexed_record_path "${INDEXED_RECORD_PATH}"
}

docker compose ${OLD} up -d --build
tests/e2e/scripts/wait-for-services.sh
run_nb 10_Create_Pad

docker compose ${BASE} up -d --build solr
status=""
for attempt in $(seq 1 30); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$(docker compose ${BASE} ps -q solr)")"
  if [ "${status}" = "unhealthy" ]; then break; fi
  sleep 5
done
[ "${status}" = "unhealthy" ]
docker compose ${BASE} restart etherpad
tests/e2e/scripts/wait-for-services.sh
run_nb 20_Verify_Broken

docker compose ${BASE} rm -sf solr
PROJECT="$(docker compose ${BASE} config --format json | python3 -c 'import json, sys; print(json.load(sys.stdin)["name"])')"
docker volume rm "${PROJECT}_solr_data_vol"
docker compose ${BASE} up -d solr
docker compose ${BASE} restart etherpad
tests/e2e/scripts/wait-for-services.sh
run_nb 30_Verify_Recovered
