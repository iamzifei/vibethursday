import { randomBytes } from "node:crypto";
import harbourMap from "@/lib/game/maps/harbour.json";
import chatswoodMap from "@/lib/game/maps/chatswood.json";
import { pickRushSpot, RUSH_LIFETIME_MS, type Rush } from "@/lib/game/rush";
import { setRushSpawner } from "@/lib/game/room";
import { place, reachable, SPAWN, type GameMap, type MapId } from "@/lib/game/world";

/**
 * The server's copy of the maps, for placing beans — kept out of room.ts so the
 * tests (which cannot import JSON) can load the room without them. The masks
 * are "reachable from the spawn", the same test the client uses for landmarks.
 */
const MAPS: Record<MapId, { map: GameMap; reach: Uint8Array }> = (() => {
  const build = (id: MapId, map: GameMap) => ({
    map,
    reach: reachable(map, place(map, SPAWN[id].lat, SPAWN[id].lon)),
  });
  return {
    harbour: build("harbour", harbourMap as unknown as GameMap),
    chatswood: build("chatswood", chatswoodMap as unknown as GameMap),
  };
})();

let installed = false;

/** Hands the room a bean-maker, once per process. Called from the routes. */
export function installRushSpawner(): void {
  if (installed) return;
  installed = true;
  setRushSpawner((now: number, maps: string[]): Rush | null => {
    const id = maps[Math.floor(Math.random() * maps.length)] as MapId;
    const entry = MAPS[id];
    if (!entry) return null;
    const spot = pickRushSpot(entry.map, id, entry.reach, Math.random);
    if (!spot) return null;
    return { id: randomBytes(6).toString("hex"), map: id, x: spot.x, y: spot.y, until: now + RUSH_LIFETIME_MS };
  });
}
