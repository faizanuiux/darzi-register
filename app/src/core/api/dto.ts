/**
 * DTOs for the Supabase `licenses` table.
 *
 * Table shape (already exists — do not create it):
 *   licenses: key TEXT PRIMARY KEY, customer_name TEXT, used BOOLEAN,
 *             device_id TEXT, created_at TIMESTAMPTZ, activated_at TIMESTAMPTZ,
 *             expires_at TIMESTAMPTZ NULL (null = lifetime), enabled BOOLEAN,
 *             key_hint TEXT
 *
 * The app only ever reads the `key` / `used` / `device_id` / `activated_at` /
 * `expires_at` / `enabled` columns and writes `used`, `device_id`,
 * `activated_at`. Customer data (customer_name) is created in the admin
 * dashboard — the app never sends it to Supabase.
 */

/** One row of the `licenses` table, as returned by PostgREST. */
export interface LicenseRow {
  key: string;
  customer_name: string | null;
  used: boolean;
  device_id: string | null;
  created_at: string;
  activated_at: string | null;
  /** ISO 8601 expiry, or null for a lifetime key. */
  expires_at: string | null;
  /** Admin kill-switch: false locks the device out of the app. */
  enabled: boolean;
  key_hint: string | null;
}

/** Body sent when activating a license key. */
export interface ActivateRequest {
  used: true;
  device_id: string;
  activated_at: string; // ISO 8601
}

/** Response of the activate PATCH with `Prefer: return=representation`. */
export interface ActivateResponse {
  key: string;
  used: boolean;
  device_id: string | null;
  activated_at: string | null;
}

/** Logical activation operations exposed by the Supabase REST surface. */
export type LicenseOperation = 'activate' | 'validate' | 'status';

/** Result of a backend validation check against the stored activation. */
export type LicenseValidationResult =
  | 'valid'
  | 'invalid'
  | 'disabled'
  | 'expired'
  | 'offline';
