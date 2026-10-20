import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditInput {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  /** Sanitized details — key_hint only, NEVER a plaintext license key. */
  details?: Record<string, unknown>;
}

/**
 * Append an admin audit row. Throws on failure so callers can compensate
 * and return 500 instead of silently skipping the audit trail.
 */
export async function logAdminAction(
  db: SupabaseClient,
  input: AuditInput,
): Promise<void> {
  // Strip undefined values: JSONB insert chokes on them.
  const details = input.details
    ? (JSON.parse(JSON.stringify(input.details)) as Record<string, unknown>)
    : {};
  const { error } = await db.from("admin_audit_logs").insert({
    admin_id: input.adminId,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    details,
  });
  if (error) throw error;
}
