import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export interface LicenseEventInput {
  deviceId?: string | null;
  /** Masked hint ONLY — never a plaintext key in this table. */
  licenseKeyHint?: string | null;
  eventType: string;
  outcome: string;
  metadata?: Record<string, unknown>;
  actorType?: "system" | "app" | "admin";
  actorId?: string | null;
}

/** Append an activation_events row. Throws on failure. */
export async function logLicenseEvent(
  db: SupabaseClient,
  input: LicenseEventInput,
): Promise<void> {
  const metadata = input.metadata
    ? (JSON.parse(JSON.stringify(input.metadata)) as Record<string, unknown>)
    : {};
  const { error } = await db.from("activation_events").insert({
    device_id: input.deviceId ?? null,
    license_key_hint: input.licenseKeyHint ?? null,
    event_type: input.eventType,
    outcome: input.outcome,
    metadata,
    actor_type: input.actorType ?? "system",
    actor_id: input.actorId ?? null,
  });
  if (error) throw error;
}
