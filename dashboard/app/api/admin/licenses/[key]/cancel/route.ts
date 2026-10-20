import { NextRequest, NextResponse } from "next/server";
import { handleAdmin } from "../../../_lib/auth";
import { adminDb } from "../../../_lib/db";
import { logAdminAction } from "../../../_lib/audit";
import { getLicenseByKey } from "../../../_lib/licenses";

/**
 * POST /api/admin/licenses/[key]/cancel
 * Deletes a key ONLY if it was never activated (used=false).
 * A used key is refused with 409 — cancelling it would orphan a live device.
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
    if (license.used) {
      return NextResponse.json(
        { error: "Key has been activated and cannot be cancelled" },
        { status: 409 },
      );
    }

    const { error: delErr } = await db
      .from("licenses")
      .delete()
      .eq("key", license.key);
    if (delErr) throw delErr;

    try {
      await logAdminAction(db, {
        adminId: admin.id,
        action: "license_cancelled",
        targetType: "license",
        targetId: license.key_hint ?? undefined,
        details: {
          key_hint: license.key_hint,
          customer_name: license.customer_name,
          device_id: license.device_id,
          note: "cancelled before activation",
        },
      });
    } catch (auditErr) {
      // Best-effort: put the row back so a cancelled key never vanishes
      // without its audit trail.
      await db.from("licenses").insert({
        key: license.key,
        customer_name: license.customer_name,
        used: license.used,
        device_id: license.device_id,
        created_at: license.created_at,
        activated_at: license.activated_at,
        expires_at: license.expires_at,
        enabled: license.enabled,
        disabled_at: license.disabled_at,
        disabled_by: license.disabled_by,
        issued_by: license.issued_by,
        admin_note: license.admin_note,
        last_validated_at: license.last_validated_at,
        key_hint: license.key_hint,
        key_hash: license.key_hash,
      });
      throw auditErr;
    }

    return NextResponse.json({
      cancelled: true,
      key_hint: license.key_hint,
    });
  });
}
