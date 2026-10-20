/**
 * Unit tests for the REAL `lib/entitlement` (structured HMAC entitlement).
 *
 * The entitlement is a signed object
 * `{device_id, key_hint, expires_at, issued_at, sig}` — the HMAC covers the
 * canonical payload `device_id.key_hint.expires_at.issued_at`.
 */
import { describe, test, expect, beforeEach } from "vitest";
import { signEntitlement, verifyEntitlement } from "../../lib/entitlement";

const GOOD_SECRET = "test-entitlement-secret-please-rotate";

beforeEach(() => {
  process.env.ENTITLEMENT_SECRET = GOOD_SECRET;
});

function signedInput() {
  return { device_id: "dev-1", key_hint: "DRZ-••••-EFGH", expires_at: null as string | null };
}

describe("entitlement sign/verify", () => {
  test("sign → verify roundtrip returns true", () => {
    const token = signEntitlement(signedInput());
    expect(token.device_id).toBe("dev-1");
    expect(token.key_hint).toBe("DRZ-••••-EFGH");
    expect(typeof token.issued_at).toBe("string");
    expect(typeof token.sig).toBe("string");
    expect(verifyEntitlement(token)).toBe(true);
  });

  test("works with a non-null expires_at", () => {
    const token = signEntitlement({
      device_id: "dev-2",
      key_hint: "DRZ-••••-WXYZ",
      expires_at: "2027-10-19T00:00:00.000Z",
    });
    expect(verifyEntitlement(token)).toBe(true);
  });

  test("tampered device_id fails verification", () => {
    const token = signEntitlement(signedInput());
    expect(verifyEntitlement({ ...token, device_id: "dev-evil" })).toBe(false);
  });

  test("tampered signature fails verification", () => {
    const token = signEntitlement(signedInput());
    expect(verifyEntitlement({ ...token, sig: "deadbeef".repeat(8) })).toBe(false);
  });

  test("wrong secret fails verification", () => {
    const token = signEntitlement(signedInput());
    process.env.ENTITLEMENT_SECRET = "a-different-secret";
    expect(verifyEntitlement(token)).toBe(false);
  });

  test("missing ENTITLEMENT_SECRET throws on sign", () => {
    delete process.env.ENTITLEMENT_SECRET;
    expect(() => signEntitlement(signedInput())).toThrow(/ENTITLEMENT_SECRET/);
  });

  test("missing ENTITLEMENT_SECRET verifies false (never throws)", () => {
    const token = signEntitlement(signedInput());
    delete process.env.ENTITLEMENT_SECRET;
    expect(verifyEntitlement(token)).toBe(false);
  });

  test.each([[null], [undefined], [{}], [{ device_id: "x" }]])(
    "malformed input %p verifies false",
    (input) => {
      expect(verifyEntitlement(input as any)).toBe(false);
    },
  );

  test("never embeds the plaintext key", () => {
    const token = signEntitlement({
      device_id: "dev-3",
      key_hint: "DRZ-••••-QWER",
      expires_at: null,
    });
    // the canonical payload only carries device_id, key_hint, expiry, issued_at
    expect(JSON.stringify(token)).not.toContain("DRZ-ABCD");
  });
});
