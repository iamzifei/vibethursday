import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { removePersonRole, setPersonRole } from "@/lib/db";
import { isRoleKind } from "@/lib/person-roles";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";

const MAX_BODY = 8 * 1024;

export const dynamic = "force-dynamic";

/**
 * Adds or removes a 共建者 / 导师团 role (2026-11-02, person-roles.ts).
 * Organiser-only; a form post from /admin/roles, answered with a 303 back.
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

  const signupId = form?.get("signupId");
  const role = form?.get("role");
  const action = form?.get("action");
  const noteRaw = form?.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 200) : null;
  if (typeof signupId !== "string" || !/^\d{1,18}$/.test(signupId) || !isRoleKind(role)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const origin = await requestOrigin();
  try {
    if (action === "remove") await removePersonRole(signupId, role);
    else await setPersonRole(signupId, role, note);
  } catch {
    // A signup that no longer exists fails the foreign key: a stale form.
    return NextResponse.redirect(new URL(`/admin/roles?err=1#${role}`, origin), 303);
  }
  return NextResponse.redirect(new URL(`/admin/roles#${role}`, origin), 303);
}
