/**
 * REFERENCE IMPLEMENTATIONS of the documented API route contracts:
 *  - POST /api/devices/register        (idempotent upsert)
 *  - POST /api/licenses/activate       (format → invalid → disabled → expired → used; binds device)
 *  - POST /api/licenses/validate       (status lookup by key)
 *  - GET  /api/licenses/status         (status lookup by key)
 *  - POST /api/admin/licenses/generate (one license per device)
 *
 * The sibling-owned route handlers were not on disk when this suite was
 * written, so the API-logic tests exercise these spec-compliant references
 * instead. Each handler consumes `createServiceClient()` from
 * `lib/supabase/server` — the test suite `vi.mock`s that module to return the
 * in-memory fake, so the integration seam (route → service client → query
 * builder) is genuinely exercised.
 *
 * Each handler returns `{ status, body }`; the real Next.js routes wrap the
 * same shape in `NextResponse.json(body, { status })`.
 *
 * TO SWAP IN THE REAL ROUTES: in `tests/unit/api-logic.test.ts` replace these
 * imports with the real route module(s) (e.g. `POST` from
 * `../../app/api/licenses/activate/route`, invoked with a `Request`). The
 * test expectations describe the documented contract.
 */
import { createServiceClient } from "../../../lib/supabase/server";
import {
  generateLicenseKey,
  hashKey,
  isValidKeyFormat,
  maskKey,
  normalizeKey,
} from "./license-keys";
import { getLicenseStatus } from "./license-status";

export interface RouteResult {
  status: number;
  body: Record<string, any>;
}

// `any`: the mocked service client is the in-memory fake in tests.
type Db = any;
function svc(): Db {
  return createServiceClient();
}

export interface RegisterDeviceInput {
  device_id: string;
  customer_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  android_version?: string | null;
  app_version?: string | null;
}

/** POST /api/devices/register — idempotent: same device_id twice → one row. */
export async function registerDevice(input: RegisterDeviceInput): Promise<RouteResult> {
  const supabase = svc();
  if (!input || typeof input.device_id !== "string" || input.device_id.trim() === "") {
    return { status: 400, body: { ok: false, code: "invalid", message: "device_id is required" } };
  }
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("devices")
    .select("*")
    .eq("device_id", input.device_id)
    .maybeSingle();

  if (existing) {
    const { data: updated } = await supabase
      .from("devices")
      .update({ last_seen_at: now })
      .eq("device_id", input.device_id)
      .select()
      .single();
    return { status: 200, body: { ok: true, is_new: false, device: updated ?? existing } };
  }

  const { data: created, error } = await supabase
    .from("devices")
    .insert({
      device_id: input.device_id,
      customer_name: input.customer_name ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      android_version: input.android_version ?? null,
      app_version: input.app_version ?? null,
      registered_at: now,
      last_seen_at: now,
    })
    .select()
    .single();

  if (error || !created) {
    return { status: 500, body: { ok: false, code: "db_error", message: error?.message ?? "insert failed" } };
  }
  return { status: 201, body: { ok: true, is_new: true, device: created } };
}

export interface ActivateInput {
  key: string;
  device_id: string;
}

/**
 * POST /api/licenses/activate.
 * Check order: format → invalid (not found) → disabled → expired → used,
 * then binds the device. Status precedence is delegated to `getLicenseStatus`
 * so activate/validate/status can never disagree (expired beats disabled).
 */
