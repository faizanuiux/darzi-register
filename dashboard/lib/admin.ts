import "server-only";

import { createServerSupabaseClient } from "./supabase/server";

/**
 * Admin authorization model: a Supabase Auth user is an admin iff their
 * `app_metadata` contains `{"is_admin": true}`. That flag is set by the owner
 * via the Supabase dashboard / SQL — never in app code.
 */

export interface AdminUser {
  id: string;
  email?: string;
}

function hasAdminFlag(appMetadata: unknown): boolean {
  if (typeof appMetadata !== "object" || appMetadata === null) return false;
  return (appMetadata as Record<string, unknown>).is_admin === true;
}

/**
 * Returns `{ id, email }` if the current session belongs to an admin,
 * otherwise `null`. Uses `getUser()` (server-validated) — never trusts
 * the cookie alone.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !hasAdminFlag(user.app_metadata)) {
    return null;
  }

  return { id: user.id, email: user.email ?? undefined };
}

/**
 * Error thrown by `requireAdmin()`. Carries an HTTP status so API routes can
 * do: `catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); }`
 */
export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

/**
 * Returns the admin user or throws:
 *  - 401 when there is no authenticated session
 *  - 403 when the session user is not an admin
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new AdminAuthError("Unauthorized", 401);
  }
  if (!hasAdminFlag(user.app_metadata)) {
    throw new AdminAuthError("Forbidden", 403);
  }

  return { id: user.id, email: user.email ?? undefined };
}
