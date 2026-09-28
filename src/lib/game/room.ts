import { randomBytes } from "node:crypto";
// Relative, not "@/": the tests load this through Node's type stripper.
import { GUEST_ANIMALS, type Emote, type PeerView, type parseMove, type RoomEvent } from "./protocol.ts";
import { DOUBLE, HIGH_FIVE_PAIRS_PER_DAY, isDoubleTime, pairKey, POINTS, sydneyDate, type Award } from "./points.ts";
import { canClaim, isJump, nextRushDelay, type Rush } from "./rush.ts";
import { guestIdentity } from "./player-id.ts";

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

type Player = PeerView & {
  key: string;
  seenAt: number;
  memberId: string | null;
  /**
   * Who this is on the weekly board: "m:<memberId>", "g:<guestId>" for a guest
   * with a token, or "s:<seat id>" for one without. Server-only — like the key
   * and the member id, never in a snapshot.
   */
  playerKey: string;
  /** When the server last saw this player move further than walking allows. */
  jumpedAt: number;
  /** When the server last saw this player wave. */
  waveAt: number;
};

/** How close two players must stand for a wave each to count as a high-five. */
const HIGH_FIVE_RANGE = 2.5;
/** How close together the two waves must be. */
const HIGH_FIVE_WINDOW_MS = 4_000;

/** A point earned in the room, waiting for the route to write it down. */
export type RoomAward = Award & {
  player: string;
  name: string | null;
  slug: string | null;
  guest: [number, number] | null;
};

type Room = {
  players: Map<string, Player>;
  listeners: Set<(snapshot: string) => void>;
  dirty: boolean;
  timer: ReturnType<typeof setInterval> | undefined;
  /** The bean on the map right now, if any. */
  rush: Rush | null;
  nextRushAt: number;
  /** Supplied by the route, which can load the maps; null in tests. */
  spawner: ((now: number, maps: string[]) => Rush | null) | null;
  /** Recent things worth a toast on every screen, newest last. */
  events: RoomEvent[];
  /** High-five pairs paid today, and how many each player has been paid for. */
  day: string;
  pairs: Set<string>;
  pairCount: Map<string, number>;
  /** Earned in the room, not yet written down (`drainAwards`). */
  pending: RoomAward[];
  /** Last week's winner, who wears the crown this week. */
  crown: string | null;
  /** Beans won today, per player (`RUSH_WINS_PER_DAY`). */
  rushDay: string;
  rushWins: Map<string, number>;
};

/** Most beans one player can win in a Sydney day. */
export const RUSH_WINS_PER_DAY = 10;

function emptyRoom(): Room {
  return {
    players: new Map(),
    listeners: new Set(),
    dirty: false,
    timer: undefined,
    rush: null,
    nextRushAt: 0,
    spawner: null,
    events: [],
    day: "",
    pairs: new Set(),
    pairCount: new Map(),
    pending: [],
    crown: null,
    rushDay: "",
    rushWins: new Map(),
  };
}

const cache = globalThis as unknown as { __vibeThursdayPlayRoom?: Room };
cache.__vibeThursdayPlayRoom ??= emptyRoom();

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
export function join(identity: {
  memberId: string | null;
  name: string | null;
  slug: string | null;
  /** From a guest token (`player-id.ts`): the same animal and board line every visit. */
  guestId?: string | null;
}): {
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
    : identity.guestId
      ? guestIdentity(identity.guestId)
      : [Math.floor(Math.random() * GUEST_ANIMALS), 10 + Math.floor(Math.random() * 90)];
  const playerKey = identity.memberId ? `m:${identity.memberId}` : identity.guestId ? `g:${identity.guestId}` : `s:${id}`;

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
    playerKey,
    jumpedAt: 0,
    waveAt: 0,
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

  // Faster than walking — a train, a map change, back to spawn, or a script.
  // Not refused (the game really does teleport you); remembered, so the next
  // few seconds cannot claim a bean.
  if (player.map === "none" || isJump(player, update, now - player.seenAt)) player.jumpedAt = now;

  player.map = update.map;
  player.x = update.x;
  player.y = update.y;
  player.dir = update.dir;
  player.look = update.look;
  player.seenAt = now;

  if (update.emote) {
    player.emote = update.emote as Emote;
    player.emoteAt = now;
    if (update.emote === "wave") {
      player.waveAt = now;
      highFives(player, now);
    }
  }

  room().dirty = true;
  return true;
}

function awardFor(player: Player, award: Award): RoomAward {
  return { ...award, player: player.playerKey, name: player.name, slug: player.slug, guest: player.guest };
}

/**
 * Pays a high-five to each pair the server sees waving at each other, close
 * together, within a few seconds — once per pair per Sydney day, and for at
 * most `HIGH_FIVE_PAIRS_PER_DAY` different people each, so two phones in one
 * pocket are worth a handful of points, not a fortune.
 */
