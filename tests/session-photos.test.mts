import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  canUploadTo,
  cleanJpeg,
  handlePhotoUpload,
  MAX_PENDING_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_UPLOAD,
  servePhoto,
  UPLOADS_PER_IP_PER_HOUR,
  type NewPhoto,
  type StoredPhoto,
  type UploadStore,
} from "../src/lib/session-photos.ts";

/**
 * Photos uploaded on /sessions/<date> (slice D of the post-session-nine plan).
 *
 * The rules that matter: nothing is public until approved, non-images are
 * refused by their bytes, and size, count, rate and the review queue are all
 * bounded. The upload and serve handlers run here for real, against a fake
 * store and the real rate limiter; the SQL runs against a real Postgres at the
 * bottom when DATABASE_URL is set.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const TODAY = "2026-10-03";
const SESSION = "2026-10-01";

// ── A minimal JPEG, built by hand ──────────────────────────────────────

function segment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

function sof(width: number, height: number): Buffer {
  const p = Buffer.alloc(15);
  p[0] = 8; // precision
  p.writeUInt16BE(height, 1);
  p.writeUInt16BE(width, 3);
  p[5] = 3; // components
  return segment(0xc0, p);
}

/** The compressed picture: what must come out byte for byte. */
const SCAN = Buffer.concat([
  segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
  Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0x78]),
  Buffer.from([0xff, 0xd9]),
]);

function jpeg({ width = 1600, height = 1200, exif = true } = {}): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "binary")),
    ...(exif ? [segment(0xe1, Buffer.from("Exif\0\0GPS-33.8688,151.2093 serial-ABC123"))] : []),
    segment(0xe2, Buffer.from("ICC_PROFILE\0profile")),
    segment(0xfe, Buffer.from("comment: taken at home")),
    segment(0xdb, Buffer.alloc(65, 1)),
    sof(width, height),
    SCAN,
  ]);
}

// ── Type validation by content ─────────────────────────────────────────

test("★ a real JPEG is kept, its size read, and its EXIF and comments removed", () => {
  const clean = cleanJpeg(jpeg());
  assert.ok(clean);
  assert.equal(clean.width, 1600);
  assert.equal(clean.height, 1200);

  const text = clean.bytes.toString("binary");
  assert.ok(!text.includes("GPS"), "EXIF (location) is stripped");
  assert.ok(!text.includes("serial"), "EXIF (device) is stripped");
  assert.ok(!text.includes("taken at home"), "comments are stripped");
  assert.ok(text.includes("JFIF"), "the JFIF header stays");
  assert.ok(text.includes("ICC_PROFILE"), "the colour profile stays");
  assert.ok(clean.bytes.subarray(clean.bytes.length - SCAN.length).equals(SCAN), "image data copied untouched");
  assert.ok(clean.bytes.length < jpeg().length);
});

test("★ anything that is not a JPEG by its bytes is refused, whatever it is called", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  const html = Buffer.from("<html><script>alert(1)</script></html>");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');

  for (const bytes of [png, html, svg, Buffer.alloc(0), Buffer.from([0xff, 0xd8])]) {
    assert.equal(cleanJpeg(bytes), null);
  }

  // JPEG magic number followed by garbage: the header has to actually parse.
  assert.equal(cleanJpeg(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), html])), null);
  // Truncated in the middle of the header.
  assert.equal(cleanJpeg(jpeg().subarray(0, 60)), null);
  // No frame header, so no size: not stored.
  assert.equal(cleanJpeg(Buffer.concat([Buffer.from([0xff, 0xd8]), SCAN])), null);
  // A frame claiming to be enormous (a decompression bomb for every viewer).
  assert.equal(cleanJpeg(jpeg({ width: 30000, height: 30000 })), null);
  assert.equal(cleanJpeg(jpeg({ width: 0, height: 100 })), null);
});

// ── The upload handler ─────────────────────────────────────────────────

let ipCounter = 0;
/** A fresh caller address per request group, so tests do not share a rate window. */
const freshIp = () => `203.0.113.${++ipCounter}`;

function fakeStore(pending = 0): UploadStore & { saved: { session: string; photos: NewPhoto[] }[] } {
  const saved: { session: string; photos: NewPhoto[] }[] = [];
  return {
    saved,
    pendingCount: async () => pending,
    save: async (session, photos) => {
      saved.push({ session, photos });
      return photos.length;
    },
  };
}

function upload(
  files: { bytes: Buffer; name?: string; type?: string }[],
  { session = SESSION, consent = "yes", ip = freshIp(), headers = {} as Record<string, string> } = {},
): Request {
  const form = new FormData();
  form.append("session", session);
  if (consent) form.append("consent", consent);
  for (const file of files) {
    form.append("photo", new File([new Uint8Array(file.bytes)], file.name ?? "photo.jpg", { type: file.type ?? "image/jpeg" }));
  }
  return new Request("http://localhost/api/session-photos", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip, ...headers },
  });
}

