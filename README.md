# Darzi Register

Digital tailor measurement register — Android app with license-key activation,
an admin dashboard for issuing/controlling licenses, a marketing/download
website, and the shared Supabase (PostgreSQL) backend.

## Structure

| Folder | What it is |
| --- | --- |
| `app/` | React Native Android app (offline SQLite register, license activation with expiry/disable enforcement). Current version: v12 (versionCode 12). |
| `dashboard/` | Next.js admin dashboard — generate license keys, register devices, set expiry, enable/disable keys, watch activation activity. Live: https://darzi-dashboard.vercel.app |
| `site/` | Marketing + APK download website. Live: https://darzi-register.vercel.app |
| `supabase/` | Database migrations for the shared backend (`licenses`, `devices`, `activation_events`, `admin_audit_logs`, `app_settings`). |

## Deliberately NOT in this repo

- **The Android signing keystore** (`darzi.keystore`) and its password — kept by
  the owner only. Without it, nobody can publish an update that installs over
  the real app. In `app/android/app/build.gradle` the password appears as
  `__PASSWORD_KEPT_BY_OWNER__`.
- **The Supabase service-role key** — lives only in the dashboard's Vercel
  environment variables, never in code.
- **Binary assets** (app launcher icons, Outfit font files, site screenshots) —
  they live in the built APK and the working copies; add them here via GitHub's
  web upload if wanted.
- `node_modules/`, build outputs and APK files (see `.gitignore`).
