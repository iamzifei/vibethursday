import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { createQrLogin, qrLoginStatus, recordLogin, takeQrLogin } from "@/lib/db";
import { REMEMBER_COOKIE, rememberCookieOptions, rememberToken } from "@/lib/my-signup";
import { findLearnerByOpenid } from "@/lib/learn-db";
import { LEARN_COOKIE, LEARN_TTL_SECONDS, learnerToken, readLearnerToken } from "@/lib/learn";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import {
  looksLikeQrToken,
  newQrPin,
  newQrToken,
  QR_TTL_MS,
  qrBrowserToken,
  readQrBrowserToken,
  wechatConfigured,
  wechatCookieOptions,
} from "@/lib/wechat-auth";
import { WX_QR_COOKIE } from "@/lib/wechat-gate";

export const dynamic = "force-dynamic";

/** New codes per address per hour. A person needs a handful at most. */
const CODES_PER_HOUR = 30;

/**
 * Scan to log in on a computer (`wechat-auth.ts`).
 *
 * POST: a new code. Returns the QR as a PNG data URL and ties the code to this browser
 * with a signed cookie, so only this browser can collect the login.
 *
 * GET ?t=: where the code stands. Once a phone has confirmed it, the first
 * request from the browser holding the cookie collects the login — the
 * ordinary remember cookie, as if they had signed up here — and the code is
 * spent.
 */
export async function POST(request: Request) {
  if (!wechatConfigured()) return NextResponse.json({ error: "off" }, { status: 404 });
  if (!checkRateLimit(`wxqr:${clientIp(request)}`, CODES_PER_HOUR).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const origin = await requestOrigin();
  const token = newQrToken();
  const pin = newQrPin();
  try {
    await createQrLogin(token, pin);
  } catch (error) {
    console.error("[wechat/qr] could not create a code", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Dark on white, never inverted: plenty of scanners fail on a light-on-dark code.
  // A PNG data URL, shown in a plain <img>: no markup ever goes into the page.
  const image = await QRCode.toDataURL(`${origin}/login?qr=${token}`, {
    width: 440,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  // The number is shown on this screen only; the phone must pick it out.
  const response = NextResponse.json({ token, image, pin, expiresIn: QR_TTL_MS / 1000 });
  response.cookies.set(WX_QR_COOKIE, qrBrowserToken(token), wechatCookieOptions(origin.startsWith("https://"), QR_TTL_MS / 1000));
  return response;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!looksLikeQrToken(token)) return NextResponse.json({ status: "missing" });

  // Only the browser that showed this code may ask about it, and collect it.
  const held = readQrBrowserToken((await cookies()).get(WX_QR_COOKIE)?.value);
  if (held !== token) return NextResponse.json({ status: "missing" });

  try {
    const status = await qrLoginStatus(token);
    if (status !== "approved") return NextResponse.json({ status });

    const login = await takeQrLogin(token);
    if (!login) return NextResponse.json({ status: "used" });

    const secure = (await requestOrigin()).startsWith("https://");
    const response = NextResponse.json({ status: "done" });
    // The ordinary remember cookie and nothing else. Never the WeChat openid:
    // that stays in the WeChat browser that actually logged in, or a computer
    // could approve new codes and move the WeChat tie on its own (review).
    response.cookies.set(REMEMBER_COOKIE, rememberToken(login.signupId), rememberCookieOptions(secure));
    await recordLogin("wechat_qr", login.signupId);
    response.cookies.set(WX_QR_COOKIE, "", wechatCookieOptions(secure, 0));
    // The same scan signs this computer in to /learn (2026-10-29): the phone
    // that approved it is the learner's WeChat. Only the learner cookie, which
    // names a learner and can approve nothing, so the review's point above holds.
    // Only someone who already uses /learn (no new rows: a main-site login must
    // not fill the approval queue), and never over a /learn login this
    // computer already has, which may be a different, approved account.
    const hasLearnLogin = Boolean(readLearnerToken((await cookies()).get(LEARN_COOKIE)?.value));
    if (login.openid && !hasLearnLogin) {
      try {
        const learner = await findLearnerByOpenid(login.openid);
        if (learner) response.cookies.set(LEARN_COOKIE, learnerToken(learner.id), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: LEARN_TTL_SECONDS });
      } catch (error) {
        console.error("[wechat/qr] could not sign in to /learn", error);
      }
    }
    return response;
  } catch (error) {
    console.error("[wechat/qr] status failed", error);
    return NextResponse.json({ status: "pending" });
  }
}
