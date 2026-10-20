import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license-status";

export const runtime = "nodejs";

/**
 * GET /api/licenses/status?device_id=
 * Returns the effective license status for a device. Never returns the
 * plaintext key — only the masked key_hint. Public route (called by the app).
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`licenses-status:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  const deviceId = new URL(req.url).searchParams.get("device_id")?.trim() ?? "";
  if (!deviceId || deviceId.length > 128) {
    return NextResponse.json({ ok: false, error: "invalid_device_id" }, { status: 400 });
  }

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("createServiceClient failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  const row = await supabase
    .from("licenses")
    .select("key_hint, used, enabled, expires_at")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (row.error) {
    console.error("license status lookup failed:", row.error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  if (!row.data) {
    return NextResponse.json({
      device_id: deviceId,
      has_license: false,
      status: "none",
      expires_at: null,
      key_hint: null,
    });
  }

  const status: LicenseStatus = getLicenseStatus(row.data);

  return NextResponse.json({
    device_id: deviceId,
    has_license: true,
    status,
    expires_at: row.data.expires_at,
    key_hint: row.data.key_hint,
  });
}
