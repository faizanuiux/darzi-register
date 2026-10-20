/**
 * REFERENCE IMPLEMENTATION of the documented `lib/license-status` contract.
 *
 * The sibling-owned `lib/license-status.ts` was not on disk when this suite was
 * written, so the unit tests exercise this spec-compliant reference instead.
 *
 * Precedence (per spec): expired > disabled > pending > active.
 *  - expired:  `expires_at` is set and <= now (boundary: exactly now → expired)
 *  - disabled: `!enabled`
 *  - pending:  `!used`
 *  - active:   otherwise
 * A null `expires_at` never expires.
 *
 * TO SWAP IN THE REAL MODULE: in `tests/unit/license-status.test.ts` change the
 * import to `from "../../lib/license-status"`. No test logic needs to change.
 */

export type LicenseStatus = "active" | "disabled" | "expired" | "pending";

export interface LicenseStatusRow {
  used: boolean;
  enabled: boolean;
  /** ISO timestamp string, or null when the license never expires. */
  expires_at: string | null;
}

export function getLicenseStatus(row: LicenseStatusRow): LicenseStatus {
  if (row.expires_at !== null && row.expires_at !== undefined) {
    const expiry = new Date(row.expires_at).getTime();
    if (!Number.isNaN(expiry) && expiry <= Date.now()) {
      return "expired";
    }
  }
  if (!row.enabled) return "disabled";
  if (!row.used) return "pending";
  return "active";
}
