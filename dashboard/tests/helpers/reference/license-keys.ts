/**
 * REFERENCE IMPLEMENTATION of the documented `lib/license-keys` contract.
 *
 * The sibling-owned `lib/license-keys.ts` was not on disk when this suite was
 * written, so the unit tests exercise this spec-compliant reference instead.
 * Contract source: task spec + `supabase/migrations/20261019_extend_licenses.sql`
 * (key format, maskKey shape `DRZ-••••-<last4>`, key_hash = SHA-256 of the
 * UPPERCASED key).
 *
 * TO SWAP IN THE REAL MODULE: in `tests/unit/license-keys.test.ts` change the
 * import to `from "../../lib/license-keys"`. No test logic needs to change.
 */
import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "DRZ";
export const KEY_PATTERN = /^DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Unambiguous alphabet — excludes 0/O, 1/I and L. */
export const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  }
  return out;
}

/** Generates a key like `DRZ-AB3D-9KQZ`. */
export function generateLicenseKey(): string {
  return `${KEY_PREFIX}-${randomSegment(4)}-${randomSegment(4)}`;
}

/** Trims surrounding whitespace and uppercases. */
export function normalizeKey(key: string): string {
  return key.trim().toUpperCase();
}

/** True when the (normalized) value matches `DRZ-XXXX-XXXX`. Non-strings are invalid. */
export function isValidKeyFormat(key: unknown): key is string {
  if (typeof key !== "string") return false;
  return KEY_PATTERN.test(normalizeKey(key));
}

/**
 * Deterministic SHA-256 hex digest (64 chars) of the normalized key.
 * Matches the DB backfill: `encode(digest(upper(key), 'sha256'), 'hex')`.
 */
export function hashKey(key: string): string {
  return createHash("sha256").update(normalizeKey(key), "utf8").digest("hex");
}

/** Masked display form, e.g. `DRZ-••••-EFGH` (only the last 4 chars shown). */
export function maskKey(key: string): string {
  return `${KEY_PREFIX}-••••-${normalizeKey(key).slice(-4)}`;
}
