// Relative imports only: the tests load this through Node's type stripper.

/**
 * The world of /play: two real places and the train between them.
 *
 * The streets come from OpenStreetMap (see scripts/game-map.mjs), so a street
 * in the game is where the street is. Everything that sits on top of them —
 * landmarks, people, the ferry — is placed here by latitude and longitude and
 * snapped to the nearest tile you can stand on, which keeps this file honest
 * in the same way: to move the Opera House you would have to move it in
 * Sydney first.
 *
 * Nothing in here touches the DOM or the network, so all of it is testable.
 */

export type MapId = "harbour" | "chatswood";

/** A map as the generator writes it. */
export type GameMap = {
  name: MapId;
  width: number;
  height: number;
  tileMeters: number;
  /** south, west, north, east */
  bbox: [number, number, number, number];
  rows: string[];
  labels: { name: string; x: number; y: number; kind: "street" | "place" }[];
  /** The Harbour Bridge's pylon centres, when the map has the bridge on it. */
  bridge?: { south: [number, number]; north: [number, number] } | null;
};

export type Point = { x: number; y: number };

/**
 * Tiles a person can stand on. Everything else — water, buildings, rail,
 * trees, a viaduct's piers — blocks.
 */
const WALKABLE = new Set([".", "r", "p", "g", "s", "w", "H", "P", "u"]);

export function tileAt(map: GameMap, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "~";
  return map.rows[y][x];
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  return WALKABLE.has(tileAt(map, x, y));
}

const METERS_PER_DEG_LAT = 111_320;

/** Latitude/longitude → tile, the same projection the generator used. */
export function geoToTile(map: GameMap, lat: number, lon: number): Point {
  const [s, w, n] = map.bbox;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos(midLat);

  return {
    x: Math.floor(((lon - w) * metersPerDegLon) / map.tileMeters),
    y: Math.floor(((n - lat) * METERS_PER_DEG_LAT) / map.tileMeters),
  };
}

/**
 * The nearest tile somebody can stand on, searching outward in rings.
 *
 * Geocoded points land on rooftops as often as not — "465 Victoria Avenue" is
 * the middle of the building — and an NPC standing inside a wall cannot be
 * walked up to.
 */
export function snapWalkable(map: GameMap, from: Point, maxRadius = 12, reach?: Uint8Array): Point {
  const ok = (x: number, y: number) =>
    isWalkable(map, x, y) && (!reach || reach[y * map.width + x] === 1);

  if (ok(from.x, from.y)) return from;

  for (let r = 1; r <= maxRadius; r += 1) {
    let best: Point | null = null;
    let bestDistance = Infinity;

    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = from.x + dx;
        const y = from.y + dy;
        if (!ok(x, y)) continue;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { x, y };
        }
      }
    }

    if (best) return best;
  }

  return from;
}

/** A tile from a latitude/longitude, already snapped to walkable ground. */
export function place(map: GameMap, lat: number, lon: number, reach?: Uint8Array): Point {
  return snapWalkable(map, geoToTile(map, lat, lon), 12, reach);
}

/**
 * Every tile reachable on foot from `from`, as a mask (1 = reachable).
 *
 * The rasterised street network has the odd stranded tile — a scrap of
 * footpath boxed in by two buildings — and a landmark snapped onto one of
 * those is a landmark nobody can reach. Snapping against this mask instead
 * of plain walkability rules that out.
 */
export function reachable(map: GameMap, from: Point): Uint8Array {
  const mask = new Uint8Array(map.width * map.height);
  const stack: number[] = [from.y * map.width + from.x];

  while (stack.length) {
    const at = stack.pop()!;
    if (mask[at]) continue;
    const x = at % map.width;
    const y = Math.floor(at / map.width);
    if (!isWalkable(map, x, y)) continue;
    mask[at] = 1;
    if (x > 0) stack.push(at - 1);
    if (x < map.width - 1) stack.push(at + 1);
    if (y > 0) stack.push(at - map.width);
    if (y < map.height - 1) stack.push(at + map.width);
  }

  return mask;
}

/**
 * Shortest walk between two tiles, for tap-to-move on a phone.
 *
 * Plain breadth-first search: the maps are twenty thousand tiles at most and a
 * tap is a one-off, so A* would be more code for no noticeable difference.
 * Capped by `maxSteps` so a tap on the far side of the harbour does not walk
 * the whole graph; the caller treats null as "too far, walk closer first".
 */
