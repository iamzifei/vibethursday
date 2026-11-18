// Relative imports only: the tests load this through Node's type stripper.
import { createHmac, timingSafeEqual } from "node:crypto";
import { isOpenTrialSession, resolveSessionChoice, type SpecialSession } from "./sessions.ts";
import { TUESDAY_ONLINE, TUESDAY_VENUE } from "./tuesday-venue.ts";
import { THURSDAY_TIME_ZH, VENUE, VENUE_MAPS_URL, VENUE_SHORT_ADDRESS } from "./venue.ts";
import { looksLikeWechatId } from "./wechat-id.ts";

/**
 * Signing up from the WeChat group (2026-11-18).
 *
 * A bot in the group chat books people in when they ask there. It runs on the
 * organiser's own machine and calls `/api/bot/signup` server to server: no
 * browser, so no Turnstile and no cookies. What it knows about a person is
 * their display name in the group, sometimes their real WeChat ID, sometimes
 * an email they typed.
 *
 * Everything here is pure (no database, no clock of its own) so the rules are
 * tested directly. The route in `src/app/api/bot/signup/route.ts` wires them up.
 */

/**
 * `bot_check` and `source` for a row the bot wrote. Its own value, so the
 * "many signups without a bot check" alert on /admin (`UNVERIFIED_ALERT`)
 * does not count the group's sign-ups as a script filling the room.
 */
export const BOT_CHECK = "wechat-bot";
export const BOT_SOURCE = "wechat-bot";

/** How far the bot's clock may be from ours before a signed request is refused. */
export const MAX_SKEW_SECONDS = 300;

/**
 * Shortest secret accepted. A shorter one leaves the endpoint off rather than
 * guessable: `openssl rand -hex 32` gives 64 characters.
 */
export const MIN_SECRET_LENGTH = 32;

/** The shared secret from the environment, or null when the endpoint is off. */
export function botSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.BOT_SIGNUP_SECRET?.trim() ?? "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/**
 * What is signed: timestamp, method, path and the raw body, one per line.
 * The method and path are in it so a signature for one endpoint cannot be
 * replayed against the other.
 */
export function signingPayload(timestamp: string, method: string, path: string, body: string): string {
  return `${timestamp}\n${method.toUpperCase()}\n${path}\n${body}`;
}

/** The signature the bot sends in `X-Bot-Signature`: hex HMAC-SHA256 of `signingPayload`. */
export function signBotRequest(secret: string, timestamp: string, method: string, path: string, body: string): string {
  return createHmac("sha256", secret).update(signingPayload(timestamp, method, path, body)).digest("hex");
}

export type AuthResult = "ok" | "missing" | "stale" | "bad";

/**
 * Checks a request's `X-Bot-Timestamp` (Unix seconds) and `X-Bot-Signature`.
 *
 * Constant-time compare on the digests, and a timestamp within
 * `MAX_SKEW_SECONDS` either way, so a captured request cannot be replayed
 * later. Within that window a replay only repeats a sign-up, which is
 * idempotent (`botAlready`).
 */
