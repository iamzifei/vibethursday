/**
 * One answer to "who is this?" (2026-10-11, src/lib/account-resolve.ts).
 *
 * The card cookie, "this phone remembers you" and a tied WeChat each say who
 * someone is; this checks which one wins and what happens when one points at
 * something that is gone.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveAccount, type AccountLookups } from "../src/lib/account-resolve.ts";

const lookups = (overrides: Partial<AccountLookups> = {}): AccountLookups => ({
  signupIdForMember: async (memberId) => ({ "10": "100", "11": "101" })[memberId] ?? null,
  memberIdForSignup: async (signupId) => ({ "100": "10", "101": "11" })[signupId] ?? null,
  signupIdForOpenid: async (openid) => (openid === "oTied" ? "101" : null),
  ...overrides,
});

test("nobody: no proof at all", async () => {
  assert.equal(await resolveAccount({ memberCookie: null, rememberSignup: null, openid: null }, lookups()), null);
});

test("the card cookie wins over the others, since it names the card exactly", async () => {
  const account = await resolveAccount({ memberCookie: "10", rememberSignup: "101", openid: "oTied" }, lookups());
  assert.deepEqual(account, { signupId: "100", memberId: "10", via: "card" });
});

test("a card cookie for a deleted card falls through to the next proof", async () => {
  const account = await resolveAccount({ memberCookie: "99", rememberSignup: "101", openid: null }, lookups());
  assert.deepEqual(account, { signupId: "101", memberId: "11", via: "remember" });
});

test("remembered without a card: recognised, with no card yet", async () => {
  const account = await resolveAccount({ memberCookie: null, rememberSignup: "555", openid: null }, lookups());
  assert.deepEqual(account, { signupId: "555", memberId: null, via: "remember" });
});

test("WeChat counts only once the openid is tied to a signup", async () => {
  assert.deepEqual(
    await resolveAccount({ memberCookie: null, rememberSignup: null, openid: "oTied" }, lookups()),
    { signupId: "101", memberId: "11", via: "wechat" },
  );
  assert.equal(await resolveAccount({ memberCookie: null, rememberSignup: null, openid: "oLoose" }, lookups()), null);
});
