import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { hashKey, maskKey, normalizeKey, isValidKeyFormat } from "@/lib/license-keys";
import { signEntitlement } from "@/lib/entitlement";

export const runtime = "nodejs";

const activateSchema = z.object({
  key: z.string().min(1).max(64),
  device_id: z.string().min(1).max(128),
});

type ServiceClient = ReturnType<typeof createServiceClient>;

async function logEvent(
  supabase: ServiceClient,
  e: {
    device_id: string;
    event_type: string;
    outcome: string;
    license_key_hint: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("activation_events").insert({
    device_id: e.device_id,
    event_type: e.event_type,
    outcome: e.outcome,
    license_key_hint: e.license_key_hint,
    actor_type: "app",
    metadata: e.metadata ?? {},
  });
  if (error) {
    console.error("activation_events insert failed:", error.message);
  }
}

/**
 * POST /api/licenses/activate
 * Binds a license key to a device. Idempotent for same-device reactivation
 * (preserves the original activated_at). Public route (called by the app).
 *
 * Plaintext keys are NEVER logged or written to activation_events — only the
 * masked key_hint (e.g. "DRZ-••••-EFGH").
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`licenses-activate:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = activateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const { device_id } = parsed.data;

  let supabase: ServiceClient;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("createServiceClient failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  const normalized = normalizeKey(parsed.data.key);
  // Compute the masked hint once; this is the only key material that may
  // appear in logs or events from here on.
  const hint = maskKey(normalized);

  if (!isValidKeyFormat(normalized)) {
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "format",
      license_key_hint: hint,
    });
    return NextResponse.json({ ok: false, error: "format" }, { status: 400 });
  }

  const row = await supabase
    .from("licenses")
    .select("key, key_hint, used, enabled, expires_at, device_id, activated_at")
    .eq("key_hash", hashKey(normalized))
    .maybeSingle();
  if (row.error) {
    console.error(`activation db error for key ${hint}:`, row.error.message);
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "db_error",
      license_key_hint: hint,
    });
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  if (!row.data) {
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "invalid_key",
      license_key_hint: hint,
    });
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 404 });
  }

  const license = row.data;
  const keyHint = license.key_hint ?? hint;

  if (license.expires_at && new Date(license.expires_at).getTime() <= Date.now()) {
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "expired",
      license_key_hint: keyHint,
    });
    return NextResponse.json({ ok: false, error: "expired" }, { status: 403 });
  }
  if (!license.enabled) {
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "disabled",
      license_key_hint: keyHint,
    });
    return NextResponse.json({ ok: false, error: "disabled" }, { status: 403 });
  }
  if (license.used && license.device_id && license.device_id !== device_id) {
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "already_used",
      license_key_hint: keyHint,
    });
    return NextResponse.json({ ok: false, error: "used" }, { status: 403 });
  }

  const isReactivation = Boolean(license.used && license.device_id === device_id);
  const now = new Date().toISOString();

  // Bind the device. The partial unique index licenses(device_id) WHERE
  // device_id IS NOT NULL requires clearing this device_id from any OTHER
  // license rows first, otherwise the UPDATE below would hit 23505.
  // These two statements run sequentially via the service client; a future
  // hardening step could wrap them in a single Postgres function call.
  const cleared = await supabase
    .from("licenses")
    .update({ device_id: null })
    .eq("device_id", device_id)
    .neq("key", license.key);
  if (cleared.error) {
    console.error(`device_id clear failed for key ${keyHint}:`, cleared.error.message);
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "db_error",
      license_key_hint: keyHint,
    });
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  const bound = await supabase
    .from("licenses")
    .update({
      used: true,
      device_id,
      // Preserve the original activation timestamp on same-device
      // reactivation (matches the mobile app's direct-PATCH semantics).
      activated_at: license.activated_at ?? now,
      last_validated_at: now,
    })
    .eq("key", license.key);
  if (bound.error) {
    console.error(`activation bind failed for key ${keyHint}:`, bound.error.message);
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: bound.error.code === "23505" ? "conflict" : "db_error",
      license_key_hint: keyHint,
    });
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  let entitlement: ReturnType<typeof signEntitlement>;
  try {
    entitlement = signEntitlement({
      device_id,
      key_hint: keyHint,
      expires_at: license.expires_at,
    });
  } catch (err) {
    console.error("signEntitlement failed:", (err as Error).message);
    await logEvent(supabase, {
      device_id,
      event_type: "activation_failed",
      outcome: "config_error",
      license_key_hint: keyHint,
    });
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  await logEvent(supabase, {
    device_id,
    event_type: isReactivation ? "reactivation" : "activation_succeeded",
    outcome: "success",
    license_key_hint: keyHint,
    metadata: { is_reactivation: isReactivation },
  });

  return NextResponse.json({ ok: true, entitlement });
}
