import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { hashKey, maskKey, normalizeKey, isValidKeyFormat } from "@/lib/license-keys";

export const runtime = "nodejs";

const validateSchema = z.object({
  key: z.string().min(1).max(64),
  device_id: z.string().min(1).max(128),
});

/**
 * POST /api/licenses/validate
 * Checks whether a key is currently valid for a device. The ONLY mutation is
 * last_validated_at=now() on a found key. Public route (called by the app).
 *
 * Plaintext keys are NEVER logged or written anywhere — only masked hints.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`licenses-validate:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const { device_id } = parsed.data;

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("createServiceClient failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  const normalized = normalizeKey(parsed.data.key);
  if (!isValidKeyFormat(normalized)) {
    return NextResponse.json(
      { status: "invalid", expires_at: null },
      { status: 200 },
    );
  }

  const row = await supabase
    .from("licenses")
    .select("key, used, enabled, expires_at, device_id")
    .eq("key_hash", hashKey(normalized))
    .maybeSingle();
  if (row.error) {
    console.error(`validate db error for key ${maskKey(normalized)}:`, row.error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  if (!row.data) {
    return NextResponse.json({ status: "invalid", expires_at: null }, { status: 200 });
  }

  const license = row.data;
  const expires_at: string | null = license.expires_at;

  // Only mutation allowed on this endpoint: refresh last_validated_at.
  // Fire-and-forget-ish: a failure here must not fail the validation itself.
  const touch = await supabase
    .from("licenses")
    .update({ last_validated_at: new Date().toISOString() })
    .eq("key", license.key);
  if (touch.error) {
    console.error(`last_validated_at update failed for key ${maskKey(normalized)}:`, touch.error.message);
  }

  if (expires_at && new Date(expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ status: "expired", expires_at }, { status: 200 });
  }
  if (!license.enabled) {
    return NextResponse.json({ status: "disabled", expires_at }, { status: 200 });
  }
  // A key bound to a DIFFERENT device is not valid for this device.
  if (license.used && license.device_id && license.device_id !== device_id) {
    return NextResponse.json({ status: "invalid", expires_at }, { status: 200 });
  }
  return NextResponse.json({ status: "valid", expires_at }, { status: 200 });
}
