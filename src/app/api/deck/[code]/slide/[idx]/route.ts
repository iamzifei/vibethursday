import { getDeckSlide } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * One page of a deck.
 *
 * Public, because the deck is being shown to a room and the code is read out
 * loud in it. Fetched one page at a time rather than as a bundle: the venue
 * has no wifi, so every phone is on mobile data, and the difference between
 * "first page in a second" and "whole deck before anything appears" is the
 * difference between this working and not.
 *
 * `immutable` is the other half of that. A page is never rewritten — clearing
 * a deck deletes the rows — so flipping back through a talk costs nothing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; idx: string }> },
) {
  const { code, idx } = await params;

  if (!/^\d{1,3}$/.test(idx)) return new Response("not found", { status: 404 });

  const slide = await getDeckSlide(code, Number(idx));
  if (!slide) return new Response("not found", { status: 404 });

  return new Response(new Uint8Array(slide.bytes), {
    headers: {
      "Content-Type": slide.mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
