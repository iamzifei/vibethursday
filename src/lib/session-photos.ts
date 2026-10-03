// Relative, not "@/": the tests load this through Node's type stripper, which
// cannot resolve the tsconfig path alias.
import { isSessionDate } from "./checkin.ts";
import { bodyTooLarge, checkRateLimit, clientIp } from "./rate-limit.ts";

/**
 * Photos people took at a session, uploaded on that session's page.
 *
 * ★ Nothing uploaded is public until the organiser approves it in /admin.
 * A photo of a room is a photo of the people in it, and nobody is shown on
 * this site without having agreed to it. The uploader ticks a box saying so;
 * the organiser is the check that the box was true.
 *
 * Stored in Postgres like avatars and Wharf screenshots, not in a bucket: a
 * second storage system means a new account, new keys and a new supplier, for
 * a few dozen photos a week. Re-evaluate once there are many more.
 *
 * Everything in this file is a rule with no database behind it — the routes
 * hand it the store as plain functions — so the tests can drive the real
 * upload and serve logic with a fake store and the real rate limiter.
 */

/**
 * Per-photo ceiling on the server.
 *
 * The page shrinks every photo to 1600px on the long edge and re-encodes it as
 * JPEG before sending, which lands at a few hundred kilobytes. Anything near
 * this did not come from the page.
 */
export const MAX_PHOTO_BYTES = 1024 * 1024;

/** Photos in one upload. A handful, not a camera roll. */
export const MAX_PHOTOS_PER_UPLOAD = 5;

/** Upload requests per IP (per /64 for IPv6) per hour. Sized so a room on one café Wi-Fi still fits. */
export const UPLOADS_PER_IP_PER_HOUR = 20;

/** Photos per IP (per /64 for IPv6) per hour, counted on top of the requests. */
export const PHOTOS_PER_IP_PER_HOUR = 30;

/**
 * Most photos waiting for review, across every session, before uploads stop.
 *
 * ⚠️ This is what bounds the database if somebody scripts the form from many
 * addresses: the per-IP limit alone does not. At 1 MB a photo the queue tops
 * out around 200 MB, and the organiser clears it by approving or rejecting —
 * or with "reject everything waiting" in /admin, if it was flooded.
 */
export const MAX_PENDING_PHOTOS = 200;

/** Longest side a stored photo may have. The page sends 1600; this is slack. */
export const MAX_PHOTO_SIDE = 4096;

/** How far back a session still takes uploads. */
export const UPLOAD_WINDOW_DAYS = 60;

/** The body as a whole: every photo at the cap plus room for the form fields. */
export const MAX_UPLOAD_BODY = MAX_PHOTOS_PER_UPLOAD * MAX_PHOTO_BYTES + 64 * 1024;

/**
 * Whether a session takes uploads on `today` (both YYYY-MM-DD, Sydney).
 *
 * Only a day that has already started — nobody has photos of next week — and
 * only for a couple of months after, so an old page is not an open inbox
 * forever.
 */
export function canUploadTo(session: string, today: string): boolean {
  if (!isSessionDate(session) || !isSessionDate(today)) return false;
  if (session > today) return false;

  const ageDays = (Date.parse(today) - Date.parse(session)) / 86_400_000;
  return ageDays <= UPLOAD_WINDOW_DAYS;
}

/** Start-of-frame markers, which carry the image's dimensions. */
function isStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 && // DHT
    marker !== 0xc8 && // reserved (JPG)
    marker !== 0xcc // DAC
  );
}

/**
 * The bytes of a metadata segment we keep, possibly trimmed — or null to drop it.
 *
 * Kept, and only in their known form: APP0 as plain JFIF with its embedded
 * thumbnail removed (a thumbnail of the original undoes any crop or blur),
 * APP2 only as a colour profile (dropping it shifts colours on wide-gamut
 * phone photos; other APP2 data is MPF, which points at hidden second images),
 * and APP14 only as Adobe's (some decoders need it to read the colour
 * transform at all). Everything else in APP1–APP15 and every comment goes:
 * APP1 is EXIF and XMP — GPS coordinates, the device serial, the exact time.
 */
function keptMetadata(marker: number, segment: Buffer): Buffer | null {
  const payload = segment.subarray(4);
  const startsWith = (tag: string) => payload.subarray(0, tag.length).toString("binary") === tag;

  if (marker === 0xe0) {
    if (!startsWith("JFIF\0") || payload.length < 14) return null;
    // JFIF header without the thumbnail: 14 payload bytes, thumbnail size 0×0.
    const trimmed = Buffer.from(segment.subarray(0, 4 + 14));
    trimmed.writeUInt16BE(16, 2);
    trimmed[4 + 12] = 0;
    trimmed[4 + 13] = 0;
    return trimmed;
  }
  if (marker === 0xe2) return startsWith("ICC_PROFILE\0") ? segment : null;
  if (marker === 0xee) return startsWith("Adobe") ? segment : null;
  return null;
}

