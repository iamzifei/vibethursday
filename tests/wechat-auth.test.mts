/**
 * WeChat login (2026-10-04): the rules that decide when someone is sent to
 * WeChat, where they may be sent back to, and which cookies can be trusted on
 * the way. All pure, so none of this needs WeChat or a network.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  authorizeUrl,
  newNonce,
  nonceToken,
  NONCE_TTL_MS,
  openidFromTokenResponse,
  openidToken,
  readNonceToken,
  readOpenidToken,
} from "../src/lib/wechat-auth.ts";
import { isWeChatBrowser, safeNext, shouldStartWechatLogin, type GateInput } from "../src/lib/wechat-gate.ts";

const KEY = "test-key";
const OPENID = "oAbCdEfGhIjKlMnOpQrStUvWxYz1";

const IPHONE_WECHAT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322d) NetType/WIFI Language/zh_CN";
const WXWORK =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 wxwork/4.1.0 MicroMessenger/7.0.1 Language/zh";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("WeChat's browser is recognised; WeChat Work and Safari are not", () => {
  assert.equal(isWeChatBrowser(IPHONE_WECHAT), true);
  assert.equal(isWeChatBrowser(WXWORK), false, "a service account's login does not work in WeChat Work");
  assert.equal(isWeChatBrowser(SAFARI), false);
  assert.equal(isWeChatBrowser(null), false);
});

const base: GateInput = {
  configured: true,
  method: "GET",
  path: "/go",
  userAgent: IPHONE_WECHAT,
  hasRemember: false,
  hasOpenid: false,
  tried: false,
};

test("an unknown visitor in WeChat on an identity page is sent to log in", () => {
  assert.equal(shouldStartWechatLogin(base), true);
  for (const path of ["/", "/tuesday", "/my", "/checkin", "/badge"]) {
    assert.equal(shouldStartWechatLogin({ ...base, path }), true, path);
  }
});

test("★ every reason not to: unconfigured, not GET, other page, not WeChat, already known, already tried", () => {
  // `tried` is the loop breaker: set before leaving for WeChat, so a failed
  // round trip can never send the same browser round again.
  assert.equal(shouldStartWechatLogin({ ...base, configured: false }), false);
  assert.equal(shouldStartWechatLogin({ ...base, method: "POST" }), false);
  assert.equal(shouldStartWechatLogin({ ...base, path: "/members" }), false);
  assert.equal(shouldStartWechatLogin({ ...base, path: "/api/signup" }), false);
  assert.equal(shouldStartWechatLogin({ ...base, userAgent: SAFARI }), false);
  assert.equal(shouldStartWechatLogin({ ...base, hasRemember: true }), false);
  assert.equal(shouldStartWechatLogin({ ...base, hasOpenid: true }), false);
  assert.equal(shouldStartWechatLogin({ ...base, tried: true }), false);
});

test("★ next only ever points back at this site", () => {
  assert.equal(safeNext("/go"), "/go");
  assert.equal(safeNext("/checkin?s=2026-10-08&k=abc"), "/checkin?s=2026-10-08&k=abc");
  for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "evil", "", "/a\r\nSet-Cookie: x", null, 42]) {
    assert.equal(safeNext(bad), "/", String(bad));
  }
  assert.equal(safeNext(`/${"a".repeat(600)}`), "/");
});

test("the authorise URL is the silent scope, with the fragment WeChat requires", () => {
  const url = authorizeUrl("wx123", "https://vibethursday.com/api/wechat/callback", "abc123");
  assert.ok(url.startsWith("https://open.weixin.qq.com/connect/oauth2/authorize?"));
  assert.ok(url.endsWith("#wechat_redirect"));
  const params = new URL(url).searchParams;
  assert.equal(params.get("scope"), "snsapi_base", "snsapi_userinfo would show a consent page");
  assert.equal(params.get("redirect_uri"), "https://vibethursday.com/api/wechat/callback");
  assert.equal(params.get("response_type"), "code");
});

test("a nonce fits WeChat's state rules", () => {
  assert.match(newNonce(), /^[a-f0-9]{32}$/);
});

test("the nonce cookie round-trips, and refuses forgery and expiry", () => {
  const nonce = "0123456789abcdef0123456789abcdef";
  const now = 1_800_000_000_000;
  const token = nonceToken(nonce, "/checkin?s=2026-10-08&k=x", now, KEY);
  assert.deepEqual(readNonceToken(token, now + 1000, KEY), { nonce, next: "/checkin?s=2026-10-08&k=x" });
  assert.equal(readNonceToken(token, now + NONCE_TTL_MS + 1, KEY), null, "expired");
  assert.equal(readNonceToken(token, now, "other-key"), null, "wrong key");
  assert.equal(readNonceToken(token.replace("~", "x~"), now, KEY), null, "tampered");
});

test("★ the openid cookie cannot be forged or moved to another openid", () => {
  const now = 1_800_000_000_000;
  const token = openidToken(OPENID, now, KEY);
  assert.equal(readOpenidToken(token, now + 1000, KEY), OPENID);
  assert.equal(readOpenidToken(token.replace(OPENID, "oSomeoneElse0000000000000000"), now, KEY), null);
  assert.equal(readOpenidToken(token, now, "other-key"), null);
  assert.equal(readOpenidToken(`vt.wx.openid.v1:${OPENID}.9999999999999~${"a".repeat(32)}`, now, KEY), null);
});

test("★ WeChat's answer: an openid, or nothing — never a snapshot visitor's placeholder", () => {
  assert.equal(openidFromTokenResponse({ access_token: "t", openid: OPENID, scope: "snsapi_base" }), OPENID);
  assert.equal(openidFromTokenResponse({ errcode: 40029, errmsg: "invalid code" }), null);
  assert.equal(openidFromTokenResponse({ openid: OPENID, is_snapshotuser: 1 }), null);
  assert.equal(openidFromTokenResponse({ openid: "bad id with spaces" }), null);
  assert.equal(openidFromTokenResponse(null), null);
  assert.equal(openidFromTokenResponse("nope"), null);
});

test("★ the proxy runs on exactly the pages the gate lists", async () => {
  // The matcher has to be a literal (Next reads it at build time), so it
  // cannot import WX_LOGIN_PATHS. If the two drift, either a page never gets
  // the login or the proxy runs where the gate always says no.
  const { readFileSync } = await import("node:fs");
  const { WX_LOGIN_PATHS } = await import("../src/lib/wechat-gate.ts");
  const source = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  const matcher = /matcher:\s*\[([^\]]*)\]/.exec(source)?.[1] ?? "";
  const listed = [...matcher.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(listed, [...WX_LOGIN_PATHS]);
});

test("WECHAT_LOGIN=off turns login off without removing the credentials", async () => {
  const { wechatLoginOn } = await import("../src/lib/wechat-gate.ts");
  assert.equal(wechatLoginOn({ WECHAT_APPID: "wx1", WECHAT_SECRET: "s" }), true);
  assert.equal(wechatLoginOn({ WECHAT_APPID: "wx1", WECHAT_SECRET: "s", WECHAT_LOGIN: "off" }), false);
  assert.equal(wechatLoginOn({ WECHAT_APPID: "wx1" }), false);
  assert.equal(wechatLoginOn({}), false);
});

test("★ the browser is only ever given a remembered visitor's name", async () => {
  // A remember cookie rests on a name and a WeChat ID, both visible in the
  // group chat, so it must not be a way to read someone's email or WeChat ID
  // (2026-10-04 review). The form gets the name; the route fills in the rest.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/lib/known-profile.ts", import.meta.url), "utf8");
  // The one object that leaves: its fields may grow (2026-10-05: whether a
  // WeChat is linked, a yes/no), but never a contact detail or "building".
  const returned = /return profile \? (\{[^}]*\}) : null;/.exec(source)?.[1] ?? "";
  assert.match(returned, /name: profile\.name/);
  for (const secret of ["email", "wechat:", "building"]) {
    assert.ok(!returned.includes(secret), `known-profile.ts sends ${secret} to the browser: ${returned}`);
  }
});

test("★ a scan-to-log-in code can only be collected by the computer that showed it", async () => {
  const { qrBrowserToken, readQrBrowserToken, QR_TTL_MS, newQrToken, looksLikeQrToken } = await import("../src/lib/wechat-auth.ts");
  const token = newQrToken();
  assert.ok(looksLikeQrToken(token));
  assert.equal(looksLikeQrToken("../../etc"), false);
  const now = 1_800_000_000_000;
  const cookie = qrBrowserToken(token, now, KEY);
  assert.equal(readQrBrowserToken(cookie, now + 1000, KEY), token);
  assert.equal(readQrBrowserToken(cookie, now + QR_TTL_MS + 1, KEY), null, "expired");
  assert.equal(readQrBrowserToken(cookie.replace(token, newQrToken()), now, KEY), null, "another code");
  assert.equal(readQrBrowserToken(cookie, now, "other-key"), null);
});

test("★ the phone picks the computer's number out of three, the same three on every reload", async () => {
  const { newQrPin, newQrToken, qrPinChoices } = await import("../src/lib/wechat-auth.ts");
  for (let i = 0; i < 200; i += 1) {
    const token = newQrToken();
    const pin = newQrPin();
    assert.match(pin, /^\d{2}$/);
    const choices = qrPinChoices(token, pin);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices).size, 3, "no duplicate choices");
    assert.ok(choices.includes(pin), "the real number is always offered");
    for (const choice of choices) assert.match(choice, /^\d{2}$/);
    assert.deepEqual(qrPinChoices(token, pin), choices, "a reload must not deal fresh guesses");
  }
});

test("★ only posts from this site's own pages are accepted", async () => {
  const { fromThisSite } = await import("../src/lib/same-origin.ts");
  const origin = "https://vibethursday.com";
  const post = (headers: Record<string, string>) => new Request(`${origin}/api/wechat/link`, { method: "POST", headers });
  assert.equal(fromThisSite(post({ origin }), origin), true);
  assert.equal(fromThisSite(post({ "sec-fetch-site": "same-origin" }), origin), true);
  assert.equal(fromThisSite(post({}), origin), true, "a browser that says nothing is let through, as before");
  assert.equal(fromThisSite(post({ origin: "https://evil.example" }), origin), false);
  assert.equal(fromThisSite(post({ origin: "null" }), origin), false);
  assert.equal(fromThisSite(post({ "sec-fetch-site": "cross-site" }), origin), false);
  assert.equal(fromThisSite(post({ "sec-fetch-site": "same-site" }), origin), false, "another subdomain");
});
