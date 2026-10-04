import { wechatConfigured } from "./wechat-auth.ts";

/**
 * The visible "Log in with WeChat" link (2026-10-05: with only the silent
 * login, nobody could tell WeChat login existed). Null while login is off, so
 * no page offers a door that leads nowhere.
 *
 * `back` is where /login sends them once they are recognised.
 */
export function wechatLoginHref(back: string, langParam: string | null | undefined): string | null {
  if (!wechatConfigured()) return null;
  const params = new URLSearchParams({ next: back });
  if (langParam) params.set("lang", langParam);
  return `/login?${params.toString()}`;
}
