import { NextRequest, NextResponse } from "next/server";
import { handleAdmin } from "../../../_lib/auth";
import { adminDb } from "../../../_lib/db";
import { logAdminAction } from "../../../_lib/audit";
import { logLicenseEvent } from "../../../_lib/events";
import { getLicenseByKey, restoreLicense } from "../../../_lib/licenses";

/**
 * POST /api/admin/licenses/[key]/enable
 * Re-enables a key. Refuses with 409 if the key is expired (enabling an
 * expired key would silently grant nothing — the admin must extend it first).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { key: string } },
) {
  return handleAdmin(async (admin) => {
    const db = adminDb();
    const license = await getLicenseByKey(db, params.key);
    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }

    if (
      license.expires_at &&
      new Date(license.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "expired" },
        { status: 409 },
      );
    }

    const { error: upErr } = await db
      .from("licenses")
      .update({ enabled: true, disabled_at: null, disabled_by: null })
      .eq("key", license.key);
    if (upErr) throw upErr;

    try {
      await logLicenseEvent(db, {
        deviceId: license.device_id,
        licenseKeyHint: license.key_hint,
        eventType: "license_enabled",
        outcome: "success",
        metadata: { reason: "admin_action" },
        actorType: "admin",
        actorId: admin.id,
      });
      await logAdminAction(db, {
        adminId: admin.id,
        action: "license.enable",
        targetType: "license",
        targetId: license.key_hint ?? undefined,
        details: {
          key_hint: license.key_hint,
          device_id: license.device_id,
          customer_name: license.customer_name,
        },
      });
    } catch (trailErr) {
      await restoreLicense(db, license);
      throw trailErr;
    }

    return NextResponse.json({ key_hint: license.key_hint, enabled: true });
  });
}