export function findPath(map: GameMap, from: Point, to: Point, maxSteps = 4000): Point[] | null {
  if (!isWalkable(map, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return [];

  const key = (x: number, y: number) => y * map.width + x;
  const cameFrom = new Map<number, number>();
  const queue: number[] = [key(from.x, from.y)];
  cameFrom.set(queue[0], -1);

  let head = 0;
  const target = key(to.x, to.y);

  while (head < queue.length && head < maxSteps) {
    const current = queue[head++];
    if (current === target) break;

    const cx = current % map.width;
    const cy = Math.floor(current / map.width);

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(map, nx, ny)) continue;
      const next = key(nx, ny);
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, current);
      queue.push(next);
    }
  }

  if (!cameFrom.has(target)) return null;

  const path: Point[] = [];
  for (let at = target; at !== key(from.x, from.y); at = cameFrom.get(at)!) {
    path.push({ x: at % map.width, y: Math.floor(at / map.width) });
  }

  return path.reverse();
}

/* =============================================================================
   What stands where
============================================================================= */

/**
 * Landmarks, by real coordinates (OpenStreetMap / Nominatim, checked
 * 2026-09-25). Each one is also a stamp in the stamp book: walk within
 * `radius` tiles of it and the page is stamped.
 */
export type Landmark = {
  id: string;
  map: MapId;
  lat: number;
  lon: number;
  /** How close counts as "been there", in tiles. */
  radius: number;
};

export const LANDMARKS: Landmark[] = [
  // ── Harbour ──────────────────────────────────────────────────────
  { id: "quay", map: "harbour", lat: -33.8612, lon: 151.2107, radius: 4 },
  { id: "opera", map: "harbour", lat: -33.8575, lon: 151.2150, radius: 5 },
  { id: "customs", map: "harbour", lat: -33.8622, lon: 151.2108, radius: 3 },
  { id: "mca", map: "harbour", lat: -33.8600, lon: 151.2090, radius: 3 },
  { id: "rocks", map: "harbour", lat: -33.8589, lon: 151.2093, radius: 3 },
  { id: "pylon", map: "harbour", lat: -33.8546, lon: 151.2095, radius: 3 },
  { id: "bridge", map: "harbour", lat: -33.8522, lon: 151.2106, radius: 3 },
  { id: "luna", map: "harbour", lat: -33.8473, lon: 151.2098, radius: 4 },
  { id: "milsons", map: "harbour", lat: -33.8459, lon: 151.2118, radius: 3 },
  { id: "kirribilli", map: "harbour", lat: -33.8505, lon: 151.2185, radius: 4 },
  { id: "garden", map: "harbour", lat: -33.8610, lon: 151.2165, radius: 5 },
  // ── Chatswood ────────────────────────────────────────────────────
  { id: "station", map: "chatswood", lat: -33.79748, lon: 151.18094, radius: 4 },
  { id: "mall", map: "chatswood", lat: -33.79648, lon: 151.18224, radius: 4 },
  { id: "concourse", map: "chatswood", lat: -33.79568, lon: 151.18373, radius: 4 },
  { id: "avenue", map: "chatswood", lat: -33.79689, lon: 151.17988, radius: 3 },
  { id: "oval", map: "chatswood", lat: -33.7999, lon: 151.1819, radius: 5 },
];

/**
 * The story's people. Fictional, and deliberately a mixed cast: who you meet
 * first should not tell anybody who this game is for.
 */
export type StoryNpcId =
  | "deckhand" | "busker" | "climber" | "guard" | "stallholder" | "host" | "noticeboard"
  // Side-quest givers.
  | "barista" | "photographer" | "tourist" | "greeter" | "hunter";

export type StoryNpc = {
  id: StoryNpcId;
  map: MapId;
  lat: number;
  lon: number;
};

