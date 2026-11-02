// Relative-import friendly: the tests load this through Node's type stripper.

/**
 * Small helpers for the directory views of the wall (2026-11-02): which tags
 * to offer as filters, and which slice of a long list is on this page.
 */

/** How two tags are compared: case and spacing do not count. */
export function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The most common tags across cards, most common first, merged across case
 * and spacing ("AI Agent" and "ai agent" are one tag). The label shown is the
 * spelling most people used. Each card counts once per tag.
 */
export function topTags(cards: readonly { tags: readonly string[] }[], limit: number): { label: string; count: number }[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const card of cards) {
    const seen = new Set<string>();
    for (const raw of card.tags) {
      const label = raw.trim();
      const key = tagKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
      group.count += 1;
      group.spellings.set(label, (group.spellings.get(label) ?? 0) + 1);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({ label: [...group.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0], count: group.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** One page of a list, with the page number clamped to the pages there are. */
export function paginate<T>(items: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages, Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1));
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}
