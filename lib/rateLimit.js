// Simple in-memory rate limiter (per-IP, single-instance)
// For multi-instance deployments, replace with Redis-backed limiter.

const store = new Map(); // key -> { count, resetAt }

/**
 * @param {string} key      - e.g. `otp:${ip}` or `2fa:${ip}`
 * @param {number} max      - max requests allowed in the window
 * @param {number} windowMs - window duration in milliseconds
 * @returns {{ ok: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: max - 1, resetAt: now + windowMs };
  }

  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/** Extract real IP from Next.js request */
export function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}