export async function activateLicense(input: ActivateInput): Promise<RouteResult> {
  const supabase = svc();
  const normalized = normalizeKey(input?.key ?? "");
  if (!isValidKeyFormat(normalized)) {
    return { status: 400, body: { ok: false, code: "invalid", message: "Invalid license key format" } };
  }
  if (!input?.device_id || typeof input.device_id !== "string") {
    return { status: 400, body: { ok: false, code: "invalid", message: "device_id is required" } };
  }

  const keyHash = hashKey(normalized);
  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!license) {
    return { status: 404, body: { ok: false, code: "invalid", message: "License key not found" } };
  }

  const status = getLicenseStatus(license);
  if (status === "disabled") {
    return { status: 403, body: { ok: false, code: "disabled", message: "License is disabled" } };
  }
  if (status === "expired") {
    return { status: 403, body: { ok: false, code: "expired", message: "License has expired" } };
  }
  if (license.used && license.device_id !== input.device_id) {
    return { status: 409, body: { ok: false, code: "used", message: "License is already bound to another device" } };
  }
  if (license.used && license.device_id === input.device_id) {
    // Idempotent re-activation on the same device.
    return { status: 200, body: { ok: true, code: "active", key_hint: license.key_hint ?? maskKey(normalized) } };
  }

  // Optimistic check-and-set: bind only when the row is still unused. The real
  // route wraps this in a transaction (SELECT … FOR UPDATE); the observable
  // effect is identical — exactly one concurrent activation flips used=false.
  const now = new Date().toISOString();
  const { data: bound } = await supabase
    .from("licenses")
    .update({ used: true, device_id: input.device_id, activated_at: now })
    .eq("key_hash", keyHash)
    .eq("used", false)
    .select();

  if (bound && bound.length === 1) {
    return { status: 200, body: { ok: true, code: "active", key_hint: bound[0].key_hint ?? maskKey(normalized) } };
  }

  // Lost the race (or the row changed between our read and write): re-read to
  // report the real reason.
  const { data: current } = await supabase
    .from("licenses")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (current && current.used && current.device_id === input.device_id) {
    return { status: 200, body: { ok: true, code: "active", key_hint: current.key_hint ?? maskKey(normalized) } };
  }
  return { status: 409, body: { ok: false, code: "used", message: "License is already bound to another device" } };
}

export interface ValidateInput {
  key: string;
}

/** POST /api/licenses/validate — status lookup; never mutates binding state. */
export async function validateLicense(input: ValidateInput): Promise<RouteResult> {
  const supabase = svc();
  const normalized = normalizeKey(input?.key ?? "");
  if (!isValidKeyFormat(normalized)) {
    return { status: 400, body: { ok: false, code: "invalid", message: "Invalid license key format" } };
  }
  const keyHash = hashKey(normalized);
  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!license) {
    return { status: 404, body: { ok: false, code: "invalid", message: "License key not found" } };
  }
  await supabase
    .from("licenses")
    .update({ last_validated_at: new Date().toISOString() })
    .eq("key_hash", keyHash);
  return {
    status: 200,
    body: { ok: true, code: getLicenseStatus(license), key_hint: license.key_hint ?? maskKey(normalized) },
  };
}

/** GET /api/licenses/status — same lookup as validate, exposed as a GET. */
export async function licenseStatus(input: ValidateInput): Promise<RouteResult> {
  const result = await validateLicense(input);
  if (!result.body.ok) return result;
  return {
    status: 200,
    body: { ok: true, code: result.body.code, key_hint: result.body.key_hint },
  };
}

export interface GenerateKeyInput {
  device_id?: string | null;
  customer_name?: string | null;
  expires_at?: string | null;
  admin_id?: string | null;
}

/**
 * POST /api/admin/licenses/generate — one license per device: generating for
 * a device that already holds a license returns the existing row (no new row).
 */
export async function adminGenerateKey(input: GenerateKeyInput): Promise<RouteResult> {
  const supabase = svc();
  if (input.device_id) {
    const { data: existing } = await supabase
      .from("licenses")
      .select("*")
      .eq("device_id", input.device_id)
      .maybeSingle();
    if (existing) {
      return {
        status: 200,
        body: { ok: true, reused: true, key_hint: existing.key_hint, message: "Device already has a license" },
      };
    }
  }

  const key = generateLicenseKey();
  const now = new Date().toISOString();
  const { data: created, error } = await supabase
    .from("licenses")
    .insert({
      key,
      key_hash: hashKey(key),
      key_hint: maskKey(key),
      customer_name: input.customer_name ?? null,
      used: false,
      enabled: true,
      device_id: input.device_id ?? null,
      activated_at: null,
      expires_at: input.expires_at ?? null,
      issued_by: input.admin_id ?? null,
      created_at: now,
    })
    .select()
    .single();

  if (error || !created) {
    return { status: 500, body: { ok: false, code: "db_error", message: error?.message ?? "insert failed" } };
  }
  // The plaintext key is returned exactly once at creation; afterwards only
  // key_hint / key_hash are used for lookup and display.
  return { status: 201, body: { ok: true, reused: false, key, key_hint: created.key_hint } };
}
