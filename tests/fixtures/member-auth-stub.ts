// Test stand-in for src/lib/member-auth.ts: everything is the real module
// except `currentMemberId`, which reports a signed-in member instead of
// reading a cookie (that needs a live Next request). See alias-hooks.mjs.
export * from "../../src/lib/member-auth.ts";

export async function currentMemberId(): Promise<string | null> {
  return "1";
}
