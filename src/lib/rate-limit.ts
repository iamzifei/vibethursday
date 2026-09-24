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

/**
 * `max` overrides the per-window cap for a key. The default fits a signup
 * form; a room full of phones on one café Wi-Fi shares a single address, so
 * check-in needs a cap sized for a room, not a person.
 */
export function checkRateLimit(
  key: string,
  max: number = MAX_PER_WINDOW,
): { allowed: boolean; retryAfterSeconds: number } {
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

  if (existing.count > max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * The caller's address, as the proxy reports it.
 *
 * The same two lines were already copied into every route that limits; this is
 * them once, for the routes that did not limit at all until 2026-09-24.
 */
export function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

/**
 * A ready-made 429 when `request` is over `max` per hour in `bucket`, else null.
 *
 * ⚠️ Added for the write endpoints the 2026-09-24 audit found with no limit at
 * all — the admin routes, the admin session exchange, the projector, and a
 * member's own card. The one that mattered most was the admin session route:
 * it is where the admin token is checked, and an unthrottled check is an
 * unthrottled guess. Call it before authenticating, so a guess costs a slot
 * whether or not it was right.
 */
export function tooMany(request: Request, bucket: string, max: number): Response | null {
  const { allowed, retryAfterSeconds } = checkRateLimit(`${bucket}:${clientIp(request)}`, max);
  if (allowed) return null;

  return new Response("Too many requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
  });
}
