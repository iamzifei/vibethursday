// Relative imports only: loaded by the tests through Node's type stripper, and
// by `src/proxy.ts`. Deliberately free of `node:crypto` and of anything that
// reads the database, so the proxy stays a cheap header-and-cookie check.

/**
 * When to send a visitor through WeChat's silent login (2026-10-04).
 *
 * Most people open this site from a link in a WeChat chat, inside WeChat's own
 * browser. There, the service account's web authorisation (`snsapi_base`)
 * hands back a stable per-person id without showing anything to the visitor —
 * which is what lets the site recognise someone without them typing a WeChat
 * ID they often get wrong (nicknames, phone numbers, nothing at all).
 */

/** Whether WeChat login is on: both credentials set, and not WECHAT_LOGIN=off. */
export function wechatLoginOn(env: Record<string, string | undefined>): boolean {
  return Boolean(env.WECHAT_APPID && env.WECHAT_SECRET) && env.WECHAT_LOGIN !== "off";
}

/** The cookie that holds a signed openid not yet tied to a signup (`wechat-auth.ts`). */
export const WX_OPENID_COOKIE = "vt_wx";

/**
 * Set before every trip to WeChat, so a trip that fails — denied, timed out,
 * a misconfigured account — is not retried on every page view. The proxy only
 * ever looks at whether it exists.
 */
export const WX_TRIED_COOKIE = "vt_wx_tried";

/** How long one failed or finished attempt suppresses the next: half a day. */
export const WX_TRIED_MAX_AGE_S = 12 * 60 * 60;

/** The cookie that carries the round trip's nonce and where to come back to. */
export const WX_NONCE_COOKIE = "vt_wxn";

/**
 * WeChat's in-app browser, on a phone or on the desktop app. Not WeChat Work
 * (企业微信): its UA also says MicroMessenger, but a service account's login
 * does not work inside it, and every attempt would be a wasted round trip.
 */
export function isWeChatBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return /MicroMessenger/i.test(userAgent) && !/wxwork/i.test(userAgent);
}

/**
 * The pages where knowing who someone is changes what they see: the signup
 * forms, their own signup, the day-of page, check-in and their badge. Kept to
 * these rather than the whole site, so reading an FAQ or the member wall never
 * takes a detour through WeChat.
 */
export const WX_LOGIN_PATHS = ["/", "/tuesday", "/my", "/go", "/checkin", "/badge"] as const;

export type GateInput = {
  /** Whether WECHAT_APPID and WECHAT_SECRET are both set. */
  configured: boolean;
  method: string;
  path: string;
  userAgent: string | null;
  /** Cookies present on the request, by name. Only presence is read. */
  hasRemember: boolean;
  hasOpenid: boolean;
  tried: boolean;
};

/**
 * Whether this request should go through WeChat's login first.
 *
 * Every condition is a reason *not* to: unconfigured, not a page view, not a
 * page that uses identity, not WeChat, already known, or already tried. The
 * last one is what makes a loop impossible — the start route sets it before
 * leaving for WeChat, and nothing clears it except time.
 */
export function shouldStartWechatLogin(input: GateInput): boolean {
  if (!input.configured) return false;
  if (input.method !== "GET") return false;
  if (!(WX_LOGIN_PATHS as readonly string[]).includes(input.path)) return false;
  if (!isWeChatBrowser(input.userAgent)) return false;
  if (input.hasRemember || input.hasOpenid || input.tried) return false;
  return true;
}

/**
 * Where to come back to after the round trip: a path on this site, or "/".
 *
 * The value arrives in a query string anyone can write, and ends up in a
 * redirect, so only a plain same-site path survives — never `//host`, `/\host`
 * (both read as another site by browsers), a scheme, or a line break.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\r\n\t\0]/.test(next) || next.includes("\\")) return "/";
  return next;
}
