#!/bin/bash
set -e

# Clear old IPAs and logs
echo "🗑️  Cleaning previous builds..."
rm -f *.ipa
rm -f build.log
touch build.log

echo "🚀 Starting ITU iOS Build Process..."
echo "📄 Detailed logs are being written to build.log"
echo "----------------------------------------"

# Ensure node is properly set up
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

echo -n "📦 [1/5] Creating React Native Bundle... "
./node_modules/.bin/react-native bundle --entry-file index.js \
  --platform ios \
  --dev false \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios \
  >> build.log 2>&1
echo "✅"

# Config
cd ios
WORKSPACE="T.xcworkspace"
SCHEME="T"
CONFIGURATION="Release"
ARCHIVE_PATH="build/T.xcarchive"
IPA_PATH="../ITU.ipa"

echo -n "🧹 [2/5] Cleaning Xcode Workspace...   "
xcodebuild clean -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration "$CONFIGURATION" >> ../build.log 2>&1
echo "✅"

echo -n "🏗️  [3/5] Archiving Project (Unsigned)..."
export SKIP_BUNDLING=1
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  >> ../build.log 2>&1
echo "✅"

echo -n "📂 [4/5] Packaging Payload...          "
rm -rf Payload >> ../build.log 2>&1
mkdir Payload
cp -r "$ARCHIVE_PATH/Products/Applications/T.app" Payload/
cp main.jsbundle Payload/T.app/
if [ -d "assets" ]; then
    cp -r assets Payload/T.app/
fi
echo "✅"

echo -n "🗜️  [5/5] Compressing to IPA...          "
zip -q -r "$IPA_PATH" Payload >> ../build.log 2>&1
echo "✅"

cd ..
echo "----------------------------------------"
echo "🎉 Build Successful! IPA created at: $(pwd)/ITU.ipa"
