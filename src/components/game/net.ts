/**
 * The browser end of /play's multiplayer.
 *
 * Join once for an id and a key, listen on one event-stream for the whole
 * room, and post your own position when it changes. Every failure here
 * degrades to playing alone: the game never waits on the network, and a
 * player who is offline simply sees nobody else.
 */

import type { Dir, Emote, Look, PeerView } from "@/lib/game/protocol";

type Seat = { id: string; key: string; guest: [number, number] | null; name: string | null; slug: string | null };

export type NetStatus = "connecting" | "online" | "offline";

export class Net {
  private seat: Seat | null = null;
  private source: EventSource | null = null;
  private last = { map: "", x: -1, y: -1, dir: 0 as Dir, look: "" };
  private pending: { map: string; x: number; y: number; dir: Dir; look: Look; emote: Emote | null } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;
  private stopped = false;

  constructor(
    private onPeers: (peers: PeerView[], selfId: string | null) => void,
    private onStatus: (status: NetStatus, seat: Seat | null) => void,
  ) {}

  async start() {
    this.onStatus("connecting", null);
    await this.join();
    this.listen();

    // Flush at most every 150ms, and re-send the current position every five
    // seconds while standing still, so the server does not drop an idle player.
    let idle = 0;
    this.timer = setInterval(() => {
      idle += 1;
      if (this.pending) {
        void this.flush();
        idle = 0;
      } else if (idle >= 33 && this.last.map) {
        idle = 0;
        this.pending = { map: this.last.map, x: this.last.x, y: this.last.y, dir: this.last.dir, look: JSON.parse(this.last.look || "{}"), emote: null };
        void this.flush();
      }
    }, 150);

    window.addEventListener("pagehide", this.leave);
  }

  stop() {
    this.stopped = true;
    this.leave();
    this.source?.close();
    if (this.timer) clearInterval(this.timer);
    window.removeEventListener("pagehide", this.leave);
  }

  private leave = () => {
    if (!this.seat) return;
    const body = JSON.stringify({ leave: true, id: this.seat.id, key: this.seat.key });
    try {
      navigator.sendBeacon("/api/play/move", new Blob([body], { type: "application/json" }));
    } catch {
      // The tab is going either way; the server drops us in thirty seconds.
    }
  };

  private async join() {
    try {
      const response = await fetch("/api/play/join", { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      this.seat = (await response.json()) as Seat;
      this.onStatus("online", this.seat);
    } catch {
      this.seat = null;
      this.onStatus("offline", null);
    }
  }

  private listen() {
    if (this.stopped) return;
    this.source?.close();
    const source = new EventSource("/api/play/stream");
    this.source = source;
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { peers: PeerView[] };
        this.onPeers(data.peers, this.seat?.id ?? null);
      } catch {
        // A malformed frame is one missed tick, not a reason to stop.
      }
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        this.onStatus("offline", this.seat);
        setTimeout(() => this.listen(), 5000);
      }
    };
  }

  /** Queues your position. Only the latest one is ever sent. */
  update(map: string, x: number, y: number, dir: Dir, look: Look, emote: Emote | null = null) {
    const lookKey = JSON.stringify(look);
    if (!emote && map === this.last.map && x === this.last.x && y === this.last.y && dir === this.last.dir && lookKey === this.last.look) return;
    this.last = { map, x, y, dir, look: lookKey };
    this.pending = { map, x, y, dir, look, emote: emote ?? this.pending?.emote ?? null };
  }

  private async flush() {
    if (!this.seat || !this.pending || this.sending) return;
    const move = this.pending;
    this.pending = null;
    this.sending = true;
    try {
      const response = await fetch("/api/play/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.seat.id, key: this.seat.key, ...move }),
        keepalive: true,
      });
      // Our seat is gone — the server restarted, or we were idle too long.
      if (response.status === 410) {
        await this.join();
        this.pending = move;
      }
    } catch {
      this.pending = this.pending ?? move;
    } finally {
      this.sending = false;
    }
  }
}
