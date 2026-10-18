#!/usr/bin/env bash
# Builds the native Android app on a CI machine (PLATFORMS.md "Android"):
#   1. Cocos Creator (CLI) exports the project: game/build/android — assets, scripts and a Gradle
#      project from game/native/engine/android, with the SDK, NDK and release key from the
#      environment written into a copy of build-configs/android.json (the repo's has none);
#   2. Gradle builds the release APK, signed with the project's key (the same key every time:
#      phones install an update only over an app signed by the same key);
#   3. apksigner checks the signature.
#
# Usage: tools/ci/build-android.sh <path to CocosCreator.app> <output dir>
# Environment: ANDROID_HOME, NDK_PATH, KEYSTORE_FILE (PKCS12), KEYSTORE_PASSWORD; VERSION_CODE
# (grows with every build, so a new APK installs over the old one).
# Logs: <output dir>/cocos.log and <output dir>/gradle.log.

set -euo pipefail

CREATOR_APP="$1"
OUT="$(mkdir -p "$2" && cd "$2" && pwd)"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT="$ROOT/game"
EXPORT="$PROJECT/build/android"
CONFIG="$OUT/android.json"

: "${ANDROID_HOME:?}" "${NDK_PATH:?}" "${KEYSTORE_FILE:?}" "${KEYSTORE_PASSWORD:?}"

python3 - "$ROOT/build-configs/android.json" "$CONFIG" <<'EOF'
import json, os, sys
c = json.load(open(sys.argv[1]))
a = c["packages"]["android"]
a["sdkPath"] = os.environ["ANDROID_HOME"]
a["ndkPath"] = os.environ["NDK_PATH"]
a["keystorePath"] = os.environ["KEYSTORE_FILE"]
a["keystorePassword"] = os.environ["KEYSTORE_PASSWORD"]
# A PKCS12 keystore has one password for the store and the key.
a["keystoreAliasPassword"] = os.environ["KEYSTORE_PASSWORD"]
json.dump(c, open(sys.argv[2], "w"), indent=2)
EOF

echo "== Cocos Creator: export the Android project (NDK $(sed -n 's/^Pkg.Revision *= *//p' "$NDK_PATH/source.properties"))"
set +e
"$CREATOR_APP/Contents/MacOS/CocosCreator" --project "$PROJECT" --build "configPath=$CONFIG" 2>&1 | tee "$OUT/cocos.log"
code=${PIPESTATUS[0]}
set -e
rm -f "$CONFIG"
# Cocos exit codes: 36 is success, 32 bad parameters, 34 a failed build.
if [ "$code" != "36" ]; then
  echo "Cocos build failed with exit code $code"
  exit 1
fi

PROJ="$EXPORT/proj"
# The Gradle module is named after the config's "name".
MODULE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["name"])' "$ROOT/build-configs/android.json")"
echo "== Gradle: $MODULE:assembleRelease"
set +e
(cd "$PROJ" && chmod +x gradlew && ./gradlew --no-daemon -PVERSION_CODE="${VERSION_CODE:-1}" "$MODULE:assembleRelease") > "$OUT/gradle.log" 2>&1
code=$?
set -e
grep -E '^e: |error:|FAILURE|What went wrong' -A3 "$OUT/gradle.log" | head -n 60 || true
if [ "$code" != "0" ]; then
  echo "Gradle failed with exit code $code"
  tail -n 60 "$OUT/gradle.log"
  exit 1
fi

APK="$(find "$PROJ" -path '*outputs/apk/release/*.apk' | head -n 1)"
if [ -z "$APK" ]; then
  echo "No release APK under $PROJ"
  exit 1
fi
cp "$APK" "$OUT/SpaceFlight.apk"

BUILD_TOOLS="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -n 1)"
echo "== Signature ($BUILD_TOOLS)"
"$BUILD_TOOLS/apksigner" verify --print-certs "$OUT/SpaceFlight.apk" | head -n 4
"$BUILD_TOOLS/aapt2" dump badging "$OUT/SpaceFlight.apk" | grep -E "^package:|^application-label:|sdkVersion|native-code" || true
du -h "$OUT/SpaceFlight.apk"
