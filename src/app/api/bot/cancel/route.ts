import { NextResponse } from "next/server";
import { botAuthFailure, botSecret, cancellableByName, feeBlocksCancel, findBotRow, parseBotSignup, pickCancelDate } from "@/lib/bot-signup";
import { exactSignupName } from "@/lib/capacity";
import { cancelSession, findSignupByContact, getMySignup, listNamedSignups, sessionFeeFor } from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, tooMany } from "@/lib/rate-limit";
import { isSpecialSession, SPECIAL_SESSIONS, sydneyToday } from "@/lib/sessions";

const MAX_BODY = 4 * 1024;

/** Cancels per hour, all of them together; its own bucket, like sign-ups. */
const BOT_PER_HOUR = 60;

/** Requests per hour per address before the signature is even checked. */
const AUTH_PER_HOUR = 120;

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * The WeChat group bot cancelling the caller's own sign-up (2026-11-18).
 * Signed and switched on exactly like `/api/bot/signup` (404 without
 * BOT_SIGNUP_SECRET). The body takes the same identity fields: `wechatName`,
 * optional `name`, `wechat`, `email`, and an optional `session` ("thursday",
 * the default: the next Thursday they hold; "tuesday"; or a date).
 *
 * Who is cancelled is matched the way the bot's sign-up dedupes, with one
 * difference: a display name alone only ever reaches a row the bot wrote with
 * no contact details (`cancellableByName`). With an email or WeChat ID, only
 * the caller's own row (the whole name agrees). Anything else is
 * `not_found`, with nothing changed.
 *
 * The cancel itself is the site's own (`cancelSession`, as /my uses it): the
 * place is freed, and nobody is moved up from the waitlist automatically.
 * A paid session (or one they said they transferred for) is not cancelled:
 * refunds are handled by hand, so the answer is `paid_contact_organiser`.
 */
export async function POST(request: Request) {
  const secret = botSecret();
  if (!secret) return new Response("Not found", { status: 404 });

  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const limited = tooMany(request, "bot-auth", AUTH_PER_HOUR);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;

  const raw = await request.text();
  const denied = botAuthFailure(request, secret, raw);
  if (denied) return denied;

  const rate = checkRateLimit("bot-cancel", BOT_PER_HOUR);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400, headers: noStore });
  }
  const parsed = parseBotSignup(payload);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400, headers: noStore });
  const { wechatName, name, wechat, email, want } = parsed.value;

  const notFound = NextResponse.json({ ok: false, status: "not_found", session: null }, { headers: noStore });

  try {
    // The caller's own row and what it holds, or nothing.
    let signupId: string | null = null;
    let held: string[] = [];
    if (email || wechat) {
      const known = await findSignupByContact(name, email, wechat);
      // The whole name, not a part of it (`exactSignupName`): cancelling is
      // destructive, so it takes the stricter bar the site uses for its
      // 60-day "remembers you" pass.
      if (known && exactSignupName(name, known.name)) {
        const mine = await getMySignup(known.id);
        if (mine) {
          signupId = mine.id;
          held = [...mine.sessions, ...mine.waitlist.map((entry) => entry.session)];
        }
      }
    } else {
      const row = findBotRow((await listNamedSignups()).filter(cancellableByName), wechatName, want);
      if (row) {
        signupId = row.id;
        held = [...row.sessions, ...row.waitlist];
      }
    }
    if (!signupId) return notFound;

    const today = sydneyToday().toISOString().slice(0, 10);
    const date = pickCancelDate(want, held, today, isSpecialSession);
    if (!date) return notFound;

    const special = SPECIAL_SESSIONS.find((item) => item.date === date);
    const session = { date, kind: special ? "tuesday" : "thursday", online: special?.online === true, fee: special?.fee ?? null };

    if (feeBlocksCancel(await sessionFeeFor(signupId, date))) {
      return NextResponse.json({ ok: false, status: "paid_contact_organiser", session }, { headers: noStore });
    }

    await cancelSession(signupId, date);
    return NextResponse.json({ ok: true, status: "cancelled", session }, { headers: noStore });
  } catch (error) {
    console.error("[bot-cancel] failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: noStore });
  }
}
