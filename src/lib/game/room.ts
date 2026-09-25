import { randomBytes } from "node:crypto";
// Relative, not "@/": the tests load this through Node's type stripper.
import { GUEST_ANIMALS, type Emote, type PeerView, type parseMove } from "./protocol.ts";

/**
 * Who is walking around /play right now.
 *
 * In memory, on purpose, and for the same reason the rate limiter and the
 * projector's page-turn channel are: this site runs as one long-lived Node
 * process, and presence is the kind of state that is worthless thirty
 * seconds after it was true. Nothing here is ever written to the database,
 * so a restart costs everybody one reconnect and nothing else.
 *
 * ⚠️ One process only. The moment this runs on two instances, players on one
 * stop seeing players on the other — the same line rate-limit.ts draws.
 */

/** Past this, joining still works but you walk alone; see `join`. */
export const MAX_PLAYERS = 150;

/** Gone after this long without a position update. */
const STALE_MS = 30_000;

/**
 * The fastest a player's position is accepted. The browser sends at most one
 * update per 150ms, so this costs a real player nothing; it stops a script that
 * holds a seat from rewriting its slot thousands of times a second.
 */
export const MIN_MOVE_MS = 100;

/** How long an emote stays over someone's head. */
export const EMOTE_MS = 4_000;

type Player = PeerView & { key: string; seenAt: number; memberId: string | null };

type Room = {
  players: Map<string, Player>;
  listeners: Set<(snapshot: string) => void>;
  dirty: boolean;
  timer: ReturnType<typeof setInterval> | undefined;
};

const cache = globalThis as unknown as { __vibeThursdayPlayRoom?: Room };
cache.__vibeThursdayPlayRoom ??= { players: new Map(), listeners: new Set(), dirty: false, timer: undefined };

function room(): Room {
  return cache.__vibeThursdayPlayRoom!;
}

/**
 * Admits a player and returns the credentials their moves must carry.
 *
 * The key is what stops one tab from moving another tab's character: the id
 * is broadcast to everybody, the key only ever goes back to the joiner.
 * Returns null when the room is full.
 */
export function join(identity: { memberId: string | null; name: string | null; slug: string | null }): {
  id: string;
  key: string;
  guest: [number, number] | null;
} | null {
  const r = room();
  sweep();

  if (r.players.size >= MAX_PLAYERS) return null;

  // A member opening a second tab replaces their first rather than standing
  // next to themselves.
  if (identity.memberId) {
    for (const [id, player] of r.players) if (player.memberId === identity.memberId) r.players.delete(id);
  }

  const id = randomBytes(8).toString("hex");
  const key = randomBytes(24).toString("base64url");
  const guest: [number, number] | null = identity.name
    ? null
    : [Math.floor(Math.random() * GUEST_ANIMALS), 10 + Math.floor(Math.random() * 90)];

  r.players.set(id, {
    id,
    key,
    memberId: identity.memberId,
    name: identity.name,
    slug: identity.slug,
    guest,
    // Off the map until the first move arrives, so nobody flickers in at 0,0.
    map: "none",
    x: 0,
    y: 0,
    dir: 0,
    look: { skin: 1, hair: 0, hairColor: 0, top: 0, bottom: 0, acc: 0, hat: 0, pet: -1 },
    emote: null,
    emoteAt: 0,
    seenAt: Date.now(),
  });

  schedule();
  return { id, key, guest };
}

/** Applies a validated move. False when the id/key pair is not a player. */
export function move(update: NonNullable<ReturnType<typeof parseMove>>): boolean {
  const player = room().players.get(update.id);
  if (!player || player.key !== update.key) return false;

  const now = Date.now();
  // Too soon: accepted (so the client does not think its seat is gone) but
  // dropped. An emote still gets through — it is a one-off, not a stream.
  if (now - player.seenAt < MIN_MOVE_MS && !update.emote && player.map !== "none") return true;

  player.map = update.map;
  player.x = update.x;
  player.y = update.y;
  player.dir = update.dir;
  player.look = update.look;
  player.seenAt = now;

  if (update.emote) {
    player.emote = update.emote as Emote;
    player.emoteAt = now;
  }

  room().dirty = true;
  return true;
}

export function leave(id: string, key: string): void {
  const player = room().players.get(id);
  if (player && player.key === key) {
    room().players.delete(id);
    room().dirty = true;
  }
}

function sweep(): void {
  const now = Date.now();
  for (const [id, player] of room().players) {
    if (now - player.seenAt > STALE_MS) {
      room().players.delete(id);
      room().dirty = true;
    }
  }
}

/** The room as everybody sees it: no keys, no member ids. */
export function snapshot(): string {
  const now = Date.now();
  const peers: PeerView[] = [];

  for (const player of room().players.values()) {
    if (player.map === "none") continue;
    const emoting = player.emote && now - player.emoteAt < EMOTE_MS;
    peers.push({
      id: player.id,
      name: player.name,
      slug: player.slug,
      guest: player.guest,
      map: player.map,
      x: player.x,
      y: player.y,
      dir: player.dir,
      look: player.look,
      emote: emoting ? player.emote : null,
      emoteAt: emoting ? player.emoteAt : 0,
    });
  }

  return JSON.stringify({ t: now, peers });
}

/**
 * Listens for snapshots. Returns the unsubscribe.
 *
 * One timer for the whole room rather than one per listener: every open
 * stream gets the same string, serialised once per tick.
 */
export function subscribe(listener: (snapshot: string) => void): () => void {
  room().listeners.add(listener);
  room().dirty = true;
  schedule();
  return () => {
    room().listeners.delete(listener);
  };
}

export function listenerCount(): number {
  return room().listeners.size;
}

/**
 * Five ticks a second, only while somebody is listening, and only sending
 * when something moved — plus once a second regardless, so emotes fade and
 * stale players drop off every screen.
 */
function schedule(): void {
  const r = room();
  if (r.timer) return;

  let ticks = 0;
  r.timer = setInterval(() => {
    ticks += 1;
    if (ticks % 5 === 0) {
      sweep();
      r.dirty = true;
    }

    if (r.listeners.size === 0 && r.players.size === 0) {
      clearInterval(r.timer);
      r.timer = undefined;
      return;
    }

    if (!r.dirty || r.listeners.size === 0) return;
    r.dirty = false;

    const message = snapshot();
    for (const listener of r.listeners) listener(message);
  }, 200);
}

/** For tests: empties the room and stops the timer. */
export function resetRoom(): void {
  const r = room();
  if (r.timer) clearInterval(r.timer);
  r.timer = undefined;
  r.players.clear();
  r.listeners.clear();
  r.dirty = false;
}
