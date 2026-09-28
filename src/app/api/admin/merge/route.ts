import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { mergeSignups } from "@/lib/db";
import { bodyTooLarge, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  same: "两边是同一条。",
  missing: "有一条已经不存在了。",
  "two-cards": "两条都有名片，先在成员墙那边决定留哪张。",
};

/**
 * Folds one signup into another (`mergeSignups`): the same person signed up
 * twice. The organiser picks both ids; nothing here guesses that two rows match.
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

  const keep = form?.get("keep");
  const drop = form?.get("drop");

  if (typeof keep !== "string" || !/^\d+$/.test(keep) || typeof drop !== "string" || !/^\d+$/.test(drop)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = await mergeSignups(keep, drop);
  const msg = result.ok ? `已把 #${drop} 并进 #${keep}` : `没合并：${REASONS[result.reason] ?? result.reason}`;

  const url = new URL("/admin", await requestOrigin());
  url.searchParams.set("msg", msg);
  url.hash = "merge";
  return NextResponse.redirect(url, 303);
}
