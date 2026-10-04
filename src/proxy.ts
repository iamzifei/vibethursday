import { NextResponse, type NextRequest } from "next/server";
import { shouldStartWechatLogin, wechatLoginOn, WX_OPENID_COOKIE, WX_TRIED_COOKIE } from "./lib/wechat-gate";

/**
 * Sends a visitor the site does not know yet, inside WeChat's browser, through
 * WeChat's silent login on their way to a page that uses who they are
 * (`wechat-gate.ts`). Everything else passes straight through.
 *
 * Only cookie *presence* is read here — no signatures, no database — so this
 * stays a header check on every matched request. The routes it sends people to
 * do the real verification.
 */

/** Kept in step with `REMEMBER_COOKIE` in `my-signup.ts` (not imported: that module pulls in node:crypto). */
const REMEMBER_COOKIE = "vt_my";

export function proxy(request: NextRequest) {
  const start = shouldStartWechatLogin({
    configured: wechatLoginOn(process.env),
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
    hasRemember: request.cookies.has(REMEMBER_COOKIE),
    hasOpenid: request.cookies.has(WX_OPENID_COOKIE),
    tried: request.cookies.has(WX_TRIED_COOKIE),
  });
  if (!start) return NextResponse.next();

  // Relative to the page asked for, so the address is whatever the visitor
  // used. Behind the hosting proxy `request.url` can name the container, so
  // the public origin is preferred when it is configured.
  const base = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const target = new URL("/api/wechat/start", base);
  target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(target, 307);
}

export const config = {
  // The pages listed in WX_LOGIN_PATHS, and nothing else: never assets, never API routes.
  matcher: ["/", "/tuesday", "/my", "/go", "/checkin", "/badge", "/login"],
};
