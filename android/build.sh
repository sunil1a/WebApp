#!/usr/bin/env bash
# Builds dist/CalorieTracker.apk from ../calorie-tracker without Gradle or Android Studio.
# Needs JDK 17+ and Ubuntu/Debian's Android tools:
#   sudo apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23
set -euo pipefail
cd "$(dirname "$0")"

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
MIN_SDK=24      # Android 7.0
TARGET_SDK=34   # Android 14
ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
KEYSTORE="${KEYSTORE:-calorie-tracker.jks}"
KS_PASS="${KS_PASS:-calorietracker}"
KEY_ALIAS="${KEY_ALIAS:-calories}"

BUILD=build
rm -rf "$BUILD" && mkdir -p "$BUILD"/{compiled,gen,classes,assets/www} dist

echo "• Bundling web app"
cp -r ../calorie-tracker/{index.html,styles.css,app.js,foods.js,parser.js,ai.js,manifest.json,icon.svg,icons} "$BUILD/assets/www/"

echo "• Compiling resources"
aapt2 compile --dir res -o "$BUILD/compiled/res.zip"
aapt2 link -o "$BUILD/unsigned.apk" -I "$ANDROID_JAR" \
  --manifest AndroidManifest.xml -A "$BUILD/assets" --java "$BUILD/gen" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  "$BUILD/compiled/res.zip"

echo "• Compiling Java"
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$ANDROID_JAR" -d "$BUILD/classes" \
  $(find src "$BUILD/gen" -name '*.java')

echo "• Converting to DEX"
dalvik-exchange --dex --min-sdk-version="$MIN_SDK" --output="$BUILD/classes.dex" "$BUILD/classes"
(cd "$BUILD" && zip -q -j unsigned.apk classes.dex)

echo "• Aligning and signing"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias "$KEY_ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Calorie Tracker" >/dev/null 2>&1
fi
zipalign -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --ks-key-alias "$KEY_ALIAS" \
  --min-sdk-version "$MIN_SDK" --out dist/CalorieTracker.apk "$BUILD/aligned.apk"
apksigner verify dist/CalorieTracker.apk
rm -f dist/CalorieTracker.apk.idsig

echo "✓ dist/CalorieTracker.apk ($(du -h dist/CalorieTracker.apk | cut -f1))"
