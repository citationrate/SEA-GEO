/**
 * Simple in-memory rate limiter for Vercel serverless.
 * Note: each serverless instance has its own Map, so this provides
 * per-instance limiting (good enough to prevent abuse, not a global limit).
 */

const rateMap = new Map<string, number[]>();

// Periodic cleanup to prevent memory leaks (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const keys = Array.from(rateMap.keys());
  for (const key of keys) {
    const timestamps = rateMap.get(key)!;
    const valid = timestamps.filter((t: number) => now - t < windowMs);
    if (valid.length === 0) {
      rateMap.delete(key);
    } else {
      rateMap.set(key, valid);
    }
  }
}

/**
 * Check if a request is within the rate limit.
 * @returns true if allowed, false if rate limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  cleanup(windowMs);
  const now = Date.now();
  const timestamps = rateMap.get(key) || [];
  const valid = timestamps.filter((t) => now - t < windowMs);
  if (valid.length >= maxRequests) return false;
  valid.push(now);
  rateMap.set(key, valid);
  return true;
}