export type CleanJpeg = { bytes: Buffer; width: number; height: number };

/**
 * Checks that `input` really is a JPEG, reads its size, and returns a copy with
 * the metadata removed — or null if it is not one we will store.
 *
 * The bytes decide, never the filename or the declared type: anything that
 * does not walk as a JPEG from the first byte to the end-of-image marker is
 * refused, so an HTML or SVG file renamed to .jpg never gets stored.
 *
 * The page already re-encodes through a canvas, which drops EXIF by itself.
 * This is for the upload that did not come from the page: the person who
 * scripted it may not have meant to publish where they live either.
 *
 * Every marker in the file is walked, including the ones between the scans of
 * a progressive JPEG, and nothing after the end-of-image marker is kept —
 * that trailing space is where phones put their hidden second images (depth
 * and gain maps), each with its own EXIF. The compressed picture data itself
 * is copied byte for byte.
 */
export function cleanJpeg(input: Buffer): CleanJpeg | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;

  const kept: Buffer[] = [input.subarray(0, 2)];
  let width = 0;
  let height = 0;
  let i = 2;

  while (i < input.length) {
    if (input[i] !== 0xff) return null;

    // Any number of 0xFF fill bytes may precede a marker.
    while (i < input.length && input[i] === 0xff) i += 1;
    if (i >= input.length) return null;

    const marker = input[i];
    const segmentStart = i - 1;

    // End of image: done. Anything after it is dropped.
    if (marker === 0xd9) {
      if (width === 0 || height === 0) return null;
      kept.push(Buffer.from([0xff, 0xd9]));
      return { bytes: Buffer.concat(kept), width, height };
    }

    // A second SOI, or a stray restart / reserved marker, is not well formed.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0x00) {
      return null;
    }

    if (i + 2 >= input.length) return null;
    const length = input.readUInt16BE(i + 1);
    if (length < 2) return null;

    const segmentEnd = i + 1 + length;
    if (segmentEnd > input.length) return null;
    const segment = input.subarray(segmentStart, segmentEnd);

    if (isStartOfFrame(marker)) {
      // One frame per image. A second one would let the stored size disagree
      // with what a browser actually draws.
      if (width !== 0 || length < 7) return null;
      height = input.readUInt16BE(i + 4);
      width = input.readUInt16BE(i + 6);
      if (width === 0 || height === 0 || width > MAX_PHOTO_SIDE || height > MAX_PHOTO_SIDE) return null;
    }

    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) {
      const trimmed = keptMetadata(marker, segment);
      if (trimmed) kept.push(trimmed);
    } else {
      kept.push(segment);
    }

    i = segmentEnd;

    if (marker === 0xda) {
      if (width === 0) return null;

      // Entropy-coded data: runs until a 0xFF that is followed by neither a
      // stuffed zero nor a restart marker. Copied as is.
      const scanStart = i;
      while (i < input.length) {
        if (input[i] === 0xff && i + 1 < input.length) {
          const next = input[i + 1];
          if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7)) break;
        }
        i += 1;
      }
      if (i >= input.length) return null; // never reached the end-of-image marker
      kept.push(input.subarray(scanStart, i));
    }
  }

  return null;
}

export type NewPhoto = { bytes: Buffer; width: number; height: number };

/**
 * What the upload handler needs from the database.
 *
 * `save` enforces the review queue's ceiling itself, in the same transaction
 * as the insert, and answers "full" instead of storing. A check in the handler
 * followed by a separate insert let a burst of parallel requests all read 195
 * and all go through (2026-10-03 review).
 */
export type UploadStore = {
  save: (session: string, photos: NewPhoto[], maxPending: number) => Promise<number | "full">;
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/**
 * The address a limit is keyed on. An IPv6 caller usually controls a whole
 * /64, so it counts as one address; IPv4 is used as is.
 */
export function limitKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  // An IPv4 address written as IPv6 (::ffff:1.2.3.4) is still that one address.
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];
  // Expand "::" just enough to take the first four groups.
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/**
 * Reads at most `max` bytes of the body, or null if there is more.
 *
 * `bodyTooLarge` trusts Content-Length, and a chunked request has none: until
 * this, a 30 MB chunked upload was read into memory in full before any check
 * ran (2026-10-03 review). This counts as it reads and stops at the limit.
 */
