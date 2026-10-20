import "server-only";

/** Raw DB row shapes (supabase-js is untyped here; we cast to these). */

export interface LicenseRow {
  key: string;
  customer_name: string | null;
  used: boolean | null;
  device_id: string | null;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
  enabled: boolean | null;
  disabled_at: string | null;
  disabled_by: string | null;
  issued_by: string | null;
  admin_note: string | null;
  last_validated_at: string | null;
  key_hint: string | null;
  key_hash: string | null;
}

export interface DeviceRow {
  id: string;
  device_id: string;
  customer_name: string | null;
  manufacturer: string | null;
  model: string | null;
  android_version: string | null;
  app_version: string | null;
  registered_at: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivationEventRow {
  id: string;
  device_id: string | null;
  license_key_hint: string | null;
  event_type: string;
  outcome: string;
  metadata: Record<string, unknown>;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
}

export interface AdminAuditRow {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