export const STORY_NPCS: StoryNpc[] = [
  // At the head of the wharves, where the ferries tie up.
  { id: "deckhand", map: "harbour", lat: -33.8608, lon: 151.2112 },
  // Forecourt steps, below the sails.
  { id: "busker", map: "harbour", lat: -33.8586, lon: 151.2146 },
  // South end of the deck, by the pylon.
  { id: "climber", map: "harbour", lat: -33.8538, lon: 151.2099 },
  // Milsons Point station's entrance.
  { id: "guard", map: "harbour", lat: -33.8462, lon: 151.2116 },
  // The Wharf's noticeboard, between the wharves.
  { id: "noticeboard", map: "harbour", lat: -33.8607, lon: 151.2102 },
  // Chatswood Mall, where the Thursday market sets up.
  { id: "stallholder", map: "chatswood", lat: -33.7965, lon: 151.1815 },
  // The Avenue, 465 Victoria Avenue — the address on the home page.
  { id: "host", map: "chatswood", lat: -33.79672, lon: 151.1797 },
  // ── Side quests ──────────────────────────────────────────────────
  // A coffee cart at the east end of the mall.
  { id: "barista", map: "chatswood", lat: -33.79655, lon: 151.183 },
  // Circular Quay East, on the walk to the Opera House.
  { id: "photographer", map: "harbour", lat: -33.8604, lon: 151.2128 },
  // Circular Quay West by the MCA, where the ibises work the bins.
  { id: "tourist", map: "harbour", lat: -33.8597, lon: 151.2095 },
  // Luna Park's gate.
  { id: "greeter", map: "harbour", lat: -33.8478, lon: 151.2104 },
  // The Rocks, a lane back from the water.
  { id: "hunter", map: "harbour", lat: -33.8592, lon: 151.2085 },
];

/**
 * Where the postcards are taken: the views people actually stop for. The
 * Kirribilli one is the classic — Opera House and bridge in one frame.
 */
export const PHOTO_SPOTS: { id: string; map: MapId; lat: number; lon: number }[] = [
  { id: "forecourt", map: "harbour", lat: -33.858, lon: 151.2148 },
  { id: "kirribilli", map: "harbour", lat: -33.849, lon: 151.215 },
  { id: "lunapark", map: "harbour", lat: -33.8478, lon: 151.21 },
  { id: "farmcove", map: "harbour", lat: -33.86, lon: 151.218 },
  { id: "mall", map: "chatswood", lat: -33.7965, lon: 151.1822 },
];

/** Where each map starts you, and where the train leaves you. */
export const SPAWN: Record<MapId, { lat: number; lon: number }> = {
  harbour: { lat: -33.8612, lon: 151.2112 },
  chatswood: { lat: -33.79735, lon: 151.1813 },
};

/** The two station doors, which start the train. */
export const STATIONS: Record<MapId, { lat: number; lon: number }> = {
  harbour: { lat: -33.8459, lon: 151.2118 },
  chatswood: { lat: -33.79748, lon: 151.18094 },
};

/**
 * The T1 North Shore line between the two maps, in order from the harbour.
 * Real stops, real order: from Milsons Point the line runs north through
 * North Sydney, Waverton, Wollstonecraft, St Leonards and Artarmon.
 */
export const T1_STOPS = [
  "Milsons Point",
  "North Sydney",
  "Waverton",
  "Wollstonecraft",
  "St Leonards",
  "Artarmon",
  "Chatswood",
] as const;

/** The two ferry wharves the ferry shuttles between. */
export const FERRY_WHARVES = {
  quay: { lat: -33.8604, lon: 151.2106 },
  milsons: { lat: -33.8496, lon: 151.2109 },
} as const;

/**
 * Hidden Vibe shards: out-of-the-way corners worth walking to. Tips of piers,
 * the far end of a park, a lane nobody takes.
 */
