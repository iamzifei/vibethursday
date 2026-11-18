import { NextResponse } from "next/server";
import { BOT_CHECK, BOT_SOURCE, botAuthFailure, botSecret, chooseBotSession, parseBotSignup } from "@/lib/bot-signup";
import { admission, capFor, sameSignupName } from "@/lib/capacity";
import {
  canJoinOnlineTuesday,
  findSignupByContact,
  getMySignup,
  getOrCreateSessionFee,
  isTuesdayFree,
  saveBotSignup,
  saveSignupWithResult,
  sessionHeadcount,
  setWechatName,
} from "@/lib/db";
import { bodyTooLarge, boundedRequest, checkRateLimit, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { bookableSessions, nextThursdays, upcomingBookableSpecialSessions } from "@/lib/sessions";
import { HOLD_MINUTES, stripeEnabled } from "@/lib/stripe-pay";
import { feeToPay, newFeeRef } from "@/lib/tuesday-fee";

/** The bot sends a handful of short fields; anything bigger is not from it. */
const MAX_BODY = 4 * 1024;

/**
 * Sign-ups the bot may make per hour, all of them together (one bot, one
 * group). Its own bucket: the signup form's six per address would stop the
 * bot after six people, since every request comes from the same machine.
 */
const BOT_PER_HOUR = 60;

/** Requests per hour per address before the signature is even checked. */
const AUTH_PER_HOUR = 120;

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Sign-ups from the WeChat group bot (2026-11-18). See `bot-signup.ts` for
 * who calls this and the rules; `.env.example` (BOT_SIGNUP_SECRET) for how a request is signed.
 *
 * Off (404) unless BOT_SIGNUP_SECRET is set. Answers a status the bot turns
 * into its own sentence:
 *   booked · waitlisted · already · no_tuesday · members_only · closed
 *   · name_mismatch (a paid session, and the name does not match the one on
 *     file for that email or WeChat ID: not booked, so nobody holds a paid
 *     place without a payment reference)
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

  // The raw text, not `json()`: the signature is over the exact bytes sent.
  const raw = await request.text();
  const denied = botAuthFailure(request, secret, raw);
  if (denied) return denied;

  const rate = checkRateLimit("bot-signup", BOT_PER_HOUR);
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

  const choice = chooseBotSession(want, {
    thursdays: nextThursdays(1),
    specials: upcomingBookableSpecialSessions(),
    bookable: bookableSessions(12),
  });
  if (!choice.ok) return NextResponse.json({ ok: false, status: choice.status }, { headers: noStore });

  const chosen = choice.session;
  const date = chosen.date;
  const session = { date, kind: chosen.kind, online: chosen.online, fee: chosen.fee };

  try {
    const origin = await requestOrigin();
    const hasContact = Boolean(email || wechat);
    const known = hasContact ? await findSignupByContact(name, email, wechat) : null;
    // The name agrees with the row on file: the signup form's bar for acting
    // on someone's row (`profileUpdated` there). Typing another person's
    // WeChat ID must not reveal whether they are a member or get a paid place.
    const nameAgrees = known !== null && sameSignupName(name, known.name);

    // An online Tuesday for 共创会员 and the 导师团 only: never booked on a
    // display name, which proves nothing about membership. With a real WeChat
    // ID or email the same check as everywhere else decides, on the person's
    // own row only.
    if (chosen.membersOnly) {
      const entitled = known !== null && nameAgrees && (await canJoinOnlineTuesday(known.id, date));
      if (!entitled) {
        return NextResponse.json({ ok: false, status: "members_only", session, joinUrl: `${origin}/join` }, { headers: noStore });
      }
    }

    if (chosen.fee !== null && known !== null && !nameAgrees) {
      return NextResponse.json({ ok: false, status: "name_mismatch", session }, { headers: noStore });
    }

    // Full puts them on the waitlist, never refuses (capacity.ts). Soft, like
    // the signup form: a counting race costs at most one place over.
    const cap = capFor(date);
    const { count, alreadyIn } = await sessionHeadcount(date, email, wechat);
    const waitlisted = admission(count, alreadyIn, cap) === "waitlist";

    let signupId: string;
    let already: "booked" | "waitlisted" | null = null;
    // Whether this is the person's own row, the gate the signup form puts on
    // the fee reference and the waitlist place (`profileUpdated` there).
    let own = true;

    if (hasContact) {
      // The identity path of /api/signup: deduped by email or WeChat ID.
      const mine = known ? await getMySignup(known.id) : null;
      const held = !mine
        ? null
        : mine.sessions.includes(date)
          ? "booked"
          : mine.waitlist.some((entry) => entry.session === date)
            ? "waitlisted"
            : null;
      // Waiting and there is room now: saved again below, which moves them in.
      if (mine && held && !(held === "waitlisted" && !waitlisted)) {
        signupId = mine.id;
        already = held;
        own = nameAgrees;
      } else {
        const saved = await saveSignupWithResult({
          name,
          email,
          wechat,
          building: null,
          demoIntent: null,
          topic: null,
          firstSession: date,
          // Someone already on file keeps where they first came from.
          source: known ? null : BOT_SOURCE,
          availability: [],
          aiModels: [],
          aiSpend: null,
          purpose: null,
          lang: "zh",
          botCheck: BOT_CHECK,
          waitlisted,
        });
        signupId = saved.id;
        own = saved.profileUpdated;
        if (own) await setWechatName(signupId, wechatName);
      }
    } else {
      // Display name only: deduped by (display name, session) among bot rows.
      const saved = await saveBotSignup({ name, wechatName, session: date, waitlisted, botCheck: BOT_CHECK });
      signupId = saved.id;
      already = saved.already;
      // Someone's signup with contact details, found by display name only:
      // just "already", never their place, fee or membership.
      own = !saved.contactRow;
    }

    const waiting = already ? already === "waitlisted" : waitlisted;
    const status = already ? "already" : waiting ? "waitlisted" : "booked";
    const body: Record<string, unknown> = { ok: true, status, session };
    if (already && own) body.waitlisted = waiting;

    if (waiting && own) {
      const mine = await getMySignup(signupId);
      const place = mine?.waitlist.find((entry) => entry.session === date)?.position;
      if (place !== undefined) body.position = place;
    }

    // A paid session, created exactly as /api/signup does: members and the
    // 导师团/volunteers come free; anyone else gets a reference to pay against,
    // the same one if they ask again, held for a while when card payment is on.
    if (chosen.fee !== null && !waiting && own) {
      if (await isTuesdayFree(signupId)) {
        body.member = true;
      } else {
        const payHold = stripeEnabled() ? HOLD_MINUTES : null;
        const fee = await getOrCreateSessionFee(date, signupId, newFeeRef(), payHold);
        if (fee.status === "pending") {
          body.payUrl = `${origin}/tuesday/pay?ref=${encodeURIComponent(fee.ref)}`;
          body.amount = feeToPay(chosen.fee);
          if (payHold !== null) body.holdMinutes = payHold;
        } else {
          body.paid = true;
        }
      }
    }

    body.spotsLeft = Math.max(0, cap - (await sessionHeadcount(date, null, null)).count);
    return NextResponse.json(body, { headers: noStore });
  } catch (error) {
    console.error("[bot-signup] failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: noStore });
  }
}
