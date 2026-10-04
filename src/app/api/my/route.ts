import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LANG_PARAM, resolveLang } from "@/lib/content";
import { bindOpenid, cancelSession, findMySignup, findSignupIdByOpenid, getMySignup, moveSessionFor, unbindOpenid } from "@/lib/db";
import { canChangeSession, myToken, readRememberToken, REMEMBER_COOKIE, rememberCookieOptions, rememberToken, verifyMyToken } from "@/lib/my-signup";
import { readOpenidToken, wechatCookieOptions } from "@/lib/wechat-auth";
import { WX_OPENID_COOKIE, WX_TRIED_COOKIE, WX_TRIED_MAX_AGE_S } from "@/lib/wechat-gate";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { bookableSessions, sydneyToday } from "@/lib/sessions";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 8 * 1024;

// Reads and writes Postgres; never prerender or cache.
export const dynamic = "force-dynamic";

/**
 * Lookups per address per hour. Low on purpose: this is the one form on the
 * site where a wrong answer tells you something ("no such pair"), so it is the
 * one worth slowing down. A person who mistypes a few times is nowhere near it.
 */
const LOOKUPS_PER_HOUR = 20;

/** Changes per address per hour, once looked up. */
const CHANGES_PER_HOUR = 60;

function clean(value: FormDataEntryValue | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Everything /my does, as plain form posts with a 303 back to the page — the
 * same shape as /api/order and /api/feedback, so it works in WeChat's browser
 * with or without script.
 *
 * `action=lookup` trades a name and WeChat ID for a two-hour token
 * (`my-signup.ts`); `cancel` and `move` need that token and nothing else. Only
 * today's and later sessions can be touched, and a move is a cancel plus the
 * same admission rule the signup form uses — so moving into a full Thursday
 * lands on its waitlist rather than past the cap.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const form = await request.formData().catch(() => null);
  const action = clean(form?.get("action"), 10);
  const lang = resolveLang(clean(form?.get("lang"), 10) ?? undefined);
  const origin = await requestOrigin();

  const back = (params: Record<string, string>) => {
    const url = new URL("/my", origin);
    const param = LANG_PARAM[lang];
    if (param) url.searchParams.set("lang", param);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  const ip = clientIp(request);

  if (action === "lookup") {
    if (!checkRateLimit(`my-lookup:${ip}`, LOOKUPS_PER_HOUR).allowed) return back({ err: "rate" });

    const name = clean(form?.get("name"), 60);
    const wechat = clean(form?.get("wechat"), 60);
    if (!name || !wechat) return back({ err: "notfound" });

    try {
      const found = await findMySignup(name, wechat);
      if (!found) return back({ err: "notfound" });
      if ("nameHint" in found) return back({ err: "name", h: found.nameHint, w: wechat });
      const response = back({ t: myToken(found.id) });
      // Remember this phone, so next time /my opens straight to their signup —
      // but only on the whole name. A partial match still gets the two-hour
      // link above; it just is not worth a 60-day pass.
      if (found.exactName) {
        response.cookies.set(REMEMBER_COOKIE, rememberToken(found.id), rememberCookieOptions(origin.startsWith("https://")));
        // Same gate ties a pending WeChat login to this signup (wechat-auth.ts).
        try {
          const openid = readOpenidToken((await cookies()).get(WX_OPENID_COOKIE)?.value);
          if (openid) await bindOpenid(found.id, openid);
        } catch (error) {
          console.error("[my] could not tie the WeChat login", error);
        }
      }
      return response;
    } catch (error) {
      console.error("[my] lookup failed", error);
      return back({ err: "failed" });
    }
  }

  // "Not me": a shared phone, or a signup made on a friend's. Forget it and
  // go back to the form.
  if (action === "forget") {
    const secure = origin.startsWith("https://");
    const response = back({});
    // With WeChat login, "not me" also unties this WeChat from that signup —
    // otherwise the next visit would sign the same wrong person straight back
    // in — and drops the WeChat cookie, with "tried" so the proxy does not
    // immediately send them round again.
    // Both ways this browser can be someone: the remember cookie, and (inside
    // WeChat) the WeChat it carries, which may be tied to a different signup.
    try {
      const store = await cookies();
      const remembered = readRememberToken(store.get(REMEMBER_COOKIE)?.value);
      if (remembered) await unbindOpenid(remembered);
      const openid = readOpenidToken(store.get(WX_OPENID_COOKIE)?.value);
      const tied = openid ? await findSignupIdByOpenid(openid) : null;
      if (tied) await unbindOpenid(tied);
    } catch (error) {
      console.error("[my] could not untie the WeChat login", error);
    }
    response.cookies.set(REMEMBER_COOKIE, "", { ...rememberCookieOptions(secure), maxAge: 0 });
    response.cookies.set(WX_OPENID_COOKIE, "", wechatCookieOptions(secure, 0));
    response.cookies.set(WX_TRIED_COOKIE, "1", wechatCookieOptions(secure, WX_TRIED_MAX_AGE_S));
    return response;
  }

  if (action !== "cancel" && action !== "move") return back({});

  const token = clean(form?.get("t"), 200);
  const signupId = verifyMyToken(token);
  if (!token || !signupId) return back({ err: "expired" });

  if (!checkRateLimit(`my-change:${ip}`, CHANGES_PER_HOUR).allowed) return back({ t: token, err: "rate" });

  const today = sydneyToday().toISOString().slice(0, 10);
  const from = clean(form?.get("from"), 10);
  const to = clean(form?.get("to"), 10);

  try {
    const mine = await getMySignup(signupId);
    if (!mine) return back({ err: "expired" });

    const holds = (session: string) =>
      mine.sessions.includes(session) || mine.waitlist.some((entry) => entry.session === session);

    // Only something this person actually holds, and not in the past.
    if (from && (!holds(from) || !canChangeSession(from, today))) return back({ t: token, err: "failed" });

    if (action === "cancel") {
      if (!from) return back({ t: token, err: "failed" });
      await cancelSession(signupId, from);
      return back({ t: token, done: "cancel", d: from });
    }

    // Move (or, with no `from`, add): only to a date the signup form would
    // offer — a Thursday or an open Build Tuesday — so nobody books a date
    // that is not a session.
    if (!to || !bookableSessions(6).includes(to) || to === from) return back({ t: token, err: "failed" });

    // Cancel and add in one transaction: never "old Thursday gone, new one not taken".
    const result = await moveSessionFor(signupId, from, to);
    return back({ t: token, done: result === "booked" ? "booked" : "waitlist", d: to });
  } catch (error) {
    console.error("[my] change failed", error);
    return back({ t: token, err: "failed" });
  }
}
