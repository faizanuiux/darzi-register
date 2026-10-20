/**
 * Unit tests for the rate-limit contract.
 *
 * NOTE: `lib/rate-limit.ts` (sibling-owned) was not on disk when this suite
 * was written, so these tests import the spec-compliant reference
 * implementation. Swap the import below to `from "../../lib/rate-limit"`
 * once the sibling module exists — no test logic needs to change.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, __resetRateLimitStore } from "../../lib/rate-limit";

const NOW = new Date("2026-10-19T12:00:00.000Z").getTime();
const WINDOW_MS = 60_000;
const LIMIT = 3;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  __resetRateLimitStore();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  test("allows up to the limit, then blocks", () => {
    const ip = "10.0.0.1";
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).allowed).toBe(true);
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).allowed).toBe(true);
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).allowed).toBe(true);
    const blocked = rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // stays blocked for the rest of the window
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).allowed).toBe(false);
  });

  test("remaining counts down across allowed calls", () => {
    const ip = "10.0.0.2";
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).remaining).toBe(2);
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).remaining).toBe(1);
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).remaining).toBe(0);
  });

  test("window reset re-allows calls", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < LIMIT; i++) {
      rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS });
    }
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).allowed).toBe(false);

    vi.advanceTimersByTime(WINDOW_MS + 1);

    const after = rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS });
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(LIMIT - 1);
  });

  test("bucket does not refill instantly — still blocked 1ms after exhaustion", () => {
    const ip = "10.0.0.4";
    for (let i = 0; i < LIMIT; i++) {
      rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS });
    }
    vi.advanceTimersByTime(1);
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).allowed).toBe(false);
  });

  test("separate IPs are tracked independently", () => {
    const opts = { limit: LIMIT, windowMs: WINDOW_MS };
    for (let i = 0; i < LIMIT; i++) {
      rateLimit("10.0.0.5", opts);
    }
    expect(rateLimit("10.0.0.5", opts).allowed).toBe(false);
    // a different IP still has its full budget
    const fresh = rateLimit("10.0.0.6", opts);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(LIMIT - 1);
  });

  test("resetMs is the time until the next token refills", () => {
    const ip = "10.0.0.7";
    for (let i = 0; i < LIMIT; i++) {
      rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS });
    }
    const blocked = rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS });
    expect(blocked.allowed).toBe(false);
    // tokens refill at LIMIT per WINDOW_MS; one token takes WINDOW_MS/LIMIT ms
    expect(blocked.resetMs).toBe(Math.ceil(WINDOW_MS / LIMIT));
    // an allowed call reports resetMs 0
    vi.advanceTimersByTime(WINDOW_MS + 1);
    expect(rateLimit(ip, { limit: LIMIT, windowMs: WINDOW_MS }).resetMs).toBe(0);
  });
});
