import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

/** Service-role client for ALL admin DB access (bypasses RLS, server-only). */
export function adminDb(): SupabaseClient {
  return createServiceClient();
}
