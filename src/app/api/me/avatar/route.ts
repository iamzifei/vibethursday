import { NextResponse } from "next/server";
import { clearMemberAvatar, saveMemberAvatar } from "@/lib/db";
import { sniffImage } from "@/lib/image-sniff";
import { currentMemberId } from "@/lib/member-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Server-side ceiling on an avatar.
 *
 * The browser already resizes to 512px and re-encodes as JPEG before sending,
 * so anything approaching this is a request that did not come from the editor.
 */
const MAX_BYTES = 400 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  // Keyed on the member rather than the IP: this endpoint already requires a
  // valid cookie, so the thing worth bounding is one person hammering it, not
  // one network. Every accepted request writes hundreds of kilobytes.
  if (!checkRateLimit(`avatar:${memberId}`).allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(bytes);

  if (!mime || !ALLOWED.has(mime)) {
    return NextResponse.json({ error: "bad_type" }, { status: 415 });
  }

  try {
    const version = await saveMemberAvatar(memberId, bytes, mime);
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    console.error("[avatar] failed to save", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE() {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  await clearMemberAvatar(memberId);
  return NextResponse.json({ ok: true });
}
