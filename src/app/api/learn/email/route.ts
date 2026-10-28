import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkEmailCode, learnerForEmail, signupIdForEmail, storeEmailCode } from "@/lib/learn-db";
import { readRememberToken, REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import {
  EMAIL_CODE_TTL_MS,
  hashEmailCode,
  LEARN_COOKIE,
  LEARN_TTL_SECONDS,
  learnerToken,
  looksLikeEmailCode,
  newEmailCode,
  normaliseEmail,
} from "@/lib/learn";
import { mailConfigured, sendMail } from "@/lib/mail";
import { boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";
import { safeNext } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

const MAX_BODY = 2 * 1024;

/** Holds the address between "send me a code" and "here it is", so it never sits in a URL. */
const EMAIL_COOKIE = "vt_learn_email";

/**
 * Sign in to /learn with a code sent by email. A form post either way,
 * answered with a 303 to /learn/login:
 *
 * - `step=send`: emails a six-digit code (at most one a minute per address).
 * - `step=verify`: checks it; five wrong tries and the code is dead. On a
 *   match, this browser gets the learner cookie for that address.
 *
 * "Sent" is said whether or not the address is known: signing in creates a
 * waiting learner, so there is nothing to enumerate.
 */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  const secure = origin.startsWith("https://");
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const wanted = safeNext(form?.get("next"));
  const next = wanted.startsWith("/learn") ? wanted : "/learn";
  const lang = form?.get("lang") === "en" ? "en" : null;

  const back = (params: Record<string, string>) => {
    const url = new URL("/learn/login", origin);
    if (lang) url.searchParams.set("lang", lang);
    if (next !== "/learn") url.searchParams.set("next", next);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 303);
  };

  if (!mailConfigured()) return back({ err: "off" });

  if (form?.get("step") === "send") {
    if (tooMany(bounded, "learn-email-send", 10)) return back({ err: "rate" });
    const email = normaliseEmail(form?.get("email"));
    if (!email) return back({ err: "email" });

    const code = newEmailCode();
    const stored = await storeEmailCode(email, hashEmailCode(email, code));
    // Within the minute: the earlier code still stands, so go on to typing it.
    if (stored) {
      const minutes = EMAIL_CODE_TTL_MS / 60_000;
      const sent = await sendMail(
        email,
        lang ? `Your Vibe Thursday sign-in code: ${code}` : `Vibe Thursday 登录验证码：${code}`,
        lang
          ? `Your code is ${code}. It works for ${minutes} minutes.\n\nIf you did not ask for it, ignore this email.`
          : `你的验证码是 ${code}，${minutes} 分钟内有效。\n\n如果不是你本人操作，忽略这封邮件即可。`,
      );
      if (!sent) return back({ err: "send" });
    }
    const response = back({ step: "code" });
    response.cookies.set(EMAIL_COOKIE, email, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: EMAIL_CODE_TTL_MS / 1000 });
    return response;
  }

  // step=verify
  if (tooMany(bounded, "learn-email-verify", 30)) return back({ step: "code", err: "rate" });
  const email = normaliseEmail((await cookies()).get(EMAIL_COOKIE)?.value);
  if (!email) return back({ err: "expired" });
  const code = String(form?.get("code") ?? "").replace(/\s/g, "");
  if (!looksLikeEmailCode(code)) return back({ step: "code", err: "code" });

  const result = await checkEmailCode(email, code);
  if (result === "wrong") return back({ step: "code", err: "code" });
  if (result !== "ok") return back({ err: result });

  const learner = await learnerForEmail(email);
  const response = NextResponse.redirect(new URL(next, origin), 303);
  response.cookies.set(LEARN_COOKIE, learnerToken(learner.id), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: LEARN_TTL_SECONDS });
  response.cookies.set(EMAIL_COOKIE, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });

  // One sign-in for the whole site (2026-10-29): the code proved this address,
  // which is a stronger proof than the main site's own remember cookie asks
  // for, so if it belongs to a signup the main site recognises them too.
  try {
    const signupId = await signupIdForEmail(email);
    if (signupId && !readRememberToken((await cookies()).get(REMEMBER_COOKIE)?.value)) {
      response.cookies.set(REMEMBER_COOKIE, rememberToken(signupId), rememberCookieOptions(secure));
    }
  } catch (error) {
    console.error("[learn/email] could not remember the signup", error);
  }
  return response;
}
