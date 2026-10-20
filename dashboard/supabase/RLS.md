# RLS design — Darzi Register dashboard backend

## The two halves of the schema

### 1. `licenses` — the live mobile contract (DO NOT RESTRICT YET)

The mobile app talks to this table **directly with the anon key**: it GETs the
row by `key`, and on activation PATCHes `used=true`, `device_id=<android-id>`,
`activated_at=now()`. The existing permissive anon read/insert/update policies
are what make that work.

**Decision: leave those policies exactly as they are.** Tightening them now
would brick activation for every installed app. The 20261019 migrations only
*extend* this table (new nullable/defaulted columns + indexes) so the old flow
is untouched.

### 2. New dashboard tables — deny by default

`devices`, `activation_events`, `admin_audit_logs`, `app_settings` have
**ROW LEVEL SECURITY enabled with zero permissive policies** for anon or
authenticated. That is a deliberate deny-by-default: no public PostgREST
access at all.

The dashboard server is the only client of these tables, and it connects with
the **service-role key, which bypasses RLS entirely** — so reads/writes from
the dashboard keep working while the public surface stays closed. We add *no*
policies at all (rather than writing "restrictive" ones) so the posture can't
be silently weakened by a future permissive policy.

## Future tightening path for `licenses`

Only in this order — skipping steps breaks the live app:

1. **Move mobile traffic behind the dashboard.** Route activation and
   validation through the dashboard's `/api/*` routes (service-role).
2. **Ship an app update** whose activation/validation code calls those routes
   instead of hitting Supabase directly.
3. **Wait for the old flow to drain.** Watch `activation_events` (and app
   versions in `devices`) until no direct-Supabase activations remain.
4. **Then, and only then:** drop the anon policies on `licenses` and restrict
   the table to service-role-only access.

## Related rules enforced by the migrations

- Plaintext license keys live **only** in `licenses.key`. Event/audit tables
  store masked hints (`DRZ-••••-EFGH`) or hashes, never plaintext.
- No foreign key from `licenses.device_id` to `devices` — the mobile app's
  PATCH-first activation would violate it (device row may not exist yet).
- `enabled` defaults to `TRUE`; `expires_at` may be backdated by admins (no
  future-date check constraint).
