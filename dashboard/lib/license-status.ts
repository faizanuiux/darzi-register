import "server-only";

/** Effective license state derived from the row's flags. */
export type LicenseStatus = "active" | "disabled" | "expired" | "pending";

/** Minimal row shape needed to compute the status. */
export interface LicenseStatusRow {
  used: boolean | null;
  enabled: boolean | null;
  expires_at: string | null;
}

/**
 * Compute a license's effective status.
 * Precedence: expired > disabled > pending > active.
 * - expired: expires_at is set and is in the past (takes precedence over
 *   everything, even a disabled flag).
 * - disabled: enabled flag is false (or null).
 * - pending: enabled but never activated (used is false/null).
 * - active: enabled and activated.
 */
export function getLicenseStatus(row: LicenseStatusRow): LicenseStatus {
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return "expired";
  }
  if (!row.enabled) {
    return "disabled";
  }
  if (!row.used) {
    return "pending";
  }
  return "active";
}
