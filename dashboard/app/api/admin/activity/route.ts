import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleAdmin, badRequest } from "../_lib/auth";
import { adminDb } from "../_lib/db";
import {
  paginationSchema,
  pageMeta,
  sanitizeLike,
} from "../_lib/pagination";
import type { ActivationEventRow } from "../_lib/types";

const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "must be a valid ISO-8601 date",
  });

const querySchema = paginationSchema.extend({
  event_type: z.string().trim().max(100).optional(),
  outcome: z.string().trim().max(100).optional(),
  device_id: z.string().trim().max(200).optional(),
  date_from: isoDate.optional(),
  date_to: isoDate.optional(),
});

/**
 * GET /api/admin/activity
 * activation_events log, newest first, with filters. Paginated.
 */
export async function GET(req: NextRequest) {
  return handleAdmin(async () => {
    const db = adminDb();
    const parsed = querySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) return badRequest("Invalid query parameters", parsed.error.flatten());
    const { event_type, outcome, device_id, date_from, date_to, page, per_page } =
      parsed.data;

    let query = db.from("activation_events").select("*", { count: "exact" });
    if (event_type) query = query.eq("event_type", event_type);
    if (outcome) query = query.eq("outcome", outcome);
    if (device_id) query = query.ilike("device_id", `%${sanitizeLike(device_id)}%`);
    if (date_from) query = query.gte("created_at", new Date(date_from).toISOString());
    if (date_to) query = query.lte("created_at", new Date(date_to).toISOString());

    const from = (page - 1) * per_page;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + per_page - 1);
    if (error) throw error;

    return NextResponse.json({
      data: (data ?? []) as ActivationEventRow[],
      ...pageMeta(count ?? 0, page, per_page),
    });
  });
}
