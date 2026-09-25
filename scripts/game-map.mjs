/**
 * Builds the two game maps from OpenStreetMap.
 *
 *   node scripts/game-map.mjs            # both maps
 *   node scripts/game-map.mjs chatswood  # one
 *
 * Set GAME_MAP_CACHE=/some/dir to keep the raw Overpass responses there and
 * reuse them, so tuning the rasteriser does not hammer a free public API.
 *
 * The streets in /play are the real streets. Rather than drawing Sydney by
 * hand and getting it subtly wrong, this asks the Overpass API for every road,
 * building, park, rail line and body of water inside a bounding box and
 * rasterises them onto a grid of square tiles. The output is committed, so the
 * game never talks to OpenStreetMap at runtime and this only needs re-running
 * when the map should change.
 *
 * Map data © OpenStreetMap contributors, ODbL — the game credits it on screen.
 *
 * Tile alphabet (one character per tile, one string per row):
 *   ~ water            . pavement / open ground   r road
 *   p pedestrian mall  g grass / park             s sand
 *   w pier / wharf     H bridge deck (walkable)   h bridge rail (blocked)
 *   = rail (blocked)   P platform                 t tree (blocked)
 *   v rail viaduct (blocked)   u street passing under a viaduct (walkable)
 *   A B C D buildings (blocked; four shades so blocks read as separate)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "src/lib/game/maps");
const OVERPASS = "https://overpass-api.de/api/interpreter";

/**
 * The two places. `bbox` is south, west, north, east in degrees.
 */
const MAPS = {
  harbour: {
    bbox: [-33.8632, 151.2035, -33.8448, 151.2215],
    tileMeters: 12,
  },
  chatswood: {
    bbox: [-33.8008, 151.1768, -33.7932, 151.1872],
    tileMeters: 8,
    // Chatswood's line runs on a viaduct through the town centre, and the
    // streets pass underneath it. Drawn, not skipped: without it there is no
    // railway through the middle of a map whose point is the railway station.
    viaducts: true,
  },
};

const METERS_PER_DEG_LAT = 111_320;

async function overpass(bbox) {
  const [s, w, n, e] = bbox;
  const box = `${s},${w},${n},${e}`;

  const query = `
    [out:json][timeout:90];
    (
      way["highway"](${box});
      way["railway"~"^(rail|subway|light_rail|platform)$"](${box});
      way["public_transport"="platform"](${box});
      way["building"](${box});
      relation["building"](${box});
      way["leisure"~"^(park|garden|pitch|playground)$"](${box});
      relation["leisure"~"^(park|garden)$"](${box});
      way["landuse"~"^(grass|recreation_ground|village_green)$"](${box});
      way["natural"~"^(water|beach|sand|wood|scrub)$"](${box});
      relation["natural"="water"](${box});
      way["man_made"~"^(pier|bridge)$"](${box});
      relation["man_made"="bridge"](${box});
      way["place"="square"](${box});
      way["area:highway"](${box});
      node["natural"="tree"](${box});
    );
    out geom;
  `;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "vibethursday-game-map/1.0" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.ok) return (await response.json()).elements;

    console.warn(`overpass ${response.status}, attempt ${attempt}`);
    await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
  }

  throw new Error("Overpass kept failing");
}

