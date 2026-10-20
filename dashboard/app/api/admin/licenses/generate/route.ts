import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../../_lib/auth";
import { adminDb } from "../../_lib/db";
import { logAdminAction } from "../../_lib/audit";
import { logLicenseEvent } from "../../_lib/events";
import {
  generateLicenseKey,
  hashKey,
  maskKey,
} from "@/lib/license-keys";
import type { LicenseRow } from "../../_lib/types";

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
 * POST /api/admin/licenses/generate
 *
 * Creates a standalone (unbound) license key. The key is NOT tied to any
 * device yet — it binds to the customer's phone the first time it is
 * activated inside the app. This is the sell flow: generate here, share the
 * key with the customer (e.g. over WhatsApp), the customer enters it in the
 * app, and the device appears under that license on first activation.
 *
 * Plaintext key is returned — this response is admin-gated. The key is shown
 * once; only its hash is stored.
 */
export async function POST(req: NextRequest) {
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

    const expires_at = computeExpiresAt(expiry);
    const finalCustomerName = customer_name?.trim() || null;

    // Insert with PK-collision retry (generateLicenseKey is random, but the
    // key column is the PK — retry on the rare collision).
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
          device_id: null, // unbound — binds on first activation in the app
          used: false,
          enabled: true,
          expires_at,
          issued_by: admin.id,
          admin_note: admin_note?.trim() || null,
        })
        .select("*")
        .single();
      if (!error) {
        license = data as LicenseRow;
        break;
      }
      if (error.code !== "23505") throw error;
      // 23505 = key PK collision — try a fresh key
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
        deviceId: null,
        licenseKeyHint: license.key_hint,
        eventType: "key_generated",
        outcome: "success",
        metadata: {
          expires_at,
          customer_name: finalCustomerName,
          expiry_type: expiry.type,
          standalone: true,
        },
        actorType: "admin",
        actorId: admin.id,
      });
      await logAdminAction(db, {
        adminId: admin.id,
        action: "license.generate",
        targetType: "license",
        targetId: license.key_hint ?? undefined,
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
