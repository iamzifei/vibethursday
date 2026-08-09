import { NextResponse } from "next/server";
import { clearMemberAvatar, saveMemberAvatar } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

/**
 * Server-side ceiling on an avatar.
 *
 * The browser already resizes to 512px and re-encodes as JPEG before sending,
 * so anything approaching this is a request that did not come from the editor.
 */
const MAX_BYTES = 400 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Confirms the bytes really are the image type they claim to be.
 *
 * Trusting the declared MIME would let anyone store arbitrary bytes that a
 * browser is later told to interpret as an image, so the magic number is
 * checked instead of the label.
 */
function sniff(bytes: Buffer): string | null {
  if (bytes.length > 12) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      return "image/png";
    if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP")
      return "image/webp";
  }

  return null;
}

export async function POST(request: Request) {
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);

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