export const SHARDS: { id: string; map: MapId; lat: number; lon: number }[] = [
  { id: "h1", map: "harbour", lat: -33.8553, lon: 151.2155 }, // Bennelong Point, the northern tip
  { id: "h2", map: "harbour", lat: -33.8566, lon: 151.2062 }, // Dawes Point, under the bridge
  { id: "h3", map: "harbour", lat: -33.8565, lon: 151.2042 }, // Walsh Bay piers
  { id: "h4", map: "harbour", lat: -33.8597, lon: 151.2186 }, // Farm Cove, east shore
  { id: "h5", map: "harbour", lat: -33.8488, lon: 151.2203 }, // Kirribilli wharf
  { id: "h6", map: "harbour", lat: -33.8481, lon: 151.2089 }, // Luna Park boardwalk
  { id: "h7", map: "harbour", lat: -33.8512, lon: 151.2112 }, // mid-span of the bridge
  { id: "h8", map: "harbour", lat: -33.8487, lon: 151.2128 }, // Bradfield Park, under the north end
  { id: "h9", map: "harbour", lat: -33.8616, lon: 151.2073 }, // The Rocks lanes
  { id: "h10", map: "harbour", lat: -33.8627, lon: 151.2150 }, // Botanic Garden
  { id: "c1", map: "chatswood", lat: -33.7937, lon: 151.1862 }, // Chatswood Chase corner
  { id: "c2", map: "chatswood", lat: -33.8003, lon: 151.1822 }, // far side of the oval
  { id: "c3", map: "chatswood", lat: -33.7948, lon: 151.1790 }, // up Help Street
  { id: "c4", map: "chatswood", lat: -33.7972, lon: 151.1860 }, // Spring Street
  { id: "c5", map: "chatswood", lat: -33.7995, lon: 151.1780 }, // Pacific Highway
  { id: "c6", map: "chatswood", lat: -33.7957, lon: 151.1838 }, // The Concourse lawn
];

/**
 * Sydney's wildlife, and where each is actually found. Every one of these is
 * a real, everyday sight in these two places — including the brush turkey,
 * which has made itself at home across the North Shore, and the magpie, whose
 * spring swooping season is August to November.
 *
 * The humpback is real too: the northern migration past Sydney runs through
 * spring. It turns up rarely and only on the harbour, which is the point.
 * The golden ibis is not real, and only appears on Thursdays.
 */
export type CritterId =
  | "ibis" | "gull" | "cockatoo" | "lorikeet" | "kookaburra"
  | "dragon" | "turkey" | "magpie" | "whale" | "golden";

export type Critter = {
  id: CritterId;
  /** 1 easy … 4 very hard; sets the catch window in the befriend game. */
  rarity: 1 | 2 | 3 | 4;
  /** Where it spawns: a map and the tile kinds it likes. */
  map: MapId;
  on: string;
  /** How many live on the map at once. */
  count: number;
  /** Can walk behind you once befriended. */
  pet: boolean;
};

export const CRITTERS: Critter[] = [
  { id: "ibis", rarity: 1, map: "harbour", on: "p.", count: 5, pet: true },
  { id: "gull", rarity: 1, map: "harbour", on: "w", count: 5, pet: true },
  { id: "cockatoo", rarity: 2, map: "harbour", on: "g", count: 3, pet: true },
  { id: "dragon", rarity: 2, map: "harbour", on: "g", count: 2, pet: true },
  { id: "whale", rarity: 4, map: "harbour", on: "~", count: 1, pet: false },
  { id: "lorikeet", rarity: 2, map: "chatswood", on: "gp", count: 4, pet: true },
  { id: "kookaburra", rarity: 3, map: "chatswood", on: "g", count: 1, pet: true },
  { id: "turkey", rarity: 2, map: "chatswood", on: "g.", count: 2, pet: true },
  { id: "magpie", rarity: 3, map: "chatswood", on: "g", count: 2, pet: true },
  { id: "golden", rarity: 4, map: "chatswood", on: "p", count: 1, pet: true },
];

/**
 * Whether it is Thursday in Sydney right now.
 *
 * Sydney's own clock, not the viewer's: somebody in Beijing on Thursday
 * evening is already in Friday morning here.
 */
export function isSydneyThursday(now: Date): boolean {
  const day = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "short" }).format(now);
  return day === "Thu";
}

/** A small deterministic generator, so everyone sees critters in the same spots. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Walkable tiles of the given kinds within a box, for scattering critters and
 * standing community NPCs somewhere sensible.
 */
export function tilesOfKind(map: GameMap, kinds: string, box?: { x0: number; y0: number; x1: number; y1: number }): Point[] {
  const out: Point[] = [];
  const x0 = box?.x0 ?? 0;
  const y0 = box?.y0 ?? 0;
  const x1 = Math.min(map.width - 1, box?.x1 ?? map.width - 1);
  const y1 = Math.min(map.height - 1, box?.y1 ?? map.height - 1);

  for (let y = Math.max(0, y0); y <= y1; y += 1) {
    for (let x = Math.max(0, x0); x <= x1; x += 1) {
      if (kinds.includes(map.rows[y][x])) out.push({ x, y });
    }
  }

  return out;
}