function buildMap(name, spec, elements) {
  const [s, w, n, e] = spec.bbox;
  const midLat = ((s + n) / 2) * (Math.PI / 180);
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos(midLat);

  const width = Math.round(((e - w) * metersPerDegLon) / spec.tileMeters);
  const height = Math.round(((n - s) * METERS_PER_DEG_LAT) / spec.tileMeters);

  /** Degrees → fractional tile coordinates, y growing southward like a screen. */
  const toTile = (lat, lon) => [
    ((lon - w) * metersPerDegLon) / spec.tileMeters,
    ((n - lat) * METERS_PER_DEG_LAT) / spec.tileMeters,
  ];

  const grid = Array.from({ length: height }, () => new Array(width).fill("."));
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;

  const tags = (el) => el.tags ?? {};
  /**
   * Closed rings for an element, in tile space.
   *
   * A multipolygon's outline arrives as dozens of separate member ways that
   * only form a ring once joined end to end — Sydney Harbour is 193 of them.
   * Filling each one as if it were a ring on its own paints nonsense, which is
   * exactly what the first version of this did. Inner rings come back too;
   * the even-odd fill below turns them into holes.
   */
  const ringsOf = (el) => {
    if (el.type === "way" && el.geometry) return [el.geometry.map((p) => toTile(p.lat, p.lon))];
    if (el.type === "relation" && el.members) {
      const parts = el.members.filter((m) => (m.role === "outer" || m.role === "inner") && m.geometry);
      return joinRings(parts.map((m) => m.geometry)).map((ring) => ring.map((p) => toTile(p.lat, p.lon)));
    }
    return [];
  };

  function joinRings(ways) {
    const key = (p) => `${p.lat},${p.lon}`;
    const pool = ways.map((w) => [...w]);
    const rings = [];
    while (pool.length) {
      let ring = pool.pop();
      let grew = true;
      while (key(ring[0]) !== key(ring.at(-1)) && grew) {
        grew = false;
        for (let i = 0; i < pool.length; i += 1) {
          const w = pool[i];
          const end = key(ring.at(-1));
          if (key(w[0]) === end) ring = ring.concat(w.slice(1));
          else if (key(w.at(-1)) === end) ring = ring.concat([...w].reverse().slice(1));
          else continue;
          pool.splice(i, 1);
          grew = true;
          break;
        }
      }
      rings.push(ring);
    }
    return rings;
  }

  const isClosed = (el) =>
    el.type === "relation" ||
    (el.geometry && el.geometry.length > 3 &&
      el.geometry[0].lat === el.geometry.at(-1).lat && el.geometry[0].lon === el.geometry.at(-1).lon);

  /**
   * Even-odd scanline fill of one or more rings, sampling tile centres.
   * Passing every ring of a multipolygon at once is what makes its inner
   * rings holes — an island in the harbour stays land.
   */
  function fillRings(rings, ch, onlyOver = null) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const ring of rings) {
      for (const [, y] of ring) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    for (let ty = Math.max(0, Math.floor(minY)); ty <= Math.min(height - 1, Math.ceil(maxY)); ty += 1) {
      const cy = ty + 0.5;
      const xs = [];
      for (const ring of rings) {
        for (let i = 0; i < ring.length - 1; i += 1) {
          const [x1, y1] = ring[i];
          const [x2, y2] = ring[i + 1];
          if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) {
            xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
          }
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let tx = Math.max(0, Math.ceil(xs[k] - 0.5)); tx <= Math.min(width - 1, Math.floor(xs[k + 1] - 0.5)); tx += 1) {
          if (!onlyOver || onlyOver.includes(grid[ty][tx])) grid[ty][tx] = ch;
        }
      }
    }
  }

  /** A polyline stamped with a square brush `r` tiles either side. */
  function strokeLine(points, ch, r, target = grid) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 3));
      for (let k = 0; k <= steps; k += 1) {
        const x = x1 + ((x2 - x1) * k) / steps;
        const y = y1 + ((y2 - y1) * k) / steps;
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const tx = Math.floor(x + dx);
            const ty = Math.floor(y + dy);
            if (tx >= 0 && ty >= 0 && tx < width && ty < height) target[ty][tx] = ch;
          }
        }
      }
    }
  }

  const byKind = (predicate) => elements.filter((el) => predicate(tags(el), el));

  // ── 1. Parks and grass ───────────────────────────────────────────
  for (const el of byKind((t) => /^(park|garden|pitch|playground)$/.test(t.leisure ?? "") ||
    /^(grass|recreation_ground|village_green)$/.test(t.landuse ?? "") || /^(wood|scrub)$/.test(t.natural ?? ""))) {
    if (!isClosed(el)) continue;
    fillRings(ringsOf(el), "g");
  }
  for (const el of byKind((t) => /^(beach|sand)$/.test(t.natural ?? ""))) {
    if (!isClosed(el)) continue;
    fillRings(ringsOf(el), "s");
  }

  // ── 2. Water ─────────────────────────────────────────────────────
  // Sydney Harbour is not coastline in OpenStreetMap: it is a `natural=water`
  // multipolygon (Port Jackson / Sydney Harbour), so it fills like a lake.
  for (const el of byKind((t) => t.natural === "water")) {
    if (!isClosed(el)) continue;
    fillRings(ringsOf(el), "~");
  }

  // ── 3. Piers and plazas ──────────────────────────────────────────
  for (const el of byKind((t) => t.man_made === "pier")) {
    const rings = ringsOf(el);
    if (isClosed(el)) fillRings(rings, "w");
    else for (const ring of rings) strokeLine(ring, "w", 1);
  }
  for (const el of byKind((t) => t.highway === "pedestrian" || t.place === "square" || t["area:highway"] === "pedestrian")) {
    if (el.type === "way" && isClosed(el) && (tags(el).area === "yes" || tags(el).place || tags(el)["area:highway"])) {
      fillRings(ringsOf(el), "p", [".", "g", "r"]);
    }
  }

  // ── 4. Buildings ─────────────────────────────────────────────────
  const shades = ["A", "B", "C", "D"];
  for (const el of byKind((t) => t.building)) {
    const t = tags(el);
    if (!isClosed(el)) continue;
    // Roofs over platforms and walkways, not walls.
    if (/^(roof|canopy|train_station|bridge)$/.test(t.building)) continue;
    const shade = shades[Number(String(el.id).slice(-2)) % shades.length];
    fillRings(ringsOf(el), shade, [".", "g", "r", "p", "s"]);
  }

  // ── 5. Roads and paths, over the buildings ───────────────────────
  // After the buildings on purpose. Footprints in OpenStreetMap overlap the
  // street where a building bridges it — Chatswood Interchange spans the
  // mall — and painting walls last sealed Chatswood Mall into a box you
  // could not walk out of. A street drawn in the data is a way through.
  const elevated = (t) => (t.bridge && t.bridge !== "no") || Number(t.layer ?? 0) >= 1 || t.tunnel === "yes";
  const isHarbourBridge = (t) => /Harbour Bridge|Bradfield/.test(t.name ?? "") || /Harbour Bridge/.test(t["bridge:name"] ?? "");
  const ROAD_WIDTH = { motorway: 2, trunk: 2, primary: 2, secondary: 1, tertiary: 1, residential: 1, unclassified: 1, service: 0, living_street: 1 };
  const FOOT = /^(footway|pedestrian|path|steps|cycleway)$/;

  for (const el of byKind((t) => t.highway)) {
    const t = tags(el);
    if (t.area === "yes" || !el.geometry) continue;
    if (t.tunnel === "yes") continue;
    // The Cahill Expressway and Circular Quay's own viaduct run one storey
    // above the quay; drawn at street level they would wall the wharves off.
    if (elevated(t) && !isHarbourBridge(t)) continue;
    const line = ringsOf(el)[0];
    if (FOOT.test(t.highway)) {
      strokeLine(line, "p", 0);
      continue;
    }
    const widthKey = t.highway.replace(/_link$/, "");
    const r = ROAD_WIDTH[widthKey] ?? 0;
    // Metres differ between maps, so wide roads get scaled down on the coarse one.
    strokeLine(line, "r", spec.tileMeters >= 12 ? Math.min(r, 1) : r);
  }
  // Pedestrian streets stroked wide, so Chatswood Mall reads as a mall.
  for (const el of byKind((t) => t.highway === "pedestrian" && t.area !== "yes")) {
    if (el.geometry) strokeLine(ringsOf(el)[0], "p", 1);
  }

  for (const el of byKind((t) => t.railway === "platform" || t.public_transport === "platform")) {
    const t = tags(el);
    if (t.tunnel === "yes" || t.level?.startsWith("-") || Number(t.layer ?? 0) < 0) continue;
    const rings = ringsOf(el);
    if (isClosed(el)) fillRings(rings, "P");
    else for (const ring of rings) strokeLine(ring, "P", 0);
  }

  // ── 6. Rail, then the bridge on top of everything ────────────────
  for (const el of byKind((t) => /^(rail|subway|light_rail)$/.test(t.railway ?? ""))) {
    const t = tags(el);
    if (t.tunnel === "yes" || Number(t.layer ?? 0) < 0 || !el.geometry) continue;
    const onBridge = isHarbourBridge(t) || /Harbour Bridge/.test(t["bridge:name"] ?? "");
    if (elevated(t) && !onBridge) {
      if (spec.viaducts) strokeViaduct(ringsOf(el)[0]);
      continue;
    }
    strokeLine(ringsOf(el)[0], "=", 0);
  }

  /**
   * A railway overhead: blocked where it stands on something, walkable (`u`)
   * where a street or footpath runs under it — which is how a pedestrian
   * actually gets from one side of Chatswood station to the other.
   */
  function strokeViaduct(points) {
    const mark = grid.map((row) => [...row]);
    strokeLine(points, "#", 0, mark);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (mark[y][x] !== "#") continue;
        grid[y][x] = /[rpu]/.test(grid[y][x]) ? "u" : "v";
      }
    }
  }

  // The Harbour Bridge's deck: every way OpenStreetMap puts on the span
  // (`bridge:name=Sydney Harbour Bridge`) plus the Bradfield Highway
  // approaches. The carriageways, cycleway and footway are stroked wide so the
  // deck reads as one surface; the two rail lines go on top, and block. The
  // Cahill Expressway shares the tag where it joins, but it is the viaduct over
  // Circular Quay, and drawn at street level it would wall off the wharves.
  const onSpan = (t) =>
    (/Sydney Harbour Bridge/.test(t["bridge:name"] ?? "") || /^Bradfield Highway/.test(t.name ?? "")) &&
    !/Cahill Expressway/.test(t.name ?? "");
  const deck = byKind((t, raw) => raw.type === "way" && Boolean(raw.geometry) && onSpan(t) && (t.highway || t.railway));
  for (const el of deck) if (!tags(el).railway) strokeLine(ringsOf(el)[0], "H", 1);
  for (const el of deck) if (tags(el).railway) strokeLine(ringsOf(el)[0], "h", 0);

  // Where the pylons stand, so the game can raise the arch between the real
  // ones rather than along a line typed in by hand.
  let bridge = null;
  const pylon = (which) => {
    const el = elements.find((e) => new RegExp(`Sydney Harbour Bridge - ${which} Pylons`).test(tags(e).name ?? ""));
    const ring = el && ringsOf(el)[0];
    if (!ring?.length) return null;
    return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
  };
  const south = pylon("South");
  const north = pylon("North");
  if (south && north) bridge = { south: south.map((v) => Math.round(v * 10) / 10), north: north.map((v) => Math.round(v * 10) / 10) };

  // ── 7. Trees ─────────────────────────────────────────────────────
  for (const el of byKind((t, raw) => raw.type === "node" && t.natural === "tree")) {
    const [x, y] = toTile(el.lat, el.lon).map(Math.floor);
    if (inside(x, y) && (grid[y][x] === "g" || grid[y][x] === "." || grid[y][x] === "p")) grid[y][x] = "t";
  }

  // ── Labels: street names and named buildings ─────────────────────
  const labels = [];
  const seen = new Set();
  for (const el of byKind((t) => t.name && (t.highway || t.building || t.leisure || t.amenity || t.tourism))) {
    const t = tags(el);
    const rings = ringsOf(el);
    if (!rings.length || !rings[0].length) continue;
    const ring = rings[0];
    let x;
    let y;
    if (t.highway && !isClosed(el)) {
      [x, y] = ring[Math.floor(ring.length / 2)];
    } else {
      x = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
      y = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
    }
    x = Math.floor(x);
    y = Math.floor(y);
    if (!inside(x, y)) continue;
    const key = `${t.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({ name: t.name, x, y, kind: t.highway ? "street" : "place" });
  }

  return {
    name,
    width,
    height,
    tileMeters: spec.tileMeters,
    bbox: spec.bbox,
    rows: grid.map((row) => row.join("")),
    labels,
    bridge,
  };
}

async function main() {
  const only = process.argv[2];
  mkdirSync(OUT_DIR, { recursive: true });

  for (const [name, spec] of Object.entries(MAPS)) {
    if (only && only !== name) continue;
    const cache = process.env.GAME_MAP_CACHE ? path.join(process.env.GAME_MAP_CACHE, `${name}.osm.json`) : null;
    let elements;
    if (cache && existsSync(cache)) {
      elements = JSON.parse(readFileSync(cache, "utf8"));
    } else {
      console.log(`fetching ${name}…`);
      elements = await overpass(spec.bbox);
      if (cache) writeFileSync(cache, JSON.stringify(elements));
    }
    console.log(`  ${elements.length} elements`);
    const map = buildMap(name, spec, elements);
    const file = path.join(OUT_DIR, `${name}.json`);
    writeFileSync(file, `${JSON.stringify(map)}\n`);
    console.log(`  ${map.width}×${map.height} → ${path.relative(process.cwd(), file)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
