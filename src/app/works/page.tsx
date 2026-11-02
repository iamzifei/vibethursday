import type { Metadata } from "next";
import type React from "react";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WorkIcon } from "@/components/WorkIcon";
import { getCopy, LANG_PARAM, resolveLang } from "@/lib/content";
import { pageAlternates } from "@/lib/seo";
import { listWallMembers } from "@/lib/db";
import { PRODUCT_STAGES, type ProductStage } from "@/lib/members";
import { siteUrl } from "@/lib/site";
import { countByStage, listWorks, topFields } from "@/lib/works";

type PageProps = {
  searchParams: Promise<{ lang?: string; stage?: string; field?: string; q?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang).works;
  // A filtered or searched view is the same list cut down: kept out of the
  // index so the one canonical /works carries the page's weight.
  const narrowed = Boolean(params.stage || params.field || params.q);

  return {
    alternates: pageAlternates("/works", lang),
    title: c.meta.title,
    description: c.meta.description,
    robots: { index: !narrowed, follow: true },
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.meta.title }],
    },
  };
}

/**
 * Works — every product on the member wall, in one place.
 *
 * A second view over the wall's rows, and deliberately not a second wall: the
 * wall's subject is a person and a product is one of five things that can hang
 * off a card. What this page adds is the one question the wall answers badly,
 * because the answer is scattered one card at a time — what have these people
 * actually built.
 *
 * Same privacy gate as everything else public here: `listWallMembers()`, which
 * filters on `published_at IS NOT NULL AND NOT hidden` in SQL.
 */
/*
 * As a directory (2026-11-02): search, filters by stage and by field (the
 * makers' own tags), a grid of cards with each site's icon, and a page per
 * work (`/works/<key>`) — the address search engines and AI assistants can
 * cite. Every filter is a plain link or GET form: no client JS, every view a
 * URL someone can paste into the group.
 */
export default async function WorksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const w = c.works;
  const m = c.members;

  const stage = (PRODUCT_STAGES as readonly string[]).includes(params.stage ?? "")
    ? (params.stage as ProductStage)
    : null;
  const field = params.field?.trim().slice(0, 60) || null;
  const query = params.q?.trim().slice(0, 80) || null;

  const members = await listWallMembers();
  const works = listWorks(members, { stage, field, q: query });
  const counts = countByStage(members);
  const fields = topFields(members, 10);
  const total = listWorks(members).length;

  const href = (next: { stage?: string | null; field?: string | null; q?: string | null }) => {
    const value = { stage, field, q: query, ...next };
    const search = new URLSearchParams();
    if (value.q) search.set("q", value.q);
    if (value.field) search.set("field", value.field);
    if (value.stage) search.set("stage", value.stage);
    if (LANG_PARAM[lang]) search.set("lang", LANG_PARAM[lang] as string);
    const text = search.toString();
    return text ? `/works?${text}` : "/works";
  };

  const base = siteUrl();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: w.meta.title,
    numberOfItems: works.length,
    itemListElement: works.map((work, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${base}/works/${work.key}`,
      name: work.title,
    })),
  };

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={[itemList]} />
      <SiteHeader lang={lang} copy={c} path="/works" />

      <main id="main">
        <section className="section">
          <div className="shell stack-6">
            <div className="stack-4">
              <span className="eyebrow">{w.eyebrow}</span>
              <h1>{w.title}</h1>
              <p className="body-lg" style={{ maxWidth: "60ch", margin: 0 }}>
                {w.lede}
              </p>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Link className="btn btn--primary" href={`/me${langSuffix(lang)}`}>{w.submitCta}</Link>
                <Link className="btn btn--secondary" href={`/members${langSuffix(lang)}`}>{w.wallCta}</Link>
              </div>
            </div>

            <form className="wall-search" method="get" action="/works" role="search">
              {stage && <input type="hidden" name="stage" value={stage} />}
              {field && <input type="hidden" name="field" value={field} />}
              {LANG_PARAM[lang] && <input type="hidden" name="lang" value={LANG_PARAM[lang] as string} />}
              <label className="visually-hidden" htmlFor="works-q">{w.searchLabel}</label>
              <input className="field" id="works-q" name="q" type="search" defaultValue={query ?? ""} placeholder={w.searchPlaceholder} maxLength={80} />
              <button className="btn btn--secondary" type="submit">{w.searchSubmit}</button>
            </form>

            {total > 0 && (
              <div className="stack-3">
                <div className="filters" aria-label={w.fieldsLabel}>
                  <FilterChip href={href({ field: null })} on={field === null}>{w.all} · {total}</FilterChip>
                  {fields.map((item) => (
                    <FilterChip key={item.label} href={href({ field: item.label })} on={field?.toLowerCase() === item.label.toLowerCase()}>
                      {item.label} · {item.count}
                    </FilterChip>
                  ))}
                </div>
                <div className="filters" aria-label={w.stagesLabel}>
                  {PRODUCT_STAGES.filter((value) => counts.has(value)).map((value) => (
                    <FilterChip key={value} href={href({ stage: stage === value ? null : value })} on={stage === value}>
                      {m.stages[value]} · {counts.get(value)}
                    </FilterChip>
                  ))}
                  {query && (
                    <FilterChip href={href({ q: null })} on>
                      {`"${query}" ✕`}<span className="visually-hidden"> — {w.searchClear}</span>
                    </FilterChip>
                  )}
                </div>
                <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }} aria-live="polite">
                  {w.resultCount.replace("{n}", String(works.length))}
                </p>
              </div>
            )}

            {works.length === 0 ? (
              <p className="wharf-empty">{total === 0 ? w.emptyAll : w.empty}</p>
            ) : (
              <ul className="works works--grid">
                {works.map((work) => (
                  <li className="work" key={work.key}>
                    <Link className="work__link" href={`/works/${work.key}${langSuffix(lang)}`}>
                      <WorkIcon title={work.title} url={work.url} />
                      <span className="work__text">
                        <h2 className="work__title">{work.title}</h2>
                        {work.tagline && <span className="work__tagline">{work.tagline}</span>}
                      </span>
                    </Link>
                    <div className="work__foot">
                      {work.stage && <span className="pill">{m.stages[work.stage]}</span>}
                      {work.fields.slice(0, 2).map((item) => (
                        <span className="chip" key={item}>{item}</span>
                      ))}
                      <span className="body-sm work__maker-line">
                        {w.by}{" "}
                        <Link className="work__maker" href={`/members/${work.slug}${langSuffix(lang)}`}>{work.maker}</Link>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

function FilterChip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link className={`pill${on ? " pill--live" : ""}`} href={href} aria-current={on ? "page" : undefined}>
      {children}
    </Link>
  );
}
