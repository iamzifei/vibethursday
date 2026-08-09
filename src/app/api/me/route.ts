import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMemberById, saveMember, SlugTakenError } from "@/lib/db";
import { currentMemberId, MEMBER_COOKIE } from "@/lib/member-auth";
import { fallbackSlug, parseProfile } from "@/lib/members";

export const dynamic = "force-dynamic";

/** Saves the signed-in member's own card. */
export async function POST(request: Request) {
  const memberId = await currentMemberId();

  if (!memberId) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseProfile(payload as Record<string, unknown>);

  if (!parsed.displayName) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }

  // The card must always be reachable at some address. An empty or unusable
  // handle falls back to the generated one rather than failing the save.
  const slug = parsed.slug ?? fallbackSlug(memberId);

  try {
    await saveMember(memberId, { ...parsed, slug });
  } catch (error) {
    if (error instanceof SlugTakenError) {
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }

    console.error("[me] failed to save", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // The editor needs the stored slug back: it may differ from what was typed,
  // and the "view my card" link points at it.
  const saved = await getMemberById(memberId);

  return NextResponse.json({ ok: true, slug: saved?.slug ?? slug, published: saved?.published ?? false });
}

/** Signs out. Nothing to revoke server-side — the cookie was the whole session. */
export async function DELETE() {
  (await cookies()).delete(MEMBER_COOKIE);
  return NextResponse.json({ ok: true });
}
