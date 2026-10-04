import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findSignupIdByOpenid } from "@/lib/db";
import { readRememberToken, REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import { requestOrigin } from "@/lib/request-origin";
import {
  OPENID_TTL_MS,
  openidFromTokenResponse,
  openidToken,
  readNonceToken,
  tokenUrl,
  wechatConfigured,
  wechatCookieOptions,
} from "@/lib/wechat-auth";
import { WX_NONCE_COOKIE, WX_OPENID_COOKIE } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

/** WeChat's token endpoint is usually quick; a stuck one must not hold a page. */
const EXCHANGE_TIMEOUT_MS = 5_000;

/**
 * Where WeChat sends the visitor back, with a one-time `code`.
 *
 * Whatever happens, the visitor ends up on the page they were going to — a
 * failed login only means they are not recognised, never a dead end. On
 * success:
 *
 * - This WeChat is already tied to a signup, and this phone remembers nobody →
 *   remember that signup here. A new phone, a cleared browser: recognised
 *   without typing.
 * - Always → keep the openid in a signed cookie, so the next whole-name proof
 *   (signing up, or /my) can tie it.
 *
 * Never ties a WeChat to whoever this phone happens to remember: on a shared
 * phone that is somebody else (2026-10-04 review).
 */
export async function GET(request: Request) {
  const origin = await requestOrigin();
  const secure = origin.startsWith("https://");
  const params = new URL(request.url).searchParams;
  const store = await cookies();

  const pending = readNonceToken(store.get(WX_NONCE_COOKIE)?.value);
  const back = NextResponse.redirect(new URL(pending?.next ?? "/", origin), 303);
  // Single use either way.
  back.cookies.set(WX_NONCE_COOKIE, "", { ...wechatCookieOptions(secure, 0) });

  // The state must be the nonce this browser was sent off with: a callback
  // link forwarded from someone else's phone is refused (login CSRF).
  const code = params.get("code");
  if (!wechatConfigured() || !pending || !code || params.get("state") !== pending.nonce) return back;

  let openid: string | null = null;
  try {
    const response = await fetch(tokenUrl(process.env.WECHAT_APPID!, process.env.WECHAT_SECRET!, code), {
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
      cache: "no-store",
    });
    openid = openidFromTokenResponse(await response.json().catch(() => null));
  } catch (error) {
    console.error("[wechat] code exchange failed", error);
  }
  if (!openid) return back;

  back.cookies.set(WX_OPENID_COOKIE, openidToken(openid), wechatCookieOptions(secure, OPENID_TTL_MS / 1000));

  try {
    if (readRememberToken(store.get(REMEMBER_COOKIE)?.value)) return back;

    const found = await findSignupIdByOpenid(openid);
    if (found) back.cookies.set(REMEMBER_COOKIE, rememberToken(found), rememberCookieOptions(secure));
  } catch (error) {
    // The openid cookie above still stands, so the next signup or /my lookup
    // can tie it; only this visit goes unrecognised.
    console.error("[wechat] could not resolve the openid", error);
  }
  return back;
}
