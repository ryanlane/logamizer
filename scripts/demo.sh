#!/usr/bin/env bash
set -euo pipefail

# Demo script for Logamizer
# Requirements:
# - API running at http://localhost:8000
# - A user account and token
# - A site created for the demo
#
# Usage:
#   LOGAMIZER_TOKEN=... SITE_ID=... ./scripts/demo.sh

if [[ -z "${LOGAMIZER_TOKEN:-}" || -z "${SITE_ID:-}" ]]; then
  echo "Usage: LOGAMIZER_TOKEN=... SITE_ID=... ./scripts/demo.sh"
  exit 1
fi

API_URL=${API_URL:-"http://localhost:8000"}
SAMPLES_DIR=${SAMPLES_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/samples"}

function upload_and_confirm() {
  local file_path="$1"
  local filename
  filename=$(basename "$file_path")

  local upload_json
  upload_json=$(curl -sS -X POST "$API_URL/api/sites/$SITE_ID/upload-url" \
    -H "Authorization: Bearer $LOGAMIZER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"filename\": \"$filename\"}")

  local upload_url
  upload_url=$(echo "$upload_json" | python - <<'PY'
import json,sys
print(json.load(sys.stdin)["upload_url"])
PY
)

  local log_file_id
  log_file_id=$(echo "$upload_json" | python - <<'PY'
import json,sys
print(json.load(sys.stdin)["log_file_id"])
PY
)

  curl -sS -X PUT "$upload_url" --data-binary "@$file_path" > /dev/null

  curl -sS -X POST "$API_URL/api/sites/$SITE_ID/uploads" \
    -H "Authorization: Bearer $LOGAMIZER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"log_file_id\": \"$log_file_id\", \"size_bytes\": $(stat -c%s "$file_path") }" > /dev/null
}

upload_and_confirm "$SAMPLES_DIR/access.log"
upload_and_confirm "$SAMPLES_DIR/error.log"

echo "Demo upload complete. Open: http://localhost:5173/sites/$SITE_ID"
