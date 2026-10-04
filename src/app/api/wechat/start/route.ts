import { NextResponse } from "next/server";
import { requestOrigin } from "@/lib/request-origin";
import { authorizeUrl, newNonce, nonceToken, NONCE_TTL_MS, wechatCookieOptions, wechatConfigured } from "@/lib/wechat-auth";
import { safeNext, WX_NONCE_COOKIE, WX_TRIED_COOKIE, WX_TRIED_MAX_AGE_S } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

/**
 * Leaves for WeChat's silent login, and arranges to come back to `next`.
 *
 * Reached from `src/proxy.ts` (a WeChat visitor the site does not know yet) or
 * from a link. Writes two cookies before leaving: the nonce that the callback
 * will insist on, and "tried", which stops the proxy sending this browser
 * round again however the trip ends.
 */
export async function GET(request: Request) {
  const origin = await requestOrigin();
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const home = new URL(next, origin);

  // Not switched on for this deployment: a plain detour back.
  if (!wechatConfigured()) return NextResponse.redirect(home, 303);

  const secure = origin.startsWith("https://");
  const nonce = newNonce();
  const response = NextResponse.redirect(
    authorizeUrl(process.env.WECHAT_APPID!, `${origin}/api/wechat/callback`, nonce),
    303,
  );
  response.cookies.set(WX_NONCE_COOKIE, nonceToken(nonce, next), wechatCookieOptions(secure, NONCE_TTL_MS / 1000));
  response.cookies.set(WX_TRIED_COOKIE, "1", wechatCookieOptions(secure, WX_TRIED_MAX_AGE_S));
  return response;
}