test("★ a good upload is stored as JPEG with the metadata gone", async () => {
  const store = fakeStore();
  const response = await handlePhotoUpload(upload([{ bytes: jpeg() }, { bytes: jpeg({ exif: false }) }]), store, TODAY);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, saved: 2 });
  assert.equal(store.saved.length, 1);
  assert.equal(store.saved[0].session, SESSION);
  assert.equal(store.saved[0].photos.length, 2);
  assert.ok(!store.saved[0].photos[0].bytes.toString("binary").includes("GPS"));
});

test("★ an oversize photo is refused and nothing is stored", async () => {
  const store = fakeStore();
  const big = Buffer.concat([jpeg(), Buffer.alloc(MAX_PHOTO_BYTES)]);
  const response = await handlePhotoUpload(upload([{ bytes: jpeg() }, { bytes: big }]), store, TODAY);

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error, "too_large");
  assert.equal(store.saved.length, 0, "all or nothing: the good one is not kept either");
});

test("★ an oversize body is refused before it is read", async () => {
  const store = fakeStore();
  const request = upload([{ bytes: jpeg() }], { headers: { "content-length": String(50 * 1024 * 1024) } });
  const response = await handlePhotoUpload(request, store, TODAY);

  assert.equal(response.status, 413);
  assert.equal(store.saved.length, 0);
});

test("★ a non-image is refused by its content, even named and typed as a JPEG", async () => {
  const store = fakeStore();
  const html = Buffer.from("<html><body onload=alert(1)>hi</body></html>");
  const response = await handlePhotoUpload(
    upload([{ bytes: html, name: "<img src=x onerror=alert(1)>.jpg", type: "image/jpeg" }]),
    store,
    TODAY,
  );

  assert.equal(response.status, 415);
  assert.equal((await response.json()).error, "bad_type");
  assert.equal(store.saved.length, 0);
});

test("more than the per-upload count is refused", async () => {
  const store = fakeStore();
  const files = Array.from({ length: MAX_PHOTOS_PER_UPLOAD + 1 }, () => ({ bytes: jpeg() }));
  const response = await handlePhotoUpload(upload(files), store, TODAY);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "too_many_files");
  assert.equal(store.saved.length, 0);
});

test("★ without the consent box, nothing is stored", async () => {
  const store = fakeStore();
  const response = await handlePhotoUpload(upload([{ bytes: jpeg() }], { consent: "" }), store, TODAY);

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "no_consent");
  assert.equal(store.saved.length, 0);
});

test("only a session that has happened, and recently, takes uploads", async () => {
  assert.equal(canUploadTo("2026-10-01", "2026-10-03"), true);
  assert.equal(canUploadTo("2026-10-03", "2026-10-03"), true, "on the day");
  assert.equal(canUploadTo("2026-10-08", "2026-10-03"), false, "next week has no photos yet");
  assert.equal(canUploadTo("2026-07-01", "2026-10-03"), false, "too long ago");
  assert.equal(canUploadTo("2026-02-31", "2026-10-03"), false);
  assert.equal(canUploadTo("not-a-date", "2026-10-03"), false);

  const store = fakeStore();
  const response = await handlePhotoUpload(upload([{ bytes: jpeg() }], { session: "2026-10-08" }), store, TODAY);
  assert.equal(response.status, 400);
  assert.equal(store.saved.length, 0);
});

test("★ the review queue has a ceiling, so a flood cannot fill the database", async () => {
  const store = fakeStore(MAX_PENDING_PHOTOS - 1);
  const response = await handlePhotoUpload(upload([{ bytes: jpeg() }, { bytes: jpeg() }]), store, TODAY);

  assert.equal(response.status, 503);
  assert.equal(store.saved.length, 0);
});

test("★ one address is rate limited per hour; another address is not", async () => {
  const store = fakeStore();
  const ip = freshIp();

  for (let i = 0; i < UPLOADS_PER_IP_PER_HOUR; i += 1) {
    const response = await handlePhotoUpload(upload([{ bytes: jpeg() }], { ip }), store, TODAY);
    assert.equal(response.status, 200, `request ${i + 1} is within the limit`);
  }

  const over = await handlePhotoUpload(upload([{ bytes: jpeg() }], { ip }), store, TODAY);
  assert.equal(over.status, 429);
  assert.ok(Number(over.headers.get("retry-after")) > 0);
  assert.equal(store.saved.length, UPLOADS_PER_IP_PER_HOUR, "the refused one stored nothing");

  const other = await handlePhotoUpload(upload([{ bytes: jpeg() }]), store, TODAY);
  assert.equal(other.status, 200);
});

// ── Serving: nothing public until approved ─────────────────────────────

function getter(rows: Record<string, StoredPhoto>) {
  return async (id: string) => rows[id] ?? null;
}

const BYTES = cleanJpeg(jpeg())!.bytes;

