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

read_build_num() {
  # stdout: integer build number, or empty
  local out
  out="$("$@" 2>/dev/null | tail -n 1 | tr -d '[:space:]' || true)"
  if [[ "${out}" =~ ^[0-9]+$ ]]; then
    printf '%s' "${out}"
  fi
}

LATEST_TF="$(read_build_num app-store-connect get-latest-testflight-build-number \
  "${APPLE_APP_APPLE_ID}" \
  --all-versions || true)"
LATEST_AS="$(read_build_num app-store-connect get-latest-app-store-build-number \
  "${APPLE_APP_APPLE_ID}" || true)"

LATEST="0"
for candidate in "${LATEST_TF:-}" "${LATEST_AS:-}"; do
  if [[ "${candidate}" =~ ^[0-9]+$ ]] && (( candidate > LATEST )); then
    LATEST="${candidate}"
  fi
done

# Always go strictly above the highest known ASC build.
NEXT="${LOCAL}"
if [[ "${LATEST}" =~ ^[0-9]+$ ]] && (( LATEST + 1 > NEXT )); then
  NEXT=$((LATEST + 1))
fi

echo "==> Build number: local=${LOCAL} latest_tf=${LATEST_TF:-none} latest_appstore=${LATEST_AS:-none} max_asc=${LATEST} using=${NEXT}"

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
