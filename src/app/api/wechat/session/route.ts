import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findSignupIdByOpenid } from "@/lib/db";
import { REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import { requestOrigin } from "@/lib/request-origin";
import { readOpenidToken, wechatConfigured } from "@/lib/wechat-auth";
import { safeNext, WX_OPENID_COOKIE } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

/**
 * Turns "WeChat knows who this is" into "this browser is logged in": the
 * remember cookie every page reads, for the signup this browser's WeChat is
 * tied to. Then on to `next`.
 *
 * Needed because the WeChat tie can be made after this browser's WeChat login
 * has already happened (linking on /login, signing up), and nothing would
 * otherwise set the cookie — the proxy never goes round again once the WeChat
 * cookie exists. Measured 2026-10-05: in WeChat, "微信登录 / 注册" sent /login,
 * which recognised the WeChat and jumped back to the form, which did not —
 * so the button looked like it only reloaded the page.
 *
 * A GET is fine: it only ever logs a browser in as the WeChat it already
 * holds, signed, from the service account's own login.
 */
export async function GET(request: Request) {
  const origin = await requestOrigin();
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, origin), 303);
  if (!wechatConfigured()) return response;

  try {
    const openid = readOpenidToken((await cookies()).get(WX_OPENID_COOKIE)?.value);
    const signupId = openid ? await findSignupIdByOpenid(openid) : null;
    if (signupId) response.cookies.set(REMEMBER_COOKIE, rememberToken(signupId), rememberCookieOptions(origin.startsWith("https://")));
  } catch (error) {
    console.error("[wechat/session] could not log in", error);
  }
  return response;
}
