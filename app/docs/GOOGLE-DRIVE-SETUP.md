# Google Drive Backup — Setup Guide

The Drive backup buttons in **Settings → Import / Export → Google Drive backup**
are stubs today: every call throws
`Google Drive not configured: OAuth client ID required`.
Follow these steps (one-time, by the app owner) to enable them.

## 1. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and sign in
   with the Google account that will own the app.
2. **Create a project** (e.g. `darzi-register`) and select it.

## 2. Enable the Google Drive API

1. In the console: **APIs & Services → Library**.
2. Search **"Google Drive API"** → **Enable**.

## 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen** → choose **External**.
2. Fill in: app name `Darzi Register`, user support email, developer contact email.
3. **Scopes → Add**: `https://www.googleapis.com/auth/drive.file`
   (least privilege — the app only sees files it created itself).
4. **Test users**: add your own Google account(s) while the app is in testing.
5. Publish the app later if you distribute beyond test users.

## 4. Create an Android OAuth client

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Android**.
3. **Package name**: the one in `android/app/build.gradle`
   (`applicationId`, e.g. `com.darziregister`).
4. **SHA-1 certificate fingerprint**:
   - Debug builds: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`
   - Release builds: use your Play Console **App integrity → App signing key**
     SHA-1 (or your own release keystore's SHA-1 if you sign manually).
   - Add **both** fingerprints if you test debug and ship release.
5. Save the **client ID** — you will need it in code. (There is no downloadable
   secret for Android clients; the client ID is public-by-design.)

## 5. Install the sign-in library

```bash
npm install @react-native-google-signin/google-signin
```

Follow its README for the Android setup (`google-services.json` is **not**
required for the Drive scope flow; the OAuth client from step 4 is enough).

## 6. Implement the stub

File: `src/services/export/driveService.ts`

1. `GoogleSignin.configure({ scopes: ['https://www.googleapis.com/auth/drive.file'] })`
   at app startup (after the license gate, before Settings is reachable).
2. `connect()`: `await GoogleSignin.signIn()` then cache the access token via
   `GoogleSignin.getTokens()`.
3. `uploadBackup(localPath)`: zip the backup folder (add
   `react-native-zip-archive`), then `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
   with metadata `{ name: 'darzi-backup-<date>.zip', mimeType: 'application/zip',
   parents: ['appDataFolder'] }` — `appDataFolder` keeps backups hidden from the
   user's Drive UI and scoped to this app.
4. `listBackups()`: `GET https://www.googleapis.com/drive/v3/files`
   with `q: "'appDataFolder' in parents and name contains 'darzi-backup'"`
   ordered by `createdTime desc`.
5. `downloadBackup(remoteId, destDir)`: `GET .../files/<id>?alt=media`, unzip
   into `destDir`, then call the existing `restoreBackup(destDir, repo, mode)`.
6. Make `isConfigured()` return `true` once a client ID is present.
7. Refresh expired tokens with `GoogleSignin.getTokens()` before each call;
   surface sign-in failures to the user with a retry option.

## 7. Keep secrets out of source

- The Android OAuth **client ID is not a secret**, but keep all IDs/keys in a
  build-time config (e.g. `react-native-config` / `.env`, git-ignored), never
  hardcoded in committed source.
- Never commit `google-services.json`, keystores, or key passwords.

## Privacy note

Backups contain customer names, phone numbers, measurements, and photos.
Uploads happen **only** when the user taps the backup button — there is no
background sync in this design, and that must stay true.
