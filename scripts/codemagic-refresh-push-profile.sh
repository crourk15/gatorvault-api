#!/usr/bin/env bash
# Recreate the App Store provisioning profile with Push (aps-environment).
# Runs on Codemagic with the App Store Connect integration + named distribution cert.
set -euo pipefail

BUNDLE_ID="${BUNDLE_ID:?BUNDLE_ID is required}"
PROFILES_DIR="${HOME}/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "${PROFILES_DIR}"

echo "==> Refresh App Store profile for ${BUNDLE_ID} (Push / aps-environment)"

keychain initialize
keychain add-certificates

python3 - <<'PY2' > /tmp/asc_ids.env
import json, os, subprocess, sys

def run_json(args):
    out = subprocess.check_output(args, text=True)
    out = out.strip()
    if not out:
        return []
    data = json.loads(out)
    return data if isinstance(data, list) else [data]

bundle_id = os.environ["BUNDLE_ID"]
bundles = run_json([
    "app-store-connect", "bundle-ids", "list",
    "--bundle-id-identifier", bundle_id,
    "--strict-match-identifier",
    "--json",
])
if not bundles:
    sys.exit(f"ERROR: no Bundle ID found for {bundle_id}")
bundle_rid = bundles[0]["id"]
print(f"BUNDLE_RID={bundle_rid}")

caps = run_json([
    "app-store-connect", "bundle-ids", "capabilities",
    bundle_rid,
    "--json",
])
has_push = False
for cap in caps:
    ctype = (cap.get("attributes") or {}).get("capabilityType") or ""
    if str(ctype) in ("PUSH_NOTIFICATIONS", "Push Notifications"):
        has_push = True
        break
print(f"HAS_PUSH={'1' if has_push else '0'}")

certs = run_json([
    "app-store-connect", "certificates", "list",
    "--profile-type", "IOS_APP_STORE",
    "--json",
])
cert_ids = []
for cert in certs:
    ctype = str((cert.get("attributes") or {}).get("certificateType") or "")
    if ctype in ("IOS_DISTRIBUTION", "DISTRIBUTION", "MAC_APP_DISTRIBUTION"):
        cert_ids.append(cert["id"])
if not cert_ids and certs:
    cert_ids = [c["id"] for c in certs]
if not cert_ids:
    sys.exit("ERROR: no App Store distribution certificates found in Apple Developer portal")
print("CERT_IDS=" + " ".join(cert_ids))

profiles = run_json([
    "app-store-connect", "bundle-ids", "profiles",
    "--bundle-ids", bundle_rid,
    "--type", "IOS_APP_STORE",
    "--json",
])
profile_ids = [p["id"] for p in profiles if p.get("id")]
print("OLD_PROFILE_IDS=" + " ".join(profile_ids))
PY2

# shellcheck disable=SC1091
source /tmp/asc_ids.env

if [[ "${HAS_PUSH}" != "1" ]]; then
  echo "==> Enabling Push Notifications on App ID ${BUNDLE_RID}"
  app-store-connect bundle-ids enable-capabilities \
    "${BUNDLE_RID}" \
    --capability "Push Notifications"
else
  echo "==> Push Notifications already enabled on App ID"
fi

if [[ -n "${OLD_PROFILE_IDS:-}" ]]; then
  echo "==> Deleting stale App Store profiles: ${OLD_PROFILE_IDS}"
  for pid in ${OLD_PROFILE_IDS}; do
    app-store-connect profiles delete "${pid}" --ignore-not-found || true
  done
fi

# Drop any previously installed local profiles so use-profiles cannot pick a stale one.
rm -f "${PROFILES_DIR}"/*.mobileprovision 2>/dev/null || true

PROFILE_NAME="GatorVault Insider App Store Push $(date -u +%Y%m%d%H%M%S)"
echo "==> Creating App Store profile: ${PROFILE_NAME}"
# shellcheck disable=SC2086
app-store-connect profiles create \
  "${BUNDLE_RID}" \
  --type IOS_APP_STORE \
  --name "${PROFILE_NAME}" \
  --certificate-ids ${CERT_IDS} \
  --save

PROFILE_FILE="$(ls -1t "${PROFILES_DIR}"/*.mobileprovision 2>/dev/null | head -1 || true)"
if [[ -z "${PROFILE_FILE}" ]]; then
  echo "ERROR: profile was not saved to ${PROFILES_DIR}" >&2
  exit 1
fi

echo "==> Verifying aps-environment in ${PROFILE_FILE}"
DECODED="$(security cms -D -i "${PROFILE_FILE}" 2>/dev/null || true)"
if ! printf '%s' "${DECODED}" | grep -q 'aps-environment'; then
  echo "ERROR: new profile still missing aps-environment entitlement." >&2
  echo "Confirm Push Notifications is enabled for ${BUNDLE_ID} in Apple Developer." >&2
  printf '%s\n' "${DECODED}" | head -n 80 >&2 || true
  exit 1
fi
echo "OK: profile includes aps-environment"

xcode-project use-profiles
echo "OK: Xcode project configured with Push-enabled App Store profile"
