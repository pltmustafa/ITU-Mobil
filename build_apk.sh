#!/bin/bash
set -e

# Clear old APKs and logs
echo "🗑️  Cleaning previous builds..."
rm -f *.apk
rm -f build_android.log
touch build_android.log

echo "🚀 Starting ITU Android Build Process..."
echo "📄 Detailed logs are being written to build_android.log"
echo "----------------------------------------"

# Ensure node and android tools are properly set up
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

echo -n "📦 [1/4] Creating React Native Bundle... "
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res/ \
  >> build_android.log 2>&1
echo "✅"

cd android

echo -n "🧹 [2/4] Cleaning Gradle Project...      "
./gradlew clean >> ../build_android.log 2>&1
echo "✅"

echo -n "🏗️  [3/4] Building APK (Release)...       "
./gradlew assembleRelease >> ../build_android.log 2>&1
echo "✅"

echo -n "📂 [4/4] Locating and Moving APK...      "
APK_FILE=$(find app/build/outputs/apk/release -name "*.apk" | head -n 1)
if [ -n "$APK_FILE" ]; then
    cp "$APK_FILE" ../ITU.apk
    echo "✅"
else
    echo "❌ (APK not found)"
    exit 1
fi

cd ..
echo "----------------------------------------"
echo "🎉 Build Successful! APK created at: $(pwd)/ITU.apk"