export function verifyBotRequest(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  method: string;
  path: string;
  body: string;
  nowSeconds: number;
}): AuthResult {
  const { secret, timestamp, signature } = input;
  if (!timestamp || !signature) return "missing";
  if (!/^\d{1,12}$/.test(timestamp)) return "bad";
  if (Math.abs(input.nowSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return "stale";
  if (!/^[0-9a-f]{64}$/i.test(signature)) return "bad";
  const expected = Buffer.from(signBotRequest(secret, timestamp, input.method, input.path, input.body), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected) ? "ok" : "bad";
}

/** Trims, drops empties and caps length, like the signup route's `clean`. */
function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export type BotSignupRequest = {
  /** The person's display name in the group. Never stored as a WeChat ID. */
  wechatName: string;
  /** The name to sign up under; the display name when none was given. */
  name: string;
  /** A real WeChat ID, only when the bot has one. */
  wechat: string | null;
  email: string | null;
  /** "thursday" (the default), "tuesday", or a YYYY-MM-DD date. */
  want: string;
};

/**
 * Reads the bot's JSON body. A WeChat ID that does not look like one is
 * refused rather than stored: a display name in the `wechat` column would
 * make that person impossible to add to a group or find again.
 */
export function parseBotSignup(body: unknown): { ok: true; value: BotSignupRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_json" };
  const raw = body as Record<string, unknown>;
  const wechatName = clean(raw.wechatName, 100);
  if (!wechatName) return { ok: false, error: "missing_wechat_name" };
  const name = clean(raw.name, 100) ?? wechatName;
  const wechat = clean(raw.wechat, 100);
  if (wechat && !looksLikeWechatId(wechat)) return { ok: false, error: "invalid_wechat" };
  const email = clean(raw.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "invalid_email" };
  const want = clean(raw.session, 10) ?? "thursday";
  if (want !== "thursday" && want !== "tuesday" && !/^\d{4}-\d{2}-\d{2}$/.test(want)) {
    return { ok: false, error: "invalid_session" };
  }
  return { ok: true, value: { wechatName, name, wechat: wechat ? wechat.trim() : null, email, want } };
}

export type ChosenSession = {
  date: string;
  kind: "thursday" | "tuesday";
  online: boolean;
  /** Fee before GST, or null when free. */
  fee: number | null;
  /** An online Tuesday only 共创会员 and the 导师团 may join (not an open trial). */
  membersOnly: boolean;
};

/**
 * When and where a session is, as the bot says it in the group (2026-11-18):
 * added to every session object the bot API returns, so a reply after a
 * sign-up can carry the time and place.
 *
 * Read from the same constants the site's pages are built from (`venue.ts`
 * for Thursday, `tuesday-venue.ts` for Tuesday), never typed again here.
 *
 *   Thursday          the home page's time card and venue, with its map link
 *   online Tuesday    the hours, "线上", and where the Zoom link comes from
 *   Tuesday in a room the hours and "Chatswood" only: the street address is
 *                     for people who have paid (tuesday-venue.ts), and the
 *                     bot's reply is read by the whole group
 */
export type BotWhereWhen = { time: string; place: string; placeUrl?: string };

export function botWhereWhen(session: { kind: "thursday" | "tuesday"; online: boolean }): BotWhereWhen {
  if (session.kind === "thursday") {
    return { time: THURSDAY_TIME_ZH, place: `${VENUE.name} · ${VENUE_SHORT_ADDRESS}`, placeUrl: VENUE_MAPS_URL };
  }
  if (session.online) {
    return {
      time: `${TUESDAY_ONLINE.start}–${TUESDAY_ONLINE.end} 线上 · ${TUESDAY_ONLINE.zh.linkFrom}`,
      place: TUESDAY_ONLINE.zh.where,
    };
  }
  return { time: `${TUESDAY_VENUE.start}–${TUESDAY_VENUE.end}`, place: VENUE.addressLocality };
}

/** A session as the bot API returns it: what it is, and when and where. */
export function botSessionView(session: { date: string; kind: "thursday" | "tuesday"; online: boolean; fee: number | null }) {
  return { ...session, ...botWhereWhen(session) };
}

/**
 * Which session a request means, from what is on offer right now.
 *
 * `thursdays` is `nextThursdays()`, `specials` is
 * `upcomingBookableSpecialSessions()`, `bookable` is `bookableSessions()`: all
 * passed in, so this is tested on any day without a clock.
 */
export function chooseBotSession(
  want: string,
  offer: { thursdays: readonly string[]; specials: readonly SpecialSession[]; bookable: readonly string[] },
): { ok: true; session: ChosenSession } | { ok: false; status: "no_tuesday" | "closed" } {
  let date: string | null;
  if (want === "thursday") {
    date = offer.thursdays[0] ?? null;
    if (!date) return { ok: false, status: "closed" };
  } else if (want === "tuesday") {
    date = offer.specials.find((session) => session.kind === "tuesday")?.date ?? null;
    if (!date) return { ok: false, status: "no_tuesday" };
  } else {
    // A date someone named: only if the signup form would offer it too.
    const { firstSession } = resolveSessionChoice(want, offer.bookable);
    if (!firstSession) return { ok: false, status: "closed" };
    date = firstSession;
  }
  const special = offer.specials.find((session) => session.date === date);
  const online = special?.online === true;
  return {
    ok: true,
    session: {
      date,
      kind: special ? "tuesday" : "thursday",
      online,
      fee: special?.fee ?? null,
      membersOnly: online && !isOpenTrialSession(date),
    },
  };
}

/**
 * The key two bot sign-ups are "the same person" by when all the bot has is a
 * display name: width, case and every kind of space ignored. Two people with
 * exactly the same display name in one session are taken as one (accepted,
 * 2026-11-18); the bot tells the second one they are already in and
 * suggests leaving contact details in a private chat. The second one is also
 * handed the first one's pay link on a paid session: the display name is
 * already public in the group, so that is the same accepted cost.
 */
export function botNameKey(wechatName: string): string {
  return wechatName.normalize("NFKC").toLowerCase().replace(/[\s　]+/g, "");
}

/**
 * The row with this display name, preferring one that already holds
 * `session` (so the answer is "already"). Callers pass the set of rows they
 * may match: bot-only rows to write to, or rows with contact details to
 * answer "already" from (see `saveBotSignup`).
 */
export function findBotRow<T extends { wechat_name: string | null; sessions: readonly string[]; waitlist: readonly string[] }>(
  rows: readonly T[],
  wechatName: string,
  session: string,
): T | undefined {
  const key = botNameKey(wechatName);
  if (!key) return undefined;
  const same = rows.filter((row) => row.wechat_name !== null && botNameKey(row.wechat_name) === key);
  return same.find((row) => botAlready(row, session) !== null) ?? same[0];
}

/**
 * Whether this person already holds the session, booked or waiting. A repeat
 * of the same (display name, session) changes nothing and answers "already",
 * so the bot can retry a request safely.
 */
export function botAlready(row: { sessions: readonly string[]; waitlist: readonly string[] } | undefined, session: string): "booked" | "waitlisted" | null {
  if (!row) return null;
  if (row.waitlist.includes(session)) return "waitlisted";
  return row.sessions.includes(session) ? "booked" : null;
}

/**
 * The response for a request that fails `verifyBotRequest`, or null when it
 * passes. The signed path is the request's own, so a signature made for
 * `/api/bot/sessions` does not open `/api/bot/signup`.
 */
export function botAuthFailure(request: Request, secret: string, body: string, nowSeconds = Math.floor(Date.now() / 1000)): Response | null {
  const result = verifyBotRequest({
    secret,
    timestamp: request.headers.get("x-bot-timestamp"),
    signature: request.headers.get("x-bot-signature"),
    method: request.method,
    path: new URL(request.url).pathname,
    body,
    nowSeconds,
  });
  if (result === "ok") return null;
  return Response.json({ ok: false, error: result === "stale" ? "stale_timestamp" : "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

/* ── Cancelling (2026-11-18) ─────────────────────────────────────────────
 * The bot may cancel a sign-up, only ever the caller's own. It never books or
 * cancels for anyone but the person speaking. */

/**
 * Whether a request carrying only a display name may cancel on this row: only
 * a row the bot wrote that still has no contact details. A display name alone
 * must never cancel a normal signup made with an email or WeChat ID (or one
 * merged into such a signup), since anyone can take any display name.
 */
export function cancellableByName(row: { source: string | null; has_contact: boolean }): boolean {
  return row.source === BOT_SOURCE && !row.has_contact;
}

/**
 * Which held session a cancel means: "thursday" (the default) is the next
 * Thursday they hold, "tuesday" the next special session they hold, a date
 * that date. Booked or waiting both count as held. Never a past date (the
 * same rule as /my, `canChangeSession`). Null when they hold no such session.
 */
export function pickCancelDate(want: string, held: readonly string[], today: string, isSpecial: (date: string) => boolean): string | null {
  const upcoming = [...new Set(held)].filter((date) => date >= today).sort();
  if (want === "thursday") return upcoming.find((date) => !isSpecial(date)) ?? null;
  if (want === "tuesday") return upcoming.find((date) => isSpecial(date)) ?? null;
  return upcoming.includes(want) ? want : null;
}

/**
 * Whether a session's fee stops the bot cancelling it: paid, or the person
 * said they had transferred (the money may already be on its way). Refunds
 * are handled by hand, so these go to the organiser instead.
 */
export function feeBlocksCancel(fee: { status: string; claimed: boolean } | null): boolean {
  return fee !== null && (fee.status === "paid" || (fee.status === "pending" && fee.claimed));
}
