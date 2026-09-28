import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { correctWechat } from "@/lib/db";
import { bodyTooLarge, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Puts the right WeChat ID on a signup whose ID box held a nickname
 * (`correctWechat`). The old value is kept as one they used to go by, so it
 * still finds them. A plain form post with a 303 back, like every /admin action.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, 16 * 1024)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const key = form?.get("key");

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const id = form?.get("id");
  const wechat = typeof form?.get("wechat") === "string" ? (form?.get("wechat") as string).trim() : "";

  if (typeof id !== "string" || !/^\d+$/.test(id) || !wechat || wechat.length > 60) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await correctWechat(id, wechat);
  const msg = result.ok ? `微信号已改成 ${wechat}` : result.reason === "taken" ? `没改：${wechat} 已经在另一条报名上（${result.takenBy}）。是同一个人的话，用下面的「合并」。` : "没改：这条报名不存在了。";

  const url = new URL("/admin", await requestOrigin());
  url.searchParams.set("msg", msg);
  url.hash = "wechat-fix";
  return NextResponse.redirect(url, 303);
}
