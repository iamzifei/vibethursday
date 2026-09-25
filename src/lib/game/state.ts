// Relative imports only: the tests load this through Node's type stripper.
import { CRITTERS, LANDMARKS, PHOTO_SPOTS, SHARDS, hashString, seeded, type CritterId, type MapId, type StoryNpcId } from "./world.ts";
import { clampLook, DEFAULT_LOOK, type Look } from "./protocol.ts";

/**
 * Everything a player has done, kept in their own browser.
 *
 * localStorage rather than the database, for the same reason the site has no
 * accounts: most people who open /play have never signed up, and asking them
 * to before they can walk to the Opera House would end the game at the title
 * screen. The cost is that progress lives on one device, which is stated in
 * the game rather than discovered.
 */
export type SaveState = {
  v: 1;
  look: Look;
  map: MapId;
  x: number;
  y: number;
  /** Story beats, by id. Set once, never unset. */
  flags: string[];
  /** What the busker asked you about: which kind of thing you are building. */
  idea: IdeaKind | null;
  stamps: string[];
  critters: CritterId[];
  shards: string[];
  /** Member slugs you have said hello to. */
  met: string[];
  /** Stalls visited, by index key. */
  stalls: string[];
  /** Wharf question ids read on the noticeboard. */
  read: string[];
  /** Consecutive days played, and the Sydney date of the last one. */
  streak: number;
  lastDay: string | null;
  /** Passers-by said g'day to, ever. */
  greeted: number;
  /** High-fives with other players, ever. */
  highFives: number;
  /** Names of other players you have waved at, high-fived or had a photo with. */
  friends: string[];
  /** Today's daily tasks: the Sydney day they belong to, and counts so far. */
  daily: { day: string | null; progress: Record<string, number> };
  /** Daily tasks finished, ever. */
  stars: number;
};

export const IDEAS = ["app", "content", "shop", "automation"] as const;
export type IdeaKind = (typeof IDEAS)[number];

export const SAVE_KEY = "vt-play-v1";

export function newSave(map: MapId, x: number, y: number): SaveState {
  return {
    v: 1,
    look: { ...DEFAULT_LOOK },
    map,
    x,
    y,
    flags: [],
    idea: null,
    stamps: [],
    critters: [],
    shards: [],
    met: [],
    stalls: [],
    read: [],
    streak: 0,
    lastDay: null,
    greeted: 0,
    highFives: 0,
    friends: [],
    daily: { day: null, progress: {} },
    stars: 0,
  };
}

const strings = (value: unknown, max = 500): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length <= 80))].slice(0, max) : [];

/**
 * Reads a save back, trusting nothing about it.
 *
 * It came out of localStorage, which the player — or an older version of this
 * game — can put anything in. Every field is checked and anything unusable
 * falls back to the default, so a corrupt save costs a field, not the game.
 */
export function parseSave(raw: string | null, fallback: SaveState): SaveState {
  if (!raw) return fallback;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!data || typeof data !== "object" || data.v !== 1) return fallback;

  const map = data.map === "harbour" || data.map === "chatswood" ? data.map : fallback.map;
  const int = (value: unknown, dflt: number) => (Number.isInteger(value) && (value as number) >= 0 && (value as number) < 1000 ? (value as number) : dflt);
  const critterIds = new Set(CRITTERS.map((critter) => critter.id));

  return {
    v: 1,
    look: clampLook(data.look),
    map,
    x: int(data.x, fallback.x),
    y: int(data.y, fallback.y),
    flags: strings(data.flags),
    idea: IDEAS.includes(data.idea as IdeaKind) ? (data.idea as IdeaKind) : null,
    stamps: strings(data.stamps),
    critters: strings(data.critters).filter((id): id is CritterId => critterIds.has(id as CritterId)),
    shards: strings(data.shards),
    met: strings(data.met),
    stalls: strings(data.stalls),
    read: strings(data.read),
    streak: int(data.streak, 0),
    lastDay: typeof data.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.lastDay) ? data.lastDay : null,
    greeted: int(data.greeted, 0),
    highFives: int(data.highFives, 0),
    friends: strings(data.friends, 50),
    daily: parseDaily(data.daily),
    stars: int(data.stars, 0),
  };
}

function parseDaily(value: unknown): SaveState["daily"] {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const day = typeof input.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.day) ? input.day : null;
  const progress: Record<string, number> = {};
  if (input.progress && typeof input.progress === "object") {
    for (const [key, count] of Object.entries(input.progress as Record<string, unknown>)) {
      if (DAILY_KINDS.includes(key as DailyKind) && Number.isInteger(count) && (count as number) >= 0 && (count as number) < 1000) {
        progress[key] = count as number;
      }
    }
  }
  return { day, progress };
}

/* =============================================================================
   The main quest
============================================================================= */

