import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed entitlement tokens issued by the activate route. The mobile app can
 * cache this to gate features offline; the server re-verifies on validate.
 *
 * sig = HMAC-SHA256 hex of `${device_id}.${key_hint}.${expires_at}.${issued_at}`
 * keyed by ENTITLEMENT_SECRET. Only masked hints are embedded — never the
 * plaintext license key.
 */

export interface Entitlement {
  device_id: string;
  key_hint: string;
  expires_at: string | null;
  issued_at: string;
  sig: string;
}

export interface EntitlementInput {
  device_id: string;
  key_hint: string;
  expires_at: string | null;
}

function getSecret(): string {
  const secret = process.env.ENTITLEMENT_SECRET;
  if (!secret) {
    throw new Error(
      "ENTITLEMENT_SECRET is not set. signEntitlement()/verifyEntitlement() require it.",
    );
  }
  return secret;
}

function canonicalPayload(input: EntitlementInput, issuedAt: string): string {
  return `${input.device_id}.${input.key_hint}.${input.expires_at ?? ""}.${issuedAt}`;
}

/** Sign a fresh entitlement for an activated device. */
export function signEntitlement(input: EntitlementInput): Entitlement {
  const issued_at = new Date().toISOString();
  const sig = createHmac("sha256", getSecret())
    .update(canonicalPayload(input, issued_at))
    .digest("hex");
  return { ...input, issued_at, sig };
}

/**
 * Verify an entitlement's signature. Returns false (never throws) for
 * malformed input, a missing/rotated secret, or a bad signature.
 */
export function verifyEntitlement(entitlement: Entitlement): boolean {
  try {
    if (
      !entitlement ||
      typeof entitlement.device_id !== "string" ||
      typeof entitlement.key_hint !== "string" ||
      typeof entitlement.issued_at !== "string" ||
      typeof entitlement.sig !== "string" ||
      (entitlement.expires_at !== null && typeof entitlement.expires_at !== "string")
    ) {
      return false;
    }
    const expected = createHmac("sha256", getSecret())
      .update(canonicalPayload(entitlement, entitlement.issued_at))
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(entitlement.sig, "hex");
    return (
      expectedBuf.length === actualBuf.length &&
      timingSafeEqual(expectedBuf, actualBuf)
    );
  } catch {
    return false;
  }
}
