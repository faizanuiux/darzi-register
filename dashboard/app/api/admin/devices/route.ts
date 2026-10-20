import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../_lib/auth";
import { adminDb } from "../_lib/db";
import {
  paginationSchema,
  pageMeta,
  sanitizeLike,
  escapePostgrest,
} from "../_lib/pagination";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license-status";
import type { DeviceRow, LicenseRow } from "../_lib/types";

const querySchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  filter: z
    .enum(["all", "no-key", "active", "disabled", "expired", "pending"])
    .default("all"),
  sort: z
    .enum(["registered_at", "last_seen_at", "expires_at", "customer_name"])
    .default("registered_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

interface LicenseSummary {
  key_hint: string | null;
  status: LicenseStatus;
  expires_at: string | null;
}

function toDeviceDto(d: DeviceRow, license: LicenseSummary | null) {
  return {
    id: d.id,
    device_id: d.device_id,
    customer_name: d.customer_name,
    manufacturer: d.manufacturer,
    model: d.model,
    android_version: d.android_version,
    app_version: d.app_version,
    registered_at: d.registered_at,
    last_seen_at: d.last_seen_at,
    license,
  };
}

/**
 * GET /api/admin/devices
 * Paginated device list with license summary (key_hint only, never plaintext).
 */
export async function GET(req: NextRequest) {
  return handleAdmin(async () => {
    const db = adminDb();
    const parsed = querySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) return badRequest("Invalid query parameters", parsed.error.flatten());
    const { q, filter, sort, order, page, per_page } = parsed.data;
    const asc = order === "asc";

    // License map: one query (no FK between devices/licenses, so merge in JS).
    const { data: licRows, error: licErr } = await db
      .from("licenses")
      .select("device_id, customer_name, key_hint, enabled, used, expires_at")
      .not("device_id", "is", null);
    if (licErr) throw licErr;

    const licByDevice = new Map<string, LicenseSummary>();
    for (const r of (licRows ?? []) as LicenseRow[]) {
      if (!r.device_id) continue;
      licByDevice.set(r.device_id, {
        key_hint: r.key_hint,
        status: getLicenseStatus(r),
        expires_at: r.expires_at,
      });
    }
    const licensedIds = Array.from(licByDevice.keys());

    let query = db.from("devices").select("*", { count: "exact" });

    if (q) {
      const like = `%${sanitizeLike(q)}%`;
      const ors = [`device_id.ilike.${like}`, `customer_name.ilike.${like}`];
      const ql = q.toLowerCase();
      // device_id / device customer_name are covered by the ilike()s above;
      // this covers key_hint and names stored only on the license row.
      const allMatched = Array.from(
        new Set(
          ((licRows ?? []) as LicenseRow[])
            .filter(
              (r) =>
                r.device_id &&
                ((r.key_hint ?? "").toLowerCase().includes(ql) ||
                  (r.customer_name ?? "").toLowerCase().includes(ql)),
            )
            .map((r) => r.device_id as string),
        ),
      );
      if (allMatched.length > 0) {
        ors.push(`device_id.in.(${allMatched.map(escapePostgrest).join(",")})`);
      }
      query = query.or(ors.join(","));
    }

    if (filter === "no-key") {
      if (licensedIds.length > 0) {
        query = query.not(
          "device_id",
          "in",
          `(${licensedIds.map(escapePostgrest).join(",")})`,
        );
      }
    } else if (filter !== "all") {
      const ids = licensedIds.filter(
        (id) => licByDevice.get(id)?.status === filter,
      );
      if (ids.length === 0) {
        return NextResponse.json({ data: [], ...pageMeta(0, page, per_page) });
      }
      query = query.in("device_id", ids);
    }

    let rows: DeviceRow[];
    let total: number;

    if (sort === "expires_at") {
      // expires_at lives on the license row — sort the merged set in JS.
      const { data, error } = await query;
      if (error) throw error;
      const merged = ((data ?? []) as DeviceRow[]).map((d) => ({
        device: d,
        license: licByDevice.get(d.device_id) ?? null,
      }));
      merged.sort((a, b) => {
        const ea = a.license?.expires_at ? new Date(a.license.expires_at).getTime() : null;
        const eb = b.license?.expires_at ? new Date(b.license.expires_at).getTime() : null;
        // null (lifetime / no key) sorts last in both directions.
        if (ea === null && eb === null) return 0;
        if (ea === null) return 1;
        if (eb === null) return -1;
        return asc ? ea - eb : eb - ea;
      });
      total = merged.length;
      const dtos = merged
        .slice((page - 1) * per_page, page * per_page)
        .map((m) => toDeviceDto(m.device, m.license));
      return NextResponse.json({ data: dtos, ...pageMeta(total, page, per_page) });
    }

    const from = (page - 1) * per_page;
    const { data, error, count } = await query
      .order(sort, { ascending: asc })
      .range(from, from + per_page - 1);
    if (error) throw error;
    rows = (data ?? []) as DeviceRow[];
    total = count ?? 0;

    const out = rows.map((d) =>
      toDeviceDto(d, licByDevice.get(d.device_id) ?? null),
    );
    return NextResponse.json({ data: out, ...pageMeta(total, page, per_page) });
  });
}
