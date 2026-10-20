/**
 * Unit tests for the license-status matrix.
 *
 * NOTE: `lib/license-status.ts` (sibling-owned) was not on disk when this
 * suite was written, so these tests import the spec-compliant reference
 * implementation. Swap the import below to `from "../../lib/license-status"`
 * once the sibling module exists — no test logic needs to change.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { getLicenseStatus } from "../../lib/license-status";

// Frozen "now" so expiry comparisons are fully deterministic.
const NOW = new Date("2026-10-19T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const past = new Date(NOW.getTime() - 60_000).toISOString();
const future = new Date(NOW.getTime() + 60_000).toISOString();

describe("getLicenseStatus", () => {
  test("active: used, enabled, no expiry", () => {
    expect(getLicenseStatus({ used: true, enabled: true, expires_at: null })).toBe("active");
  });

  test("active: used, enabled, expiry in the future", () => {
    expect(getLicenseStatus({ used: true, enabled: true, expires_at: future })).toBe("active");
  });

  test("pending: not used yet", () => {
    expect(getLicenseStatus({ used: false, enabled: true, expires_at: null })).toBe("pending");
  });

  test("pending: not used, expiry in the future", () => {
    expect(getLicenseStatus({ used: false, enabled: true, expires_at: future })).toBe("pending");
  });

  test("disabled: enabled is false", () => {
    expect(getLicenseStatus({ used: true, enabled: false, expires_at: null })).toBe("disabled");
  });

  test("disabled: unused AND disabled → disabled (not pending)", () => {
    expect(getLicenseStatus({ used: false, enabled: false, expires_at: null })).toBe("disabled");
  });

  test("expired: expires_at in the past", () => {
    expect(getLicenseStatus({ used: true, enabled: true, expires_at: past })).toBe("expired");
  });

  test("expired takes precedence over disabled", () => {
    expect(getLicenseStatus({ used: true, enabled: false, expires_at: past })).toBe("expired");
    expect(getLicenseStatus({ used: false, enabled: false, expires_at: past })).toBe("expired");
  });

  test("expired takes precedence over pending", () => {
    expect(getLicenseStatus({ used: false, enabled: true, expires_at: past })).toBe("expired");
  });

  test("null expires_at never expires (even when disabled)", () => {
    expect(getLicenseStatus({ used: true, enabled: false, expires_at: null })).toBe("disabled");
    expect(getLicenseStatus({ used: true, enabled: true, expires_at: null })).toBe("active");
  });

  test("boundary: expires_at exactly now → expired", () => {
    expect(getLicenseStatus({ used: true, enabled: true, expires_at: NOW.toISOString() })).toBe("expired");
  });
});
