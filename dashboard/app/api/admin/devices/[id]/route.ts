import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../../_lib/auth";
import { adminDb } from "../../_lib/db";
import { logAdminAction } from "../../_lib/audit";
import { getLicenseStatus } from "@/lib/license-status";
import type { ActivationEventRow, DeviceRow, LicenseRow } from "../../_lib/types";

const patchSchema = z
  .object({
    customer_name: z.string().trim().max(200).nullable(),
  })
  .strict();

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/admin/devices/[id]
 * Device + its license (plaintext key included — admin-gated) + recent events.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  return handleAdmin(async () => {
    const db = adminDb();

    const { data: device, error: devErr } = await db
      .from("devices")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (devErr) throw devErr;
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    const d = device as DeviceRow;

    const { data: licRow, error: licErr } = await db
      .from("licenses")
      .select("*")
      .eq("device_id", d.device_id)
      .maybeSingle();
    if (licErr) throw licErr;
    const lic = (licRow ?? null) as LicenseRow | null;

    const { data: events, error: evErr } = await db
      .from("activation_events")
      .select("*")
      .eq("device_id", d.device_id)
      .order("created_at", { ascending: false })
      .limit(25);
    if (evErr) throw evErr;

    return NextResponse.json({
      device: d,
      license: lic
        ? { ...lic, status: getLicenseStatus(lic) }
        : null,
      recent_events: (events ?? []) as ActivationEventRow[],
    });
  });
}

/**
 * PATCH /api/admin/devices/[id]
 * Body: { customer_name } ONLY. device_id edits are rejected with 400.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return handleAdmin(async (admin) => {
    const db = adminDb();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    if (body && typeof body === "object" && "device_id" in body) {
      return badRequest("device_id cannot be edited");
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid body", parsed.error.flatten());
    }

    const { data: existing, error: getErr } = await db
      .from("devices")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!existing) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    const old = existing as DeviceRow;

    const { data: updated, error: upErr } = await db
      .from("devices")
      .update({
        customer_name: parsed.data.customer_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*")
      .single();
    if (upErr) throw upErr;

    await logAdminAction(db, {
      adminId: admin.id,
      action: "device.update",
      targetType: "device",
      targetId: old.id,
      details: {
        device_id: old.device_id,
        customer_name: { from: old.customer_name, to: parsed.data.customer_name },
      },
    });

    return NextResponse.json({ device: updated as DeviceRow });
  });
}
