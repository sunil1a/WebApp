# Calorie Tracker — Android app

Wraps the web app in `../calorie-tracker` as a native Android APK. The output is
**`dist/CalorieTracker.apk`**: Android 7.0+ (minSdk 24, targetSdk 34), about 120 KB.

## Install on your phone

1. Copy `dist/CalorieTracker.apk` to the phone (download it from GitHub, or send it via Drive, WhatsApp, email or USB).
2. Tap the file. Android asks you to allow installs from that app (Chrome, Files, Drive…) — allow it once.
3. Tap **Install**. If Play Protect shows "Unsafe app blocked" / "App scan recommended", choose
   **More details → Install anyway** (it warns about any APK that isn't from the Play Store).
4. Open **Calories** from your home screen or app drawer.

To update later, install a newer APK over the old one — your logs are kept.
Uninstalling the app deletes your logs, so export a CSV first (Settings → Export CSV).

## What's native vs. web

| Feature | How it works in the app |
|---|---|
| UI, food list, calorie maths, dashboard | The bundled web app, running offline in a WebView |
| **Speak** | Android's built-in voice typing (Indian English) |
| **Photo** | Lets you pick **Camera** or **Gallery** |
| **Export CSV** | Opens the share sheet so you can save to Files/Drive or send it |
| Back button | Goes back to the Log tab, then closes the app |
| Data | Stored on the phone (WebView local storage) |
| AI photo/estimates | Needs internet and an Anthropic API key (Settings) |

## Building

No Android Studio or Gradle needed: just a JDK and Ubuntu/Debian's Android tools.

```bash
sudo apt-get install openjdk-21-jdk-headless zip aapt apksigner zipalign dalvik-exchange android-sdk-platform-23
./build.sh                          # → dist/CalorieTracker.apk
VERSION_CODE=2 VERSION_NAME=1.1 ./build.sh   # bump the version for an update
```

The GitHub Actions workflow `.github/workflows/build-android-apk.yml` runs the same script on every
push that touches the app, and attaches the APK to the run as a downloadable artifact.

### Signing key

`calorie-tracker.jks` (password `calorietracker`) signs the APK. Android only installs an update if it is
signed with the **same key**, so keep this file. It's committed here for convenience because this is a
personal, sideloaded app. If you ever publish to the Play Store, create a new private key and keep it
out of the repository.

### Layout

| Path | Purpose |
|---|---|
| `AndroidManifest.xml` | App id `app.calorietracker`, permissions (internet only) |
| `src/.../MainActivity.java` | WebView host, serves `assets/www` at `https://appassets.androidplatform.net/`, voice, camera/gallery, share |
| `src/.../FileShareProvider.java` | Lets the camera app write the photo and share targets read the CSV |
| `res/` | App name, light/dark theme, launcher icons (adaptive on Android 8+) |
| `build.sh` | aapt2 → javac → dx → zipalign → apksigner |
