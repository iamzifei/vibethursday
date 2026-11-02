import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { addProgress, deleteProgress, setProgressConfirmed } from "@/lib/db";
import { parseProgressForm } from "@/lib/progress";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { sydneyToday } from "@/lib/sessions";

/** The most this route reads from a request body (see `boundedRequest`). */
const MAX_BODY = 16 * 1024;

export const dynamic = "force-dynamic";

/**
 * The organiser's edits to a work's progress record (2026-11-02, progress.ts).
 *
 * Four actions on one form post, like the rest of /admin, so the page works
 * with no client JavaScript:
 *   add       — a new entry, always a draft
 *   confirm   — the maker agreed to show it; it goes public
 *   unconfirm — back to draft
 *   delete    — gone
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
  // 303 so the browser follows with GET; a 307 would repost the form on reload.
  const back = (query: string, anchor: string) =>
    NextResponse.redirect(new URL(`/admin/progress${query}${anchor}`, origin), 303);

  const action = text("action");

  if (action === "add") {
    const parsed = parseProgressForm({
      member: text("member"),
      hash: text("hash"),
      date: text("date"),
      kind: text("kind"),
      title: text("title"),
      detail: text("detail"),
      proof: text("proof"),
    }, sydneyToday().toISOString().slice(0, 10));
    if (!parsed.ok) return back(`?err=${parsed.error}`, "");
    try {
      await addProgress(parsed.value);
    } catch {
      // A member id that is no longer there fails the foreign key: a stale form.
      return back("?err=member", "");
    }
    return back("?ok=added", `#w-${parsed.value.memberId}-${parsed.value.workHash}`);
  }

  const id = text("id");
  if (!id || !/^\d{1,18}$/.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });
  const anchor = text("anchor");
  const hash = anchor && /^w-\d+-[0-9a-z]{6}$/.test(anchor) ? `#${anchor}` : "";

  if (action === "confirm" || action === "unconfirm") {
    await setProgressConfirmed(id, action === "confirm");
    return back("", hash);
  }
  if (action === "delete") {
    await deleteProgress(id);
    return back("", hash);
  }
  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