test("★ an unapproved photo does not exist to the public", async () => {
  const get = getter({ "1": { bytes: BYTES, status: "pending" }, "2": { bytes: null, status: "rejected" } });

  assert.equal((await servePhoto("1", false, get)).status, 404, "pending: same 404 as a missing id");
  assert.equal((await servePhoto("2", false, get)).status, 404);
  assert.equal((await servePhoto("3", false, get)).status, 404);
  assert.equal((await servePhoto("../1", false, get)).status, 404);
  assert.equal((await servePhoto("2", true, get)).status, 404, "a rejected photo has no bytes left to show anyone");
});

test("★ the organiser can see a pending photo, and nothing caches it", async () => {
  const response = await servePhoto("1", true, getter({ "1": { bytes: BYTES, status: "pending" } }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("★ approving makes it public, always as an image that can run nothing", async () => {
  const response = await servePhoto("1", false, getter({ "1": { bytes: BYTES, status: "approved" } }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /sandbox/);
  assert.match(response.headers.get("cache-control") ?? "", /^public/);
  assert.ok(Buffer.from(await response.arrayBuffer()).equals(BYTES));
});

// ── Wiring that the handlers cannot see ────────────────────────────────

test("★ the session page lists approved photos only", () => {
  const page = read("src/app/sessions/[date]/page.tsx");
  assert.match(page, /listApprovedSessionPhotos\(date\)/);
  assert.ok(!page.includes("listPhotosForReview"), "the review queue never reaches a public page");

  const db = read("src/lib/db.ts");
  const fn = db.slice(db.indexOf("export async function listApprovedSessionPhotos"));
  assert.match(fn.slice(0, fn.indexOf("\n}\n")), /status = 'approved'/);
});

test("★ approve / reject / delete are admin-only, checked before any action", () => {
  const route = read("src/app/api/admin/photos/route.ts");
  const auth = route.indexOf("isAdminRequest(");
  assert.ok(auth > 0);
  for (const call of ["approveSessionPhoto(id)", "rejectSessionPhoto(id)", "deleteSessionPhoto(id)"]) {
    assert.ok(route.indexOf(call) > auth, `${call} runs after the admin check`);
  }
});

test("the uploader's filename is never stored", () => {
  const db = read("src/lib/db.ts");
  const ddl = db.match(/CREATE TABLE IF NOT EXISTS session_photos \([\s\S]*?\)\s*\n\s*`/)?.[0] ?? "";
  assert.ok(ddl, "found the session_photos DDL");
  assert.ok(!/name|filename|mime/i.test(ddl), "no column takes anything the uploader named");
});

test("the consent line is there in both languages", () => {
  const content = read("src/lib/content.ts");
  assert.match(content, /照片里认得出来的人都同意放到网上/);
  assert.match(content, /Everyone recognisable in these photos agreed to them being posted/);
});

// ── The real SQL, when there is a database ─────────────────────────────

/**
 *   DATABASE_URL=postgresql://... npm test
 *
 * Runs only against a throwaway database: it creates the schema and writes and
 * deletes its own rows.
 */
test(
  "★ live: a pending photo is invisible until approved, and gone once rejected",
  { skip: process.env.DATABASE_URL ? false : "no DATABASE_URL — skipping the live check" },
  async () => {
    const db = await import("../src/lib/db.ts");
    const session = "2026-10-01";

    try {
      const before = (await db.listApprovedSessionPhotos(session)).length;
      assert.equal(await db.saveSessionPhotos(session, [cleanJpeg(jpeg())!]), 1);

      const queued = (await db.listPhotosForReview()).find((row) => row.status === "pending" && row.session === session);
      assert.ok(queued, "the upload is in the review queue");
      assert.ok((await db.countPendingPhotos()) >= 1);

      assert.equal((await db.listApprovedSessionPhotos(session)).length, before, "not on the public list yet");
      assert.equal((await servePhoto(queued.id, false, db.getSessionPhoto)).status, 404, "not served publicly");
      assert.equal((await servePhoto(queued.id, true, db.getSessionPhoto)).status, 200, "the organiser sees it");

      await db.approveSessionPhoto(queued.id);
      const listed = await db.listApprovedSessionPhotos(session);
      assert.ok(listed.some((row) => row.id === queued.id), "approved: on the public list");
      assert.equal((await servePhoto(queued.id, false, db.getSessionPhoto)).status, 200, "approved: served publicly");

      await db.rejectSessionPhoto(queued.id);
      assert.ok(!(await db.listApprovedSessionPhotos(session)).some((row) => row.id === queued.id));
      assert.equal((await servePhoto(queued.id, true, db.getSessionPhoto)).status, 404, "rejected: bytes gone");

      // Approving never brings a rejected photo back.
      await db.approveSessionPhoto(queued.id);
      assert.equal((await db.getSessionPhoto(queued.id))?.status, "rejected");

      await db.deleteSessionPhoto(queued.id);
      assert.equal(await db.getSessionPhoto(queued.id), null);
    } finally {
      await db.getPool().end();
    }
  },
);
