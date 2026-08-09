/**
 * The member wall's domain rules.
 *
 * Everything here is shared by the API route that writes a card and the pages
 * that render one, so a value that is valid on screen is valid in the database
 * and vice versa. The route is the only enforcement point — the editor is a
 * convenience, never a guarantee.
 */

/**
 * How someone describes themselves. Multi-select: most people are two of these.
 *
 * `advisor` covers the lawyers, accountants, grant and compliance people. It is
 * here because the first session surfaced compliance as the strongest unmet
 * need in the room, and "can help with" is useless if the people who can help
 * are not findable.
 */
export const ROLES = ["builder", "business", "advisor", "creator", "organiser", "listener"] as const;
export type Role = (typeof ROLES)[number];

/**
 * What can hang off a card.
 *
 * A product is only one of five, which is the central design decision: the
 * subject of this wall is the person, and a shipped product is optional.
 */
export const ASSET_KINDS = ["product", "business", "media", "community", "profile"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/**
 * How far along a product is.
 *
 * Not a filter and not a bar to entry — "runs on my laptop" is a legitimate
 * thing to put on a wall at a builders' meetup, arguably more interesting than
 * "shipped" because it means the person is stuck on something someone in the
 * room may have already solved.
 */
export const PRODUCT_STAGES = ["idea", "local", "beta", "live", "revenue"] as const;
export type ProductStage = (typeof PRODUCT_STAGES)[number];

/** Where a media account or personal profile lives. */
export const PLATFORMS = [
  "xhs",
  "wechat",
  "x",
  "linkedin",
  "youtube",
  "podcast",
  "github",
  "substack",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const LIMITS = {
  displayName: 60,
  headline: 120,
  bio: 600,
  lookingFor: 200,
  canHelp: 200,
  slug: 32,
  tag: 24,
  tags: 6,
  assetTitle: 80,
  assetTagline: 140,
  url: 400,
  assets: 8,
} as const;

export type AssetInput = {
  kind: AssetKind;
  title: string;
  tagline: string | null;
  url: string | null;
  stage: ProductStage | null;
  platform: Platform | null;
};

export type ProfileInput = {
  slug: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  roles: Role[];
  lookingFor: string | null;
  canHelp: string | null;
  tags: string[];
  hidden: boolean;
  publish: boolean;
  assets: AssetInput[];
};

function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/** Trims, collapses empties to null, and caps length. Mirrors the signup route. */
export function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Accepts a URL only if it is http(s).
 *
 * These strings end up in an `href` that other people click, so anything else —
 * `javascript:` above all — has to be rejected here rather than at render time.
 * A bare "example.com" is upgraded rather than refused: people paste domains.
 */
export function url(value: unknown): string | null {
  const raw = text(value, LIMITS.url);
  if (!raw) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Normalises a handle into the slug used in `/members/<slug>`.
 *
 * ASCII only, because this is a URL people read out loud and paste into WeChat.
 * A Chinese display name simply produces nothing here, and the caller falls
 * back to `m<id>` — the display name itself is never mangled.
 */
export function slugify(value: unknown): string | null {
  const raw = text(value, LIMITS.slug);
  if (!raw) return null;

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slug);

  // Reserved so a member can never take a path that is already a page.
  const reserved = new Set(["new", "edit", "me", "claim", "admin", "api"]);

  return slug && !reserved.has(slug) ? slug : null;
}

/** The slug a card gets before anyone picks a handle. `id` is any stable id. */
export function fallbackSlug(id: string | number): string {
  return `m${id}`;
}

/**
 * Splits a typed tag line into tags.
 *
 * Half-width, full-width and the CJK enumeration comma all count: this field is
 * filled on a Chinese IME more often than not, and splitting on "," alone
 * silently turned a whole line into one very long tag.
 */
export function splitTags(input: string): string[] {
  return input
    .split(/[,，、]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const cleaned = value
    .map((item) => text(item, LIMITS.tag))
    .filter((item): item is string => item !== null);

  // Case-insensitive dedupe, first spelling wins.
  const seen = new Set<string>();
  const out: string[] = [];

  for (const tag of cleaned) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= LIMITS.tags) break;
  }

  return out;
}

function roles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  const picked = value
    .map((item) => oneOf(ROLES, item))
    .filter((item): item is Role => item !== null);
  return [...new Set(picked)];
}

/**
 * Drops anything unusable rather than rejecting the whole submission.
 *
 * A row with no title is an empty row the editor left behind, not an error
 * worth failing someone's save over.
 */
function assets(value: unknown): AssetInput[] {
  if (!Array.isArray(value)) return [];

  const out: AssetInput[] = [];

  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;

    const item = raw as Record<string, unknown>;
    const kind = oneOf(ASSET_KINDS, item.kind);
    const title = text(item.title, LIMITS.assetTitle);

    if (!kind || !title) continue;

    out.push({
      kind,
      title,
      tagline: text(item.tagline, LIMITS.assetTagline),
      url: url(item.url),
      // Stage only means something for a product; platform only for the two
      // kinds that are an account somewhere. Clearing them here keeps the row
      // consistent with what the detail page will actually render.
      stage: kind === "product" ? oneOf(PRODUCT_STAGES, item.stage) : null,
      platform: kind === "media" || kind === "profile" ? oneOf(PLATFORMS, item.platform) : null,
    });

    if (out.length >= LIMITS.assets) break;
  }

  return out;
}

/**
 * Turns an untrusted request body into something safe to write.
 *
 * Returns null only when the card would have no name, which is the one field
 * with nothing sensible to fall back to.
 */
export function parseProfile(body: Record<string, unknown>): Omit<ProfileInput, "slug"> & {
  slug: string | null;
} {
  return {
    slug: slugify(body.slug),
    displayName: text(body.displayName, LIMITS.displayName) ?? "",
    headline: text(body.headline, LIMITS.headline),
    bio: text(body.bio, LIMITS.bio),
    roles: roles(body.roles),
    lookingFor: text(body.lookingFor, LIMITS.lookingFor),
    canHelp: text(body.canHelp, LIMITS.canHelp),
    tags: tags(body.tags),
    hidden: body.hidden === true,
    publish: body.publish === true,
    assets: assets(body.assets),
  };
}

/** Initials for the monogram tile that stands in for an avatar. */
export function monogram(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  // One glyph for CJK, because a two-character Chinese name and its own
  // two-character monogram are the same string — the tile then reads as the
  // name printed twice. Latin names split on whitespace as usual.
  if (/[一-鿿]/.test(trimmed)) return trimmed.slice(0, 1);

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]);
  return initials.join("").toUpperCase() || "?";
}