/**
 * What the world has in it this time the page loaded — the counts the quest
 * targets are clamped to. A chapter that asks you to meet three members has to
 * be finishable on a day there are only two cards on the wall, and on a day
 * there are none it asks for nothing: a chapter nobody can finish is a game
 * nobody can finish.
 */
export type WorldCounts = { members: number; stalls: number; questions: number };

export type QuestId = "arrive" | "muse" | "wharf" | "bridge" | "train" | "market" | "people" | "thursday";

export type QuestProgress = { id: QuestId; done: boolean; have: number; need: number };

const need = (want: number, available: number) => Math.max(0, Math.min(want, available));

/**
 * The eight chapters, in order, each a check against the save.
 *
 * A chapter is done when its condition holds, whenever that happened — walking
 * to Chatswood before talking to anyone still counts once you get there. The
 * story only ever points at the first chapter that is not done yet, so the
 * order is the order it is told in, and nothing is ever locked behind it.
 */
export function questProgress(save: SaveState, counts: WorldCounts): QuestProgress[] {
  const has = (flag: string) => save.flags.includes(flag);
  const count = (id: QuestId, have: number, want: number): QuestProgress => ({
    id,
    have: Math.min(have, want),
    need: want,
    done: have >= want,
  });

  return [
    count("arrive", has("talked:deckhand") ? 1 : 0, 1),
    count("muse", save.idea ? 1 : 0, 1),
    count("wharf", save.read.length, need(3, counts.questions)),
    count("bridge", save.stamps.includes("milsons") ? 1 : 0, 1),
    count("train", has("rode:t1") ? 1 : 0, 1),
    count("market", save.stalls.length, need(3, counts.stalls)),
    count("people", save.met.length, need(3, counts.members)),
    count("thursday", has("talked:host") ? 1 : 0, 1),
  ];
}

/** The chapter the story is on: the first one not done, or null when finished. */
export function currentQuest(progress: QuestProgress[]): QuestProgress | null {
  return progress.find((quest) => !quest.done) ?? null;
}

/* =============================================================================
   Collections and what they unlock
============================================================================= */

export const HATS = ["none", "bucket", "akubra", "crest", "sail", "lime", "jacaranda", "cup", "beanie", "beret", "koala"] as const;
export type Hat = (typeof HATS)[number];

/**
 * Why each hat unlocks. Collections are the part of the game with no end
 * point you can see from the start, and a hat is the thing other players
 * can see you earned — which is the whole reason to show it off in a shared
 * world rather than on a stats page.
 */
export function unlockedHats(save: SaveState, progress: QuestProgress[]): Hat[] {
  const done = (id: QuestId) => progress.find((quest) => quest.id === id)?.done ?? false;

  const hats: Hat[] = ["none"];
  if (done("muse")) hats.push("bucket");
  if (save.stamps.length >= 8) hats.push("akubra");
  if (save.critters.length >= 5) hats.push("crest");
  if (save.shards.length >= SHARDS.length) hats.push("sail");
  if (done("thursday")) hats.push("lime");
  if (save.streak >= 3) hats.push("jacaranda");
  if (save.flags.includes("sidedone:coffee")) hats.push("cup");
  if (save.flags.includes("sidedone:ibis")) hats.push("beanie");
  if (save.flags.includes("sidedone:postcards")) hats.push("beret");
  if (save.flags.includes("sidedone:gday")) hats.push("koala");

  return hats;
}

export const TOTALS = {
  stamps: LANDMARKS.length,
  critters: CRITTERS.length,
  shards: SHARDS.length,
};

/**
 * Today's date in Sydney, as YYYY-MM-DD, for the daily streak.
 *
 * en-CA formats dates as ISO, which saves assembling one by hand.
 */
export function sydneyDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(now);
}

/**
 * Advances the daily streak for a visit today.
 *
 * Returns the same object when today was already counted, so the caller can
 * tell "new day" from "same day" by identity and only greet once.
 */
export function touchStreak(save: SaveState, today: string): SaveState {
  if (save.lastDay === today) return save;

  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const continued = save.lastDay === yesterday.toISOString().slice(0, 10);

  return { ...save, streak: continued ? save.streak + 1 : 1, lastDay: today };
}

/** Adds to a set-like list, returning the same save if nothing changed. */
export function addTo<K extends "flags" | "stamps" | "shards" | "met" | "stalls" | "read" | "friends">(
  save: SaveState,
  key: K,
  value: string,
): SaveState {
  if (save[key].includes(value)) return save;
  return { ...save, [key]: [...save[key], value] };
}

export function addCritter(save: SaveState, id: CritterId): SaveState {
  if (save.critters.includes(id)) return save;
  return { ...save, critters: [...save.critters, id] };
}

/* =============================================================================
   Side quests
============================================================================= */

