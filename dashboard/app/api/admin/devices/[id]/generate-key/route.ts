import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../../../_lib/auth";
import { adminDb } from "../../../_lib/db";
import { logAdminAction } from "../../../_lib/audit";
import { logLicenseEvent } from "../../../_lib/events";
import {
  generateLicenseKey,
  hashKey,
  maskKey,
} from "@/lib/license-keys";
import type { DeviceRow, LicenseRow } from "../../../_lib/types";

const expirySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("days"),
    days: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365)]),
  }),
  z.object({
    type: z.literal("custom"),
    date: z
      .string()
      .refine((s) => !Number.isNaN(Date.parse(s)), {
        message: "date must be a valid ISO-8601 date",
      }),
  }),
  z.object({ type: z.literal("lifetime") }),
]);

const bodySchema = z
  .object({
    customer_name: z.string().trim().max(200).optional(),
    admin_note: z.string().trim().max(500).optional(),
    expiry: expirySchema,
  })
  .strict();

function computeExpiresAt(expiry: z.infer<typeof expirySchema>): string | null {
  if (expiry.type === "lifetime") return null;
  if (expiry.type === "days") {
    return new Date(Date.now() + expiry.days * 86_400_000).toISOString();
  }
  return new Date(expiry.date).toISOString();
}

/**
 * POST /api/admin/devices/[id]/generate-key
 * Idempotent: if a license already exists for this device_id, returns 200
 * with the existing key (no duplicate). Otherwise creates one (201).
 * Plaintext key is returned — this response is admin-gated.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
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
    const { customer_name, admin_note, expiry } = parsed.data;

    const { data: deviceRow, error: devErr } = await db
      .from("devices")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (devErr) throw devErr;
    if (!deviceRow) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    const device = deviceRow as DeviceRow;

    // Idempotency: a license row already bound to this device_id wins.
    const { data: existingRow, error: existErr } = await db
      .from("licenses")
      .select("*")
      .eq("device_id", device.device_id)
      .maybeSingle();
    if (existErr) throw existErr;
    if (existingRow) {
      const existing = existingRow as LicenseRow;
      return NextResponse.json({
        created: false,
        key: existing.key,
        key_hint: existing.key_hint,
        expires_at: existing.expires_at,
      });
    }

    const expires_at = computeExpiresAt(expiry);
    const finalCustomerName = customer_name ?? device.customer_name ?? null;

    // Insert with PK-collision retry. The device_id partial-unique index can
    // also race here — if it does, fall back to the idempotent path.
    let license: LicenseRow | null = null;
    for (let attempt = 0; attempt < 5 && !license; attempt++) {
      const key = generateLicenseKey();
      const { data, error } = await db
        .from("licenses")
        .insert({
          key,
          key_hash: hashKey(key),
          key_hint: maskKey(key),
          customer_name: finalCustomerName,
          device_id: device.device_id,
          expires_at,
          enabled: true,
          issued_by: admin.id,
          admin_note: admin_note ?? null,
        })
        .select("*")
        .single();
      if (!error) {
        license = data as LicenseRow;
        break;
      }
      if (error.code === "23505") {
        if (error.message.includes("licenses_device_id_unique")) {
          const { data: raced, error: racedErr } = await db
            .from("licenses")
            .select("*")
            .eq("device_id", device.device_id)
            .maybeSingle();
          if (racedErr) throw racedErr;
          if (raced) {
            const r = raced as LicenseRow;
            return NextResponse.json({
              created: false,
              key: r.key,
              key_hint: r.key_hint,
              expires_at: r.expires_at,
            });
          }
        }
        continue; // key PK collision — try a fresh key
      }
      throw error;
    }
    if (!license) {
      return NextResponse.json(
        { error: "Could not generate a unique key, please retry" },
        { status: 500 },
      );
    }

    // Events + audit. If either fails, delete the license row so we never
    // leave a half-provisioned key without its trail.
    try {
      await logLicenseEvent(db, {
        deviceId: device.device_id,
        licenseKeyHint: license.key_hint,
        eventType: "key_generated",
        outcome: "success",
        metadata: {
          expires_at,
          customer_name: finalCustomerName,
          expiry_type: expiry.type,
        },
        actorType: "admin",
        actorId: admin.id,
      });
      await logAdminAction(db, {
        adminId: admin.id,
        action: "license.generate",
        targetType: "license",
        targetId: license.key_hint ?? undefined,
        details: {
          key_hint: license.key_hint,
          device_id: device.device_id,
          customer_name: finalCustomerName,
          expires_at,
        },
      });
    } catch (trailErr) {
      await db.from("licenses").delete().eq("key", license.key);
      throw trailErr;
    }

    return NextResponse.json(
      {
        created: true,
        key: license.key,
        key_hint: license.key_hint,
        expires_at: license.expires_at,
      },
      { status: 201 },
    );
  });
}
