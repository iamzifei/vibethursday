// Relative, not "@/": the tests load this through Node's type stripper.
import type { ProductStage } from "./members.ts";

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
  assets: readonly {
    kind: string;
    title: string;
    tagline: string | null;
    url: string | null;
    stage: string | null;
  }[];
};

export type Work = {
  slug: string;
  maker: string;
  title: string;
  tagline: string | null;
  url: string | null;
  stage: ProductStage | null;
};

/**
 * Flattens the wall into a list of products.
 *
 * ★ Order is the wall's own order — most recently seen first — and not the
 * stage. Sorting by how far along something is would turn this page into a
 * league table, and "runs on my laptop" would be at the bottom of it. The
 * whole reason the wall carries a stage at all is that being stuck somewhere
 * is a legitimate thing to put in front of a room, arguably a more interesting
 * one than having shipped. The stage is shown on each card and can be filtered
 * on; it does not decide who goes first.
 */
export function listWorks(members: readonly WorkSource[], stage?: string | null): Work[] {
  const works: Work[] = [];

  for (const member of members) {
    for (const asset of member.assets) {
      if (asset.kind !== "product") continue;
      if (stage && asset.stage !== stage) continue;

      works.push({
        slug: member.slug,
        maker: member.display_name,
        title: asset.title,
        tagline: asset.tagline,
        url: asset.url,
        stage: (asset.stage as ProductStage | null) ?? null,
      });
    }
  }

  return works;
}

/** How many products sit at each stage, for the filter row. */
export function countByStage(members: readonly WorkSource[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const work of listWorks(members)) {
    if (!work.stage) continue;
    counts.set(work.stage, (counts.get(work.stage) ?? 0) + 1);
  }

  return counts;
}
