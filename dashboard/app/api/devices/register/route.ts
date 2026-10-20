import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";
import { getClientIp, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const registerSchema = z.object({
  device_id: z.string().min(1).max(128),
  manufacturer: z.string().max(128).optional(),
  model: z.string().max(128).optional(),
  android_version: z.string().max(64).optional(),
  app_version: z.string().max(64).optional(),
});

interface EventInsert {
  device_id: string;
  event_type: string;
  outcome: string;
  license_key_hint?: string | null;
  actor_type?: string;
  metadata?: Record<string, unknown>;
}

async function logEvent(supabase: ReturnType<typeof createServiceClient>, e: EventInsert) {
  const { error } = await supabase.from("activation_events").insert({
    device_id: e.device_id,
    event_type: e.event_type,
    outcome: e.outcome,
    license_key_hint: e.license_key_hint ?? null,
    actor_type: e.actor_type ?? "app",
    metadata: e.metadata ?? {},
  });
  if (error) {
    // Never fail the request because the audit log write failed.
    console.error("activation_events insert failed:", error.message);
  }
}

/**
 * POST /api/devices/register
 * Idempotent device registration/upsert. Public route (called by the app).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(`devices-register:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return rateLimitedResponse(rl.resetMs);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const input = parsed.data;

  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("createServiceClient failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  const now = new Date().toISOString();

  const existing = await supabase
    .from("devices")
    .select("id")
    .eq("device_id", input.device_id)
    .maybeSingle();
  if (existing.error) {
    console.error("devices lookup failed:", existing.error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
  const isNew = !existing.data;

  // On conflict: touch last_seen_at and refresh provided fields; never
  // overwrite registered_at, and never null out fields not sent this time.
  const upsertPayload: Record<string, unknown> = {
    device_id: input.device_id,
    last_seen_at: now,
    updated_at: now,
  };
  for (const field of ["manufacturer", "model", "android_version", "app_version"] as const) {
    if (input[field] !== undefined) upsertPayload[field] = input[field];
  }

  const upserted = await supabase
    .from("devices")
    .upsert(upsertPayload, { onConflict: "device_id" })
    .select(
      "id, device_id, customer_name, manufacturer, model, android_version, app_version, registered_at, last_seen_at",
    )
    .single();
  if (upserted.error || !upserted.data) {
    console.error("devices upsert failed:", upserted.error?.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  const licenseCheck = await supabase
    .from("licenses")
    .select("key", { count: "exact", head: true })
    .eq("device_id", input.device_id);
  if (licenseCheck.error) {
    console.error("license lookup failed:", licenseCheck.error.message);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }

  await logEvent(supabase, {
    device_id: input.device_id,
    event_type: "device_registered",
    outcome: "success",
    metadata: { is_new: isNew, ...(input.app_version ? { app_version: input.app_version } : {}) },
  });

  return NextResponse.json({
    device: {
      id: upserted.data.id,
      device_id: upserted.data.device_id,
      customer_name: upserted.data.customer_name,
      manufacturer: upserted.data.manufacturer,
      model: upserted.data.model,
      android_version: upserted.data.android_version,
      app_version: upserted.data.app_version,
      registered_at: upserted.data.registered_at,
      last_seen_at: upserted.data.last_seen_at,
    },
    is_new: isNew,
    has_license: (licenseCheck.count ?? 0) > 0,
  });
}
