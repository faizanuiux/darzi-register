/**
 * REFERENCE IMPLEMENTATION of the documented `lib/entitlement` contract.
 *
 * The sibling-owned `lib/entitlement.ts` was not on disk when this suite was
 * written, so the unit tests exercise this spec-compliant reference instead.
 *
 * Token shape: `<base64url(JSON payload)>.<hex HMAC-SHA256 of the payload part>`
 * using `process.env.ENTITLEMENT_SECRET`. Both `signEntitlement` and
 * `verifyEntitlement` throw when the secret is missing; `verifyEntitlement`
 * returns `false` (never throws) for tampered or malformed tokens.
 *
 * TO SWAP IN THE REAL MODULE: in `tests/unit/entitlement.test.ts` change the
 * import to `from "../../lib/entitlement"`. No test logic needs to change.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.ENTITLEMENT_SECRET;
  if (!secret) {
    throw new Error(
      "ENTITLEMENT_SECRET is not set. signEntitlement/verifyEntitlement require it.",
    );
  }
  return secret;
}

/** Signs a JSON-serializable payload, returning the entitlement token. */
export function signEntitlement(payload: unknown): string {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${signature}`;
}

/**
 * Verifies a token: true only when the signature matches the payload part
 * under the current secret. False for tampered/malformed tokens.
 */
export function verifyEntitlement(token: string): boolean {
  const secret = getSecret();
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  if (!body || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
}
