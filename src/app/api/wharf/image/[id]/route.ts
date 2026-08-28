import { getReplyImage } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * A picture attached to an answer.
 *
 * Same shape as the avatar route: bytes out of the row, no object storage. It
 * is public because the answer it belongs to is public — but see the warning
 * beside the upload control, which is the part that actually matters here.
 * A screenshot of somebody's dashboard can carry a great deal more than they
 * meant to show.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) return new Response("not found", { status: 404 });

  const image = await getReplyImage(id);
  if (!image) return new Response("not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      // Immutable: a reply's picture is never replaced, only deleted with it.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
