#!/usr/bin/env bash
# Hardened CocoaPods install for Codemagic.
# Facebook/Meta pods (FBAEMKit via FBSDKCoreKit) download a large xcframework zip
# from GitHub releases; Codemagic often hits curl (56) Connection died with the
# CocoaPods default --retry 2. We wrap curl + retry the whole pod install.
set -euo pipefail

ROOT="${CM_BUILD_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
APP_DIR="${ROOT}/client/ios/App"
MAX_ATTEMPTS="${POD_INSTALL_MAX_ATTEMPTS:-5}"

if [[ ! -d "${APP_DIR}" ]]; then
  echo "ERROR: iOS App dir missing: ${APP_DIR}" >&2
  exit 1
fi

WRAP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gv-pod-curl.XXXXXX")"
cleanup() { rm -rf "${WRAP_DIR}"; }
trap cleanup EXIT

# CocoaPods invokes curl with --retry 2; last --retry wins, so strip theirs and
# force a longer GitHub-release-friendly retry policy.
cat > "${WRAP_DIR}/curl" <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
args=()
while (($#)); do
  case "$1" in
    --retry|--retry-delay|--retry-max-time)
      shift
      if (($#)); then shift; fi
      ;;
    --retry-all-errors|--retry-connrefused)
      shift
      ;;
    *)
      args+=("$1")
      shift
      ;;
  esac
done
exec /usr/bin/curl \
  --retry 12 \
  --retry-all-errors \
  --retry-delay 5 \
  --connect-timeout 30 \
  "${args[@]}"
INNER
chmod +x "${WRAP_DIR}/curl"
export PATH="${WRAP_DIR}:${PATH}"

cd "${APP_DIR}"

attempt=1
while (( attempt <= MAX_ATTEMPTS )); do
  echo "=== pod install attempt ${attempt}/${MAX_ATTEMPTS} ==="

  # Prefetch Meta dynamic SDK zip (same URL CocoaPods uses for FBAEMKit 18.1.x).
  # Failure here is non-fatal — pod install still runs — but warming the CDN helps.
  FB_VER="${FACEBOOK_IOS_SDK_VERSION:-v18.1.0}"
  FB_URL="https://github.com/facebook/facebook-ios-sdk/releases/download/${FB_VER}/FacebookSDK_Dynamic.xcframework.zip"
  echo "Prefetch warm: ${FB_URL}"
  curl -fL -o /dev/null "${FB_URL}" || echo "WARN: Facebook SDK prefetch failed (continuing to pod install)"

  if pod install --verbose; then
    echo "OK: pod install succeeded on attempt ${attempt}"
    exit 0
  fi

  echo "WARN: pod install failed on attempt ${attempt}" >&2
  # Clear partial Facebook / CocoaPods download caches before retry
  rm -rf Pods/FBAEMKit Pods/FBSDKCoreKit Pods/FBSDKCoreKit_Basics 2>/dev/null || true
  pod cache clean FBAEMKit --all 2>/dev/null || true
  pod cache clean FBSDKCoreKit --all 2>/dev/null || true
  pod cache clean FBSDKCoreKit_Basics --all 2>/dev/null || true
  rm -rf "${HOME}/Library/Caches/CocoaPods/Pods/Release/FBAEMKit" \
         "${HOME}/Library/Caches/CocoaPods/Pods/External/FBAEMKit" 2>/dev/null || true

  if (( attempt == MAX_ATTEMPTS )); then
    break
  fi
  sleep_s=$(( attempt * 20 ))
  echo "Sleeping ${sleep_s}s before retry..."
  sleep "${sleep_s}"
  attempt=$(( attempt + 1 ))
done

echo "ERROR: pod install failed after ${MAX_ATTEMPTS} attempts (often GitHub CDN flake on FBAEMKit / FacebookSDK_Dynamic.xcframework.zip). Re-run the Codemagic build." >&2
exit 1
