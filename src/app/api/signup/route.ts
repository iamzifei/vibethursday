import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { bindOpenid, getMySignup, getSignupProfile, publishCardForSignup, saveSignupWithResult, sessionHeadcount, setBizFocus } from "@/lib/db";
import { bookableSessions, sydneyToday, upcomingSpecialSessions } from "@/lib/sessions";
import { admission, capFor } from "@/lib/capacity";
import { readRememberToken, REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { parseBizFocus, parseSignupProfile } from "@/lib/signup-profile";
import { verifyTurnstile } from "@/lib/turnstile";
import { readOpenidToken } from "@/lib/wechat-auth";
import { WX_OPENID_COOKIE } from "@/lib/wechat-gate";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 64 * 1024;

// This route writes to Postgres, so it must never be prerendered or cached.
export const dynamic = "force-dynamic";

const DEMO_INTENTS = new Set(["yes", "maybe", "listen"]);

/** Other times someone could make. Kept in step with `copy.fields.availabilityOptions`. */
const AVAILABILITY = new Set(["weekday_evening", "weekend_day", "weekend_evening"]);

/**
 * Which models someone uses. Kept in step with `copy.fields.aiModelGroups`.
 *
 * The `intl_` / `cn_` prefix is load-bearing: the whole reason this question is
 * asked is the split between the two, and encoding it in the value means that
 * count is a prefix match rather than a second list of "which model is which
 * side" that could drift out of step with this one.
 */
const AI_MODELS = new Set([
  "intl_openai",
  "intl_claude",
  "intl_gemini",
  "intl_other",
  "cn_deepseek",
  "cn_qwen",
  "cn_kimi",
  "cn_doubao",
  "cn_other",
]);

/**
 * Why someone is coming this time. Kept in step with `copy.fields.purposeOptions`,
 * plus "other": no longer offered (2026-10-05, the routed form), but still
 * accepted from a page opened before that, and still on older rows.
 *
 * Required on the form, but never required here: a page opened before the
 * question existed must still be able to sign someone up, and a lost signup
 * costs more than one unanswered question.
 */
const PURPOSES = new Set(["biz", "product", "tech", "learn", "other"]);

/** Monthly AI spend band. Kept in step with `copy.fields.aiSpendOptions`. */
const AI_SPEND = new Set(["free", "lt_50", "50_200", "200_1000", "gt_1000"]);

/** Trims, drops empties, and caps length so one paste cannot fill a column. */
function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Deliberately loose email check. The only job here is to catch typos like a
 * missing @ before the address reaches the database; anything stricter starts
 * rejecting addresses that are actually valid.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  // Refused before the body is read (2026-09-28 review: parsing first let one
  // oversized POST balloon the process). See `bodyTooLarge`.
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  // JSON only. The form always sends it; a plain HTML form on another site
  // cannot (it can only send urlencoded, multipart or text/plain), so this
  // stops a third-party page from submitting signups from its visitors'
  // browsers — and their addresses — without a preflight (2026-09-28 review).
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  // Honeypot: a field hidden from humans that bots fill in anyway. Answer 200
  // so the bot records a success and does not retry with a different shape.
  if (clean(body.company, 100)) {
    return NextResponse.json({ ok: true });
  }

  // The proxy appends the real address last; see `callerIp` in rate-limit.ts.
  const ip = clientIp(request);
  const remoteIp = ip === "unknown" ? null : ip;

  // Rate limit first — it is the defence that still works when the challenge
  // does not, and it costs nothing to evaluate.
  const rate = checkRateLimit(remoteIp ?? "unknown");

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  // Advisory: only a token that is present AND invalid blocks the submission.
  // A missing token means the challenge never completed in that browser, which
  // must not cost someone their signup.
  const { verdict } = await verifyTurnstile(clean(body.turnstileToken, 2048), remoteIp);

  if (verdict === "rejected") {
    return NextResponse.json({ error: "failed_bot_check" }, { status: 403 });
  }

  // A visitor the form knew only from the remember cookie (WeChat login, on a
  // phone that never signed up here) sends no contact details: they never
  // reached the browser (`known-profile.ts`). Read them from the signup the
  // cookie names instead. A missing or forged cookie just leaves them empty,
  // and the check below turns that away like any incomplete form.
  let fromCookie: { name: string; email: string; wechat: string } | null = null;
  if (body.fromCookie === true) {
    try {
      const id = readRememberToken((await cookies()).get(REMEMBER_COOKIE)?.value);
      fromCookie = id ? await getSignupProfile(id) : null;
    } catch (error) {
      console.error("[signup] could not read the remembered signup", error);
    }
  }

  const name = fromCookie ? fromCookie.name : clean(body.name, 100);
  const email = fromCookie ? fromCookie.email || null : clean(body.email, 200);
  const wechat = fromCookie ? fromCookie.wechat || null : clean(body.wechat, 100);
  const topic = clean(body.topic, 2000);

  // Which of the two is mandatory differs per language, and `lang` comes from
  // the client so it cannot be trusted here. The invariant the server actually
  // needs is weaker and unspoofable: a name, and at least one way to reach them.
  if (!name || (!email && !wechat)) {
    return NextResponse.json({ error: "missing_required" }, { status: 400 });
  }

  if (email && !looksLikeEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const demoIntentRaw = clean(body.demoIntent, 20);
  const demoIntent = demoIntentRaw && DEMO_INTENTS.has(demoIntentRaw) ? demoIntentRaw : null;

  // Only accept a session date the form actually offered. Without this the
  // column would happily take any string a crafted request sent.
  // `bookableSessions`, not `nextThursdays`: a Build Tuesday date would
  // otherwise be stored as "no session" while the person was told they were in.
  const sessionRaw = clean(body.firstSession, 10);
  const firstSession = sessionRaw && bookableSessions(12).includes(sessionRaw) ? sessionRaw : null;

  // Whitelisted the same way the session date is: this column is read back as
  // counts to decide whether a second session is worth running, and a free
  // text array would make those counts meaningless.
  const availability = Array.isArray(body.availability)
    ? [...new Set(body.availability.filter((slot: unknown): slot is string =>
        typeof slot === "string" && AVAILABILITY.has(slot),
      ))]
    : [];

  // Whitelisted for the same reason availability is: these columns are only
  // ever read back as counts, and one free-text value would make the count of
  // whatever it lands next to a number nobody can trust.
  const aiModels = Array.isArray(body.aiModels)
    ? [...new Set(body.aiModels.filter((model: unknown): model is string =>
        typeof model === "string" && AI_MODELS.has(model),
      ))]
    : [];

  const purposeRaw = clean(body.purpose, 20);
  const purpose = purposeRaw && PURPOSES.has(purposeRaw) ? purposeRaw : null;

  const aiSpendRaw = clean(body.aiSpend, 20);
  const aiSpend = aiSpendRaw && AI_SPEND.has(aiSpendRaw) ? aiSpendRaw : null;

  // "How familiar with AI" and "which industry". Optional, and anything missing
  // or unrecognised becomes null rather than an error — see signup-profile.ts.
  const { aiLevel, industry } = parseSignupProfile(body);

  // Strict `=== true`: anything else, including the string "false" a hand-rolled
  // client might send, means the box was not ticked. Publishing someone's card
  // is not a thing to do on a truthy value.
  const publishCard = body.publishCard === true;

  // A full session takes the signup onto its waitlist rather than refusing it
  // (`capacity.ts`). Someone already booked keeps their place. Walk-ins at the
  // door never come through here, so the cap never turns anybody away there.
  let waitlisted = false;

  if (firstSession) {
    try {
      const { count, alreadyIn } = await sessionHeadcount(firstSession, email, wechat);
      waitlisted = admission(count, alreadyIn, capFor(firstSession)) === "waitlist";
    } catch (error) {
      // Counting failed: book them. A signup lost to a counting error is worse
      // than one person over a soft cap.
      console.error("[signup] could not count the session; booking anyway", error);
    }
  }

  let signupId: string;
  let profileUpdated = true;
  let exactName = false;

  try {
    ({ id: signupId, profileUpdated, exactName } = await saveSignupWithResult({
      name,
      email,
      wechat,
      topic,
      building: clean(body.building, 1000),
      demoIntent,
      firstSession,
      availability,
      aiModels,
      aiSpend,
      purpose,
      aiLevel,
      industry,
      source: clean(body.source, 200),
      lang: clean(body.lang, 5) ?? "zh",
      botCheck: verdict,
      waitlisted,
    }));
  } catch (error) {
    console.error("[signup] failed to save", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Deliberately after the signup is safely stored, and deliberately not
  // allowed to fail the request: the signup is the thing that must not be lost.
  // A card that did not get published is recoverable by the person at /claim;
  // a signup that 500ed is a headcount the venue booking never hears about.
  // Never on somebody else's row: a name that did not match is not allowed to
  // put that person's card on the wall (see `saveSignupWithResult`).
  // The business-focus answer, saved like the profile fields: only an answer,
  // only on the person's own row, never fatal to the signup.
  const bizFocus = parseBizFocus(body.bizFocus);
  if (bizFocus.length > 0 && profileUpdated) {
    try {
      await setBizFocus(signupId, bizFocus);
    } catch (error) {
      console.error("[signup] saved, but the business focus did not", error);
    }
  }

  if (publishCard && profileUpdated) {
    try {
      await publishCardForSignup(signupId);
    } catch (error) {
      console.error("[signup] saved, but publishing the member card failed", error);
    }
  }

  // No member cookie is issued here, unlike /claim. That route rate-limits the
  // same soft name-plus-contact match to six attempts an hour precisely because
  // it hands out edit access to a card; handing the same access out from an
  // open signup form would make "sign up as someone whose WeChat ID you know"
  // a way to take over their card. Editing still goes through /claim.
  // Everything this person is now down for, so the confirmation can say "you
  // are down for 1 Oct (waitlist) and 8 Oct" instead of only this week — a
  // second signup that quietly added a Thursday was invisible (2026-09-28).
  // Only when the name matched: this form is open, and typing someone else's
  // WeChat ID must not show you their Thursdays.
  let upcoming: { session: string; waitlisted: boolean }[] | undefined;
  if (profileUpdated) {
    try {
      const mine = await getMySignup(signupId);
      const today = sydneyToday().toISOString().slice(0, 10);
      if (mine) {
        upcoming = [
          ...mine.sessions.map((session) => ({ session, waitlisted: false })),
          ...mine.waitlist.map((entry) => ({ session: entry.session, waitlisted: true })),
        ]
          .filter((entry) => entry.session >= today)
          .sort((a, b) => (a.session < b.session ? -1 : 1));
      }
    } catch (error) {
      console.error("[signup] saved, but could not read back the sessions", error);
    }
  }

  // Waitlisted for a Thursday while a Build Tuesday still has room: say so on
  // the confirmation, with how many places are left. This is the overflow the
  // Tuesday exists to take (2026-10-04). Only a hint — nothing is booked for
  // them; /my moves them in one tap. A failed count just leaves it out.
  let tuesday: { session: string; left: number } | undefined;
  if (waitlisted && firstSession) {
    try {
      for (const special of upcomingSpecialSessions()) {
        if (special.date === firstSession) continue;
        // Matched like the booking itself, so someone already down for the
        // Tuesday is not told to move there.
        const { count, alreadyIn } = await sessionHeadcount(special.date, email, wechat);
        if (alreadyIn) break;
        if (count < special.cap) {
          tuesday = { session: special.date, left: special.cap - count };
          break;
        }
      }
    } catch (error) {
      console.error("[signup] saved, but could not count the Tuesday", error);
    }
  }

  // `remembered`: the cookie below is about to be set, so the confirmation can
  // offer its one-tap question (/api/signup/interest reads only that cookie).
  const remembered = profileUpdated && exactName;
  const response = NextResponse.json({ ok: true, waitlisted, upcoming, tuesday, remembered });

  // "This phone remembers you": the next /my or /go from this browser shows
  // their Thursdays without typing. Behind the same gate as `upcoming` — only
  // when the name matched — or knowing someone's WeChat ID would be enough to
  // take home a pass to their signup.
  // The whole name, not just a part of it (`exactSignupName`): this pass lasts
  // 60 days, so it takes more than a WeChat ID and two letters.
  if (profileUpdated && exactName) {
    try {
      response.cookies.set(REMEMBER_COOKIE, rememberToken(signupId), rememberCookieOptions((await requestOrigin()).startsWith("https://")));
    } catch (error) {
      console.error("[signup] could not set the remember cookie", error);
    }

    // Signed up from inside WeChat, recognised by WeChat but not yet tied to a
    // signup: tie it now, behind the same whole-name gate as the cookie above.
    // From here on this WeChat is recognised on any phone (wechat-auth.ts).
    // Not when the identity itself came from the cookie: that proves nothing
    // new, and binding is reserved for someone who typed their whole name.
    try {
      const openid = fromCookie ? null : readOpenidToken((await cookies()).get(WX_OPENID_COOKIE)?.value);
      if (openid) await bindOpenid(signupId, openid);
    } catch (error) {
      console.error("[signup] could not tie the WeChat login", error);
    }
  }

  return response;
}
