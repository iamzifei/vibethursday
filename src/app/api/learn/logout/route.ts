import { NextResponse } from "next/server";
import { LEARN_COOKIE } from "@/lib/learn";
import { cookieOptions as memberCookieOptions, MEMBER_COOKIE } from "@/lib/member-auth";
import { REMEMBER_COOKIE, rememberCookieOptions } from "@/lib/my-signup";
import { wechatCookieOptions } from "@/lib/wechat-auth";
import { WX_OPENID_COOKIE, WX_TRIED_COOKIE, WX_TRIED_MAX_AGE_S } from "@/lib/wechat-gate";
import { requestOrigin } from "@/lib/request-origin";
import { fromThisSite } from "@/lib/same-origin";

export const dynamic = "force-dynamic";

/**
 * Signs this browser out of the whole site, not only /learn (2026-10-29: the
 * two are one sign-in now): the learner cookie, the main site's remember and
 * card cookies, and the WeChat one, with "tried" so WeChat's silent login does
 * not sign them straight back in. Nothing is untied: this is "sign out", not
 * "this is not me" (that is /my's forget).
 */
export async function POST(request: Request) {
  const origin = await requestOrigin();
  if (!fromThisSite(request, origin)) return new Response("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/learn/login", origin), 303);
  const secure = origin.startsWith("https://");
  response.cookies.set(LEARN_COOKIE, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
  response.cookies.set(REMEMBER_COOKIE, "", { ...rememberCookieOptions(secure), maxAge: 0 });
  response.cookies.set(MEMBER_COOKIE, "", { ...memberCookieOptions(), maxAge: 0 });
  response.cookies.set(WX_OPENID_COOKIE, "", wechatCookieOptions(secure, 0));
  response.cookies.set(WX_TRIED_COOKIE, "1", wechatCookieOptions(secure, WX_TRIED_MAX_AGE_S));
  return response;
}
