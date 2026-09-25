// Relative imports only, and none at all from the server: the browser loads this.

/**
 * What goes over the wire in /play's multiplayer, and the checks on it.
 *
 * ★ There is no free text anywhere in this protocol, on purpose. A player's
 * name is either their name on the member wall — which they already chose to
 * publish — or a generated one; what they can say is one of a fixed set of
 * emotes. A chat box on a public page is a moderation job, and this site has
 * nobody to do it.
 */

/** Appearance. Every field is an index into a palette the renderer owns. */
export type Look = {
  skin: number;
  hair: number;
  hairColor: number;
  top: number;
  bottom: number;
  acc: number;
  hat: number;
  /** Index into PETS, or -1 for none. */
  pet: number;
};

export const LOOK_RANGES: Record<keyof Look, [number, number]> = {
  skin: [0, 4],
  hair: [0, 6],
  hairColor: [0, 6],
  top: [0, 7],
  bottom: [0, 4],
  acc: [0, 3],
  hat: [0, 10],
  pet: [-1, 8],
};

/** Pets by index, matching the critters that can follow you. */
export const PETS = ["ibis", "gull", "cockatoo", "dragon", "lorikeet", "kookaburra", "turkey", "magpie", "golden"] as const;

export const DEFAULT_LOOK: Look = { skin: 1, hair: 0, hairColor: 0, top: 0, bottom: 0, acc: 0, hat: 0, pet: -1 };

/** Any value → a valid look. Out-of-range fields fall back to the default. */
export function clampLook(value: unknown): Look {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const look = { ...DEFAULT_LOOK };

  for (const key of Object.keys(LOOK_RANGES) as (keyof Look)[]) {
    const [min, max] = LOOK_RANGES[key];
    const raw = input[key];
    if (Number.isInteger(raw) && (raw as number) >= min && (raw as number) <= max) look[key] = raw as number;
  }

  return look;
}

/**
 * The only things a player can say. Rendered as bubbles over their head.
 *
 * The first eight are pictures. The rest are quick-chat phrases: a fixed id
 * goes over the wire and each screen shows it in its own language, so two
 * players who share no language can still say "see you Thursday" — and
 * nobody can type anything at all.
 */
export const PHRASES = ["gday", "building", "thursday", "follow", "nice", "coffeeq", "help", "bye"] as const;
export type Phrase = (typeof PHRASES)[number];
export const EMOTES = ["wave", "heart", "laugh", "coffee", "idea", "party", "chat", "thanks", ...PHRASES] as const;
export type Emote = (typeof EMOTES)[number];

export function isPhrase(emote: Emote): emote is Phrase {
  return (PHRASES as readonly string[]).includes(emote);
}

export const EMOTE_GLYPH: Record<Emote, string> = {
  gday: "💬",
  building: "💬",
  thursday: "💬",
  follow: "💬",
  nice: "💬",
  coffeeq: "💬",
  help: "💬",
  bye: "💬",
  wave: "👋",
  heart: "❤️",
  laugh: "😂",
  coffee: "☕",
  idea: "💡",
  party: "🎉",
  chat: "💬",
  thanks: "🙏",
};

export type Dir = 0 | 1 | 2 | 3; // down, left, right, up

/**
 * One player as everyone else sees them. Kept flat and short because the
 * whole room goes out several times a second.
 */
export type PeerView = {
  id: string;
  /** Wall name for members; null for guests, who are shown by `guest`. */
  name: string | null;
  /** Member slug, so tapping them can open their card. */
  slug: string | null;
  /** Generated guest identity: an animal index and a number. */
  guest: [number, number] | null;
  map: string;
  x: number;
  y: number;
  dir: Dir;
  look: Look;
  emote: Emote | null;
  /** Server clock when the emote was sent, so it can fade on every screen. */
  emoteAt: number;
};

/** Animals guests are named after. Localised by index in the game's copy. */
export const GUEST_ANIMALS = 10;

export const MAP_IDS = ["harbour", "chatswood", "train"] as const;

/** A position update, validated. Null means drop it. */
export function parseMove(body: unknown): {
  id: string;
  key: string;
  map: string;
  x: number;
  y: number;
  dir: Dir;
  look: Look;
  emote: Emote | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;

  if (typeof input.id !== "string" || !/^[a-z0-9]{8,24}$/.test(input.id)) return null;
  if (typeof input.key !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(input.key)) return null;
  if (!MAP_IDS.includes(input.map as (typeof MAP_IDS)[number])) return null;

  const coord = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 400 ? value : null);
  const x = coord(input.x);
  const y = coord(input.y);
  if (x === null || y === null) return null;

  const dir = [0, 1, 2, 3].includes(input.dir as number) ? (input.dir as Dir) : 0;
  const emote = EMOTES.includes(input.emote as Emote) ? (input.emote as Emote) : null;

  return {
    id: input.id,
    key: input.key,
    map: input.map as string,
    // Two decimals is plenty for a tile position and keeps the payload short.
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    dir,
    look: clampLook(input.look),
    emote,
  };
}
