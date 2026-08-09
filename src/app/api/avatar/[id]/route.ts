import { getMemberAvatar } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Serves a member's avatar.
 *
 * Public: it is the picture on a public card, and the id is already in the
 * page that links here. The URL carries a `v` query the pages bump on every
 * upload, which is what makes the immutable cache below safe — a new face gets
 * a new URL rather than waiting out someone else's cache.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) return new Response(null, { status: 404 });

  const avatar = await getMemberAvatar(id);

  if (!avatar) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
