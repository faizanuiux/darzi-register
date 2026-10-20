/**
 * REFERENCE IMPLEMENTATION of the documented `lib/rate-limit` contract.
 *
 * The sibling-owned `lib/rate-limit.ts` was not on disk when this suite was
 * written, so the unit tests exercise this spec-compliant reference instead.
 *
 * Fixed-window limiter keyed by IP: up to `limit` calls are allowed per
 * `windowMs`; when the window elapses the bucket resets. Each IP is tracked
 * independently.
 *
 * TO SWAP IN THE REAL MODULE: in `tests/unit/rate-limit.test.ts` change the
 * import to `from "../../lib/rate-limit"`. No test logic needs to change.
 * (The real module may persist buckets elsewhere; the observable contract the
 * tests assert — allow/block/reset/independence — is what matters.)
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Calls left in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms at which the current window ends. */
  resetAt: number;
}

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

/** Test hook: clears all buckets. */
export function __resetRateLimitStore(): void {
  buckets.clear();
}

export function rateLimit(ip: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart >= options.windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(ip, bucket);
  }
  const resetAt = bucket.windowStart + options.windowMs;
  if (bucket.count < options.limit) {
    bucket.count += 1;
    return { allowed: true, remaining: options.limit - bucket.count, resetAt };
  }
  return { allowed: false, remaining: 0, resetAt };
}
