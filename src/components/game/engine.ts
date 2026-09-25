/**
 * The game loop for /play: one canvas, one requestAnimationFrame.
 *
 * The engine owns everything that happens sixty times a second — walking,
 * the camera, who is standing where, what is drawn — and nothing that is a
 * decision. When the player presses A next to somebody, or walks into a
 * landmark, the engine reports it through `events` and the React layer
 * decides what that means: a dialogue, a stamp, a train. Keeping the story
 * out of here is what lets the story be edited without touching a frame loop.
 */

import {
  CRITTERS,
  FERRY_WHARVES,
  LANDMARKS,
  PHOTO_SPOTS,
  SHARDS,
  STATIONS,
  STORY_NPCS,
  findPath,
  hashString,
  isSydneyThursday,
  isWalkable,
  place,
  reachable,
  seeded,
  tileAt,
  tilesOfKind,
  type CritterId,
  type GameMap,
  type MapId,
  type Point,
  type StoryNpcId,
} from "@/lib/game/world";
import { PETS, isPhrase, type Dir, type Emote, type Look, type PeerView } from "@/lib/game/protocol";
import { iconCanvas, type IconName } from "./icons";
import {
  CHAR_H,
  CHAR_W,
  CHUNK,
  TILE,
  bridgeGeometry,
  cameraSign,
  characterSprite,
  critterSprite,
  drawBridge,
  drawBridgeDeck,
  ferrySprite,
  lookFromSeed,
  lunaFace,
  noticeboard,
  operaHouse,
  renderChunk,
  roundBuilding,
  shardSprite,
  signpost,
  stall,
  type BridgeGeometry,
} from "./art";

/* =============================================================================
   What the world is told, and what it reports
============================================================================= */

export type CommunityMember = {
  slug: string;
  name: string;
  headline: string | null;
  roles: string[];
  lookingFor: string | null;
  canHelp: string | null;
  tags: string[];
  avatar: string | null;
  products: { title: string; tagline: string | null; url: string | null; stage: string | null }[];
};

export type CommunityWork = {
  key: string;
  slug: string;
  maker: string;
  title: string;
  tagline: string | null;
  url: string | null;
  stage: string | null;
};

export type CommunityQuestion = { id: string; text: string; name: string; slug: string };

export type Community = {
  members: CommunityMember[];
  works: CommunityWork[];
  questions: CommunityQuestion[];
};

export type Interaction =
  | { kind: "story"; id: StoryNpcId }
  | { kind: "member"; index: number }
  | { kind: "stall"; index: number }
  | { kind: "critter"; id: CritterId; uid: number }
  | { kind: "station"; map: MapId }
  | { kind: "ferry"; to: "milsons" | "quay" }
  | { kind: "peer"; id: string }
  | { kind: "walker"; index: number }
  | { kind: "photo"; id: string };

/** Something the quest guide can point at. */
export type Locate =
  | { kind: "story"; id: StoryNpcId }
  | { kind: "station"; map: MapId }
  | { kind: "landmark"; id: string }
  | { kind: "member"; exclude: string[] }
  | { kind: "stall"; exclude: string[] }
  | { kind: "shard"; exclude: string[] }
  | { kind: "photo"; exclude: string[] }
  | { kind: "critter"; id: CritterId }
  | { kind: "walker" };

export type Target = { map: MapId; x: number; y: number };

export type EngineEvents = {
  /** What pressing A would do right now, or null. Changes rarely. */
  onPrompt: (prompt: Interaction | null) => void;
  onInteract: (what: Interaction) => void;
  /** Called on every completed step: where the player now stands. */
  onStep: (map: MapId, x: number, y: number) => void;
  onLandmark: (id: string) => void;
  /** Every time you walk into a landmark's radius, not just the first. */
  onArrive: (id: string) => void;
  /** You came within earshot of one of the story's people. */
  onNear: (id: StoryNpcId) => void;
  onShard: (id: string) => void;
  /** Where the player is, for the network. Throttled by the caller. */
  onMove: (map: MapId, x: number, y: number, dir: Dir) => void;
  onTooFar: () => void;
};

type Actor = {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t: number;
  dir: Dir;
  moving: boolean;
  frame: number;
  path: Point[];
};

type Entity = {
  kind: "story" | "member" | "stall" | "critter" | "station" | "ferry" | "board" | "walker" | "photo";
  /** A line of speech over their head, until the engine clock passes `until`. */
  speech?: { text: string; until: number };
  /** Walkers stop to talk; this is when they may move again. */
  pauseUntil?: number;
  storyId?: StoryNpcId;
  /** Member slug, stall key, photo spot id — what the quest guide excludes by. */
  ref?: string;
  x: number;
  y: number;
  interaction: Interaction | null;
  look?: Look;
  actor?: Actor;
  critter?: CritterId;
  uid?: number;
  /** Tile kinds a wandering thing stays on. */
  roam?: string;
  home?: Point;
  nextMove?: number;
  label?: string;
  sprite?: HTMLCanvasElement;
  spriteLift?: number;
};

type Peer = PeerView & { dx: number; dy: number; seen: number; frame: number; moving: boolean };

const SPEED = 5.5; // tiles per second
const WALKER_SPEED = 2.2;
const DIRS: Record<Dir, [number, number]> = { 0: [0, 1], 1: [-1, 0], 2: [1, 0], 3: [0, -1] };

function newActor(x: number, y: number): Actor {
  return { x, y, fromX: x, fromY: y, toX: x, toY: y, t: 1, dir: 0, moving: false, frame: 0, path: [] };
}

