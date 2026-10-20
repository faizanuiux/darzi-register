import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/health
 * Liveness probe: verifies the service client can reach Supabase.
 */
export async function GET() {
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("health: createServiceClient failed:", (err as Error).message);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }

  const probe = await supabase
    .from("devices")
    .select("id", { count: "exact", head: true })
    .limit(1);
  if (probe.error) {
    console.error("health: db probe failed:", probe.error.message);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    db: "up",
    time: new Date().toISOString(),
  });
}
