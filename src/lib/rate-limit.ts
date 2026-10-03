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
  return callerIp((name) => request.headers.get(name));
}

/**
 * The caller's address from whatever reads a header — a `Request`, or
 * `headers()` in a server component.
 *
 * ★ The LAST entry of X-Forwarded-For, and nothing else. Measured on
 * production 2026-09-28 (`/api/admin/ip-headers`): the hosting proxy appends
 * the address it saw to X-Forwarded-For instead of replacing the header, and
 * passes every other header through untouched. So the last entry is the only
 * one the caller did not write. `cf-connecting-ip` and `x-real-ip` are not
 * read at all — there is no CDN in front of this site, so both are whatever
 * the caller put there. Until this change every limit keyed on the first
 * entry, which let a script choose a fresh address for every request.
 *
 * ⚠️ This assumes exactly one proxy in front of the app. Put a CDN in front of
 * it and the last entry becomes the CDN's address; that CDN's own client
 * header would then be the one to read, and this has to change with it.
 */
export function callerIp(header: (name: string) => string | null): string {
  const entries = (header("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.at(-1) ?? "unknown";
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

/**
 * Whether a request declares a body larger than `maxBytes`.
 *
 * ★ Checked before `formData()` / `json()` are touched. The 2026-09-28 review
 * measured one 150 MB POST to /api/feedback adding ~440 MB to the process:
 * every form route parsed the whole body before looking at the code or the
 * rate limit. A declared length that is not a number is refused too. With no
 * declared length (a chunked upload) this says no — so on its own it is only
 * a fast path, and every route also reads the body through `boundedRequest`,
 * which enforces the same limit on the bytes that actually arrive.
 */
export function bodyTooLarge(request: Request, maxBytes: number): boolean {
  const declared = request.headers.get("content-length");
  if (declared === null) return false;
  const length = Number(declared);
  return !Number.isFinite(length) || length > maxBytes;
}

/**
 * A copy of `request` whose body has been read with a running byte count, or
 * null if the body turned out to be larger than `maxBytes`.
 *
 * ★ Why this exists: `bodyTooLarge` trusts Content-Length, and a chunked
 * request has none. Until this, any route could be sent a body of any size
 * that way and `formData()` / `json()` would buffer all of it before a single
 * check ran (found on the photo upload first, 2026-10-03). This stops reading
 * the moment the count passes the limit, so what one request can make the
 * process hold is bounded by `maxBytes` (a small multiple of it while the
 * chunks are joined and copied into the new request), not by the sender.
 *
 * The copy keeps the URL, method and headers, so a route can carry on using
 * it exactly like the original — including `formData()` and `json()` on it.
 * Content-Length and Transfer-Encoding are dropped from the copy: the body is
 * now a plain in-memory buffer and they no longer describe it.
 *
 * If the stream breaks part-way (the caller went away), the copy has an empty
 * body, so the route's own parse fails and it answers as it would for any
 * malformed request.
 */
export async function boundedRequest(request: Request, maxBytes: number): Promise<Request | null> {
  if (bodyTooLarge(request, maxBytes)) return null;

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  const copy = (body: Uint8Array | null) =>
    new Request(request.url, { method: request.method, headers, body: body as BodyInit | null });

  if (!request.body) return copy(null);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return copy(new Uint8Array(0));
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return copy(body);
}
