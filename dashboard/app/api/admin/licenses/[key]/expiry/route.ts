import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../../../_lib/auth";
import { adminDb } from "../../../_lib/db";
import { logAdminAction } from "../../../_lib/audit";
import { logLicenseEvent } from "../../../_lib/events";
import { getLicenseByKey, restoreLicense } from "../../../_lib/licenses";

const bodySchema = z
  .object({
    expires_at: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), {
        message: "expires_at must be a valid ISO-8601 date",
      })
      .nullable(),
  })
  .strict();

/**
 * PATCH /api/admin/licenses/[key]/expiry
 * Body: { expires_at: ISO string | null } — null = lifetime.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { key: string } },
) {
  return handleAdmin(async (admin) => {
    const db = adminDb();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid body", parsed.error.flatten());
    }
    const newExpiresAt =
      parsed.data.expires_at === null
        ? null
        : new Date(parsed.data.expires_at).toISOString();

    const license = await getLicenseByKey(db, params.key);
    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }
    const oldExpiresAt = license.expires_at;

    const { error: upErr } = await db
      .from("licenses")
      .update({ expires_at: newExpiresAt })
      .eq("key", license.key);
    if (upErr) throw upErr;

    try {
      await logLicenseEvent(db, {
        deviceId: license.device_id,
        licenseKeyHint: license.key_hint,
        eventType: "expiry_changed",
        outcome: "success",
        metadata: { old_expires_at: oldExpiresAt, new_expires_at: newExpiresAt },
        actorType: "admin",
        actorId: admin.id,
      });
      await logAdminAction(db, {
        adminId: admin.id,
        action: "license.expiry_change",
        targetType: "license",
        targetId: license.key_hint ?? undefined,
        details: {
          key_hint: license.key_hint,
          device_id: license.device_id,
          old_expires_at: oldExpiresAt,
          new_expires_at: newExpiresAt,
        },
      });
    } catch (trailErr) {
      await restoreLicense(db, license);
      throw trailErr;
    }

    return NextResponse.json({
      key_hint: license.key_hint,
      expires_at: newExpiresAt,
    });
  });
}
