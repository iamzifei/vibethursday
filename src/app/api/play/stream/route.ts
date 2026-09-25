import { listenerCount, snapshot, subscribe } from "@/lib/game/room";

export const dynamic = "force-dynamic";

/** Past this many open streams, new ones are turned away rather than queued. */
const MAX_LISTENERS = 300;

const HEARTBEAT_MS = 20_000;

/**
 * Everybody else in /play, as an event-stream.
 *
 * Server-sent events, the same channel the projector's page turns use and
 * for the same reasons (see api/deck/[code]/stream): a long-lived Node
 * process, and traffic that is almost all one way. Moves go up as ordinary
 * POSTs. Every message is the whole room, so a phone that dropped off for a
 * minute is correct the instant it reconnects.
 */
export async function GET(request: Request) {
  if (listenerCount() >= MAX_LISTENERS) return new Response("busy", { status: 503 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let live = true;
      const cleanups: Array<() => void> = [];

      const close = () => {
        if (!live) return;
        live = false;
        for (const undo of cleanups.splice(0)) undo();
        try {
          controller.close();
        } catch {
          // Already closed when the socket went away.
        }
      };

      const write = (chunk: string) => {
        if (!live) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      write(`data: ${snapshot()}\n\n`);
      cleanups.push(subscribe((message) => write(`data: ${message}\n\n`)));

      const heartbeat = setInterval(() => write(`: keep-alive\n\n`), HEARTBEAT_MS);
      cleanups.push(() => clearInterval(heartbeat));

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
