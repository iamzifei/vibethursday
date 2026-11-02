// Relative, not "@/": the tests load this through Node's type stripper.
import type { ProductStage } from "./members.ts";
import { tagKey, topTags } from "./directory.ts";

/**
 * The works view: every product on the member wall, in one place.
 *
 * This is a **second view over the wall's data, not a second wall.** The
 * distinction matters and is not stylistic: the wall's subject is a person,
 * and a product is one of five kinds of thing that can hang off their card.
 * Making products the subject anywhere on this site was ruled out early, on
 * the grounds that it would leave out most of the room — plenty of people come
 * to listen, and a card with nothing hanging off it is a complete card.
 *
 * So this page answers a narrower question than the wall does: what have the
 * people who come to this thing actually built. It is the strongest recruiting
 * evidence the site has, and it does not replace anything.
 */

export type WorkSource = {
  slug: string;
  display_name: string;
  /** The maker's own tags, used as the work's fields (2026-11-02). */
  tags?: readonly string[];
  assets: readonly {
    kind: string;
    title: string;
    tagline: string | null;
    url: string | null;
    stage: string | null;
    platform?: string | null;
  }[];
};

export type Work = {
  /** Its address under /works: see `workKey`. */
  key: string;
  slug: string;
  maker: string;
  title: string;
  tagline: string | null;
  url: string | null;
  stage: ProductStage | null;
  /** What it is about, borrowed from the maker's tags — no extra field to fill. */
  fields: string[];
};

export type WorkFilter = {
  stage?: string | null;
  /** One field, matched whatever the case. */
  field?: string | null;
  /** Words that must all appear in the title, tagline, maker or fields. */
  q?: string | null;
};

/**
 * A work's address: its maker's slug and a short hash of its title.
 *
 * Not the database id: saving a card deletes and re-inserts its assets, so ids
 * change on every edit and a shared link would break. The address moves when
 * the work is renamed or its maker changes their handle — the same edit that
 * moves their own /members page.
 * FNV-1a, 32 bits, base 36 — no crypto needed, only stability.
 */
export function workKey(slug: string, title: string): string {
  const text = title.trim().toLowerCase().replace(/\s+/g, " ");
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${slug}-${hash.toString(36).padStart(6, "0").slice(-6)}`;
}

/**
 * Whether a title is a title.
 *
 * The editor accepts any non-empty string, and a placeholder such as "-" is a
 * real row that would otherwise show up as a work with no name.
 */
function isTitle(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

/**
 * Every product on the wall, in the wall's order (most recent first),
 * optionally narrowed. A bare string is the stage, as it always was.
 */
export function listWorks(members: readonly WorkSource[], filter?: string | null | WorkFilter): Work[] {
  const { stage = null, field = null, q = null } =
    typeof filter === "object" && filter !== null ? filter : { stage: filter ?? null };
  const terms = q ? q.toLowerCase().split(/\s+/).filter(Boolean) : [];
  const wantField = field ? tagKey(field) || null : null;
  const seen = new Set<string>();
  const works: Work[] = [];

  for (const member of members) {
    const fields = [...(member.tags ?? [])];
    for (const asset of member.assets) {
      if (asset.kind !== "product") continue;
      if (!isTitle(asset.title)) continue;
      if (stage && asset.stage !== stage) continue;
      if (wantField && !fields.some((f) => tagKey(f) === wantField)) continue;
      if (terms.length > 0) {
        const text = [asset.title, asset.tagline, member.display_name, ...fields].filter(Boolean).join(" ").toLowerCase();
        if (!terms.every((term) => text.includes(term))) continue;
      }

      // One maker listing the same title twice (or "Foo" and "foo ") is one
      // work: one address, one row.
      const key = workKey(member.slug, asset.title);
      if (seen.has(key)) continue;
      seen.add(key);

      works.push({
        key,
        slug: member.slug,
        maker: member.display_name,
        title: asset.title,
        tagline: asset.tagline,
        url: asset.url,
        stage: (asset.stage as ProductStage | null) ?? null,
        fields,
      });
    }
  }

  return works;
}

/** One work by its key, or null — for /works/<key>. */
export function findWork(members: readonly WorkSource[], key: string): Work | null {
  return listWorks(members).find((work) => work.key === key) ?? null;
}

/**
 * The fields the works fall into, most common first, counted per work and
 * merged across case ("AI Agent" and "ai agent" are one). The label shown is
 * the spelling most people used.
 */
export function topFields(members: readonly WorkSource[], limit: number): { label: string; count: number }[] {
  return topTags(listWorks(members).map((work) => ({ tags: work.fields })), limit);
}

/**
 * How many works are at each stage, for the filter chips — counted from the
 * same list the page renders, so a chip never promises a row that is not there.
 */
export function countByStage(members: readonly WorkSource[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const work of listWorks(members)) {
    if (!work.stage) continue;
    counts.set(work.stage, (counts.get(work.stage) ?? 0) + 1);
  }

  return counts;
}

/** The site's domain-icon URL for a work's link, or null. Lazy-loaded, small. */
export function faviconFor(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : null;
  } catch {
    return null;
  }
}
