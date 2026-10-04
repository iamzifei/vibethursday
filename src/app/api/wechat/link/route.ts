import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LANG_PARAM, resolveLang } from "@/lib/content";
import { approveQrLogin, bindOpenid, findMySignup, findSignupIdByOpenid } from "@/lib/db";
import { REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import { bodyTooLarge, boundedRequest, checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { looksLikeQrToken, readOpenidToken, wechatConfigured } from "@/lib/wechat-auth";
import { fromThisSite } from "@/lib/same-origin";
import { safeNext, WX_OPENID_COOKIE } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

const MAX_BODY = 4 * 1024;

/**
 * Same allowance as /my's lookup, and the same counter: a wrong answer here
 * also says "no such pair", so the two together must not double the guesses.
 */
const LOOKUPS_PER_HOUR = 20;

function clean(value: FormDataEntryValue | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * The phone side of WeChat login, as a plain form post (works in WeChat's
 * browser with or without script), always answered with a 303 to /login.
 *
 * Who is asking comes from the signed openid cookie the service account's
 * login left — never from the form. With a name and WeChat ID (first time),
 * the signup they prove is theirs is tied to this WeChat, exactly as /my does.
 * Without them, the signup this WeChat is already tied to is used.
 *
 * With `qr`, it also confirms the computer waiting on that code.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });

  const form = await bounded.formData().catch(() => null);
  const lang = resolveLang(clean(form?.get("lang"), 10) ?? undefined);
  const qrRaw = clean(form?.get("qr"), 40);
  const qr = looksLikeQrToken(qrRaw) ? qrRaw : null;
  const next = safeNext(clean(form?.get("next"), 512));
  const origin = await requestOrigin();
  const secure = origin.startsWith("https://");

  const back = (params: Record<string, string>) => {
    const url = new URL("/login", origin);
    const param = LANG_PARAM[lang];
    if (param) url.searchParams.set("lang", param);
    if (qr) url.searchParams.set("qr", qr);
    if (next !== "/") url.searchParams.set("next", next);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  // Switched off: nothing to link to. And only posts from this site's own pages.
  if (!wechatConfigured() || !fromThisSite(request, origin)) return back({ err: "failed" });
  if (!checkRateLimit(`my-lookup:${clientIp(bounded)}`, LOOKUPS_PER_HOUR).allowed) return back({ err: "rate" });

  const openid = readOpenidToken((await cookies()).get(WX_OPENID_COOKIE)?.value);
  if (!openid) return back({ err: "wechat" });

  try {
    const name = clean(form?.get("name"), 60);
    const wechat = clean(form?.get("wechat"), 60);
    let signupId: string | null = null;
    let proved = false;

    if (name && wechat) {
      const found = await findMySignup(name, wechat);
      if (!found) return back({ err: "notfound" });
      if ("nameHint" in found) return back({ err: "name", h: found.nameHint });
      // A partial name gets /my's two-hour link, never a lasting tie.
      if (!found.exactName) return back({ err: "notfound" });
      await bindOpenid(found.id, openid);
      signupId = found.id;
      proved = true;
    } else {
      signupId = await findSignupIdByOpenid(openid);
      if (!signupId) return back({ err: "unlinked" });
    }

    if (qr) {
      // The number on the computer's screen. Without it — someone sent the
      // link rather than scanning it — the login cannot go through.
      const pin = clean(form?.get("pin"), 4);
      if (!pin) {
        // Linked just now: this phone is logged in from here on too, not only
        // the computer it is about to confirm.
        const response = back({ step: "pin" });
        if (proved) response.cookies.set(REMEMBER_COOKIE, rememberToken(signupId), rememberCookieOptions(secure));
        return response;
      }
      const result = await approveQrLogin(qr, signupId, openid, pin);
      if (result === "wrong") return back({ err: "pin" });
      if (result === "gone") return back({ err: "expired" });
    }

    const response = back(qr ? { done: "1" } : { ok: "1" });
    // This phone too, after a whole-name proof, as /my does.
    if (proved) response.cookies.set(REMEMBER_COOKIE, rememberToken(signupId), rememberCookieOptions(secure));
    return response;
  } catch (error) {
    console.error("[wechat/link] failed", error);
    return back({ err: "failed" });
  }
}