async function readCapped(request: Request, max: number): Promise<Buffer | null> {
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/**
 * Whether the browser says this request came from another site.
 *
 * Uploading needs no cookie and multipart is a content type any page may
 * post, so without this any website could have its visitors' browsers upload
 * on its behalf, each from their own address. Browsers send Sec-Fetch-Site on
 * every request; a script that leaves it out is still bound by every limit.
 */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

/**
 * POST /api/session-photos, minus the wiring.
 *
 * All-or-nothing: if any one photo is refused, none of them is stored, so the
 * person sees one clear answer rather than "three of five went through".
 */
export async function handlePhotoUpload(request: Request, store: UploadStore, today: string): Promise<Response> {
  if (isCrossSite(request)) return json({ error: "cross_site" }, 403);

  const who = limitKey(clientIp(request));

  // Before anything reads the body: a refused request should cost the sender
  // a slot whether or not it was well formed.
  const limit = checkRateLimit(`session-photo:${who}`, UPLOADS_PER_IP_PER_HOUR);
  if (!limit.allowed) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  }

  if (bodyTooLarge(request, MAX_UPLOAD_BODY)) return json({ error: "too_large" }, 413);

  const body = await readCapped(request, MAX_UPLOAD_BODY).catch(() => null);
  if (!body) return json({ error: "too_large" }, 413);

  const form = await new Response(new Uint8Array(body), {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  if (!form) return json({ error: "invalid_body" }, 400);

  const session = form.get("session");
  if (typeof session !== "string" || !canUploadTo(session, today)) {
    return json({ error: "bad_session" }, 400);
  }

  if (form.get("consent") !== "yes") return json({ error: "no_consent" }, 400);

  const files = form.getAll("photo").filter((value): value is File => value instanceof File);
  if (files.length === 0) return json({ error: "missing_file" }, 400);
  if (files.length > MAX_PHOTOS_PER_UPLOAD) return json({ error: "too_many_files" }, 400);

  const photos: NewPhoto[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) return json({ error: "too_large" }, 413);

    const clean = cleanJpeg(Buffer.from(await file.arrayBuffer()));
    if (!clean) return json({ error: "bad_type" }, 415);

    photos.push(clean);
  }

  // Photos, not just requests: five tiny photos a request would otherwise let
  // one address fill the whole review queue in an afternoon.
  for (let n = 0; n < photos.length; n += 1) {
    const perPhoto = checkRateLimit(`session-photo-n:${who}`, PHOTOS_PER_IP_PER_HOUR);
    if (!perPhoto.allowed) {
      return json({ error: "rate_limited" }, 429, { "Retry-After": String(perPhoto.retryAfterSeconds) });
    }
  }

  const saved = await store.save(session, photos, MAX_PENDING_PHOTOS);
  if (saved === "full") return json({ error: "queue_full" }, 503);
  return json({ ok: true, saved });
}

/**
 * A stored photo as the serve route sees it. `bytes` is null when there are
 * none to show this caller: rejected, or not approved and not the organiser —
 * the query decides that, so a refused request never reads a megabyte off disk.
 */
export type StoredPhoto = { bytes: Buffer | null; status: string };

/**
 * GET /api/session-photo/:id, minus the wiring.
 *
 * ★ A photo nobody has approved does not exist to anyone but the organiser —
 * the same 404 as an id that was never used, so walking the sequential ids
 * reveals nothing about what is waiting in the queue.
 */
export async function servePhoto(
  id: string,
  isAdmin: boolean,
  get: (id: string, includeUnapproved: boolean) => Promise<StoredPhoto | null>,
): Promise<Response> {
  if (!/^\d{1,18}$/.test(id)) return new Response("not found", { status: 404 });

  const photo = await get(id, isAdmin);
  if (!photo?.bytes) return new Response("not found", { status: 404 });

  const approved = photo.status === "approved";
  if (!approved && !isAdmin) return new Response("not found", { status: 404 });

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      // Always JPEG: nothing else is ever stored (see `cleanJpeg`).
      "Content-Type": "image/jpeg",
      "Content-Length": String(photo.bytes.length),
      "X-Content-Type-Options": "nosniff",
      // Belt and braces: even opened directly, this response can run nothing.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // An approved photo can still be taken down; an hour is how long a
      // takedown may lag in somebody's cache. A pending one is only ever seen
      // by the organiser and must not be kept by anything in between.
      "Cache-Control": approved ? "public, max-age=3600" : "private, no-store",
    },
  });
}
