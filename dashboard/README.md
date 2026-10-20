# Darzi Register — Admin Dashboard

The web admin dashboard for **Darzi Register** (the digital tailor measurement
register app). It is the license-and-device control plane:

- Issue, disable, enable, and expire license keys (`DRZ-XXXX-XXXX`).
- Track app installations (devices) and correlate them with licenses.
- Watch activation/validation activity, audit every admin action, and read
  aggregate metrics.

The dashboard shares one Supabase project with the mobile app — the same
project, the same `licenses` table. The mobile app keeps talking to Supabase
directly (its flow is untouched); the dashboard adds a server-side API layer
with enforced expiry/disabled checks and signed license entitlements.

## Architecture

```
┌──────────────────────┐        ┌─────────────────────────────┐
│   Mobile app (RN)    │        │  Admin Dashboard (Next.js)  │
│                      │        │                             │
│  Direct PostgREST    │        │  Admin UI  ─┐               │
│  (anon key, legacy)  │        │  (server)   ├─ service role │
│                      │        │  Admin API  │  key (bypasses │
│  New API routes      │        │  (admin    │  RLS)         │
│  (adoption pending)  │        │   session) ┘               │
└──────────┬───────────┘        └──────────────┬──────────────┘
           │                                   │
           └──────────────┬────────────────────┘
                          ▼
              ┌───────────────────────┐
              │  Supabase Postgres    │
              │  licenses · devices   │
              │  activation_events    │
              │  admin_audit_logs     │
              │  app_settings         │
              └───────────────────────┘
```

Sessions are http-only cookies via `@supabase/ssr` — nothing auth-related in
localStorage, no custom token storage. Only the server talks to Supabase with
the service-role key (RLS bypass); public PostgREST access is deny-by-default
for the new tables (see `supabase/RLS.md`).

## Tech stack

| Layer        | Technology                                           |
|--------------|------------------------------------------------------|
| Framework    | Next.js 14 App Router + TypeScript                   |
| Styling      | Tailwind CSS                                         |
| Database     | Supabase Postgres (shared project with mobile app)   |
| Auth         | Supabase Auth, email/password, http-only cookies     |
| Validation   | Zod (all API inputs)                                 |
| Supabase SSR | `@supabase/ssr`                                      |

See [docs/API.md](docs/API.md) for the full API reference and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment.

## Local setup

**Prerequisites:** Node.js 20+, npm.

```bash
npm install
cp .env.example .env.local   # fill in real values — never commit .env.local
npm run dev                  # http://localhost:3000
```

`.env.local` holds the four environment variables documented in
[`.env.example`](.env.example). Never commit it or any real key, password,
or secret to git.

### Supabase setup

1. **Create (or reuse) a Supabase project.** This dashboard shares its project
   with the Darzi Register mobile app — both use the same `licenses` table.
2. **Run the migrations in order** (they are idempotent). Either:
   - paste each file from `supabase/migrations/` into the Supabase Dashboard
     SQL editor in filename order, or
   - with the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to
     the project: `supabase db push`.
3. Copy the project URL and anon key from **Project Settings → API** into
   `.env.local`, along with the service-role key (server-only).

### Admin bootstrap

The app ships with no admin users. Create the first one manually — this is
the only place `is_admin` is ever granted (it is never set in app code):

**(a)** Supabase Dashboard → **Authentication → Users → Add user**:
enter an email + password, check *Auto Confirm User*, and save.
**Never commit this password anywhere** — keep it in your password manager.

**(b)** Supabase Dashboard → **SQL editor**, and promote that user to admin:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"is_admin":true}'::jsonb
where email = 'admin@example.com';
```

A user is an admin **iff** `app_metadata.is_admin === true`. The dashboard's
`requireAdmin()` in `lib/admin.ts` enforces this on every admin page and API
route (401 when signed out, 403 when signed in as a non-admin).

### Running tests

```bash
npx vitest run   # or: npm test
npm run typecheck # tsc --noEmit
npm run lint      # next lint
npm run build    # production build (also typechecks)
```

## Project structure

```
.
├── app/
│   ├── api/
│   │   ├── auth/logout/          # POST /api/auth/logout
│   │   ├── devices/register/     # POST /api/devices/register (public)
│   │   ├── licenses/             # activate, validate, status (public)
│   │   ├── admin/                # metrics, devices, licenses, activity,
│   │   │                         # audit, settings (admin-only)
│   │   └── health/               # GET /api/health (public)
│   ├── login/                    # email+password sign-in (Server Action)
│   ├── (admin pages)/            # /, /devices*, /licenses*, /activity*, /settings*
│   └── layout.tsx  globals.css
├── lib/
│   ├── supabase/client.ts        # browser client (createBrowserClient)
│   ├── supabase/server.ts        # createServerSupabaseClient() +
│   │                             # createServiceClient() (service-role,
│   │                             # server-only; throws if key missing)
│   ├── supabase/middleware.ts    # updateSession() session-refresh helper
│   └── admin.ts                  # getAdminUser() / requireAdmin()
├── middleware.ts                 # session refresh; protects admin routes
├── supabase/
│   ├── migrations/               # 5 idempotent migrations (run in order)
│   ├── RLS.md                    # row-level-security design
│   └── seed.sql                  # optional local seed data
├── docs/
│   ├── API.md                    # full API reference + entitlement spec
│   └── DEPLOYMENT.md             # Vercel deploy, env vars, backups, rollback
└── .env.example                  # env var template (empty values, no secrets)
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` and `ENTITLEMENT_SECRET` are **server-only**:
  they never leave the server. The service-role client (`createServiceClient`)
  is marked `server-only` and throws at import time if the key is missing.
- Plaintext license keys live only in the `licenses.key` column. Event and
  audit tables store only the masked hint (`DRZ-••••-EFGH`) or the SHA-256
  hash — never plaintext.
- The login rate limiter (10 attempts / 10 min per IP) is in-memory per
  server instance; the upgrade path is Upstash Redis (`@upstash/ratelimit`) —
  see the comment in `app/login/actions.ts`.
- Sign-in uses generic error messages and immediately signs out non-admin
  users, so admin presence can't be probed.

## Scripts

| Script      | Command        | Purpose                    |
|-------------|----------------|----------------------------|
| `dev`       | `next dev`     | local dev server           |
| `build`     | `next build`   | production build           |
| `start`     | `next start`   | serve a production build   |
| `lint`      | `next lint`    | ESLint                     |
| `typecheck` | `tsc --noEmit` | TypeScript check           |
| `test`      | `vitest run`   | test suite                 |
