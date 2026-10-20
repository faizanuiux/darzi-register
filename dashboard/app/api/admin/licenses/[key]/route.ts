import { NextRequest, NextResponse } from "next/server";
import { handleAdmin } from "../../_lib/auth";
import { adminDb } from "../../_lib/db";
import { getLicenseStatus } from "@/lib/license-status";
import { getLicenseByKey } from "../../_lib/licenses";
import type {
  ActivationEventRow,
  DeviceRow,
  LicenseRow,
} from "../../_lib/types";

/**
 * GET /api/admin/licenses/[key]
 * Full license detail WITH the plaintext `key` — admin-gated.
 * Includes the bound device (if any) and the key's activation history.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { key: string } },
) {
  return handleAdmin(async () => {
    const db = adminDb();
    const license: LicenseRow | null = await getLicenseByKey(db, params.key);
    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    let device: DeviceRow | null = null;
    if (license.device_id) {
      const { data: devRow, error: devErr } = await db
        .from("devices")
        .select("*")
        .eq("device_id", license.device_id)
        .maybeSingle();
      if (devErr) throw devErr;
      device = (devRow ?? null) as DeviceRow | null;
    }

    const { data: events, error: evErr } = await db
      .from("activation_events")
      .select("*")
      .eq("license_key_hint", license.key_hint ?? "")
      .order("created_at", { ascending: false })
      .limit(50);
    if (evErr) throw evErr;

    return NextResponse.json({
      license: { ...license, status: getLicenseStatus(license) },
      device,
      activation_history: (events ?? []) as ActivationEventRow[],
    });
  });
}
