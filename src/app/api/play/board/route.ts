import { NextResponse } from "next/server";
import { board, refreshCrown } from "@/lib/game/ledger";
import { playerOf } from "@/lib/game/room";
import { bodyTooLarge } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * This week's board: the top ten, and — for the seat asking — its own rank,
 * points, where they came from, and the gap to the one above. Player keys never
 * leave the server; rows carry the display name (a member's wall name, or a
 * guest's animal and number) and a flag for "this is you".
 */
// POST rather than GET so the seat key travels in the body, never in a URL
// that proxies and access logs keep (2026-09-28 security review).
export async function POST(request: Request) {
  if (bodyTooLarge(request, 1024)) return new Response(null, { status: 413 });
  const body = (await request.json().catch(() => null)) as { id?: unknown; key?: unknown } | null;
  const me = playerOf(typeof body?.id === "string" ? body.id : "", typeof body?.key === "string" ? body.key : "");

  try {
    const [{ week, rows }, champion] = await Promise.all([board(), refreshCrown()]);
    const view = (row: (typeof rows)[number], index: number) => ({
      rank: index + 1,
      name: row.name,
      slug: row.slug,
      guest: row.guest,
      points: row.points,
      you: me ? row.player === me.playerKey : false,
    });

    const mine = me ? rows.findIndex((row) => row.player === me.playerKey) : -1;
    return NextResponse.json(
      {
        week,
        top: rows.slice(0, 10).map(view),
        players: rows.length,
        me:
          mine >= 0
            ? { ...view(rows[mine], mine), by: rows[mine].by, gap: mine > 0 ? rows[mine - 1].points - rows[mine].points : 0 }
            : null,
        champion: champion ? { name: champion.name, guest: champion.guest, points: champion.points } : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[play] could not read the board", error);
    return NextResponse.json({ week: null, top: [], players: 0, me: null, champion: null }, { status: 200 });
  }
}
