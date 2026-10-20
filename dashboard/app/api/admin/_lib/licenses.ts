import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeKey } from "@/lib/license-keys";
import type { LicenseRow } from "./types";

/** Fetch a license row by its (possibly un-normalized) key; null if missing. */
export async function getLicenseByKey(
  db: SupabaseClient,
  rawKey: string,
): Promise<LicenseRow | null> {
  const { data, error } = await db
    .from("licenses")
    .select("*")
    .eq("key", normalizeKey(rawKey))
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LicenseRow | null;
}

/** Best-effort compensation: restore a license row to its previous values. */
export async function restoreLicense(
  db: SupabaseClient,
  before: LicenseRow,
): Promise<void> {
  await db
    .from("licenses")
    .update({
      enabled: before.enabled,
      disabled_at: before.disabled_at,
      disabled_by: before.disabled_by,
      expires_at: before.expires_at,
    })
    .eq("key", before.key);
}
