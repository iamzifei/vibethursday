import { NextResponse } from "next/server";
import { AFTER_CHECKIN_PATH, canCheckIn, isSessionDate, verifyCheckinCode } from "@/lib/checkin";
import { LANG_PARAM, resolveLang } from "@/lib/content";
import { checkIn, getOrCreateSessionFee, isTuesdayFree, listRoster, saveSignup, sessionHeadcount } from "@/lib/db";
import { afterCheckin } from "@/lib/checkin-pay";
import { capFor } from "@/lib/capacity";
import { HOLD_MINUTES, stripeEnabled } from "@/lib/stripe-pay";
import { newFeeRef } from "@/lib/tuesday-fee";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { feeFor, sydneyToday } from "@/lib/sessions";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 64 * 1024;

// Writes to Postgres; never prerender or cache.
export const dynamic = "force-dynamic";

/**
 * A room full of phones on one café Wi-Fi is one address. Sized so a big
 * session with a few mis-taps each still fits inside an hour.
 */
const ROOM_TAPS_PER_HOUR = 200;

/** Trims, drops empties, caps length. */
function clean(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Checks someone in to today's session.
 *
 * A plain form post, so the page in the room works on any phone with no
 * script — the one place on this site where "works on every browser" is not
 * a nicety but the difference between a headcount and a guess. Every outcome
 * is a 303 back to /checkin, which shows the result; a 307 would repost the
 * form on reload and a JSON body would need script to read.
 *
 * Two shapes: `signupId` for someone on the roster, or `name` (+ optional
 * building and WeChat ID) for a walk-in, who is saved as a signup for today
 * first so that next week they are on the list like everyone else.
 */
export async function POST(request: Request) {
  // Refused before the body is read (2026-09-28 review: parsing first let one
  // oversized POST balloon the process). See `bodyTooLarge`.
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const form = await request.formData().catch(() => null);

  const session = clean(form?.get("session") ?? null, 10) ?? "";
  const code = clean(form?.get("code") ?? null, 40) ?? "";
  const lang = resolveLang(clean(form?.get("lang") ?? null, 10) ?? undefined);
  const origin = await requestOrigin();

  const back = (extra: Record<string, string>) => {
    const url = new URL("/checkin", origin);
    url.searchParams.set("s", session);
    url.searchParams.set("k", code);
    const param = LANG_PARAM[lang];
    if (param) url.searchParams.set("lang", param);
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  // Done: straight to the person's own badge (or, with no card yet, to the
  // page that makes one — see AFTER_CHECKIN_PATH).
  const toBadge = () => {
    const url = new URL(AFTER_CHECKIN_PATH, origin);
    const param = LANG_PARAM[lang];
    if (param) url.searchParams.set("lang", param);
    return NextResponse.redirect(url, 303);
  };

  // On a paid Build Tuesday (2026-11-02, checkin-pay.ts): someone who still
  // owes goes on to their own payment page, marked "checked in"; a walk-in
  // who found the room full is told to see the organiser.
  const afterwards = async (signupId: string, booked: boolean, walkIn = false) => {
    const feeDay = feeFor(session) !== null;
    const free = feeDay ? await isTuesdayFree(signupId).catch(() => false) : false;
    // A walk-in just booked gets a hold, as an online signup does. Someone
    // already booked never does: they are in the room, and a lapsed hold
    // would take their place away mid-morning.
    const fee = feeDay && !free && booked
      ? await getOrCreateSessionFee(session, signupId, newFeeRef(), walkIn && stripeEnabled() ? HOLD_MINUTES : null).catch(() => null)
      : null;
    const next = afterCheckin({ feeDay, free, booked, status: fee?.status ?? (feeDay && !free && booked ? "pending" : null) });
    if (next === "pay" && fee) {
      const url = new URL("/tuesday/pay", origin);
      url.searchParams.set("ref", fee.ref);
      url.searchParams.set("in", "1");
      return NextResponse.redirect(url, 303);
    }
    if (next === "full") return back({ done: signupId, full: "1" });
    return toBadge();
  };

  // The code is the door. Checked before anything is read from the body, and
  // checked against today rather than against the session it names: a code
  // for next Thursday is only valid next Thursday.
  if (!isSessionDate(session) || !verifyCheckinCode(session, code)) {
    return back({ err: "code" });
  }

  if (!canCheckIn(session, sydneyToday().toISOString().slice(0, 10))) {
    return back({ err: "code" });
  }

  // The proxy appends the real address last; see `callerIp` in rate-limit.ts.
  const remoteIp = clientIp(request);

  if (!checkRateLimit(`checkin:${remoteIp}`, ROOM_TAPS_PER_HOUR).allowed) {
    return back({ err: "rate" });
  }

  // Two buttons, one answer each. Anything that is not the explicit "yes"
  // button means no — a wall entry is not something to grant on a default.
  const onWall = form?.get("onWall") === "yes";

  const signupId = clean(form?.get("signupId") ?? null, 20);
  const name = clean(form?.get("name") ?? null, 100);

  try {
    if (signupId && /^\d+$/.test(signupId)) {
      // Only a name on today's list. Ids are sequential and the code is on a
      // café table, so without this anyone in the room could walk every past
      // signup onto today's public page one id at a time.
      const onRoster = (await listRoster(session)).some((row) => row.id === signupId);
      if (!onRoster) return back({ err: "failed" });

      await checkIn({ session, signupId, onWall, source: "qr" });
      return afterwards(signupId, true);
    }

    if (!name) {
      return back({ new: "1", err: "name" });
    }

    // A walk-in is a signup made on the day. `saveSignup` merges into an
    // existing row when the WeChat ID is already known, so a regular who
    // forgot to sign up this week and types their ID lands on their own row.
    // On a paid Tuesday a walk-in takes a place only if one is left
    // (2026-11-02): the room is small and a place is never promised at the
    // door. Otherwise they are checked in on the waitlist.
    const wechatIn = clean(form?.get("wechat") ?? null, 100);
    let full = false;
    if (feeFor(session) !== null) {
      const { count, alreadyIn } = await sessionHeadcount(session, null, wechatIn);
      full = !alreadyIn && count >= capFor(session);
    }

    const walkInId = await saveSignup({
      name,
      email: null,
      wechat: wechatIn,
      building: clean(form?.get("building") ?? null, 1000),
      demoIntent: null,
      topic: null,
      firstSession: session,
      availability: [],
      aiModels: [],
      aiSpend: null,
      // A walk-in is signed up at the door; nobody is asked why they came there.
      purpose: null,
      source: "walk-in",
      lang,
      botCheck: "skipped",
      ...(full ? { waitlisted: true } : {}),
    });

    await checkIn({ session, signupId: walkInId, onWall, source: "walk-in" });
    return afterwards(walkInId, !full, true);
  } catch (error) {
    console.error("[checkin] failed", error);
    return back({ err: "failed" });
  }
}
