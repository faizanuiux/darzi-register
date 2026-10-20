# Darzi Register by Faizan — Complete Project Summary

## Overview
Darzi Register is a digital measurement book for tailors, replacing the traditional paper register. It consists of four parts: a mobile app, a marketing landing page, an admin dashboard, and a cloud backend for license management.

**Live URLs:**
- Marketing site: https://darzi-register.vercel.app
- App (web): https://darzi-register.vercel.app/app.html
- Admin dashboard: https://darzi-register.vercel.app/admin.html
- Android APK: https://darzi-register.vercel.app/darzi-register.apk

---

## 1. Mobile App (Darzi Register)

**File:** `app.html` (single-file web app, also wrapped as Android APK)

**Features:**
- Customer list with photos, names, and mobile numbers
- Instant search by name or phone number
- Create / Edit / Delete customers (delete asks for confirmation)
- Customer detail view with tappable phone number (tel: link)
- 9 measurement fields with English + Urdu bilingual labels:
  - Length of Kameez (لمبائی قمیض), Bazu (بازو), Terah (تیراہ), Gala (گلہ),
    Chati (چھاتی), Kamar (کمر), Gera (گیرا), Length of Salwar (لمبائی شلوار), Payencha (پائنچہ)
- 8 extra stitching-option checkboxes with Urdu labels:
  - فرنٹ جیب (front pocket), سنگل سائیڈ جیب, ڈبل سائیڈ جیب, ہپ (hip),
    کالر (collar), بین, کف (cuff), پلیٹ (plate)
- Free-text notes field per customer
- Customer photo upload (compressed to 480px JPEG, stored locally)
- Floating + button for adding new customers

**Technical:**
- Fully offline — all customer data stored in the phone's IndexedDB (`darzi-register` database, `customers` store)
- No internet required for daily use
- PWA (Progressive Web App) — installable from the browser, works offline via service worker
- License activation screen on first launch (see Backend section)
- In-app update popup — checks `version.json` on launch; if a newer APK exists, prompts the user to download it
- `?demo=1` URL parameter seeds 3 demo customers (used for screenshots/testing)

**Android APK:**
- Native WebView wrapper (package `app.vercel.darziregister.twa`)
- Current version: 1.0.3 (versionCode 4)
- Loads the live web app, so most bug fixes deploy instantly with no reinstall needed
- Only native-level changes (e.g. file picker) require rebuilding the APK
- Signed with self-generated keystore

---

## 2. Marketing Landing Page

**File:** `index.html`

Premium marketing site (forest green / ivory / brass theme, Outfit font, Lucide icons) with:
- Hero section with app download CTA and phone mockup
- Trust strip (Android app, works offline, built for tailors)
- Paper notebook vs digital comparison
- 6 feature cards with app screenshots
- Interactive "product in action" demo tabs
- 4-step getting-started guide (Download → Install → Activate → Add customers)
- App showcase section
- 8-question FAQ accordion
- Final download CTA and footer

All download buttons link directly to the APK file.

---

## 3. Admin Dashboard

**File:** `admin.html` (+ `config.js` for credentials)

Password-protected admin panel (default password: `__PASSWORD_KEPT_BY_OWNER__`, changeable in Profile tab) with a left sidebar navigation:

**📊 Dashboard tab:**
- Stat cards: Total Keys, Active Customers, Keys Available, Activations (last 7 days)
- Recent Activity list (latest activations with customer names and dates)

**🔑 License Keys tab:**
- Generate new license keys (format `DRZ-XXXX-XXXX`) with optional customer name
- One-click copy of generated keys (to send via WhatsApp)
- Full key table: key, customer, Used/Unused status badge, activation date
- Copy and delete (unused keys only) actions per key

**👤 Profile tab:**
- Business info (Darzi Register, Owner: Faizan)
- Database connection status indicator
- App version display
- Change admin password (stored in browser localStorage)
- Logout

**Design:** Modern sidebar layout, Outfit font, colored stat tiles, card-based UI, responsive (sidebar becomes hamburger drawer on mobile).

---

## 4. Backend (License System)

**Provider:** Supabase (free tier)
**Project:** https://zfaehmpnfsgqsfypwiip.supabase.co

**Database table `licenses`:**
| Column | Type | Purpose |
|---|---|---|
| key | text (PK) | License key, e.g. `DRZ-X4K2-9M7P` |
| customer_name | text | Optional buyer name |
| used | boolean | Whether the key has been activated |
| device_id | text | Phone ID the key is locked to |
| created_at | timestamptz | When the key was generated |
| activated_at | timestamptz | When the customer activated |

**How licensing works:**
1. Seller generates a key in the admin dashboard → saved to Supabase as unused
2. Seller sends the key to the customer (e.g. via WhatsApp)
3. Customer installs the APK, opens the app, enters the key
4. App checks the key against Supabase (one-time internet needed):
   - Invalid key → error message
   - Already-used key → rejected ("already used on another device")
   - Valid unused key → marked used, locked to that phone's device ID, app activated
5. After activation, the app works fully offline forever

**Anti-reseller protection:** One key = one phone. A shared key or shared APK cannot activate on a second device.

**Setup SQL** (saved in `supabase-setup.sql`):
```sql
create table licenses (
  key text primary key,
  customer_name text,
  used boolean default false,
  device_id text,
  created_at timestamptz default now(),
  activated_at timestamptz
);
alter table licenses enable row level security;
create policy "public read" on licenses for select using (true);
create policy "public insert" on licenses for insert with check (true);
create policy "public update" on licenses for update using (true);
```

---

## 5. File Inventory (`~/workspace/tailor-app/`)

| File | Purpose |
|---|---|
| `app.html` | The tailor app (customers, measurements, activation) |
| `index.html` | Marketing landing page |
| `admin.html` | Admin dashboard |
| `config.js` | Supabase URL + anon key, admin password |
| `supabase-setup.sql` | Database table setup |
| `version.json` | Latest APK version (drives in-app update popup) |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (offline support) |
| `icon.svg` / `icon-512.png` / `icon-192.png` | App icons |
| `shot-hero.png`, `shot-list.png`, `shot-detail.png`, `shot-extras.png` | Landing page screenshots |
| `darzi-register.apk` | Built Android app (v1.0.3) |
| `apk/` | Android Studio project source |
| `deploy.py` | Deploy script (uploads files + creates Vercel deployment) |

**Hosting:** Vercel, project `darzi-register` (account `faizy-khan`)
**Deploy method:** `python3 deploy.py` — uploads each file, creates a new production deployment

---

## 6. Business Flow (End to End)

1. Customer finds the marketing site (or gets the link on WhatsApp)
2. Customer taps Download → installs the APK
3. Customer pays the seller (JazzCash / Easypaisa / bank transfer)
4. Seller opens the admin dashboard → generates a key → sends it on WhatsApp
5. Customer opens the app → enters the key → app activates (internet needed once)
6. Customer adds their tailoring customers and records measurements — fully offline from here
7. When a new app version is released, the seller updates `version.json` → old apps show an update popup with a download button
