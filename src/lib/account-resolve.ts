// Free of next/headers and the database, so the tests can load it directly.
// The doc for the whole idea is at the top of account.ts.

export type Account = {
  signupId: string;
  /** Their card, or null if they have not got one yet. */
  memberId: string | null;
  via: "card" | "remember" | "wechat";
};

export type AccountInputs = {
  /** The member id the card cookie vouches for. */
  memberCookie: string | null;
  /** The signup id the remember cookie vouches for. */
  rememberSignup: string | null;
  /** A signed openid from WeChat's login. */
  openid: string | null;
};

export type AccountLookups = {
  signupIdForMember: (memberId: string) => Promise<string | null>;
  memberIdForSignup: (signupId: string) => Promise<string | null>;
  signupIdForOpenid: (openid: string) => Promise<string | null>;
};

/** The resolution itself, without cookies or a database, so it can be tested. */
export async function resolveAccount(inputs: AccountInputs, lookups: AccountLookups): Promise<Account | null> {
  if (inputs.memberCookie) {
    const signupId = await lookups.signupIdForMember(inputs.memberCookie);
    // A card cookie for a card that has since been deleted falls through to
    // the other proofs rather than ending the search.
    if (signupId) return { signupId, memberId: inputs.memberCookie, via: "card" };
  }

  if (inputs.rememberSignup) {
    return {
      signupId: inputs.rememberSignup,
      memberId: await lookups.memberIdForSignup(inputs.rememberSignup),
      via: "remember",
    };
  }

  if (inputs.openid) {
    const signupId = await lookups.signupIdForOpenid(inputs.openid);
    if (signupId) return { signupId, memberId: await lookups.memberIdForSignup(signupId), via: "wechat" };
  }

  return null;
}