/**
 * Five errands from five people around the map. Each is offered by someone
 * standing somewhere real, counts only what can be checked against the save,
 * and pays out a hat — the one reward other players can see.
 *
 * Accepting sets `side:<id>`; finishing sets `sidedone:<id>`. Progress made
 * before accepting counts (an ibis befriended last week is still a friend),
 * except for the coffee run, where the point is carrying the cups.
 */
export type SideId = "coffee" | "postcards" | "ibis" | "gday" | "shards";

export const SIDE_QUESTS: { id: SideId; giver: StoryNpcId }[] = [
  { id: "ibis", giver: "tourist" },
  { id: "postcards", giver: "photographer" },
  { id: "shards", giver: "hunter" },
  { id: "gday", giver: "greeter" },
  { id: "coffee", giver: "barista" },
];

export type SideProgress = { id: SideId; giver: StoryNpcId; accepted: boolean; done: boolean; have: number; need: number };

export function sideProgress(save: SaveState, counts: WorldCounts): SideProgress[] {
  const has = (flag: string) => save.flags.includes(flag);
  const tally = (prefix: string) => save.flags.filter((flag) => flag.startsWith(prefix)).length;

  const measure: Record<SideId, [number, number]> = {
    ibis: [save.critters.includes("ibis") ? 1 : 0, 1],
    postcards: [tally("photo:"), 4],
    shards: [save.shards.length, 8],
    gday: [save.greeted, 5],
    coffee: [tally("coffee:"), Math.max(1, Math.min(3, counts.members))],
  };

  return SIDE_QUESTS.map(({ id, giver }) => {
    const [have, want] = measure[id];
    return { id, giver, accepted: has(`side:${id}`), done: has(`sidedone:${id}`), have: Math.min(have, want), need: want };
  });
}

/** Side quests whose goal is met but not yet marked done: finish them. */
export function readyToFinish(progress: SideProgress[]): SideId[] {
  return progress.filter((quest) => quest.accepted && !quest.done && quest.have >= quest.need).map((quest) => quest.id);
}

export const PHOTO_TOTAL = PHOTO_SPOTS.length;

/* =============================================================================
   Daily tasks
============================================================================= */

/**
 * Three small things to do each Sydney day, the same three for everybody
 * online that day — so "did you get the Luna Park one?" is a question two
 * players can ask each other.
 */
export const DAILY_KINDS = ["critter", "greet", "landmark", "phrase", "photo", "member"] as const;
export type DailyKind = (typeof DAILY_KINDS)[number];

export type DailyTask = { kind: DailyKind; need: number; landmark?: string };

export function dailyTasks(day: string, counts: WorldCounts): DailyTask[] {
  // Drawn from the full list whatever is in the world today, so the set for a
  // day never reshuffles because a member card went up between two visits —
  // progress is kept by kind, and a reshuffle would hand one task's progress
  // to another. Only the member task is swapped, for a fixed stand-in, when
  // there is nobody to talk to.
  const rand = seeded(hashString(`daily.${day}`));
  const pool: DailyKind[] = [...DAILY_KINDS];
  const kinds: DailyKind[] = [];
  while (kinds.length < 3) kinds.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);

  if (counts.members === 0 && kinds.includes("member")) {
    const standIn = DAILY_KINDS.find((kind) => kind !== "member" && !kinds.includes(kind))!;
    kinds[kinds.indexOf("member")] = standIn;
  }

  const landmark = LANDMARKS[Math.floor(rand() * LANDMARKS.length)].id;
  return kinds.map((kind) => ({ kind, need: kind === "greet" ? 3 : 1, landmark: kind === "landmark" ? landmark : undefined }));
}

/**
 * Counts one more of a daily kind for today, resetting yesterday's counts on
 * the first bump of a new day. Returns the save unchanged when the kind is
 * not one of today's tasks, and awards a star the moment a task completes.
 */
export function bumpDaily(save: SaveState, kind: DailyKind, today: string, counts: WorldCounts, landmark?: string): SaveState {
  const tasks = dailyTasks(today, counts);
  const task = tasks.find((t) => t.kind === kind && (kind !== "landmark" || t.landmark === landmark));
  if (!task) return save;

  const progress = save.daily.day === today ? { ...save.daily.progress } : {};
  const before = progress[kind] ?? 0;
  if (before >= task.need) return save;

  progress[kind] = before + 1;
  const finished = progress[kind] >= task.need;
  return { ...save, daily: { day: today, progress }, stars: save.stars + (finished ? 1 : 0) };
}

export function dailyProgress(save: SaveState, today: string, counts: WorldCounts) {
  const progress = save.daily.day === today ? save.daily.progress : {};
  return dailyTasks(today, counts).map((task) => ({ ...task, have: Math.min(progress[task.kind] ?? 0, task.need) }));
}
