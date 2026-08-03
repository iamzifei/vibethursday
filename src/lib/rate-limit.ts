/**
 * A small fixed-window rate limiter, keyed by IP.
 *
 * This exists because Turnstile is advisory rather than mandatory: a
 * submission with no token is accepted (the challenge does not complete in
 * every browser, notably WeChat's in-app one), so something still has to stop
 * a script hammering the endpoint. Combined with the honeypot that is enough
 * for a meetup signup form — there is no account and no payment behind it.
 *
 * State lives in memory, which is correct for a single instance and would need
 * replacing with Redis the moment this runs on more than one.
 */

type Window = { count: number; resetAt: number };

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 6;

const cache = globalThis as unknown as { __vibeThursdayRates?: Map<string, Window> };
cache.__vibeThursdayRates ??= new Map();

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const windows = cache.__vibeThursdayRates!;
  const now = Date.now();

  // Opportunistic sweep so the map cannot grow without bound. Cheap because
  // this endpoint sees a handful of requests, not thousands.
  if (windows.size > 5_000) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  }

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > MAX_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
