import { clampIndex, subscribe, type DeckState } from "@/lib/deck";
import { getDeck } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The live page-turn channel, as an event-stream.
 *
 * Server-sent events rather than a websocket because this site runs as a
 * long-lived Node process (Zeabur, `next start`), so an open response costs
 * nothing to hold, and the traffic only ever goes one way: the presenter
 * turns the page, the room follows. A websocket would add a dependency and a
 * second protocol to reconnect correctly for no capability this needs.
 *
 * `EventSource` reconnects on its own, and every message carries the absolute
 * page number rather than "next" — so a viewer that was disconnected for a
 * minute is correct the instant it reconnects, with no replay and no sequence
 * numbers to get wrong.
 */
const HEARTBEAT_MS = 20_000;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const deck = await getDeck(code);
  if (!deck) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let live = true;

      // Teardown is collected rather than referenced by name so that `close`
      // can be defined before the things it undoes exist. It has to be: the
      // very first `send` below can fail on a connection that died between the
      // route being entered and the stream starting, and that path calls
      // `close` while the subscription and the heartbeat are still to come.
      const cleanups: Array<() => void> = [];

      const close = () => {
        if (!live) return;
        live = false;

        for (const undo of cleanups.splice(0)) undo();

        try {
          controller.close();
        } catch {
          // Already closed by the runtime when the socket went away.
        }
      };

      const write = (chunk: string) => {
        if (!live) return;

        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client is gone. Tear down rather than keep a dead listener in
          // the room's set for the rest of the process's life.
          close();
        }
      };

      const send = (state: DeckState) => write(`data: ${JSON.stringify(state)}\n\n`);

      // The current page, immediately. A viewer scanning the QR halfway through
      // a talk has to land on the page the room is on, not on page one.
      //
      // Sent before subscribing, which leaves a sliver in which a page turn is
      // missed. Subscribing first would trade it for a worse one — a fresh turn
      // arriving and then being overwritten by this older snapshot. Either way
      // the viewer's ten-second poll is the floor that closes it.
      send({
        index: clampIndex(deck.currentIndex, deck.slideCount),
        slideCount: deck.slideCount,
        rev: deck.rev,
      });

      cleanups.push(subscribe(code, send));

      // Comment frames, which `EventSource` ignores. They exist to keep the
      // connection from being reaped by a proxy or a phone's radio during the
      // quiet minutes of a talk when nobody is turning any pages.
      const heartbeat = setInterval(() => write(`: keep-alive\n\n`), HEARTBEAT_MS);
      cleanups.push(() => clearInterval(heartbeat));

      request.signal.addEventListener("abort", close);
    },

    cancel() {
      // The `start` closure owns teardown; reaching here means the consumer
      // went away, which fires `abort` and runs `close` above.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // `no-transform` matters as much as `no-store`: a proxy that helpfully
      // buffers or compresses this would hold every page turn until the buffer
      // filled, which looks exactly like the feature being broken.
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
