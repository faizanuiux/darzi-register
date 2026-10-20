import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../_lib/auth";
import { adminDb } from "../_lib/db";
import { logAdminAction } from "../_lib/audit";

const SETTING_DEFAULTS = {
  default_license_days: "365",
  business_name: "Darzi Register",
  owner_name: "Faizan",
  timezone: "Asia/Karachi",
} as const;

type SettingKey = keyof typeof SETTING_DEFAULTS;

// Whitelist: only these keys may be read/written through this endpoint.
const putSchema = z
  .object({
    default_license_days: z.coerce.number().int().min(1).max(3650).optional(),
    business_name: z.string().trim().min(1).max(100).optional(),
    owner_name: z.string().trim().min(1).max(100).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "at least one setting must be provided",
  });

interface SettingsResponse {
  default_license_days: number;
  business_name: string;
  owner_name: string;
  timezone: string;
}

async function readSettings(): Promise<SettingsResponse> {
  const db = adminDb();
  const { data, error } = await db.from("app_settings").select("key, value");
  if (error) throw error;
  const map = new Map<string, string>(
    ((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]),
  );
  const get = (k: SettingKey): string => map.get(k) ?? SETTING_DEFAULTS[k];
  const days = Number.parseInt(get("default_license_days"), 10);
  return {
    default_license_days: Number.isFinite(days) && days > 0 ? days : 365,
    business_name: get("business_name"),
    owner_name: get("owner_name"),
    timezone: get("timezone"),
  };
}

/**
 * GET /api/admin/settings
 * Dashboard-configurable app settings.
 */
export async function GET() {
  return handleAdmin(async () => {
    return NextResponse.json(await readSettings());
  });
}

/**
 * PUT /api/admin/settings
 * Upserts whitelisted keys only. Audited.
 */
export async function PUT(req: NextRequest) {
  return handleAdmin(async (admin) => {
    const db = adminDb();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid body", parsed.error.flatten());
    }

    const entries = Object.entries(parsed.data) as [SettingKey, string | number][];
    const now = new Date().toISOString();
    for (const [key, value] of entries) {
      const { error } = await db.from("app_settings").upsert(
        {
          key,
          value: String(value),
          updated_at: now,
          updated_by: admin.id,
        },
        { onConflict: "key" },
      );
      if (error) throw error;
    }

    await logAdminAction(db, {
      adminId: admin.id,
      action: "settings.update",
      targetType: "setting",
      details: {
        keys: entries.map(([k]) => k),
        values: Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
      },
    });

    return NextResponse.json(await readSettings());
  });
}
