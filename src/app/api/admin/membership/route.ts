import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { addManualMembership } from "@/lib/db";
import { parseManualMember } from "@/lib/membership-admin";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { sydneyToday } from "@/lib/sessions";

/** The most this route reads from a request body (see `boundedRequest`). */
const MAX_BODY = 8 * 1024;

export const dynamic = "force-dynamic";

/**
 * Records a 共创会员 paid outside the site (2026-11-02, membership-admin.ts),
 * so they stop being charged for Tuesdays. Organiser-only; a plain form post
 * from /admin/members, answered with a 303 back to it.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  const limited = tooMany(request, "admin-action", 300);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  const form = await bounded.formData().catch(() => null);
  const key = form?.get("key");

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, typeof key === "string" ? key : null)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 403 });
  }

  const text = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" ? value : null;
  };
  const origin = await requestOrigin();
  const back = (query: string) => NextResponse.redirect(new URL(`/admin/members${query}`, origin), 303);

  const parsed = parseManualMember(
    { name: text("name"), wechat: text("wechat"), date: text("date"), note: text("note") },
    sydneyToday().toISOString().slice(0, 10),
  );
  if (!parsed.ok) return back(`?err=${parsed.error}`);

  const result = await addManualMembership(parsed.value);
  return back(`?ok=${result}`);
}
