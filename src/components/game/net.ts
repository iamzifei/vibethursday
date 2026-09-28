/**
 * The browser end of /play's multiplayer.
 *
 * Join once for an id and a key, listen on one event-stream for the whole
 * room, and post your own position when it changes. Every failure here
 * degrades to playing alone: the game never waits on the network, and a
 * player who is offline simply sees nobody else.
 */

import type { Dir, Emote, Look, PeerView, RoomEvent, RushView } from "@/lib/game/protocol";

type Seat = { id: string; key: string; guest: [number, number] | null; name: string | null; slug: string | null };

/** What joining paid, for a toast: today's visit, the streak, Thursday's attendance. */
export type Welcome = { points: number; streak: number; attended: boolean };

/** The rest of each stream frame: the bean, when the next one is due, and recent events. */
export type RoomState = { rush: RushView | null; nextRushAt: number | null; events: RoomEvent[]; t: number };

export type BoardEntry = { rank: number; name: string | null; slug: string | null; guest: [number, number] | null; points: number; you: boolean };
export type Board = {
  week: string | null;
  top: BoardEntry[];
  players: number;
  me: (BoardEntry & { by: Record<string, number>; gap: number }) | null;
  champion: { name: string | null; guest: [number, number] | null; points: number } | null;
};

/**
 * Where a guest's identity lives between visits (`player-id.ts`). The same
 * phone is the same animal all week, which is what lets a guest climb the board.
 */
const GUEST_KEY = "vt-play-guest";

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
    private onRoom: (room: RoomState) => void = () => {},
    private onWelcome: (welcome: Welcome) => void = () => {},
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
      let guest: string | null = null;
      try {
        guest = localStorage.getItem(GUEST_KEY);
      } catch {
        // Private mode: a new animal each visit, as before.
      }
      const response = await fetch("/api/play/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const joined = (await response.json()) as Seat & { guestToken?: string | null; welcome?: Welcome | null };
      if (joined.guestToken) {
        try {
          localStorage.setItem(GUEST_KEY, joined.guestToken);
        } catch {
          // Not kept; the next visit is a new animal.
        }
      }
      this.seat = { id: joined.id, key: joined.key, guest: joined.guest, name: joined.name, slug: joined.slug };
      this.onStatus("online", this.seat);
      if (joined.welcome && joined.welcome.points > 0) this.onWelcome(joined.welcome);
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
        const data = JSON.parse(event.data) as { peers: PeerView[]; t: number; rush?: RushView | null; nextRushAt?: number | null; events?: RoomEvent[] };
        this.onPeers(data.peers, this.seat?.id ?? null);
        this.onRoom({ rush: data.rush ?? null, nextRushAt: data.nextRushAt ?? null, events: data.events ?? [], t: data.t });
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

  /** Asks the server for the bean. It decides from where it last saw us. */
  async claim(rushId: string): Promise<boolean> {
    if (!this.seat) return false;
    await this.flush(); // make sure it knows where we are now
    try {
      const response = await fetch("/api/play/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.seat.id, key: this.seat.key, rush: rushId }),
      });
      return response.ok && ((await response.json()) as { won?: boolean }).won === true;
    } catch {
      return false;
    }
  }

  /** Tells the server one of today's tasks is done. Best-effort. */
  async daily(kind: string): Promise<void> {
    if (!this.seat) return;
    try {
      await fetch("/api/play/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.seat.id, key: this.seat.key, kind }),
      });
    } catch {
      // The board misses three points; the game carries on.
    }
  }

  /** This week's board, with this seat's own line when it has one. */
  async board(): Promise<Board | null> {
    try {
      // POST, so the seat key never sits in a URL (and so in a proxy's access log).
      const response = await fetch("/api/play/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.seat ? { id: this.seat.id, key: this.seat.key } : {}),
        cache: "no-store",
      });
      return response.ok ? ((await response.json()) as Board) : null;
    } catch {
      return null;
    }
  }

  get seatId(): string | null {
    return this.seat?.id ?? null;
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
