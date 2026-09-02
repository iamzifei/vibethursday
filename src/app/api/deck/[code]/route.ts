import { NextResponse } from "next/server";
import { keyMatches, listenerCount, publish } from "@/lib/deck";
import { getDeck, setDeckIndex } from "@/lib/db";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

/**
 * Turns the page for the whole room.
 *
 * Writes to Postgres first and broadcasts second, in that order deliberately.
 * The broadcast is the fast path and the row is the truth: a phone that misses
 * the event — asleep in a pocket, on a stream that died in a lift — reads the
 * row when it comes back and lands on the right page. Broadcasting first would
 * make a failed write show up as a room that turned and then turned back.
 */
export async function POST(request: Request, { params }: Context) {
  const { code } = await params;

  const body = await request.json().catch(() => null);
  const providedKey = typeof body?.key === "string" ? body.key : undefined;
  const requested = Number(body?.index);

  const deck = await getDeck(code);
  if (!deck) return NextResponse.json({ error: "no_such_deck" }, { status: 404 });

  if (!keyMatches(providedKey, deck.presenterKey)) {
    return NextResponse.json({ error: "not_presenter" }, { status: 403 });
  }

  if (!Number.isFinite(requested)) {
    return NextResponse.json({ error: "bad_index" }, { status: 400 });
  }

  const state = await setDeckIndex(code, requested);
  if (!state) return NextResponse.json({ error: "no_such_deck" }, { status: 404 });

  publish(code, state);

  return NextResponse.json(state);
}

/** Where the room is now. The fallback for a viewer whose event-stream is not
 *  running, and the first thing a viewer reads on load. */
export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;

  const deck = await getDeck(code);
  if (!deck) return NextResponse.json({ error: "no_such_deck" }, { status: 404 });

  return NextResponse.json(
    // `viewers` is how many phones hold an open stream to this instance. The
    // presenter reads it as "the room is actually with me" before starting —
    // the alternative is finding out mid-talk that nobody's code worked.
    {
      index: deck.currentIndex,
      slideCount: deck.slideCount,
      rev: deck.rev,
      viewers: listenerCount(code),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
