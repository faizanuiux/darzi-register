# Darzi Register — License API Contract

How the app activates, validates, and binds licenses to devices. The "REST API"
is implemented directly on **Supabase PostgREST** — there is no custom backend
server. The app maps logical operations to Supabase REST equivalents as listed
below.

**Status:** production backend, tables already exist. Do not create new tables.

## Base

- **Base URL:** `https://zfaehmpnfsgqsfypwiip.supabase.co`
- **Table:** `licenses`
  | column         | type       | notes                                  |
  | -------------- | ---------- | -------------------------------------- |
  | `key`          | TEXT PK    | Format `DRZ-XXXX-XXXX`                 |
  | `customer_name`| TEXT       | Set by the admin dashboard; app never writes it |
  | `used`         | BOOLEAN    | `true` once activated                  |
  | `device_id`    | TEXT       | Android ID the key is bound to         |
  | `created_at`   | TIMESTAMPTZ|                                        |
  | `activated_at` | TIMESTAMPTZ| Set at activation                      |

## Authentication

Every request sends these headers (see `src/core/api/supabase.ts`):

```
apikey:        <SUPABASE_ANON_KEY>     (publishable key — safe in the client)
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type:  application/json
```

> ⚠️ The **service-role key must never** be bundled with the app. It bypasses
> Row Level Security. Only the anon (publishable) key ships with the client.

## Operations

### 1. Validate key format — client-side (no network)

`POST /api/licenses/activate` step 0: the key is checked locally against
`/^DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/` (trimmed, uppercased). Malformed keys are
rejected as `format` without any request.

### 2. Look up a license key

Supabase REST equivalent of `GET /api/licenses/status?key=…`:

```http
GET /rest/v1/licenses?key=eq.DRZ-ABCD-1234&select=*
```

- **200 + `[{...}]`** — key exists.
- **200 + `[]`** — key does not exist (PostgREST returns an empty array, not
  404, for filtered reads). App error code: `invalid`.

### 3. Activate a license

Supabase REST equivalent of `POST /api/licenses/activate`:

```http
PATCH /rest/v1/licenses?key=eq.DRZ-ABCD-1234
Prefer: return=representation

{
  "used": true,
  "device_id": "<android-id>",
  "activated_at": "2026-10-19T08:30:00.000Z"
}
```

Request shape (`ActivateRequest`):

| field          | type    | required | notes                       |
| -------------- | ------- | -------- | --------------------------- |
| `used`         | boolean | yes      | always `true` on activation |
| `device_id`    | string  | yes      | Android ID of this phone    |
| `activated_at` | string  | yes      | ISO 8601 timestamp          |

Response shape (`ActivateResponse`): the updated row, `{ key, used, device_id,
activated_at }`.

Flow (`licenseService.activate`):
1. Format check → `LicenseError('format')`
2. GET the row → missing → `LicenseError('invalid')`
3. `row.used && row.device_id !== thisDevice` → `LicenseError('used')`
   (same-device reactivation is allowed and skips the PATCH rewrite)
4. PATCH `used/device_id/activated_at`
5. Persist `{ key, deviceId, activatedAt, lastValidatedAt }` to encrypted
   storage

### 4. Validate the stored license

Supabase REST equivalent of `POST /api/licenses/validate` — re-reads the row
for the stored key and returns:

| result      | meaning                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| `valid`     | Key exists and is bound to this device (or unbound); state re-timestamped   |
| `invalid`   | No stored activation, key deleted, or past the offline grace period         |
| `disabled`  | Key now bound to a **different** device (reassigned); local state is cleared |
| `offline`   | Network/server unreachable, but cached activation is within the grace window |

## Error codes

`LicenseError.code` (thrown by `activate`; `validate` returns a result union):

| code       | meaning                                          | retryable |
| ---------- | ------------------------------------------------ | --------- |
| `invalid`  | No such key                                      | no        |
| `used`     | Key bound to another device                      | no        |
| `expired`  | License expired (reserved — backend has no expiry yet) | no   |
| `disabled` | Key disabled / reassigned                        | no        |
| `network`  | Network down, timeout, or server 5xx/auth error  | yes       |
| `format`   | Key fails the client-side format check           | no        |

The app maps these to localized strings under `localization/*/common.ts →
activation.errors`. A 15-second request timeout (`AbortController`) applies to
every call; keys are never included in logs or error messages.

## Device binding

- **Device ID = Android ID** (`Settings.Secure.ANDROID_ID`, via
  `react-native-device-info` `getAndroidId()`). Not IMEI / serial / MAC.
- App-scoped on Android 8+: unique per (app signing key, user, device).
  **Resets on factory reset** — Boss/the admin dashboard must reset
  `used=false, device_id=null` on the row to let a reset phone reactivate.
- Survives app reinstalls by the same user.
- One key → one device. Same device may reactivate its own key freely
  (e.g. after app-data wipe).

## Offline grace policy

- Activation requires internet **once**.
- After that, the app works fully offline for **`licenseOfflineGraceDays`
  (30 days)** from `activatedAt` (`ENV.licenseOfflineGraceDays`).
- `validate()` in the background: reachable → re-checks binding; unreachable
  but within grace → `offline` (app keeps working); unreachable past grace →
  `invalid` (user must reactivate online).
- Offline revalidation never blocks app startup — the stored state gates the
  UI immediately, the network check runs behind it.

## Privacy

- Customer data (`customer_name`, and all tailor/customer records) is
  **never sent to Supabase** by the app. License traffic carries only
  `key`, `used`, `device_id`, `activated_at`.
- All tailor data lives on-device (IndexedDB / SQLite); the license API is
  the only network call in the app.

## Rate limits & abuse notes

- Supabase free-tier/PostgREST rate limits apply to the anon key. Activation
  and validation are low-frequency by design (once per install + occasional
  background revalidation); do not poll.
- The app never retries more than the user's own tap — no automatic retry
  loops — to avoid hammering a failing endpoint.
- Keys are high-entropy; no lockout on wrong guesses, but repeated `invalid`
  responses from one client are a signal worth monitoring server-side.
