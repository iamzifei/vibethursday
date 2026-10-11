// Relative imports only: the tests load this through Node's type stripper.
import { cookies } from "next/headers";
import { findMemberIdForSignup, findSignupIdByOpenid, findSignupIdForMember } from "./db.ts";
import { MEMBER_COOKIE, readToken } from "./member-auth.ts";
import { readRememberToken, REMEMBER_COOKIE } from "./my-signup.ts";
import { readOpenidToken } from "./wechat-auth.ts";
import { WX_OPENID_COOKIE } from "./wechat-gate.ts";
import { resolveAccount, type Account } from "./account-resolve.ts";

/**
 * One answer to "who is this?" (2026-10-11).
 *
 * Before this, a person could be recognised four ways, and each page asked one
 * of them: the card cookie (`vt_member`, from claiming a card), "this phone
 * remembers you" (`vt_my`, from signing up or looking yourself up), WeChat
 * (`vt_wx`, an openid tied to a signup) and /my's two-hour link. So someone the
 * site already knew through WeChat was still asked to claim their card.
 *
 * Every one of those rests on the same proof — a name plus a WeChat ID or
 * email — so any of them is enough to say who this is. This only reads them;
 * it never writes a cookie, because server components cannot.
 *
 * Order: the card cookie first, since it names the card exactly; then the
 * remember cookie; then a WeChat openid already tied to a signup.
 */

export type { Account, AccountInputs, AccountLookups } from "./account-resolve.ts";

/** Who this request is, or null. Never throws: a page must not fail on this. */
export async function currentAccount(): Promise<Account | null> {
  try {
    const store = await cookies();
    return await resolveAccount(
      {
        memberCookie: readToken(store.get(MEMBER_COOKIE)?.value),
        rememberSignup: readRememberToken(store.get(REMEMBER_COOKIE)?.value),
        openid: readOpenidToken(store.get(WX_OPENID_COOKIE)?.value),
      },
      {
        signupIdForMember: findSignupIdForMember,
        memberIdForSignup: findMemberIdForSignup,
        signupIdForOpenid: findSignupIdByOpenid,
      },
    );
  } catch (error) {
    console.error("[account] could not resolve who this is", error);
    return null;
  }
}
