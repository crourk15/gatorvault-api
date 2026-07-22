#!/usr/bin/env bash
# Bump CURRENT_PROJECT_VERSION above the latest TestFlight/App Store build number.
# Prevents Codemagic publish failures: ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE
set -euo pipefail

APPLE_APP_APPLE_ID="${APPLE_APP_APPLE_ID:?APPLE_APP_APPLE_ID is required}"
PBX="${CM_BUILD_DIR:?}/client/ios/App/App.xcodeproj/project.pbxproj"
test -f "${PBX}"
export PBX

LOCAL="$(python3 - <<'PY2'
import re
from pathlib import Path
import os
text = Path(os.environ["PBX"]).read_text()
m = re.search(r"CURRENT_PROJECT_VERSION = (\d+);", text)
print(m.group(1) if m else "0")
PY2
)"

LATEST="0"
if LATEST_TF="$(app-store-connect get-latest-testflight-build-number \
  "${APPLE_APP_APPLE_ID}" \
  --all-versions \
  2>/dev/null | tail -n 1 | tr -d '[:space:]')"; then
  if [[ "${LATEST_TF}" =~ ^[0-9]+$ ]]; then
    LATEST="${LATEST_TF}"
  fi
fi

if [[ "${LATEST}" == "0" ]]; then
  if LATEST_AS="$(app-store-connect get-latest-app-store-build-number \
    "${APPLE_APP_APPLE_ID}" \
    2>/dev/null | tail -n 1 | tr -d '[:space:]')"; then
    if [[ "${LATEST_AS}" =~ ^[0-9]+$ ]]; then
      LATEST="${LATEST_AS}"
    fi
  fi
fi

NEXT="${LOCAL}"
if [[ "${LATEST}" =~ ^[0-9]+$ ]] && (( LATEST + 1 > NEXT )); then
  NEXT=$((LATEST + 1))
fi

echo "==> Build number: local=${LOCAL} latest_asc=${LATEST} using=${NEXT}"

if [[ "${NEXT}" != "${LOCAL}" ]]; then
  export NEXT
  python3 - <<'PY2'
from pathlib import Path
import os
import re
path = Path(os.environ["PBX"])
next_build = os.environ["NEXT"]
text = path.read_text()
new_text, n = re.subn(
    r"CURRENT_PROJECT_VERSION = \d+;",
    f"CURRENT_PROJECT_VERSION = {next_build};",
    text,
)
if n < 1:
    raise SystemExit("ERROR: CURRENT_PROJECT_VERSION not found in project.pbxproj")
path.write_text(new_text)
print(f"OK: bumped CURRENT_PROJECT_VERSION -> {next_build} ({n} occurrence(s))")
PY2
else
  echo "OK: keeping CURRENT_PROJECT_VERSION=${NEXT}"
fi

printf '%s\n' "${NEXT}" > /tmp/gatorvault_ios_build_number.txt
