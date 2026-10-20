import "server-only";

import { NextResponse } from "next/server";
import {
  requireAdmin,
  AdminAuthError,
  type AdminUser,
} from "@/lib/admin";

/**
 * Wrap an admin route handler: calls `requireAdmin()` FIRST, then the
 * handler. Returns `{ error }` JSON with 401/403 on AdminAuthError,
 * 500 JSON on anything else.
 */
export async function handleAdmin(
  handler: (admin: AdminUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    const admin = await requireAdmin();
    return await handler(admin);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin-api] unhandled error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** 400 JSON for Zod validation failures. */
export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    details === undefined ? { error: message } : { error: message, details },
    { status: 400 },
  );
}
