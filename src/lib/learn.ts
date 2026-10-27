// Relative imports only: the tests load this through Node's type stripper.
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Recorded lessons (/learn, 2026-10-28): the rules, with no database and no
 * network, so every one of them is tested on its own.
 *
 * Who may watch is a list the organiser keeps, not a purchase. Anyone can sign
 * in — with WeChat, or with a code sent to their email — and is then either on
 * the list or waiting for the organiser to let them in.
 *
 * A "learner" is deliberately separate from a Thursday signup: people on the
 * list may never have been to a Thursday, and many are in China.
 */

/* ── Who may do what ─────────────────────────────────────────────────── */

export const LEARNER_STATUSES = ["pending", "approved", "revoked"] as const;
export type LearnerStatus = (typeof LEARNER_STATUSES)[number];

export function isLearnerStatus(value: unknown): value is LearnerStatus {
  return typeof value === "string" && (LEARNER_STATUSES as readonly string[]).includes(value);
}

/**
 * The one access rule. Watching, downloading a handout, reading and writing
 * comments: all of it needs an approved learner. Pending and revoked people
 * see only a page that says so; nobody signed in sees only the sign-in page.
 */
export function canAccessLessons(learner: { status: LearnerStatus } | null | undefined): boolean {
  return learner?.status === "approved";
}

/* ── The learner cookie ──────────────────────────────────────────────── */

export const LEARN_COOKIE = "vt_learn";

/** Six months, like the member card cookie. */
export const LEARN_TTL_SECONDS = 180 * 24 * 60 * 60;

/** Same key as every other signed cookie here, under its own label. */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;
  if (!key) throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; lesson sign-in is disabled");
  return key;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(`vt.learn.v1:${payload}`).digest("base64url");
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** `<learnerId>.<expiry seconds>.<signature>` */
export function learnerToken(learnerId: string, now: number = Date.now(), key: string = secret()): string {
  const payload = `${learnerId}.${Math.floor(now / 1000) + LEARN_TTL_SECONDS}`;
  return `${payload}.${sign(payload, key)}`;
}

/** The learner id a cookie vouches for, or null if it is forged, malformed or expired. */
export function readLearnerToken(token: string | null | undefined, now: number = Date.now(), key: string = secret()): string | null {
  if (!token || token.length > 200) return null;
  const match = /^(\d{1,18})\.(\d{9,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const [, id, expiry, signature] = match;
  if (!sameString(sign(`${id}.${expiry}`, key), signature)) return null;
  return Number(expiry) * 1000 > now ? id : null;
}

/* ── Email codes ─────────────────────────────────────────────────────── */

/** Ten minutes to type it in. */
export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

/** Wrong guesses allowed on one code before it is dead. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

/** One code per address per minute, so the send button cannot be used to flood an inbox. */
export const EMAIL_CODE_RESEND_MS = 60 * 1000;

/** Six digits, leading zeros kept. */
export function newEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * What is stored instead of the code. Keyed to the address, so a stolen table
 * row cannot be replayed for another email, and keyed to the server secret, so
 * the million possible codes cannot be hashed offline.
 */
export function hashEmailCode(email: string, code: string, key: string = secret()): string {
  return createHmac("sha256", key).update(`vt.learn.code.v1:${email}:${code}`).digest("base64url");
}

export function emailCodeMatches(email: string, code: string, storedHash: string, key: string = secret()): boolean {
  return sameString(hashEmailCode(email, code, key), storedHash);
}

/** Trimmed and lower-cased, or null if it is not plausibly an address. */
export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(email) ? email : null;
}

export function looksLikeEmailCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

/* ── What people type ────────────────────────────────────────────────── */

/** Trimmed text, cut to a length, or null when nothing is left. */
export function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  // Control characters other than line breaks have no business in a comment.
  const text = value.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export const COMMENT_MAX = 2000;
export const NAME_MAX = 40;
export const NOTE_MAX = 200;

/** URL part of a lesson: lower-case letters, digits and single hyphens. */
export function looksLikeLessonSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 60;
}

/** A VOD video id as the console shows it: 32 hex characters. */
export function looksLikeVideoId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
}

/* ── Handouts ────────────────────────────────────────────────────────── */

/** Largest handout the admin page accepts. A lesson's PDF is a few MB. */
export const HANDOUT_MAX_BYTES = 50 * 1024 * 1024;

/** Types a handout may be. Anything else is refused at upload. */
export const HANDOUT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "text/markdown": "md",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/**
 * Where a handout is stored. Random, so the object name says nothing about
 * the lesson or the file, and cannot be guessed from either.
 */
export function handoutKey(lessonId: string, random: string, ext: string): string {
  return `learn/${lessonId}/${random}.${ext}`;
}

/**
 * The name the browser saves a handout as: the title the organiser gave it,
 * minus anything a file system would choke on.
 */
export function downloadName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "handout";
  return `${base}.${ext}`;
}

/** A content hash for an uploaded file, shown in the admin list to spot duplicates. */
export function shortHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

/* ── Time ────────────────────────────────────────────────────────────── */

/** Seconds as h:mm:ss or m:ss, for a lesson's length. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
