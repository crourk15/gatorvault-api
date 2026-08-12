#!/usr/bin/env bash
# Used as CAPACITOR_COCOAPODS_PATH during `npx cap sync ios` so Capacitor still
# updates the Podfile/plugins, but defers the real download-heavy `pod install`
# to scripts/codemagic-pod-install.sh (retries + curl hardening for FBAEMKit).
set -euo pipefail

if [[ "${1:-}" == "install" ]]; then
  echo "OK: skipping CocoaPods during cap sync (deferred to Codemagic pod-install step)"
  exit 0
fi

REAL_POD="$(command -v pod || true)"
if [[ -z "${REAL_POD}" || "${REAL_POD}" == "$0" ]]; then
  for candidate in /opt/homebrew/bin/pod /usr/local/bin/pod; do
    if [[ -x "${candidate}" ]]; then
      REAL_POD="${candidate}"
      break
    fi
  done
fi

if [[ -z "${REAL_POD}" ]]; then
  echo "ERROR: real CocoaPods 'pod' binary not found" >&2
  exit 1
fi

exec "${REAL_POD}" "$@"
