import { NextResponse } from "next/server";
import { flushAwards, invalidateBoard } from "@/lib/game/ledger";
import { claimRush } from "@/lib/game/room";
import { bodyTooLarge } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * "I think I'm on the bean." The room decides, from the position it already
 * holds for this seat (`claimRush`) — the request carries nothing but who is
 * asking and which bean. Bounded the same way moves are: only a seat's own
 * id/key pair does anything, and a bean can be taken once.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, 1024)) return new Response(null, { status: 413 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const key = typeof body?.key === "string" ? body.key : "";
  const rush = typeof body?.rush === "string" ? body.rush : "";
  if (!/^[a-z0-9]{8,24}$/.test(id) || !/^[A-Za-z0-9_-]{16,64}$/.test(key) || !/^[a-f0-9]{6,24}$/.test(rush)) {
    return new Response(null, { status: 400 });
  }

  const won = claimRush(id, key, rush);
  if (won) {
    await flushAwards();
    invalidateBoard();
  }
  return NextResponse.json({ won }, { headers: { "Cache-Control": "no-store" } });
}
