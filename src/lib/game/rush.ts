// Relative imports only: the tests load this through Node's type stripper.
import { geoToTile, LANDMARKS, type GameMap, type MapId, type Point } from "./world.ts";

/**
 * The coffee-bean rush: the one thing on /play that everybody online races for.
 *
 * The server drops a bean somewhere real — near a landmark, on ground you can
 * walk to — and tells everyone at once over the existing stream. Whoever the
 * *server* sees reach it first gets it. The client only asks; the answer comes
 * from the position the server already holds for that player, so a client that
 * says "I'm there" when it is not gets nothing.
 */

export const RUSH_MIN_MS = 90_000;
export const RUSH_MAX_MS = 180_000;
/** Thursday morning (`isDoubleTime`): more beans, more reasons to be online. */
export const RUSH_DOUBLE_MS = 45_000;
/** How long a bean waits before it goes. */
export const RUSH_LIFETIME_MS = 60_000;
/** How close counts as reaching it, in tiles. */
export const CLAIM_RADIUS = 1.5;
/** After a jump (a teleport, a train, a map change), this long before claiming counts. */
export const JUMP_GRACE_MS = 5_000;

/** Walking speed is 5.5 tiles a second (engine.ts); this allows for lag and bursts. */
const MAX_TILES_PER_SECOND = 9;
const JUMP_SLACK_TILES = 3;

export type Rush = { id: string; map: string; x: number; y: number; until: number };

/** Milliseconds until the next bean. */
export function nextRushDelay(rand: () => number, double: boolean): number {
  if (double) return RUSH_DOUBLE_MS;
  return Math.round(RUSH_MIN_MS + rand() * (RUSH_MAX_MS - RUSH_MIN_MS));
}

/**
 * A tile for the next bean: near a landmark on this map (where people walk
 * anyway), walkable, and reachable from the spawn (`reach`), so it is never on
 * a stranded scrap of pavement nobody can get to.
 */
export function pickRushSpot(map: GameMap, id: MapId, reach: Uint8Array, rand: () => number): Point | null {
  const marks = LANDMARKS.filter((landmark) => landmark.map === id);
  if (marks.length === 0) return null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mark = marks[Math.floor(rand() * marks.length)];
    const centre = geoToTile(map, mark.lat, mark.lon);
    const x = centre.x + Math.floor((rand() - 0.5) * 16);
    const y = centre.y + Math.floor((rand() - 0.5) * 16);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    if (reach[y * map.width + x] === 1) return { x, y };
  }
  return null;
}

/** Whether a player the server knows about can claim this bean right now. */
export function canClaim(
  rush: Rush | null,
  player: { map: string; x: number; y: number; jumpedAt: number },
  now: number,
): boolean {
  if (!rush || now > rush.until) return false;
  if (player.map !== rush.map) return false;
  if (now - player.jumpedAt < JUMP_GRACE_MS) return false;
  return Math.hypot(player.x - rush.x, player.y - rush.y) <= CLAIM_RADIUS;
}

/**
 * Whether a move covered more ground than walking could. Not refused — the
 * game has real teleports (the train, a map change, back to spawn) — only
 * remembered, so the next few seconds cannot claim a bean.
 */
export function isJump(prev: { map: string; x: number; y: number }, next: { map: string; x: number; y: number }, elapsedMs: number): boolean {
  if (prev.map !== next.map) return true;
  const allowed = (MAX_TILES_PER_SECOND * Math.max(elapsedMs, 0)) / 1000 + JUMP_SLACK_TILES;
  return Math.hypot(next.x - prev.x, next.y - prev.y) > allowed;
}
