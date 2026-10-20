# Darzi Register — Deployment Guide

Target: Vercel. This dashboard deploys as a **brand-new Vercel project named
`darzi-dashboard`** — it must never be deployed into, merged with, or set to
overwrite the existing `darzi-register` project (the marketing/download site).
Treat the two as fully separate projects with separate deployments, env
configs, and domains.

## Vercel setup

1. In the Vercel dashboard: **Add New → Project → Import** this repository
   (`darzi-dashboard/`), and name the project **`darzi-dashboard`**.
2. Framework preset: **Next.js** (auto-detected).
3. Build & output settings:

   | Setting            | Value            |
   |--------------------|------------------|
   | Framework Preset   | Next.js          |
   | Build Command      | `npm run build`  |
   | Output Directory   | (default `.next`)|
   | Install Command    | `npm install`    |
   | Node.js Version    | 20.x             |

4. Add the environment variables from the table below (Production + Preview
   as appropriate), then **Deploy**.

## Environment variables

Copy values from `.env.example`. Obtain the Supabase values from the
Supabase Dashboard → **Project Settings → API**; generate
`ENTITLEMENT_SECRET` as a long random string and keep it in a password
manager.

| Variable                        | Scope             | Secret? | Where to get it                                   |
|---------------------------------|-------------------|---------|---------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | All (public)      | No — exposed to the browser by design (anon key is RLS-scoped) | Supabase Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All (public)      | No — exposed to the browser by design (scoped by RLS)          | Supabase Project Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server-only**   | **Yes — never expose to the browser.** Bypasses RLS. | Supabase Project Settings → API → service_role key |
| `ENTITLEMENT_SECRET`            | **Server-only**   | **Yes — never expose to the browser.** HMAC key for license entitlements. | Generate: 32+ random bytes (hex/base64); store in password manager |

Rules:

- The two `NEXT_PUBLIC_*` variables are safe in the browser; the other two
  must **only** exist as server env (Vercel encrypts them at rest and never
  ships them to the client). Never put them in `NEXT_PUBLIC_*` names,
  client components, or committed files.
- **Never commit `.env.local`, real keys, passwords, or the entitlement
  secret to git.** If a secret is ever committed, rotate it immediately in
  Supabase/Vercel and purge it from git history.

## dev / staging / prod guidance

- **Development:** `npm run dev` locally against the shared Supabase project
  (or a throwaway Supabase project for risky schema experiments).
- **Preview / staging:** every Vercel PR or branch push creates a Preview
  deployment with its own URL. Point Preview env at a **separate staging
  Supabase project** (same migrations, `supabase db push` in order) so
  experiments never touch production license rows.
- **Production:** the `main` branch deploys to Production. Keep Production
  env pointed at the real project (shared with the mobile app). Only promote
  a build to Production after it passes `npm run typecheck`, `npm run lint`,
  and `npm test`.

## Database backup & recovery

Supabase manages Postgres backups; the dashboard adds no separate backup
system.

- **Supabase Dashboard → Database → Backups:** daily backups are kept
  automatically (retention depends on plan).
- **Point-in-time recovery (PITR):** available on paid plans — restore to
  any second within the retention window from the same Backups page.
- **Manual snapshot** before risky migrations:

  ```bash
  pg_dump "$DATABASE_URL" -Fc -f darzi-backup-$(date +%F).dump
  # restore:
  pg_restore -d "$DATABASE_URL" --clean darzi-backup-YYYY-MM-DD.dump
  ```

  (`$DATABASE_URL` is the Postgres connection string from
  Supabase → Project Settings → Database.)

- Migrations in `supabase/migrations/` are idempotent and additive
  (`IF NOT EXISTS`), so re-running them is safe; always snapshot before
  schema changes that drop or alter columns.

## Rollback

- **App rollback (Vercel):** Vercel keeps every deployment. To roll back:
  Vercel Dashboard → project `darzi-dashboard` → **Deployments** → open the
  last known-good deployment → **Promote to Production**. Env vars are
  per-environment, so a rollback does not revert env changes — double-check
  them after promoting.
- **Migration reversibility:** the shipped migrations are additive (new
  tables, new nullable/defaulted columns, indexes). There are no destructive
  migrations to reverse. If a future migration drops or renames a column,
  ship the reverse migration (`supabase/migrations/<date>_revert_*.sql`) in
  the same release before promoting, and test the round-trip on the staging
  project first.
- **Secret rotation on suspected leak:** regenerate `ENTITLEMENT_SECRET` in
  Vercel env (all environments), redeploy, and inform users that devices
  should re-validate (old entitlements will fail signature checks and the
  app will fall back to `/validate` on next launch). Rotate the Supabase
  service-role key in Project Settings if it was exposed.

## Post-deploy checklist

- [ ] `GET /api/health` returns `{ "ok": true }` on the production URL.
- [ ] `/login` loads; admin sign-in works; non-admin users are signed out
      and redirected.
- [ ] Admin pages (`/`, `/devices`, `/licenses`, `/activity`, `/settings`)
      load for an admin and redirect to `/login` when signed out.
- [ ] `POST /api/licenses/activate` with a test key returns an entitlement;
      disabling the key flips validation to `error: "disabled"`.
- [ ] Vercel env: `SUPABASE_SERVICE_ROLE_KEY` and `ENTITLEMENT_SECRET` are
      present on **Production** and marked as secret; no secret appears in
      any client bundle (search the build output if in doubt).
