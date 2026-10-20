import "server-only";

import { NextResponse } from "next/server";

/**
 * In-memory token-bucket rate limiter.
 *
 * MULTI-INSTANCE LIMITATION: this bucket map lives in the Node process's
 * memory. On serverless (Vercel, etc.) each function instance keeps its own
 * map, so an attacker rotating across N warm instances effectively gets
 * N × the configured limit. It is fine as a first-line abuse guard for a
 * low-traffic admin API, but for strict global enforcement migrate to a
 * shared store — e.g. Upstash Redis with a fixed-window counter:
 *
 *   const { success } = await ratelimit.limit(`ratelimit:${route}:${ip}`);
 *
 * (see @upstash/ratelimit). Until then, keep per-route limits conservative.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();
let opsSinceSweep = 0;

function sweepStale(now: number): void {
  // Lazily drop buckets that are both full and untouched for > 10 minutes,
  // so the map can't grow unboundedly from one-off IPs.
  if (buckets.size < 5_000) return;
  // NOTE: Map.prototype.forEach is used instead of for..of because the
  // tsconfig targets below ES2015 (no downlevelIteration flag).
  buckets.forEach((bucket, key) => {
    if (now - bucket.lastRefillMs > 10 * 60 * 1_000) {
      buckets.delete(key);
    }
  });
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens left in the bucket after this request (0 when denied). */
  remaining: number;
  /** Ms until the next request would be allowed (0 when allowed). */
  resetMs: number;
}

/**
 * Token bucket: `limit` tokens max, refilled continuously over `windowMs`.
 * Key by route+IP, e.g. rateLimit(`licenses-activate:${ip}`, {limit: 10, windowMs: 60_000}).
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): RateLimitResult {
  const { limit, windowMs } = opts;
  const now = Date.now();
  const refillPerMs = limit / windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: limit, lastRefillMs: now };
    buckets.set(key, bucket);
  } else if (now > bucket.lastRefillMs) {
    bucket.tokens = Math.min(
      limit,
      bucket.tokens + (now - bucket.lastRefillMs) * refillPerMs,
    );
    bucket.lastRefillMs = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), resetMs: 0 };
  }

  opsSinceSweep += 1;
  if (opsSinceSweep > 1_000) {
    opsSinceSweep = 0;
    sweepStale(now);
  }

  return {
    allowed: false,
    remaining: 0,
    resetMs: Math.ceil((1 - bucket.tokens) / refillPerMs),
  };
}

/** Best-effort client IP from proxy headers. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** Standard 429 JSON response with Retry-After for a denied request. */
export function rateLimitedResponse(resetMs: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(resetMs / 1000))),
      },
    },
  );
}

/**
 * Test-only helper: clears all rate-limit buckets. Never call in production
 * code — it exists so unit tests can isolate each case.
 */
export function __resetRateLimitStore(): void {
  buckets.clear();
  opsSinceSweep = 0;
}
