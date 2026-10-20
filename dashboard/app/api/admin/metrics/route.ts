import { NextResponse } from "next/server";
import { handleAdmin } from "../_lib/auth";
import { adminDb } from "../_lib/db";
import { escapePostgrest } from "../_lib/pagination";

/**
 * GET /api/admin/metrics
 * Dashboard headline numbers, all from real COUNT queries.
 */
export async function GET() {
  return handleAdmin(async () => {
    const db = adminDb();
    const nowIso = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [
      devicesRes,
      licensesRes,
      disabledRes,
      expiredRes,
      activeRes,
      unusedRes,
      activationsRes,
      licDeviceIdsRes,
    ] = await Promise.all([
      db.from("devices").select("id", { count: "exact", head: true }),
      db.from("licenses").select("key", { count: "exact", head: true }),
      // Status precedence mirrors lib/license-status.ts getLicenseStatus():
      // expired > disabled > pending > active.
      db.from("licenses").select("key", { count: "exact", head: true }).eq("enabled", false).or(`expires_at.is.null,expires_at.gt.${nowIso}`),
      db
        .from("licenses")
        .select("key", { count: "exact", head: true })
        .lte("expires_at", nowIso),
      db
        .from("licenses")
        .select("key", { count: "exact", head: true })
        .eq("enabled", true)
        .eq("used", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
      db.from("licenses").select("key", { count: "exact", head: true }).eq("used", false),
      db
        .from("activation_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "activation_succeeded")
        .gt("created_at", sevenDaysAgo),
      db.from("licenses").select("device_id").not("device_id", "is", null),
    ]);

    for (const r of [
      devicesRes,
      licensesRes,
      disabledRes,
      expiredRes,
      activeRes,
      unusedRes,
      activationsRes,
      licDeviceIdsRes,
    ]) {
      if (r.error) throw r.error;
    }

    // pending_devices = devices whose device_id has no license row.
    const licensedIds = ((licDeviceIdsRes.data ?? []) as { device_id: string }[]).map(
      (r) => r.device_id,
    );
    let pendingQuery = db.from("devices").select("id", { count: "exact", head: true });
    if (licensedIds.length > 0) {
      pendingQuery = pendingQuery.not(
        "device_id",
        "in",
        `(${licensedIds.map(escapePostgrest).join(",")})`,
      );
    }
    const pendingRes = await pendingQuery;
    if (pendingRes.error) throw pendingRes.error;

    return NextResponse.json({
      total_devices: devicesRes.count ?? 0,
      keys_generated: licensesRes.count ?? 0,
      active_licenses: activeRes.count ?? 0,
      disabled_licenses: disabledRes.count ?? 0,
      expired_licenses: expiredRes.count ?? 0,
      unused_keys: unusedRes.count ?? 0,
      pending_devices: pendingRes.count ?? 0,
      activations_last_7d: activationsRes.count ?? 0,
    });
  });
}
