import { getMemberAvatar } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

/**
 * Serves a member's avatar.
 *
 * Public for a public card, and the id is already in the page that links here.
 * Not public for a hidden or unpublished one — the ids are sequential, so
 * without that check anyone could walk the range and collect photos belonging
 * to cards their owners had deliberately kept off the wall.
 *
 * The URL carries a `v` the pages bump on every upload, which is what makes the
 * immutable cache safe: a new face gets a new URL rather than waiting out
 * someone else's cache.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) return new Response(null, { status: 404 });

  const avatar = await getMemberAvatar(id, await currentMemberId());

  if (!avatar) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.bytes.length),
      // Private, because whether these bytes exist depends on who is asking:
      // the owner sees their own draft photo and nobody else does.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
