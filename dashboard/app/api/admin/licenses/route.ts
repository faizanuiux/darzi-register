import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../_lib/auth";
import { adminDb } from "../_lib/db";
import {
  paginationSchema,
  pageMeta,
  sanitizeLike,
} from "../_lib/pagination";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license-status";
import type { LicenseRow } from "../_lib/types";

const querySchema = paginationSchema.extend({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(["all", "active", "disabled", "expired", "pending"]).default("all"),
  sort: z.enum(["created_at", "expires_at", "customer_name", "status"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// The plaintext `key` IS included: this endpoint is admin-gated
// (requireAdmin) and the row actions (disable/enable/expiry/cancel/detail)
// address licenses by their key. key_hint alone is not unique enough to
// identify a row, so the UI cannot use it as the action identifier.
const LIST_COLUMNS =
  "key, key_hint, customer_name, device_id, used, enabled, created_at, activated_at, expires_at, disabled_at, issued_by, admin_note";

const STATUS_RANK: Record<LicenseStatus, number> = {
  active: 0,
  pending: 1,
  expired: 2,
  disabled: 3,
};

/**
 * GET /api/admin/licenses
 * Paginated license list. Rows carry key_hint only — never the plaintext key.
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

    let query = db.from("licenses").select(LIST_COLUMNS, { count: "exact" });
    if (q) {
      const like = `%${sanitizeLike(q)}%`;
      query = query.or(
        `key_hint.ilike.${like},customer_name.ilike.${like},device_id.ilike.${like}`,
      );
    }

    // Status is computed in JS (PostgREST has no CASE in select); the SQL
    // fast path is only valid when no status filter/sort is requested.
    if (filter === "all" && sort !== "status") {
      const from = (page - 1) * per_page;
      const { data, error, count } = await query
        .order(sort, { ascending: asc })
        .range(from, from + per_page - 1);
      if (error) throw error;
      const rows = ((data ?? []) as LicenseRow[]).map((r) => ({
        ...r,
        status: getLicenseStatus(r),
      }));
      return NextResponse.json({
        data: rows,
        ...pageMeta(count ?? 0, page, per_page),
      });
    }

    const { data, error } = await query;
    if (error) throw error;
    let rows = ((data ?? []) as LicenseRow[]).map((r) => ({
      ...r,
      status: getLicenseStatus(r),
    }));
    if (filter !== "all") {
      rows = rows.filter((r) => r.status === filter);
    }
    rows.sort((a, b) => {
      let cmp: number;
      if (sort === "status") {
        cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      } else if (sort === "expires_at") {
        const ea = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY;
        const eb = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY;
        cmp = ea - eb;
      } else if (sort === "customer_name") {
        cmp = (a.customer_name ?? "").localeCompare(b.customer_name ?? "");
      } else {
        cmp =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return asc ? cmp : -cmp;
    });

    const total = rows.length;
    const pageRows = rows.slice((page - 1) * per_page, page * per_page);
    return NextResponse.json({
      data: pageRows,
      ...pageMeta(total, page, per_page),
    });
  });
}