function highFives(waver: Player, now: number): void {
  const r = room();
  const today = sydneyDate(new Date(now));
  if (r.day !== today) {
    r.day = today;
    r.pairs.clear();
    r.pairCount.clear();
  }

  for (const other of r.players.values()) {
    if (other === waver || other.playerKey === waver.playerKey) continue;
    if (other.map !== waver.map || now - other.waveAt > HIGH_FIVE_WINDOW_MS) continue;
    if (Math.hypot(other.x - waver.x, other.y - waver.y) > HIGH_FIVE_RANGE) continue;

    const pair = pairKey(waver.playerKey, other.playerKey);
    if (r.pairs.has(pair)) continue;
    if ((r.pairCount.get(waver.playerKey) ?? 0) >= HIGH_FIVE_PAIRS_PER_DAY) continue;
    if ((r.pairCount.get(other.playerKey) ?? 0) >= HIGH_FIVE_PAIRS_PER_DAY) continue;

    r.pairs.add(pair);
    r.pairCount.set(waver.playerKey, (r.pairCount.get(waver.playerKey) ?? 0) + 1);
    r.pairCount.set(other.playerKey, (r.pairCount.get(other.playerKey) ?? 0) + 1);

    const points = POINTS.highFive * (isDoubleTime(new Date(now)) ? DOUBLE : 1);
    const ref = `${today}:${pair}`;
    r.pending.push(awardFor(waver, { reason: "highfive", ref, points }), awardFor(other, { reason: "highfive", ref, points }));
    pushEvent({ type: "highfive", a: waver.id, b: other.id, at: now });
  }
}

function pushEvent(event: RoomEvent): void {
  const r = room();
  r.events.push(event);
  if (r.events.length > 8) r.events.splice(0, r.events.length - 8);
  r.dirty = true;
}

/**
 * Takes the bean, if the server's own record of this player puts them next to
 * it. The client only asks; a client that claims from across the map, or a
 * moment after teleporting, gets nothing.
 */
export function claimRush(id: string, key: string, rushId: string): boolean {
  const r = room();
  const player = r.players.get(id);
  if (!player || player.key !== key) return false;
  if (!r.rush || r.rush.id !== rushId) return false;

  const now = Date.now();
  if (!canClaim(r.rush, player, now)) return false;

  // A ceiling on beans a day, so a script parked beside every spawn cannot
  // take them all (2026-09-28 review). Far above what a person collects.
  const today = sydneyDate(new Date(now));
  if (r.rushDay !== today) {
    r.rushDay = today;
    r.rushWins.clear();
  }
  if ((r.rushWins.get(player.playerKey) ?? 0) >= RUSH_WINS_PER_DAY) return false;
  r.rushWins.set(player.playerKey, (r.rushWins.get(player.playerKey) ?? 0) + 1);

  const points = POINTS.rush * (isDoubleTime(new Date(now)) ? DOUBLE : 1);
  r.pending.push(awardFor(player, { reason: "rush", ref: rushId, points }));
  pushEvent({ type: "rush", by: player.id, name: player.name, guest: player.guest, at: now });
  r.rush = null;
  r.nextRushAt = now + nextRushDelay(Math.random, isDoubleTime(new Date(now)));
  return true;
}

/** Everything earned since the last call, for the route to write down. */
export function drainAwards(): RoomAward[] {
  const r = room();
  const out = r.pending;
  r.pending = [];
  return out;
}

/** Where beans come from. Set by the route, which can load the maps. */
export function setRushSpawner(spawner: (now: number, maps: string[]) => Rush | null): void {
  room().spawner = spawner;
}

/** For tests, and for the spawner: put a bean down now. */
export function setRush(rush: Rush | null): void {
  room().rush = rush;
  room().dirty = true;
}

/** Last week's winner, by player key; null for nobody. */
export function setCrown(playerKey: string | null): void {
  if (room().crown === playerKey) return;
  room().crown = playerKey;
  room().dirty = true;
}

/** The player key behind a seat, for the routes. Never sent to other players. */
export function playerOf(id: string, key: string): { playerKey: string; name: string | null; slug: string | null; guest: [number, number] | null } | null {
  const player = room().players.get(id);
  if (!player || player.key !== key) return null;
  return { playerKey: player.playerKey, name: player.name, slug: player.slug, guest: player.guest };
}

/** Beans: expire an old one, drop a new one when it is time and someone is about. */
function tickRush(now: number): void {
  const r = room();
  if (r.rush && now > r.rush.until) {
    r.rush = null;
    r.nextRushAt = now + nextRushDelay(Math.random, isDoubleTime(new Date(now)));
    r.dirty = true;
  }
  if (r.rush || !r.spawner) return;
  if (r.nextRushAt === 0) r.nextRushAt = now + nextRushDelay(Math.random, isDoubleTime(new Date(now)));
  // On a map somebody is actually on — a bean in Chatswood while everyone is
  // at the harbour is a bean nobody races for.
  const maps = [...new Set([...r.players.values()].map((player) => player.map))].filter(
    (map) => map === "harbour" || map === "chatswood",
  );
  if (maps.length === 0 || now < r.nextRushAt) return;
  r.rush = r.spawner(now, maps);
  r.nextRushAt = now + nextRushDelay(Math.random, isDoubleTime(new Date(now)));
  r.dirty = true;
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
      crown: room().crown !== null && player.playerKey === room().crown ? true : undefined,
    });
  }

  const r = room();
  return JSON.stringify({
    t: now,
    peers,
    rush: r.rush ? { id: r.rush.id, map: r.rush.map, x: r.rush.x, y: r.rush.y, until: r.rush.until } : null,
    nextRushAt: r.rush ? null : r.nextRushAt || null,
    events: r.events.filter((event) => now - event.at < 10_000),
  });
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
      tickRush(Date.now());
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
  Object.assign(r, emptyRoom());
}
