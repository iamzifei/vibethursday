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

/** Upload requests per IP per hour. Sized so a room on one café Wi-Fi still fits. */
export const UPLOADS_PER_IP_PER_HOUR = 20;

/**
 * Most photos waiting for review, across every session, before uploads stop.
 *
 * ⚠️ This is what bounds the database if somebody scripts the form from many
 * addresses: the per-IP limit alone does not. At 1 MB a photo the queue tops
 * out around 200 MB, and the organiser clears it by approving or rejecting.
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

/**
 * APP segments and comments that are dropped from a stored JPEG.
 *
 * APP1 is EXIF and XMP — where a phone writes GPS coordinates, the device's
 * serial number and the time to the second. APP3–APP13 and APP15 are vendor
 * blobs nobody needs to see the picture. Kept: APP0 (JFIF), APP2 (the colour
 * profile — dropping it shifts colours on wide-gamut phone photos) and APP14
 * (Adobe — some decoders need it to read the colour transform at all).
 */
function isDroppedSegment(marker: number): boolean {
  if (marker === 0xfe) return true; // COM
  if (marker === 0xe1 || marker === 0xef) return true; // APP1, APP15
  return marker >= 0xe3 && marker <= 0xed; // APP3–APP13
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

export type CleanJpeg = { bytes: Buffer; width: number; height: number };

/**
 * Checks that `input` really is a JPEG, reads its size, and returns a copy with
 * the metadata segments removed — or null if it is not one we will store.
 *
 * The bytes decide, never the filename or the declared type: anything that
 * does not walk as a JPEG header from the first byte to the start of the image
 * data is refused, so an HTML or SVG file renamed to .jpg never gets stored.
 *
 * The page already re-encodes through a canvas, which drops EXIF by itself.
 * This is for the upload that did not come from the page: the person who
 * scripted it may not have meant to publish where they live either.
 *
 * Only the header is rewritten. Everything from the start-of-scan marker on is
 * the compressed picture, copied byte for byte.
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

    // Start of scan: the header is over. Copy the rest untouched.
    if (marker === 0xda) {
      if (width === 0 || height === 0) return null;
      kept.push(input.subarray(segmentStart));
      return { bytes: Buffer.concat(kept), width, height };
    }

    // A second SOI, an EOI, or a restart marker before any image data is not
    // a well-formed header.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0x00) {
      return null;
    }

    if (i + 2 >= input.length) return null;
    const length = input.readUInt16BE(i + 1);
    if (length < 2) return null;

    const segmentEnd = i + 1 + length;
    if (segmentEnd > input.length) return null;

    if (isStartOfFrame(marker)) {
      if (length < 7) return null;
      height = input.readUInt16BE(i + 4);
      width = input.readUInt16BE(i + 6);
      if (width === 0 || height === 0 || width > MAX_PHOTO_SIDE || height > MAX_PHOTO_SIDE) return null;
    }

    if (!isDroppedSegment(marker)) kept.push(input.subarray(segmentStart, segmentEnd));

    i = segmentEnd;
  }

  // Ran out of header without reaching any image data.
  return null;
}

export type NewPhoto = { bytes: Buffer; width: number; height: number };

/** What the upload handler needs from the database. */
export type UploadStore = {
  pendingCount: () => Promise<number>;
  save: (session: string, photos: NewPhoto[]) => Promise<number>;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/session-photos, minus the wiring.
 *
 * All-or-nothing: if any one photo is refused, none of them is stored, so the
 * person sees one clear answer rather than "three of five went through".
 */
export async function handlePhotoUpload(request: Request, store: UploadStore, today: string): Promise<Response> {
  // Before anything reads the body: a refused request should cost the sender
  // a slot whether or not it was well formed.
  const limit = checkRateLimit(`session-photo:${clientIp(request)}`, UPLOADS_PER_IP_PER_HOUR);
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  if (bodyTooLarge(request, MAX_UPLOAD_BODY)) return json({ error: "too_large" }, 413);

  const form = await request.formData().catch(() => null);
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

  // Racy by a request or two under a burst — two uploads can both read 198 —
  // which is fine for a ceiling whose job is "not unbounded", not "exactly 200".
  if ((await store.pendingCount()) + photos.length > MAX_PENDING_PHOTOS) {
    return json({ error: "queue_full" }, 503);
  }

  const saved = await store.save(session, photos);
  return json({ ok: true, saved });
}

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
  get: (id: string) => Promise<StoredPhoto | null>,
): Promise<Response> {
  if (!/^\d{1,18}$/.test(id)) return new Response("not found", { status: 404 });

  const photo = await get(id);
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
