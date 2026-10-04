import { cookies } from "next/headers";
import { getSignupProfile } from "./db.ts";
import { readRememberToken, REMEMBER_COOKIE } from "./my-signup.ts";

/**
 * Who this browser is, from its own remember cookie, for the signup form's
 * "welcome back" (`SignupForm`'s `knownProfile`). The name only — never the
 * email or WeChat ID, which a remember cookie is too weak a proof to reveal.
 * Null when it is not remembered, and on any failure: a page must never fail
 * because of this.
 */
export async function knownProfileFromCookie(): Promise<{ name: string } | null> {
  try {
    const id = readRememberToken((await cookies()).get(REMEMBER_COOKIE)?.value);
    const profile = id ? await getSignupProfile(id) : null;
    return profile ? { name: profile.name } : null;
  } catch (error) {
    console.error("[signup] could not read the remembered profile", error);
    return null;
  }
}
