# Darzi Register — React Native Android App

Digital measurement book for tailors. React Native (bare, TypeScript), Android-first, offline-first with device-bound license activation via Supabase.

## Prerequisites

- Node.js >= 22.11, npm 10+
- Java 17 (`/usr/lib/jvm/java-17-openjdk-amd64`)
- Android SDK: `platforms;android-34`, `build-tools;34.0.0`
- Gradle 9.4.1 (or use the wrapper once network allows)
- Env vars: `ANDROID_HOME` / `ANDROID_SDK_ROOT` → Android SDK path

If Java was installed via apt and the VM restarted, reinstall:
`sudo apt-get install -y openjdk-17-jdk && sudo update-ca-certificates -f`

## Setup

```sh
cd DarziRegister
npm install --legacy-peer-deps
```

## Run tests

```sh
npx jest            # all unit tests
npx tsc --noEmit    # typecheck
npx eslint .        # lint
```

## Debug build

```sh
cd android
gradle assembleDebug   # or ./gradlew if it can download the distribution
```

## Release build (signed APK)

The release is signed with the existing `darzi.keystore` (alias `darzi`,
password `__PASSWORD_KEPT_BY_OWNER__`) so installs update seamlessly over the previous APK
(package `app.vercel.darziregister.twa`, versionCode 5).

**Important:** This project uses **Zod v3** (not v4). Zod v4's `export * as`
syntax is incompatible with Metro's Babel transform and breaks the release
JS bundle. Do not upgrade to Zod v4.

In sandboxed/proxied build environments where Java cannot validate the
egress proxy's certificates, use the local Maven caching proxy:

```sh
# Terminal 1: start the proxy (fetches via curl, serves over plain HTTP)
python3 ~/workspace/darzi-rn/scripts/maven-proxy.py

# Terminal 2: build with the proxy init script
cd android
gradle assembleRelease --no-daemon -x lint -I ~/workspace/darzi-rn/scripts/maven-proxy.init.gradle
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Standard build (direct network):

```sh
cd android
gradle assembleRelease --no-daemon -x lint
# APK: android/app/build/outputs/apk/release/app-release.apk
```

Verify signature:
```sh
~/android-sdk/build-tools/34.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

## Versioning

Bump `versionCode` (integer, must increase) and `versionName` in
`android/app/build.gradle` for each release.

## Project structure

```
src/
  app/            navigation, bootstrap, providers
  core/           api, config, constants, i18n, storage, theme, utils
  components/     reusable UI (common, forms, customers, measurements, feedback, layout)
  features/       activation, customers, customer-details, customer-editor,
                  customer-import-export, settings
  database/       SQLite schema, migrations, repositories
  services/       device, licensing, export, import, files, images
  localization/   en/, ur/
  types/          shared domain types
```

## License backend

Supabase project (see `API-CONTRACT.md`): table `licenses`
(key PK, customer_name, used, device_id, created_at, activated_at).
One key = one device. Customer data never leaves the device.

## Google Drive backup

Not configured (needs OAuth client ID). See `docs/GOOGLE-DRIVE-SETUP.md`
for the exact setup steps. Local CSV/PDF/backup work without it.
