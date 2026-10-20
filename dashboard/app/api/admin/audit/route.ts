import { NextRequest, NextResponse } from "next/server";
import { handleAdmin, badRequest } from "../_lib/auth";
import { adminDb } from "../_lib/db";
import { paginationSchema, pageMeta } from "../_lib/pagination";
import type { AdminAuditRow } from "../_lib/types";

/**
 * GET /api/admin/audit
 * admin_audit_logs, newest first. Paginated.
 */
export async function GET(req: NextRequest) {
  return handleAdmin(async () => {
    const db = adminDb();
    const parsed = paginationSchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) return badRequest("Invalid query parameters", parsed.error.flatten());
    const { page, per_page } = parsed.data;

    const from = (page - 1) * per_page;
    const { data, error, count } = await db
      .from("admin_audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + per_page - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []) as AdminAuditRow[],
      ...pageMeta(count ?? 0, page, per_page),
    });
  });
}