/* =============================================================================
   The engine
============================================================================= */

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private maps: Record<MapId, GameMap>;
  private reach: Record<MapId, Uint8Array>;
  private chunks = new Map<string, HTMLCanvasElement>();
  private entities: Record<MapId, Entity[]> = { harbour: [], chatswood: [] };
  private bridge: BridgeGeometry | null;
  private opera: { x: number; y: number; w: number; h: number } | null = null;

  map: MapId;
  private player: Actor;
  private look: Look;
  private trail: Point[] = [];
  private pet: Actor | null = null;

  private held = new Set<Dir>();
  private heldOrder: Dir[] = [];
  private pendingInteract: Interaction | null = null;
  private prompt: Interaction | null = null;
  private peers = new Map<string, Peer>();
  private collectedShards: Set<string>;
  private visited: Set<string>;
  private emote: { icon: IconName; until: number } | null = null;
  private speech: { text: string; until: number } | null = null;
  private objective: Target | null = null;
  private markers = new Map<StoryNpcId, "!" | "?">();
  /** Title-screen mode: no player, the camera tours the harbour on its own. */
  private demo = false;
  private tour = 0;
  private inside = new Set<string>();
  private near = new Set<StoryNpcId>();

  private unit = 4;
  private camX = 0;
  private camY = 0;
  private raf = 0;
  private last = 0;
  private paused = false;
  private time = 0;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    maps: Record<MapId, GameMap>,
    private community: Community,
    start: { map: MapId; x: number; y: number; look: Look; shards: string[]; stamps: string[]; demo?: boolean },
    private events: EngineEvents,
    private labels: { guestName: (animal: number, n: number) => string; phrase: (id: Emote) => string },
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.demo = start.demo ?? false;
    this.maps = maps;
    this.map = start.map;
    this.look = start.look;
    this.collectedShards = new Set(start.shards);
    this.visited = new Set(start.stamps);

    const spawnOf = (id: MapId) => place(maps[id], id === "harbour" ? -33.8612 : -33.79735, id === "harbour" ? 151.2112 : 151.1813);
    this.reach = {
      harbour: reachable(maps.harbour, spawnOf("harbour")),
      chatswood: reachable(maps.chatswood, spawnOf("chatswood")),
    };

    const safe = this.isReachable(start.map, start.x, start.y) ? { x: start.x, y: start.y } : spawnOf(start.map);
    this.player = newActor(safe.x, safe.y);

    this.bridge = bridgeGeometry(maps.harbour);
    this.populate();
    this.setPet(start.look.pet);
  }

  private isReachable(map: MapId, x: number, y: number): boolean {
    const m = this.maps[map];
    return x >= 0 && y >= 0 && x < m.width && y < m.height && this.reach[map][y * m.width + x] === 1;
  }

  private placeGeo(map: MapId, lat: number, lon: number): Point {
    return place(this.maps[map], lat, lon, this.reach[map]);
  }

  /* ── World setup ─────────────────────────────────────────────────── */

  private populate() {
    const harbour = this.maps.harbour;
    const chatswood = this.maps.chatswood;

    for (const npc of STORY_NPCS) {
      const at = this.placeGeo(npc.map, npc.lat, npc.lon);
      const list = this.entities[npc.map];
      if (npc.id === "noticeboard") {
        list.push({ kind: "board", x: at.x, y: at.y, interaction: { kind: "story", id: npc.id }, sprite: noticeboard() });
        continue;
      }
      const looks: Record<string, Look> = {
        deckhand: { skin: 2, hair: 4, hairColor: 0, top: 7, bottom: 0, acc: 0, hat: 1, pet: -1 },
        busker: { skin: 1, hair: 6, hairColor: 1, top: 5, bottom: 1, acc: 2, hat: 0, pet: -1 },
        climber: { skin: 3, hair: 1, hairColor: 0, top: 1, bottom: 0, acc: 0, hat: 0, pet: -1 },
        guard: { skin: 2, hair: 5, hairColor: 0, top: 5, bottom: 4, acc: 1, hat: 0, pet: -1 },
        stallholder: { skin: 0, hair: 2, hairColor: 4, top: 2, bottom: 2, acc: 0, hat: 0, pet: -1 },
        host: { skin: 1, hair: 0, hairColor: 0, top: 0, bottom: 0, acc: 1, hat: 5, pet: -1 },
        barista: { skin: 2, hair: 2, hairColor: 0, top: 3, bottom: 3, acc: 0, hat: 7, pet: -1 },
        photographer: { skin: 0, hair: 3, hairColor: 1, top: 4, bottom: 2, acc: 0, hat: 9, pet: -1 },
        tourist: { skin: 1, hair: 1, hairColor: 3, top: 5, bottom: 2, acc: 3, hat: 1, pet: -1 },
        greeter: { skin: 3, hair: 4, hairColor: 0, top: 2, bottom: 1, acc: 0, hat: 10, pet: -1 },
        hunter: { skin: 1, hair: 6, hairColor: 5, top: 6, bottom: 4, acc: 1, hat: 0, pet: -1 },
      };
      const actor = newActor(at.x, at.y);
      list.push({ kind: "story", x: at.x, y: at.y, interaction: { kind: "story", id: npc.id }, look: looks[npc.id], actor, storyId: npc.id });
    }

    // Stations and ferry signs.
    for (const id of ["harbour", "chatswood"] as MapId[]) {
      const at = this.placeGeo(id, STATIONS[id].lat, STATIONS[id].lon);
      this.entities[id].push({ kind: "station", x: at.x, y: at.y, interaction: { kind: "station", map: id }, sprite: signpost("train") });
    }
    for (const [key, wharf] of Object.entries(FERRY_WHARVES)) {
      const at = this.placeGeo("harbour", wharf.lat, wharf.lon);
      this.entities.harbour.push({
        kind: "ferry",
        x: at.x,
        y: at.y,
        interaction: { kind: "ferry", to: key === "quay" ? "milsons" : "quay" },
        sprite: signpost("ferry"),
      });
    }

    for (const spot of PHOTO_SPOTS) {
      const at = this.placeGeo(spot.map, spot.lat, spot.lon);
      this.entities[spot.map].push({ kind: "photo", x: at.x, y: at.y, interaction: { kind: "photo", id: spot.id }, sprite: cameraSign(), ref: spot.id });
    }

    // Members of the wall, around the mall and the Concourse. Each stands
    // somewhere stable, chosen from their slug, so they are where you left
    // them next visit.
    // Every third member waits around the Quay and the Opera House forecourt
    // instead, so a new player meets a real person in the first minute rather
    // than after the train ride.
    const standing: Record<MapId, Point[]> = {
      chatswood: tilesOfKind(chatswood, "p.g", { x0: 40, y0: 22, x1: 100, y1: 64 }).filter((p) => this.isReachable("chatswood", p.x, p.y)),
      harbour: tilesOfKind(harbour, "p.g", { x0: 40, y0: 118, x1: 100, y1: 158 }).filter((p) => this.isReachable("harbour", p.x, p.y)),
    };
    const taken: Record<MapId, Point[]> = { chatswood: [], harbour: [] };
    this.community.members.forEach((member, index) => {
      const map: MapId = index % 3 === 1 ? "harbour" : "chatswood";
      const spots = standing[map];
      const rand = seeded(hashString(member.slug));
      for (let tries = 0; tries < 40 && spots.length; tries += 1) {
        const at = spots[Math.floor(rand() * spots.length)];
        if (taken[map].some((p) => Math.abs(p.x - at.x) + Math.abs(p.y - at.y) < 3)) continue;
        taken[map].push(at);
        this.entities[map].push({
          kind: "member",
          x: at.x,
          y: at.y,
          interaction: { kind: "member", index },
          look: lookFromSeed(member.slug),
          actor: newActor(at.x, at.y),
          label: member.name,
          ref: member.slug,
          home: at,
          roam: "p.g",
        });
        return;
      }
    });

    // The Thursday market: stalls down the mall east of the station, one per
    // work, plus an empty one at the end that is yours if you want it.
    const mall = tilesOfKind(chatswood, "p", { x0: 50, y0: 42, x1: 80, y1: 48 })
      .filter((p) => this.isReachable("chatswood", p.x, p.y))
      .sort((a, b) => a.x - b.x || a.y - b.y);
    const stalls: Point[] = [];
    for (const tile of mall) {
      if (stalls.some((p) => Math.abs(p.x - tile.x) < 2 && Math.abs(p.y - tile.y) < 3)) continue;
      stalls.push(tile);
    }
    const count = Math.min(stalls.length, this.community.works.length + 1, 14);
    for (let i = 0; i < count; i += 1) {
      const isPlaceholder = i === count - 1;
      this.entities.chatswood.push({
        kind: "stall",
        x: stalls[i].x,
        y: stalls[i].y,
        interaction: { kind: "stall", index: isPlaceholder ? -1 : i },
        sprite: stall(i),
        ref: isPlaceholder ? "placeholder" : this.community.works[i]?.key,
      });
    }

    // Critters, seeded by the Sydney day: everybody online sees the same ibis
    // on the same corner, and tomorrow they have moved.
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
    const rand = seeded(hashString(day));
    const thursday = isSydneyThursday(new Date());
    let uid = 0;
    for (const critter of CRITTERS) {
      if (critter.id === "golden" && !thursday) continue;
      const map = this.maps[critter.map];
      const spots = tilesOfKind(map, critter.on).filter((p) =>
        critter.on === "~" ? this.nearShore(map, p) : this.isReachable(critter.map, p.x, p.y),
      );
      // The whale is rare: most visits it is simply not there.
      if (critter.id === "whale" && rand() > 0.35) continue;
      for (let i = 0; i < critter.count && spots.length; i += 1) {
        const at = spots[Math.floor(rand() * spots.length)];
        this.entities[critter.map].push({
          kind: "critter",
          x: at.x,
          y: at.y,
          critter: critter.id,
          uid: uid,
          interaction: { kind: "critter", id: critter.id, uid: uid++ },
          actor: newActor(at.x, at.y),
          roam: critter.on,
          home: at,
        });
      }
    }

    // A few people just out for a walk, so the city is not empty when nobody
    // else is online.
    for (const id of ["harbour", "chatswood"] as MapId[]) {
      const map = this.maps[id];
      const spots = tilesOfKind(map, "p.").filter((p) => this.isReachable(id, p.x, p.y));
      const r = seeded(hashString(`${id}.walkers`));
      for (let i = 0; i < 14 && spots.length; i += 1) {
        const at = spots[Math.floor(r() * spots.length)];
        this.entities[id].push({
          kind: "walker",
          x: at.x,
          y: at.y,
          interaction: { kind: "walker", index: i },
          look: lookFromSeed(`${id}.${i}`),
          actor: newActor(at.x, at.y),
          roam: "p.rw",
          home: at,
        });
      }
    }

    // Big landmark sprites.
    const operaTile = this.placeGeo("harbour", -33.8572, 151.2151);
    this.opera = this.findFootprint(harbour, operaTile);
    const luna = this.placeGeo("harbour", -33.8473, 151.2098);
    this.entities.harbour.push({ kind: "board", x: luna.x, y: luna.y - 1, interaction: null, sprite: lunaFace() });
    const avenue = LANDMARKS.find((l) => l.id === "avenue")!;
    const avenueTile = this.placeGeo("chatswood", avenue.lat + 0.00012, avenue.lon + 0.0001);
    this.entities.chatswood.push({ kind: "board", x: avenueTile.x + 1, y: avenueTile.y + 1, interaction: null, sprite: roundBuilding() });
  }

  private nearShore(map: GameMap, p: Point): boolean {
    // Whales in the open harbour, not in a fountain.
    let water = 0;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (tileAt(map, p.x + dx, p.y + dy) === "~") water += 1;
    return water === 49;
  }

  /** The footprint of the building under `from`: the Opera House's outline. */
  private findFootprint(map: GameMap, from: Point) {
    let start: Point | null = null;
    for (let r = 0; r < 6 && !start; r += 1) {
      for (let dy = -r; dy <= r && !start; dy += 1)
        for (let dx = -r; dx <= r && !start; dx += 1) {
          const ch = tileAt(map, from.x + dx, from.y + dy);
          if (ch >= "A" && ch <= "D") start = { x: from.x + dx, y: from.y + dy };
        }
    }
    if (!start) return null;
    let minX = start.x;
    let maxX = start.x;
    let minY = start.y;
    let maxY = start.y;
    const seen = new Set<number>();
    const stack = [start];
    while (stack.length) {
      const p = stack.pop()!;
      const k = p.y * map.width + p.x;
      if (seen.has(k)) continue;
      const ch = tileAt(map, p.x, p.y);
      if (!(ch >= "A" && ch <= "D")) continue;
      seen.add(k);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      stack.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
    }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  /* ── Lifecycle ───────────────────────────────────────────────────── */

  start() {
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.last = performance.now();
    const loop = (now: number) => {
      // Clamped at both ends. A frame's timestamp can be earlier than the
      // performance.now() taken at start, so the first delta can be negative —
      // which once sent the title camera to waypoint -1.
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      this.time += dt;
      if (!this.paused) this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (!this.demo) this.events.onMove(this.map, this.player.x, this.player.y, this.player.dir);
    this.checkPrompt();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    // About fifteen tiles across a phone — enough to see the whole Opera House
    // from its forecourt — and more on a desktop. Always a whole number of
    // device pixels per art pixel, which is what keeps it crisp.
    const tilesAcross = rect.width < 560 ? 15 : Math.min(30, rect.width / 40);
    this.unit = Math.max(2, Math.round(this.canvas.width / (tilesAcross * TILE)));
    this.ctx.imageSmoothingEnabled = false;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.held.clear();
      this.heldOrder = [];
      this.player.path = [];
    }
  }

  setLook(look: Look) {
    this.look = look;
    this.setPet(look.pet);
  }

  private setPet(index: number) {
    this.pet = index >= 0 ? newActor(this.player.x, this.player.y) : null;
    this.trail = [];
  }

  setShards(ids: string[]) {
    this.collectedShards = new Set(ids);
  }

  /** Moves the player to a map and tile — the train, the ferry. */
  teleport(map: MapId, at?: Point) {
    this.map = map;
    const target = at ?? place(this.maps[map], map === "harbour" ? -33.8612 : -33.79735, map === "harbour" ? 151.2112 : 151.1813, this.reach[map]);
    this.player = newActor(target.x, target.y);
    if (this.pet) this.pet = newActor(target.x, target.y);
    this.trail = [];
    this.events.onStep(map, target.x, target.y);
    this.events.onMove(map, target.x, target.y, 0);
    this.checkPrompt();
  }

  wharfTile(which: "quay" | "milsons"): Point {
    const wharf = FERRY_WHARVES[which];
    return this.placeGeo("harbour", wharf.lat, wharf.lon);
  }

  showEmote(emote: Emote) {
    if (isPhrase(emote)) {
      this.speech = { text: this.labels.phrase(emote), until: this.time + 4 };
      this.emote = null;
      return;
    }
    this.speech = null;
    this.emote = { icon: emote as IconName, until: this.time + 4 };
  }

  /** Puts a line of speech over whatever `what` points at, for a few seconds. */
  say(what: Interaction | StoryNpcId, text: string, seconds = 4) {
    if (!text) return;
    const entity = this.entities[this.map].find((e) =>
      typeof what === "string"
        ? e.storyId === what
        : e.interaction !== null && JSON.stringify(e.interaction) === JSON.stringify(what),
    );
    if (!entity) return;
    entity.speech = { text, until: this.time + seconds };
    if (entity.kind === "walker" && entity.actor) {
      // Stop, turn to face you, and talk.
      entity.pauseUntil = this.time + seconds;
      entity.actor.path = [];
      const dx = this.player.x - entity.actor.x;
      const dy = this.player.y - entity.actor.y;
      entity.actor.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
    }
  }

  setObjective(target: Target | null) {
    this.objective = target;
  }

  setMarkers(markers: Map<StoryNpcId, "!" | "?">) {
    this.markers = markers;
  }

  /**
   * Where something is, for the quest guide. Looks on the current map first
   * and falls back to the other one, so "the nearest shard" can be across the
   * harbour or up the line in Chatswood.
   */
  locate(query: Locate): Target | null {
    const order: MapId[] = this.map === "harbour" ? ["harbour", "chatswood"] : ["chatswood", "harbour"];
    const from = { x: this.player.x, y: this.player.y };
    const nearest = (map: MapId, points: { x: number; y: number }[]): Target | null => {
      let best: Target | null = null;
      let bestD = Infinity;
      for (const p of points) {
        const d = map === this.map ? Math.hypot(p.x - from.x, p.y - from.y) : 0;
        if (d < bestD) {
          bestD = d;
          best = { map, x: p.x, y: p.y };
        }
      }
      return best;
    };
    const posOf = (e: Entity) => ({ x: e.actor ? Math.round(e.actor.x) : e.x, y: e.actor ? Math.round(e.actor.y) : e.y });

    for (const map of order) {
      let points: { x: number; y: number }[] = [];
      const list = this.entities[map];
      switch (query.kind) {
        case "story":
          points = list.filter((e) => e.storyId === query.id).map(posOf);
          break;
        case "station":
          if (map === query.map) points = list.filter((e) => e.kind === "station").map(posOf);
          break;
        case "landmark": {
          const landmark = LANDMARKS.find((l) => l.id === query.id);
          if (landmark && landmark.map === map) points = [this.placeGeo(map, landmark.lat, landmark.lon)];
          break;
        }
        case "member":
          points = list.filter((e) => e.kind === "member" && !query.exclude.includes(e.ref ?? "")).map(posOf);
          break;
        case "stall":
          points = list.filter((e) => e.kind === "stall" && !query.exclude.includes(e.ref ?? "")).map(posOf);
          break;
        case "photo":
          points = list.filter((e) => e.kind === "photo" && !query.exclude.includes(e.ref ?? "")).map(posOf);
          break;
        case "critter":
          points = list.filter((e) => e.critter === query.id).map(posOf);
          break;
        case "walker":
          points = list.filter((e) => e.kind === "walker").map(posOf);
          break;
        case "shard":
          points = SHARDS.filter((sh) => sh.map === map && !query.exclude.includes(sh.id)).map((sh) =>
            this.placeGeo(map, sh.lat, sh.lon),
          );
          break;
      }
      const found = nearest(map, points);
      if (found) return found;
    }
    return null;
  }

  /**
   * "Take me there": walk to the tile next to a target on this map. False
   * when it is on the other map or there is no way to it on foot.
   */
  walkTo(target: Target): boolean {
    if (target.map !== this.map) return false;
    const path = this.pathToAdjacent({ x: target.x, y: target.y });
    if (!path) return false;
    this.pendingInteract = null;
    this.player.path = path;
    return true;
  }

  /**
   * "I'm stuck": back to where this map starts you — the Quay, or outside
   * Chatswood station — which is always reachable and always has a way on.
   */
  rescue() {
    this.teleport(this.map);
  }

  /** The player's current goal target, for the help panel. */
  getObjective(): Target | null {
    return this.objective;
  }

  /** Other players within `radius` tiles on this map. */
  peersNear(radius: number): PeerView[] {
    const out: PeerView[] = [];
    for (const peer of this.peers.values()) {
      if (peer.map === this.map && Math.hypot(peer.dx - this.player.x, peer.dy - this.player.y) <= radius) out.push(peer);
    }
    return out;
  }

  /**
   * The current frame as a postcard: rendered without the A badge or the
   * quest arrow, with a caption band along the bottom saying where it was.
   */
  capture(caption: string): string {
    const was = this.paused;
    this.paused = true;
    this.render();
    this.paused = was;

    const out = document.createElement("canvas");
    out.width = this.canvas.width;
    out.height = this.canvas.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(this.canvas, 0, 0);
    const band = Math.round(out.height * 0.09);
    ctx.fillStyle = "rgba(10,11,13,0.82)";
    ctx.fillRect(0, out.height - band, out.width, band);
    ctx.fillStyle = "#c6ff3d";
    ctx.fillRect(0, out.height - band, out.width, Math.max(2, this.dpr * 2));
    const fs = Math.round(band * 0.34);
    ctx.font = `700 ${fs}px ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#f2f5f3";
    ctx.fillText(caption, band * 0.4, out.height - band / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#c6ff3d";
    ctx.font = `600 ${Math.round(fs * 0.8)}px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.fillText("Vibe Thursday · /play", out.width - band * 0.4, out.height - band / 2);
    return out.toDataURL("image/jpeg", 0.88);
  }

  setPeers(peers: PeerView[], selfId: string | null) {
    const now = this.time;
    const next = new Map<string, Peer>();
    for (const peer of peers) {
      if (peer.id === selfId) continue;
      const old = this.peers.get(peer.id);
      next.set(peer.id, {
        ...peer,
        dx: old ? old.dx : peer.x,
        dy: old ? old.dy : peer.y,
        seen: now,
        frame: old?.frame ?? 0,
        moving: old ? Math.abs(old.x - peer.x) + Math.abs(old.y - peer.y) > 0.01 : false,
      });
    }
    this.peers = next;
  }

  peersHere(): number {
    let n = 0;
    for (const peer of this.peers.values()) if (peer.map === this.map) n += 1;
    return n;
  }

  /* ── Input ───────────────────────────────────────────────────────── */

  press(dir: Dir) {
    if (!this.held.has(dir)) {
      this.held.add(dir);
      this.heldOrder.push(dir);
    }
    this.player.path = [];
    this.pendingInteract = null;
  }

  release(dir: Dir) {
    this.held.delete(dir);
    this.heldOrder = this.heldOrder.filter((d) => d !== dir);
  }

  releaseAll() {
    this.held.clear();
    this.heldOrder = [];
  }

  /** The A button. */
  act() {
    if (this.paused) return;
    if (this.prompt) this.events.onInteract(this.prompt);
  }

  /** A tap or click on the canvas, in CSS pixels relative to it. */
  tap(cssX: number, cssY: number) {
    if (this.paused) return;
    const wx = (cssX * this.dpr) / (this.unit * TILE) + this.camX;
    const wy = (cssY * this.dpr) / (this.unit * TILE) + this.camY;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);

    // Tapped a person or a thing: walk up to it and interact on arrival.
    const hit = this.entityNear(wx, wy - 0.3, 1.1);
    if (hit) {
      const where = hit.actor ? { x: hit.actor.toX, y: hit.actor.toY } : { x: hit.x, y: hit.y };
      if (Math.abs(where.x - this.player.toX) + Math.abs(where.y - this.player.toY) <= 1) {
        this.face(where);
        this.events.onInteract(hit.interaction!);
        return;
      }
      const path = this.pathToAdjacent(where);
      if (path) {
        this.player.path = path;
        this.pendingInteract = hit.interaction;
        return;
      }
    }

    const peer = this.peerNear(wx, wy - 0.3);
    if (peer) {
      this.events.onInteract({ kind: "peer", id: peer.id });
      return;
    }

    const target = isWalkable(this.maps[this.map], tx, ty) ? { x: tx, y: ty } : null;
    if (!target) return;
    const path = findPath(this.maps[this.map], { x: this.player.toX, y: this.player.toY }, target, 20000);
    if (path) {
      this.player.path = path;
      this.pendingInteract = null;
    } else this.events.onTooFar();
  }

  private pathToAdjacent(target: Point): Point[] | null {
    const map = this.maps[this.map];
    let best: Point[] | null = null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]]) {
      const x = target.x + dx;
      const y = target.y + dy;
      if (!isWalkable(map, x, y)) continue;
      const path = findPath(map, { x: this.player.toX, y: this.player.toY }, { x, y }, 20000);
      if (path && (!best || path.length < best.length)) best = path;
    }
    return best;
  }

  private face(target: Point) {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    this.player.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
  }

  private entityNear(wx: number, wy: number, radius: number): Entity | null {
    let best: Entity | null = null;
    let bestD = radius;
    for (const e of this.entities[this.map]) {
      if (!e.interaction) continue;
      const ex = (e.actor ? e.actor.x : e.x) + 0.5;
      const ey = (e.actor ? e.actor.y : e.y) + 0.5;
      const d = Math.hypot(ex - wx, ey - wy);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private peerNear(wx: number, wy: number): Peer | null {
    for (const peer of this.peers.values()) {
      if (peer.map !== this.map) continue;
      if (Math.hypot(peer.dx + 0.5 - wx, peer.dy + 0.5 - wy) < 0.9) return peer;
    }
    return null;
  }

  /* ── Update ──────────────────────────────────────────────────────── */

  private update(dt: number) {
    if (this.demo) {
      this.updateTour(dt);
      this.updateEntities(dt);
      return;
    }
    this.updatePlayer(dt);
    this.updatePet(dt);
    this.updateEntities(dt);
    this.updatePeers(dt);
  }

  /**
   * The title screen's camera: a slow loop past the things the game is about
   * — the Quay, the Opera House, across the bridge to Luna Park, round to
   * Kirribilli and back — while the ferry, the walkers and the birds carry
   * on underneath. Waypoints are real places, placed like everything else.
   */
  private static TOUR: [number, number][] = [
    [-33.8612, 151.2107], // Circular Quay
    [-33.8585, 151.2145], // Opera House forecourt
    [-33.8555, 151.2150], // Bennelong Point
    [-33.8530, 151.2103], // mid-span
    [-33.8478, 151.2100], // Luna Park
    [-33.8500, 151.2185], // Kirribilli
    [-33.8560, 151.2125], // open water, heading home
  ];

  private updateTour(dt: number) {
    const points = Engine.TOUR.map(([lat, lon]) => this.placeGeo("harbour", lat, lon));
    const legs = points.length;
    this.tour = (this.tour + dt / 9) % legs; // nine seconds a leg
    const i = Math.floor(this.tour);
    const t = this.tour - i;
    const eased = t * t * (3 - 2 * t);
    const a = points[i];
    const b = points[(i + 1) % legs];
    const x = a.x + (b.x - a.x) * eased;
    const y = a.y + (b.y - a.y) * eased;
    const map = this.maps.harbour;
    const viewW = this.canvas.width / (this.unit * TILE);
    const viewH = this.canvas.height / (this.unit * TILE);
    this.camX = Math.max(0, Math.min(map.width - viewW, x - viewW / 2));
    this.camY = Math.max(-1, Math.min(map.height - viewH, y - viewH / 2));
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const map = this.maps[this.map];

    if (p.moving) {
      p.t += dt * SPEED;
      if (p.t >= 1) {
        p.x = p.toX;
        p.y = p.toY;
        p.moving = false;
        this.afterStep();
      } else {
        p.x = p.fromX + (p.toX - p.fromX) * p.t;
        p.y = p.fromY + (p.toY - p.fromY) * p.t;
      }
    }

    if (!p.moving) {
      let dir: Dir | null = null;
      let next: Point | null = null;

      if (this.heldOrder.length) {
        dir = this.heldOrder[this.heldOrder.length - 1];
        const [dx, dy] = DIRS[dir];
        next = { x: p.x + dx, y: p.y + dy };
      } else if (p.path.length) {
        next = p.path.shift()!;
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        dir = dx < 0 ? 1 : dx > 0 ? 2 : dy < 0 ? 3 : 0;
      } else if (this.pendingInteract) {
        const what = this.pendingInteract;
        this.pendingInteract = null;
        const target = this.entities[this.map].find((e) => e.interaction === what);
        if (target) this.face({ x: target.actor?.x ?? target.x, y: target.actor?.y ?? target.y });
        this.events.onInteract(what);
      }

      if (dir !== null && next) {
        const turned = p.dir !== dir;
        p.dir = dir;
        if (isWalkable(map, next.x, next.y)) {
          p.fromX = p.x;
          p.fromY = p.y;
          p.toX = next.x;
          p.toY = next.y;
          p.t = 0;
          p.moving = true;
          this.trail.unshift({ x: p.x, y: p.y });
          if (this.trail.length > 4) this.trail.length = 4;
        } else {
          p.path = [];
          if (turned) this.checkPrompt();
        }
        this.events.onMove(this.map, p.moving ? p.toX : p.x, p.moving ? p.toY : p.y, p.dir);
      }
    }

    p.frame = p.moving ? (Math.floor(this.time * 8) % 2) + 1 : 0;

    // Camera follows, clamped to the map.
    const viewW = this.canvas.width / (this.unit * TILE);
    const viewH = this.canvas.height / (this.unit * TILE);
    const targetX = p.x + 0.5 - viewW / 2;
    const targetY = p.y + 0.5 - viewH / 2;
    this.camX = Math.max(0, Math.min(map.width - viewW, targetX));
    this.camY = Math.max(-1, Math.min(map.height - viewH, targetY));
    if (map.width < viewW) this.camX = (map.width - viewW) / 2;
  }

  private afterStep() {
    const { x, y } = this.player;
    this.events.onStep(this.map, x, y);

    for (const landmark of LANDMARKS) {
      if (landmark.map !== this.map) continue;
      const at = this.placeGeo(landmark.map, landmark.lat, landmark.lon);
      const within = Math.hypot(at.x - x, at.y - y) <= landmark.radius;
      if (within && !this.inside.has(landmark.id)) {
        this.inside.add(landmark.id);
        this.events.onArrive(landmark.id);
        if (!this.visited.has(landmark.id)) {
          this.visited.add(landmark.id);
          this.events.onLandmark(landmark.id);
        }
      } else if (!within) this.inside.delete(landmark.id);
    }

    // Earshot: the story's people call out once as you approach, and again
    // only after you have walked away and come back.
    for (const e of this.entities[this.map]) {
      if (!e.storyId || !e.actor) continue;
      const d = Math.abs(e.actor.x - x) + Math.abs(e.actor.y - y);
      if (d <= 4 && !this.near.has(e.storyId)) {
        this.near.add(e.storyId);
        this.events.onNear(e.storyId);
      } else if (d > 7) this.near.delete(e.storyId);
    }

    for (const shard of SHARDS) {
      if (shard.map !== this.map || this.collectedShards.has(shard.id)) continue;
      const at = this.placeGeo(shard.map, shard.lat, shard.lon);
      if (Math.abs(at.x - x) <= 1 && Math.abs(at.y - y) <= 1) {
        this.collectedShards.add(shard.id);
        this.events.onShard(shard.id);
      }
    }

    this.checkPrompt();
  }

  /** Picks what A would do: the nearest thing in reach, preferring what you face. */
  private checkPrompt() {
    const p = this.player;
    const [fx, fy] = DIRS[p.dir];
    let best: Interaction | null = null;
    let bestScore = Infinity;

    for (const e of this.entities[this.map]) {
      if (!e.interaction) continue;
      const ex = e.actor ? Math.round(e.actor.x) : e.x;
      const ey = e.actor ? Math.round(e.actor.y) : e.y;
      const d = Math.abs(ex - p.x) + Math.abs(ey - p.y);
      if (d > 2) continue;
      const facing = ex === p.x + fx && ey === p.y + fy ? -1 : 0;
      const score = d + facing;
      if (score < bestScore) {
        bestScore = score;
        best = e.interaction;
      }
    }

    if (best !== this.prompt) {
      this.prompt = best;
      this.events.onPrompt(best);
    }
  }

  private updatePet(dt: number) {
    if (!this.pet) return;
    const target = this.trail[1] ?? this.trail[0] ?? { x: this.player.x, y: this.player.y };
    const pet = this.pet;
    const dx = target.x - pet.x;
    const dy = target.y - pet.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 6) {
      pet.x = target.x;
      pet.y = target.y;
    } else if (dist > 0.05) {
      const step = Math.min(dist, dt * SPEED * 1.05);
      pet.x += (dx / dist) * step;
      pet.y += (dy / dist) * step;
      pet.moving = true;
    } else pet.moving = false;
  }

  private updateEntities(dt: number) {
    const map = this.maps[this.map];
    for (const e of this.entities[this.map]) {
      const a = e.actor;
      if (!a) continue;

      if (a.moving) {
        a.t += dt * (e.kind === "critter" ? 2.5 : WALKER_SPEED);
        if (a.t >= 1) {
          a.x = a.toX;
          a.y = a.toY;
          a.moving = false;
        } else {
          a.x = a.fromX + (a.toX - a.fromX) * a.t;
          a.y = a.fromY + (a.toY - a.fromY) * a.t;
        }
        a.frame = (Math.floor(this.time * 6) % 2) + 1;
        continue;
      }
      a.frame = 0;

      if (e.kind === "story") {
        // Story people stay put and turn to face you when you are close.
        const d = Math.abs(this.player.x - a.x) + Math.abs(this.player.y - a.y);
        if (d <= 3) {
          const dx = this.player.x - a.x;
          const dy = this.player.y - a.y;
          a.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
        }
        continue;
      }

      e.nextMove ??= this.time + Math.random() * 3;
      if (this.time < e.nextMove) continue;

      if (e.kind === "walker") {
        if (e.pauseUntil && this.time < e.pauseUntil) continue;
        if (a.path.length === 0) {
          const home = e.home!;
          const tx = home.x + Math.floor(Math.random() * 25) - 12;
          const ty = home.y + Math.floor(Math.random() * 25) - 12;
          if (isWalkable(map, tx, ty) && this.isReachable(this.map, tx, ty)) {
            a.path = findPath(map, { x: a.x, y: a.y }, { x: tx, y: ty }, 1500) ?? [];
          }
          e.nextMove = this.time + 1 + Math.random() * 4;
          continue;
        }
        const next = a.path.shift()!;
        this.stepActor(a, next);
        e.nextMove = this.time;
        continue;
      }

      // Members and critters mill about near where they stand.
      const home = e.home!;
      const dir = Math.floor(Math.random() * 4) as Dir;
      const [dx, dy] = DIRS[dir];
      const nx = a.x + dx;
      const ny = a.y + dy;
      const allowed = e.roam ?? "p.";
      const inRange = Math.abs(nx - home.x) <= 2 && Math.abs(ny - home.y) <= 2;
      if (inRange && allowed.includes(tileAt(map, nx, ny)) && !(nx === this.player.x && ny === this.player.y)) {
        this.stepActor(a, { x: nx, y: ny });
      } else a.dir = dir;
      e.nextMove = this.time + (e.kind === "critter" ? 0.8 + Math.random() * 2 : 2 + Math.random() * 5);
    }
  }

  private stepActor(a: Actor, next: Point) {
    const dx = next.x - a.x;
    const dy = next.y - a.y;
    a.dir = dx < 0 ? 1 : dx > 0 ? 2 : dy < 0 ? 3 : 0;
    a.fromX = a.x;
    a.fromY = a.y;
    a.toX = next.x;
    a.toY = next.y;
    a.t = 0;
    a.moving = true;
  }

  private updatePeers(dt: number) {
    for (const peer of this.peers.values()) {
      const dx = peer.x - peer.dx;
      const dy = peer.y - peer.dy;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        peer.dx = peer.x;
        peer.dy = peer.y;
      } else if (dist > 0.02) {
        const step = Math.min(dist, dt * SPEED * 1.1);
        peer.dx += (dx / dist) * step;
        peer.dy += (dy / dist) * step;
        peer.moving = true;
      } else peer.moving = false;
      peer.frame = peer.moving ? (Math.floor(this.time * 8) % 2) + 1 : 0;
    }
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  private toScreen = (tx: number, ty: number): [number, number] => [
    Math.round((tx - this.camX) * TILE * this.unit),
    Math.round((ty - this.camY) * TILE * this.unit),
  ];

  private render() {
    const ctx = this.ctx;
    const map = this.maps[this.map];
    const u = this.unit;
    const size = TILE * u;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = this.map === "harbour" ? "#2b6cb3" : "#bdb7aa";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Background chunks.
    const viewW = this.canvas.width / size;
    const viewH = this.canvas.height / size;
    const c0x = Math.max(0, Math.floor(this.camX / CHUNK));
    const c0y = Math.max(0, Math.floor(this.camY / CHUNK));
    const c1x = Math.floor((this.camX + viewW) / CHUNK);
    const c1y = Math.floor((this.camY + viewH) / CHUNK);
    for (let cy = c0y; cy <= c1y; cy += 1) {
      for (let cx = c0x; cx <= c1x; cx += 1) {
        if (cx * CHUNK >= map.width || cy * CHUNK >= map.height) continue;
        const key = `${this.map}.${cx}.${cy}`;
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = renderChunk(map, cx, cy);
          this.chunks.set(key, chunk);
        }
        const [sx, sy] = this.toScreen(cx * CHUNK, cy * CHUNK);
        ctx.drawImage(chunk, sx, sy, CHUNK * size, CHUNK * size);
      }
    }

    // Water glints.
    const tick = Math.floor(this.time * 2);
    const x0 = Math.floor(this.camX);
    const y0 = Math.floor(this.camY);
    ctx.fillStyle = "#cfe9ff";
    for (let ty = y0; ty <= y0 + viewH + 1; ty += 1) {
      for (let tx = x0; tx <= x0 + viewW + 1; tx += 1) {
        if (tileAt(map, tx, ty) !== "~") continue;
        const h = ((tx * 73856093) ^ (ty * 19349663) ^ (tick * 83492791)) >>> 0;
        if (h % 23 !== 0) continue;
        const [sx, sy] = this.toScreen(tx, ty);
        ctx.fillRect(sx + ((h >>> 5) % 12) * u, sy + ((h >>> 9) % 12) * u, 2 * u, u);
      }
    }

    if (this.map === "harbour" && this.bridge) drawBridgeDeck(ctx, this.bridge, this.toScreen, u);

    // Everything that stands up, sorted back to front.
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    const inView = (x: number, y: number, margin = 4) =>
      x > this.camX - margin && x < this.camX + viewW + margin && y > this.camY - margin && y < this.camY + viewH + margin * 2;

    if (this.map === "harbour" && this.opera) {
      const o = this.opera;
      if (inView(o.x + o.w / 2, o.y + o.h / 2, o.w + 4)) {
        const { canvas, lift } = operaHouse(o.w, o.h);
        list.push({
          y: o.y + o.h * 0.35,
          draw: () => {
            const [sx, sy] = this.toScreen(o.x, o.y);
            ctx.drawImage(canvas, sx, sy - lift * u, canvas.width * u, canvas.height * u);
          },
        });
      }
    }

    // The ferry, crossing on a loop between the two wharves.
    if (this.map === "harbour") {
      const a = this.wharfTile("quay");
      const b = this.wharfTile("milsons");
      const period = 40;
      const phase = (this.time % period) / period;
      const leg = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      const eased = leg < 0.1 ? 0 : leg > 0.9 ? 1 : (leg - 0.1) / 0.8;
      const fx = a.x + 2 + (b.x + 3 - a.x - 2) * eased;
      const fy = a.y - 2 + (b.y + 2 - a.y + 2) * eased;
      if (inView(fx, fy)) {
        list.push({
          y: fy - 0.5,
          draw: () => {
            const sprite = ferrySprite(phase < 0.5);
            const [sx, sy] = this.toScreen(fx - 1, fy - 0.8);
            ctx.drawImage(sprite, sx, sy, sprite.width * u, sprite.height * u);
          },
        });
      }
    }

    for (const e of this.entities[this.map]) {
      const ex = e.actor ? e.actor.x : e.x;
      const ey = e.actor ? e.actor.y : e.y;
      if (!inView(ex, ey)) continue;
      list.push({ y: ey, draw: () => this.drawEntity(e, ex, ey) });
    }

    for (const shard of SHARDS) {
      if (shard.map !== this.map || this.collectedShards.has(shard.id)) continue;
      const at = this.placeGeo(shard.map, shard.lat, shard.lon);
      if (!inView(at.x, at.y)) continue;
      list.push({
        y: at.y,
        draw: () => {
          const sprite = shardSprite(Math.floor(this.time * 5));
          const bob = Math.round(Math.sin(this.time * 3 + at.x) * 1.5);
          const [sx, sy] = this.toScreen(at.x, at.y);
          ctx.drawImage(sprite, sx + 2 * u, sy + (bob - 2) * u, sprite.width * u, sprite.height * u);
        },
      });
    }

    for (const peer of this.peers.values()) {
      if (peer.map !== this.map || !inView(peer.dx, peer.dy)) continue;
      list.push({ y: peer.dy, draw: () => this.drawPeer(peer) });
    }

    if (this.pet && !this.demo) {
      const pet = this.pet;
      const id = PETS[this.look.pet];
      if (id) {
        list.push({
          y: pet.y - 0.01,
          draw: () => {
            const sprite = critterSprite(id, pet.moving ? Math.floor(this.time * 6) % 2 : 0);
            const [sx, sy] = this.toScreen(pet.x, pet.y);
            ctx.drawImage(sprite, sx, sy, sprite.width * u, sprite.height * u);
          },
        });
      }
    }

    if (!this.demo) list.push({
      y: this.player.y + 0.001,
      draw: () => {
        const sprite = characterSprite(this.look, this.player.dir, this.player.frame);
        const [sx, sy] = this.toScreen(this.player.x, this.player.y);
        ctx.drawImage(sprite, sx, sy - (CHAR_H - TILE) * u, CHAR_W * u, CHAR_H * u);
        if (this.emote && this.time < this.emote.until) this.bubble(sx + size / 2, sy - (CHAR_H - TILE + 4) * u, this.emote.icon);
        if (this.speech && this.time < this.speech.until) this.textBubble(sx + size / 2, sy - (CHAR_H - TILE + 3) * u, this.speech.text);
      },
    });

    list.sort((a, b) => a.y - b.y);
    for (const item of list) item.draw();

    if (this.map === "harbour" && this.bridge) drawBridge(ctx, this.bridge, this.toScreen, u);

    // Name tags on top of everything, so the arch never hides who is who.
    this.drawTags(viewW, viewH);
    this.drawMarkersAndSpeech(viewW, viewH);
    this.drawObjective(viewW, viewH);

    // The A prompt over whatever it would act on.
    if (this.prompt && !this.paused) {
      const target = this.entities[this.map].find((e) => e.interaction === this.prompt);
      if (target) {
        const ex = target.actor ? target.actor.x : target.x;
        const ey = target.actor ? target.actor.y : target.y;
        const [sx, sy] = this.toScreen(ex, ey);
        const bounce = Math.round(Math.sin(this.time * 6) * 1.5) * u;
        const lift = target.kind === "story" || target.kind === "member" ? CHAR_H - TILE + 10 : 14;
        this.aBadge(sx + size / 2, sy - lift * u + bounce);
      }
    }
  }

  private drawEntity(e: Entity, ex: number, ey: number) {
    const ctx = this.ctx;
    const u = this.unit;
    const [sx, sy] = this.toScreen(ex, ey);

    if (e.look && e.actor) {
      const sprite = characterSprite(e.look, e.actor.dir, e.actor.frame);
      ctx.drawImage(sprite, sx, sy - (CHAR_H - TILE) * u, CHAR_W * u, CHAR_H * u);
      if (e.kind === "story") {
        // A small marker so the story's people stand out from the crowd.
        ctx.fillStyle = "#c6ff3d";
        ctx.fillRect(sx + 7 * u, sy - (CHAR_H - TILE + 4) * u, 2 * u, 2 * u);
      }
      return;
    }
    if (e.critter) {
      const sprite = critterSprite(e.critter, e.actor?.moving ? Math.floor(this.time * 6) % 2 : Math.floor(this.time * 1.5) % 2);
      ctx.drawImage(sprite, sx, sy, sprite.width * u, sprite.height * u);
      return;
    }
    if (e.sprite) {
      const w = e.sprite.width * u;
      const h = e.sprite.height * u;
      ctx.drawImage(e.sprite, sx + (TILE * u - w) / 2, sy + TILE * u - h, w, h);
    }
  }

  private drawPeer(peer: Peer) {
    const ctx = this.ctx;
    const u = this.unit;
    const sprite = characterSprite(peer.look, peer.dir, peer.frame);
    const [sx, sy] = this.toScreen(peer.dx, peer.dy);
    ctx.globalAlpha = 0.96;
    ctx.drawImage(sprite, sx, sy - (CHAR_H - TILE) * u, CHAR_W * u, CHAR_H * u);
    ctx.globalAlpha = 1;
    const pet = PETS[peer.look.pet];
    if (pet) {
      const petSprite = critterSprite(pet, 0);
      ctx.drawImage(petSprite, sx - 10 * u, sy + 2 * u, petSprite.width * u * 0.8, petSprite.height * u * 0.8);
    }
    if (peer.emote && isPhrase(peer.emote)) this.textBubble(sx + (TILE * u) / 2, sy - (CHAR_H - TILE + 3) * u, this.labels.phrase(peer.emote));
    else if (peer.emote) this.bubble(sx + (TILE * u) / 2, sy - (CHAR_H - TILE + 4) * u, peer.emote as IconName);
  }

  private fontPx() {
    return Math.max(Math.round(11 * this.dpr), Math.round(this.unit * 2.9));
  }

  private drawTags(viewW: number, viewH: number) {
    const ctx = this.ctx;
    const u = this.unit;
    const fs = this.fontPx();
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const tag = (text: string, x: number, y: number, accent: boolean) => {
      const w = ctx.measureText(text).width + fs * 0.8;
      ctx.fillStyle = accent ? "rgba(198,255,61,0.92)" : "rgba(10,11,13,0.72)";
      ctx.fillRect(Math.round(x - w / 2), Math.round(y - fs * 1.25), Math.round(w), Math.round(fs * 1.3));
      ctx.fillStyle = accent ? "#0a0b0d" : "#f2f5f3";
      ctx.fillText(text, x, y);
    };

    const inView = (x: number, y: number) => x > this.camX - 2 && x < this.camX + viewW + 2 && y > this.camY - 2 && y < this.camY + viewH + 3;

    for (const e of this.entities[this.map]) {
      if (e.kind !== "member" || !e.label || !e.actor) continue;
      if (!inView(e.actor.x, e.actor.y)) continue;
      const [sx, sy] = this.toScreen(e.actor.x, e.actor.y);
      tag(e.label, sx + (TILE * u) / 2, sy - (CHAR_H - TILE + 1) * u, false);
    }
    for (const peer of this.peers.values()) {
      if (peer.map !== this.map || !inView(peer.dx, peer.dy)) continue;
      const name = peer.name ?? (peer.guest ? this.labels.guestName(peer.guest[0], peer.guest[1]) : "");
      const [sx, sy] = this.toScreen(peer.dx, peer.dy);
      tag(name, sx + (TILE * u) / 2, sy - (CHAR_H - TILE + 1) * u, Boolean(peer.slug));
    }
  }

  /** "!" over whoever has something for you, "?" over whoever you owe a visit; and speech. */
  private drawMarkersAndSpeech(viewW: number, viewH: number) {
    const ctx = this.ctx;
    const u = this.unit;
    const size = TILE * u;
    for (const e of this.entities[this.map]) {
      const ex = e.actor ? e.actor.x : e.x;
      const ey = e.actor ? e.actor.y : e.y;
      if (ex < this.camX - 2 || ex > this.camX + viewW + 2 || ey < this.camY - 2 || ey > this.camY + viewH + 3) continue;
      const [sx, sy] = this.toScreen(ex, ey);
      const head = sy - (e.look ? CHAR_H - TILE + 3 : 14) * u;

      if (e.speech && this.time < e.speech.until) {
        this.textBubble(sx + size / 2, head, e.speech.text);
        continue;
      }
      const mark = e.storyId ? this.markers.get(e.storyId) : undefined;
      if (mark && !(this.prompt && e.interaction === this.prompt)) {
        const bounce = Math.round(Math.sin(this.time * 5) * 2) * u;
        const fs = Math.round(Math.max(16 * this.dpr, u * 6));
        ctx.font = `900 ${fs}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.lineWidth = Math.max(3, u);
        ctx.strokeStyle = "#0a0b0d";
        ctx.strokeText(mark, sx + size / 2, head + bounce);
        ctx.fillStyle = mark === "!" ? "#ffc93d" : "#c6ff3d";
        ctx.fillText(mark, sx + size / 2, head + bounce);
      }
    }
  }

  /**
   * The quest guide: a pulsing diamond over the goal when it is on screen,
   * an arrow at the edge of the screen with the distance when it is not.
   */
  private drawObjective(viewW: number, viewH: number) {
    const target = this.objective;
    if (!target || target.map !== this.map || this.paused) return;
    const ctx = this.ctx;
    const u = this.unit;
    const size = TILE * u;
    const [tx, ty] = this.toScreen(target.x + 0.5, target.y + 0.5);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const margin = 56 * this.dpr;
    const onScreen = target.x > this.camX && target.x < this.camX + viewW - 1 && target.y > this.camY + 1 && target.y < this.camY + viewH - 1;

    if (onScreen) {
      const pulse = 1 + Math.sin(this.time * 6) * 0.15;
      const r = size * 0.35 * pulse;
      const y = ty - size * 1.9;
      ctx.fillStyle = "rgba(198,255,61,0.9)";
      ctx.strokeStyle = "#0a0b0d";
      ctx.lineWidth = Math.max(2, u * 0.6);
      ctx.beginPath();
      ctx.moveTo(tx, y - r);
      ctx.lineTo(tx + r * 0.7, y);
      ctx.lineTo(tx, y + r);
      ctx.lineTo(tx - r * 0.7, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }

    const cx = W / 2;
    const cy = H / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    const scale = Math.min((W / 2 - margin) / Math.abs(dx || 1), (H / 2 - margin * 1.6) / Math.abs(dy || 1));
    const ax = cx + dx * scale;
    const ay = cy + dy * scale;
    const angle = Math.atan2(dy, dx);
    const r = Math.max(14 * this.dpr, u * 5);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = "#c6ff3d";
    ctx.strokeStyle = "#0a0b0d";
    ctx.lineWidth = Math.max(2, u * 0.7);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, r * 0.75);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.7, -r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const meters = Math.round(Math.hypot(target.x - this.player.x, target.y - this.player.y) * this.maps[this.map].tileMeters);
    const label = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
    const fs = this.fontPx();
    ctx.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lx = ax - Math.cos(angle) * r * 1.9;
    const ly = ay - Math.sin(angle) * r * 1.9;
    const w = ctx.measureText(label).width + fs;
    ctx.fillStyle = "rgba(10,11,13,0.8)";
    ctx.fillRect(lx - w / 2, ly - fs * 0.75, w, fs * 1.5);
    ctx.fillStyle = "#c6ff3d";
    ctx.fillText(label, lx, ly);
  }

  /** A speech bubble with a line of text, cut short if it would not fit. */
  private textBubble(x: number, y: number, raw: string) {
    const ctx = this.ctx;
    const fs = this.fontPx();
    ctx.font = `600 ${fs}px ui-sans-serif, system-ui, -apple-system, "PingFang SC", sans-serif`;
    const max = this.canvas.width * 0.6;
    let text = raw;
    while (ctx.measureText(text).width > max && text.length > 2) text = `${text.slice(0, -2)}…`;
    const w = ctx.measureText(text).width + fs * 1.2;
    const h = fs * 1.7;
    const left = Math.max(4, Math.min(this.canvas.width - w - 4, x - w / 2));
    const top = y - h - fs * 0.5;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, fs * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - fs * 0.4, top + h - 1);
    ctx.lineTo(x + fs * 0.4, top + h - 1);
    ctx.lineTo(x, top + h + fs * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#0a0b0d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, left + w / 2, top + h / 2);
  }

  /** A white bubble with one of the game's pixel icons in it. */
  private bubble(x: number, y: number, icon: IconName) {
    const ctx = this.ctx;
    const size = Math.max(24 * this.dpr, this.unit * 9);
    const pad = size * 0.2;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.beginPath();
    ctx.roundRect(x - size / 2 - pad, y - size - pad * 2, size + pad * 2, size + pad * 2, pad);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - pad, y - 1);
    ctx.lineTo(x + pad, y - 1);
    ctx.lineTo(x, y + pad);
    ctx.closePath();
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(iconCanvas(icon), x - size / 2, y - size - pad, size, size);
  }

  private aBadge(x: number, y: number) {
    const ctx = this.ctx;
    const r = Math.max(9 * this.dpr, this.unit * 3);
    ctx.fillStyle = "#0a0b0d";
    ctx.beginPath();
    ctx.arc(x, y, r + this.unit * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c6ff3d";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0b0d";
    ctx.font = `800 ${Math.round(r * 1.2)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", x, y + r * 0.08);
  }

  /** Nearest named street, for the "you are here" line. */
  nearestStreet(): string | null {
    const map = this.maps[this.map];
    let best: string | null = null;
    let bestD = 9;
    for (const label of map.labels) {
      const d = Math.hypot(label.x - this.player.x, label.y - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = label.name;
      }
    }
    return best;
  }

  /** The landmark you are standing near, if any — generous, for the HUD. */
  nearestLandmark(): string | null {
    let best: string | null = null;
    let bestD = Infinity;
    for (const landmark of LANDMARKS) {
      if (landmark.map !== this.map) continue;
      const at = this.placeGeo(landmark.map, landmark.lat, landmark.lon);
      const d = Math.hypot(at.x - this.player.x, at.y - this.player.y);
      if (d <= landmark.radius * 2 && d < bestD) {
        bestD = d;
        best = landmark.id;
      }
    }
    return best;
  }

  position(): { map: MapId; x: number; y: number } {
    return { map: this.map, x: Math.round(this.player.toX), y: Math.round(this.player.toY) };
  }
}
