import { NextResponse } from "next/server";
import { bodyTooLarge, boundedRequest } from "@/lib/rate-limit";
import { parseMove } from "@/lib/game/protocol";
import { flushAwards } from "@/lib/game/ledger";
import { leave, move } from "@/lib/game/room";

export const dynamic = "force-dynamic";

/**
 * A player's position, several times a second while they walk.
 *
 * Not behind the hourly IP limiter the rest of the site's writes use: a walk
 * across the bridge is a few hundred of these, and a café full of players
 * shares one address. What bounds it instead is that a move only lands for an
 * id/key pair the server handed out, is throttled per player (MIN_MOVE_MS),
 * and does nothing but overwrite that one player's slot in memory.
 *
 * ⚠️ That bounds the work a move does, not how many requests arrive. A flood
 * of requests is a job for the proxy in front of this process, not for a
 * route handler.
 */
/** A move is a few hundred bytes; anything much bigger is not one. */
const MAX_BODY = 2048;

export async function POST(request: Request) {
  // Declared length first, then counted while reading: a chunked request
  // declares none (see `boundedRequest`). A length that is not a number is
  // refused too — it used to read as NaN and slip past `>`.
  if (bodyTooLarge(request, MAX_BODY)) return new Response(null, { status: 413 });
  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response(null, { status: 413 });
  request = bounded;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  // `sendBeacon` on page hide: the tab is going, take the player out now
  // rather than leaving them standing still for thirty seconds.
  const input = body as Record<string, unknown> | null;
  if (input && input.leave === true && typeof input.id === "string" && typeof input.key === "string") {
    leave(input.id, input.key);
    return new Response(null, { status: 204 });
  }

  const update = parseMove(body);
  if (!update) return new Response(null, { status: 400 });

  // 410 tells the client its seat is gone (a restart, or it went stale) and
  // it should join again.
  if (!move(update)) return NextResponse.json({ error: "gone" }, { status: 410 });

  // A wave may just have become a high-five (room.ts); write it down.
  await flushAwards();

  return new Response(null, { status: 204 });
}
