// Simple in-memory, per-instance rate limiter (for production, consider Redis/Upstash).
// The key map is bounded: expired entries are pruned, then the oldest keys are
// evicted, so many distinct client keys cannot grow memory without limit.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}

export type RateLimiter = (key: string) => boolean;

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
}: RateLimiterOptions): RateLimiter {
  const entries = new Map<string, RateLimitEntry>();

  function makeRoom(now: number) {
    for (const [key, entry] of entries) {
      if (entry.resetAt < now) entries.delete(key);
    }
    // Maps iterate in insertion order, so this evicts the oldest keys first.
    for (const key of entries.keys()) {
      if (entries.size < maxKeys) break;
      entries.delete(key);
    }
  }

  return (key: string) => {
    const now = Date.now();
    const entry = entries.get(key);

    if (!entry || entry.resetAt < now) {
      if (!entry && entries.size >= maxKeys) makeRoom(now);
      entries.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= limit) return false;
    entry.count++;
    return true;
  };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
