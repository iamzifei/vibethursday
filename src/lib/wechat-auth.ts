// Relative imports only: the tests load this through Node's type stripper.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { wechatLoginOn } from "./wechat-gate.ts";

/**
 * The server half of WeChat login (2026-10-04): the authorise URL, the signed
 * cookies that carry state across the round trip, and reading WeChat's answer.
 * Pure apart from `newNonce`, so every rule here is tested without a network.
 *
 * Official doc: developers.weixin.qq.com/doc/service/guide/h5/auth.html —
 * `snsapi_base` is silent ("不弹出授权页面，直接跳转"); a `code` works once and
 * expires after five minutes; `state` is up to 128 bytes of [a-zA-Z0-9].
 */

/** Same key as the /my links and the remember cookie, under different labels. */
function secret(): string {
  const key = process.env.MEMBER_SECRET || process.env.ADMIN_TOKEN;
  if (!key) throw new Error("Neither MEMBER_SECRET nor ADMIN_TOKEN is set; WeChat login is disabled");
  return key;
}

function sign(input: string, key: string): string {
  return createHmac("sha256", key).update(input).digest("base64url").slice(0, 32);
}

function sameSignature(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether WeChat login is switched on for this deployment: both credentials
 * set, unless WECHAT_LOGIN=off — the switch for turning it off in a hurry
 * without deleting them (`wechat-gate.ts`, shared with the proxy).
 */
export function wechatConfigured(): boolean {
  return wechatLoginOn(process.env);
}


/** 32 hex characters: inside `state`'s [a-zA-Z0-9]{,128}. */
export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

/** WeChat's authorise URL for a silent (`snsapi_base`) login. */
export function authorizeUrl(appId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    appid: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "snsapi_base",
    state,
  });
  // The fragment is required by WeChat, and the parameter order is the one its
  // docs show; some clients have been reported to care.
  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
}

/** The code-for-openid exchange. Server to server; the secret never leaves here. */
export function tokenUrl(appId: string, appSecret: string, code: string): string {
  const params = new URLSearchParams({ appid: appId, secret: appSecret, code, grant_type: "authorization_code" });
  return `https://api.weixin.qq.com/sns/oauth2/access_token?${params.toString()}`;
}

/** A WeChat openid as it is actually issued: 28 URL-safe characters, give or take. */
export function looksLikeOpenid(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/**
 * The openid out of WeChat's token response, or null.
 *
 * Null for any error (`errcode`), and for `is_snapshotuser: 1`: someone viewing
 * a "snapshot" of the page from Moments is given a placeholder openid that is
 * not theirs, and binding it would tie a stranger's id to a signup.
 */
export function openidFromTokenResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (data.errcode !== undefined && data.errcode !== 0) return null;
  if (data.is_snapshotuser === 1) return null;
  return looksLikeOpenid(data.openid) ? data.openid : null;
}

/* ── The nonce cookie: one round trip to WeChat and back ───────────────── */

const NONCE_LABEL = "vt.wx.nonce.v1";

/** Ten minutes: WeChat's code lasts five, and the round trip takes seconds. */
export const NONCE_TTL_MS = 10 * 60 * 1000;

/**
 * Binds the `state` sent to WeChat to this browser, and remembers where to come
 * back to. The callback only accepts a `state` equal to the nonce in this
 * cookie — so a callback URL sent to someone else (login CSRF) is refused.
 */
export function nonceToken(nonce: string, next: string, now: number = Date.now(), key: string = secret()): string {
  const head = `${NONCE_LABEL}:${nonce}.${now + NONCE_TTL_MS}.${Buffer.from(next).toString("base64url")}`;
  return `${head}~${sign(head, key)}`;
}

export function readNonceToken(
  token: string | null | undefined,
  now: number = Date.now(),
  key: string = secret(),
): { nonce: string; next: string } | null {
  if (!token || token.length > 1024) return null;
  const match = /^(vt\.wx\.nonce\.v1:([a-f0-9]{32})\.(\d{10,16})\.([A-Za-z0-9_-]*))~([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;
  const [, head, nonce, expires, next64, signature] = match;
  if (!sameSignature(sign(head, key), signature)) return null;
  if (Number(expires) <= now) return null;
  return { nonce, next: Buffer.from(next64, "base64url").toString("utf8") };
}

/* ── The openid cookie: recognised by WeChat, not yet tied to a signup ── */

const OPENID_LABEL = "vt.wx.openid.v1";

/** As long as the remember cookie, so the two expire together. */
export const OPENID_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Holds an openid until its owner proves who they are — signing up, or looking
 * themselves up on /my, with their whole name — at which point it is tied to
 * that signup. Signed, so nobody can claim someone else's openid by typing it.
 */
export function openidToken(openid: string, now: number = Date.now(), key: string = secret()): string {
  const head = `${OPENID_LABEL}:${openid}.${now + OPENID_TTL_MS}`;
  return `${head}~${sign(head, key)}`;
}

export function readOpenidToken(token: string | null | undefined, now: number = Date.now(), key: string = secret()): string | null {
  if (!token || token.length > 300) return null;
  const match = /^(vt\.wx\.openid\.v1:([A-Za-z0-9_-]{16,64})\.(\d{10,16}))~([A-Za-z0-9_-]{32})$/.exec(token);
  if (!match) return null;
  const [, head, openid, expires, signature] = match;
  if (!sameSignature(sign(head, key), signature)) return null;
  return Number(expires) > now ? openid : null;
}

/** Cookie settings shared by the WeChat cookies: never readable by script. */
export function wechatCookieOptions(secure: boolean, maxAgeSeconds: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: maxAgeSeconds };
}
