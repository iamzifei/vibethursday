import type { Metadata } from "next";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang } from "@/lib/content";
import { listWallMembers } from "@/lib/db";
import { PRODUCT_STAGES, type ProductStage } from "@/lib/members";
import { countByStage, listWorks } from "@/lib/works";

type PageProps = {
  searchParams: Promise<{ lang?: string; stage?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).works;

  return {
    title: c.meta.title,
    description: c.meta.description,
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
export default async function WorksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const w = c.works;
  const m = c.members;

  const stage = (PRODUCT_STAGES as readonly string[]).includes(params.stage ?? "")
    ? (params.stage as ProductStage)
    : null;

  const members = await listWallMembers();
  const works = listWorks(members, stage);
  const counts = countByStage(members);
  const total = listWorks(members).length;

  const filterHref = (value: ProductStage | null) => {
    const query = new URLSearchParams();
    if (value) query.set("stage", value);
    if (LANG_PARAM[lang]) query.set("lang", LANG_PARAM[lang] as string);

    const search = query.toString();
    return search ? `/works?${search}` : "/works";
  };

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/works" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{w.eyebrow}</span>
              <h1>{w.title}</h1>
              <p className="body-lg" style={{ maxWidth: "60ch" }}>
                {w.lede}
              </p>
            </div>

            {/* Filters, not a sort. Every stage that anybody is actually at
                gets a chip; the ones nobody is at are left out rather than
                shown empty. */}
            {total > 0 && (
              <div className="filters">
                <FilterChip href={filterHref(null)} on={stage === null}>
                  {w.all} · {total}
                </FilterChip>
                {PRODUCT_STAGES.filter((value) => counts.has(value)).map((value) => (
                  <FilterChip key={value} href={filterHref(value)} on={stage === value}>
                    {m.stages[value]} · {counts.get(value)}
                  </FilterChip>
                ))}
              </div>
            )}

            {works.length === 0 ? (
              <p className="wharf-empty">{total === 0 ? w.emptyAll : w.empty}</p>
            ) : (
              <ul className="works">
                {works.map((work, index) => (
                  <li className="work" key={`${work.slug}-${work.title}-${index}`}>
                    <div className="work__head">
                      <h2 className="work__title">{work.title}</h2>
                      {work.stage && <span className="pill">{m.stages[work.stage]}</span>}
                    </div>

                    {work.tagline && <p className="work__tagline">{work.tagline}</p>}

                    <div className="work__foot">
                      <span className="body-sm" style={{ color: "var(--fg3)" }}>
                        {w.by}{" "}
                        <Link className="work__maker" href={`/members/${work.slug}${langSuffix(lang)}`}>
                          {work.maker}
                        </Link>
                      </span>
                      {work.url && (
                        <a
                          className="work__link"
                          href={work.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {w.visit} ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Link className="btn btn--secondary" href={`/members${langSuffix(lang)}`}>
                {w.wallCta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

function FilterChip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link className={`pill${on ? " pill--live" : ""}`} href={href} aria-current={on ? "page" : undefined}>
      {children}
    </Link>
  );
}
