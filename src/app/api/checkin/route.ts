import { NextResponse } from "next/server";
import { canCheckIn, isSessionDate, verifyCheckinCode } from "@/lib/checkin";
import { LANG_PARAM, resolveLang } from "@/lib/content";
import { checkIn, saveSignup } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { sydneyToday } from "@/lib/sessions";

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

  // The code is the door. Checked before anything is read from the body, and
  // checked against today rather than against the session it names: a code
  // for next Thursday is only valid next Thursday.
  if (!isSessionDate(session) || !verifyCheckinCode(session, code)) {
    return back({ err: "code" });
  }

  if (!canCheckIn(session, sydneyToday().toISOString().slice(0, 10))) {
    return back({ err: "code" });
  }

  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

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
      await checkIn({ session, signupId, onWall, source: "qr" });
      return back({ done: signupId });
    }

    if (!name) {
      return back({ new: "1", err: "name" });
    }

    // A walk-in is a signup made on the day. `saveSignup` merges into an
    // existing row when the WeChat ID is already known, so a regular who
    // forgot to sign up this week and types their ID lands on their own row.
    const walkInId = await saveSignup({
      name,
      email: null,
      wechat: clean(form?.get("wechat") ?? null, 100),
      building: clean(form?.get("building") ?? null, 1000),
      demoIntent: null,
      topic: null,
      firstSession: session,
      availability: [],
      aiModels: [],
      aiSpend: null,
      source: "walk-in",
      lang,
      botCheck: "skipped",
    });

    await checkIn({ session, signupId: walkInId, onWall, source: "walk-in" });
    return back({ done: walkInId });
  } catch (error) {
    console.error("[checkin] failed", error);
    return back({ err: "failed" });
  }
}
