/**
 * Unit tests for the license-keys contract.
 *
 * NOTE: `lib/license-keys.ts` (sibling-owned) was not on disk when this suite
 * was written, so these tests import the spec-compliant reference
 * implementation. Swap the import below to `from "../../lib/license-keys"`
 * once the sibling module exists — no test logic needs to change.
 */
import { describe, test, expect } from "vitest";
import {
  generateLicenseKey,
  hashKey,
  isValidKeyFormat,
  maskKey,
  normalizeKey,
  KEY_ALPHABET,
  KEY_PATTERN,
} from "../../lib/license-keys";

describe("generateLicenseKey", () => {
  test("generated keys match the DRZ-XXXX-XXXX format", () => {
    for (let i = 0; i < 25; i++) {
      expect(generateLicenseKey()).toMatch(KEY_PATTERN);
      expect(generateLicenseKey()).toMatch(/^DRZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  test("500 generated keys are all unique", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 500; i++) {
      keys.add(generateLicenseKey());
    }
    expect(keys.size).toBe(500);
  });

  test("alphabet excludes ambiguous characters (0, O, 1, I, L)", () => {
    expect(KEY_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 200; i++) {
      expect(generateLicenseKey()).not.toMatch(/[0O1IL]/);
    }
  });
});

describe("hashKey", () => {
  test("is deterministic", () => {
    expect(hashKey("DRZ-ABCD-EFGH")).toBe(hashKey("DRZ-ABCD-EFGH"));
  });

  test("is a 64-char lowercase hex SHA-256 digest", () => {
    const digest = hashKey("DRZ-ABCD-EFGH");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toHaveLength(64);
  });

  test("differs per key", () => {
    expect(hashKey("DRZ-ABCD-EFGH")).not.toBe(hashKey("DRZ-ABCD-EFGJ"));
  });

  test("normalizes before hashing (case/whitespace insensitive)", () => {
    expect(hashKey("  drz-abcd-efgh ")).toBe(hashKey("DRZ-ABCD-EFGH"));
  });
});

describe("maskKey", () => {
  test("shows only the last 4 characters", () => {
    expect(maskKey("DRZ-ABCD-EFGH")).toBe("DRZ-••••-EFGH");
  });

  test("normalizes the visible suffix", () => {
    expect(maskKey("drz-abcd-efgh")).toBe("DRZ-••••-EFGH");
  });
});

describe("normalizeKey", () => {
  test("trims and uppercases", () => {
    expect(normalizeKey("  drz-abcd-efgh\n")).toBe("DRZ-ABCD-EFGH");
    expect(normalizeKey("DRZ-ABCD-EFGH")).toBe("DRZ-ABCD-EFGH");
  });
});

describe("isValidKeyFormat", () => {
  test("accepts well-formed keys", () => {
    expect(isValidKeyFormat("DRZ-ABCD-EFGH")).toBe(true);
    expect(isValidKeyFormat("DRZ-1234-5678")).toBe(true);
  });

  test("accepts keys that normalize to the format", () => {
    expect(isValidKeyFormat("  drz-abcd-efgh ")).toBe(true);
  });

  test.each([
    ["DRZ-ABC-EFGH", "short first segment"],
    ["DRZ-ABCDE-EFGH", "long first segment"],
    ["DRZ-ABCD-EFG", "short second segment"],
    ["XXX-ABCD-EFGH", "wrong prefix"],
    ["DRZABCD-EFGH", "missing dash"],
    ["DRZ-ABCD-EFGH-12", "extra segment"],
    ["DRZ-ABCD-EFG!", "illegal character"],
    ["DRZ-ABCD_EFGH", "underscore instead of dash"],
    ["", "empty string"],
    ["   ", "whitespace only"],
    [null, "null"],
    [undefined, "undefined"],
    [12345, "number"],
    [{}, "object"],
  ])("rejects %s (%s)", (input: unknown, _label: string) => {
    expect(isValidKeyFormat(input)).toBe(false);
  });
});
