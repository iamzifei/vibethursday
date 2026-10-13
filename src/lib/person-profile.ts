// Relative imports only: the tests load this through Node's type stripper.
import { AI_LEVELS, INDUSTRIES } from "./signup-profile.ts";

/**
 * The organiser's private notes on the people who came (2026-10-13).
 *
 * After each Tuesday and Thursday the organiser tags who was in the room:
 * what they do, how far along they are with AI, which trade, what they are
 * good at, what they could bring. Some of it the person said on the signup
 * form; the rest is the organiser's own judgement, and that half is never
 * shown to anyone but the organiser — it is read only by /admin pages, and a
 * test keeps it that way (tests/person-profile.test.mts).
 *
 * Roles, level and industry are fixed lists, so they can be counted and
 * filtered. Skills and resources are free tags: neither can be listed in
 * advance, and a fixed list would push half the answers into "other".
 */

/** What someone is, in the room. Several can be true at once. */
export const PERSON_ROLES = ["owner", "builder", "employee", "advisor", "creator", "investor", "student"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  owner: "老板",
  builder: "做产品的",
  employee: "打工 / 求职",
  advisor: "顾问 / 服务商",
  creator: "内容创作者",
  investor: "投资人",
  student: "学生",
};

/** How far along with AI, 1 to 4. */
export const PERSON_LEVELS = [1, 2, 3, 4] as const;
export type PersonLevel = (typeof PERSON_LEVELS)[number];

export const PERSON_LEVEL_LABEL: Record<PersonLevel, string> = {
  1: "刚接触",
  2: "会用工具",
  3: "能搭工作流",
  4: "能做 AI 产品",
};

/**
 * The level suggested by the person's own answer on the signup form, used as
 * the starting point before the organiser has tagged them. Only a starting
 * point: "every day" can mean a chat window or a pipeline.
 */
export function levelFromSelfReport(aiLevel: string | null | undefined): PersonLevel | null {
  switch (aiLevel) {
    case "none":
      return 1;
    case "sometimes":
    case "daily":
      return 2;
    case "builder":
      return 4;
    default:
      return null;
  }
}

export type PersonProfile = {
  roles: PersonRole[];
  level: PersonLevel | null;
  industry: string | null;
  /** Skills and background: "iOS", "accounting", "paid ads". */
  tags: string[];
  /** What they could bring: "has customers", "has capital", "has a venue". */
  resources: string[];
  /** The organiser's standing impression of the person. */
  note: string | null;
};

export const EMPTY_PROFILE: PersonProfile = { roles: [], level: null, industry: null, tags: [], resources: [], note: null };

const MAX_TAG = 30;
const MAX_TAGS = 20;
const MAX_NOTE = 2000;
export const MAX_SESSION_NOTE = 300;

/**
 * One tag as stored: trimmed, inner whitespace collapsed, capped. Full-width
 * spaces and commas count as separators too — they are what a Chinese IME
 * types.
 */
export function normaliseTag(value: string): string {
  return value.replace(/[\s　]+/g, " ").trim().slice(0, MAX_TAG);
}

/** Splits typed text into tags on commas (either width), 、 and newlines. */
export function splitTags(value: string): string[] {
  return value.split(/[,，、;；\n]/).map(normaliseTag).filter(Boolean);
}

/** Cleans a tag list: normalised, case-insensitively de-duplicated, capped. */
export function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const tag = normaliseTag(item);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Reads a profile from a request body, keeping only known values. */
export function cleanProfile(body: unknown): PersonProfile {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const roles = Array.isArray(raw.roles)
    ? PERSON_ROLES.filter((role) => (raw.roles as unknown[]).includes(role))
    : [];
  const level = PERSON_LEVELS.find((value) => value === raw.level) ?? null;
  const industry =
    typeof raw.industry === "string" && (INDUSTRIES as readonly string[]).includes(raw.industry) ? raw.industry : null;
  return {
    roles,
    level,
    industry,
    tags: cleanTags(raw.tags),
    resources: cleanTags(raw.resources),
    note: cleanText(raw.note, MAX_NOTE),
  };
}

export function cleanSessionNote(value: unknown): string | null {
  return cleanText(value, MAX_SESSION_NOTE);
}

/** The filters /admin/people understands, read from its query string. */
export type PeopleFilter = {
  role?: string;
  level?: string;
  industry?: string;
  tag?: string;
  resource?: string;
  q?: string;
};

/** The fields of a tagged person the filters look at. */
export type FilterablePerson = PersonProfile & { name: string; wechat: string | null };

/**
 * Whether one person passes every filter that is set. Tags compare without
 * case; `q` searches the name, WeChat ID, tags, resources and notes.
 */
export function matchesFilter(person: FilterablePerson, filter: PeopleFilter): boolean {
  const lower = (value: string) => value.toLowerCase();
  if (filter.role && !person.roles.includes(filter.role as PersonRole)) return false;
  if (filter.level && String(person.level ?? "") !== filter.level) return false;
  if (filter.industry && person.industry !== filter.industry) return false;
  if (filter.tag && !person.tags.some((tag) => lower(tag) === lower(filter.tag!))) return false;
  if (filter.resource && !person.resources.some((tag) => lower(tag) === lower(filter.resource!))) return false;
  if (filter.q) {
    const needle = lower(filter.q.trim());
    const haystack = [person.name, person.wechat ?? "", ...person.tags, ...person.resources, person.note ?? ""]
      .join("\n")
      .toLowerCase();
    if (needle && !haystack.includes(needle)) return false;
  }
  return true;
}

/** How many people carry each value, most common first — the counts beside each filter chip. */
export function countValues(lists: readonly (readonly string[])[]): { value: string; count: number }[] {
  const counts = new Map<string, { value: string; count: number }>();
  for (const list of lists) {
    for (const value of list) {
      const key = value.toLowerCase();
      const entry = counts.get(key) ?? { value, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** One CSV field, quoted when it has to be. */
export function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Re-exported so the admin pages take every option list from one place.
export { AI_LEVELS, INDUSTRIES };
