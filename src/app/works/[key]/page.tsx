import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/JsonLd";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { WorkIcon } from "@/components/WorkIcon";
import { getCopy, resolveLang } from "@/lib/content";
import { getMemberBySlug as readMemberBySlug, listProgress } from "@/lib/db";
import { publicTimeline } from "@/lib/progress";
import { pageAlternates } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { findWork, listWorks } from "@/lib/works";

const getMemberBySlug = cache(readMemberBySlug);

type PageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

/**
 * A key is "<maker's slug>-<6-character hash>" (`workKey`); slugs can contain
 * hyphens themselves, so the maker is everything before the last seven
 * characters. Only a published, unhidden card is ever found (the same gate
 * as the wall), so a work disappears with its card.
 */
async function load(key: string) {
  if (!/^.+-[0-9a-z]{6}$/.test(key)) return null;
  // A database error is thrown, not read as "not found": a short outage must
  // answer 5xx, never 404 + noindex, or crawlers drop every work page.
  const member = await getMemberBySlug(key.slice(0, -7));
  if (!member) return null;
  const work = findWork([member], key);
  return work ? { member, work } : null;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const d = getCopy(lang).works.detail;
  const found = await load((await params).key);
  if (!found) return { title: getCopy(lang).works.meta.title, robots: { index: false } };

  const { work } = found;
  // Replacer functions, not strings: a "$&" in someone's title must stay text.
  const tagline = work.tagline ? work.tagline.slice(0, 80) : "";
  const title = (work.tagline ? d.metaTitle : d.metaTitleBare)
    .replace("{title}", () => work.title)
    .replace("{tagline}", () => tagline);
  const description = d.metaDescription
    .replace("{title}", () => work.title)
    .replace("{maker}", () => work.maker)
    .replace("{tagline}", () => (work.tagline ? `${work.tagline}${/[。.!?！？]$/.test(work.tagline) ? "" : lang === "en" ? "." : "。"}` : ""));

  return {
    title,
    description,
    alternates: pageAlternates(`/works/${work.key}`, lang),
    openGraph: { title, description, images: [{ url: "/og.jpg", width: 1200, height: 630, alt: work.title }] },
  };
}

/**
 * Outbound links are rel="ugc nofollow", like the member page's: the makers
 * put them there, and the wall should not be worth spamming for backlinks.
 *
 * One work (2026-11-02): what it is, who made it, how far along, where to
 * open it — and, for machines, the same in schema.org terms, so a search
 * engine or an AI assistant asked "what AI tools has the Sydney community
 * built" has a page per answer to cite.
 */
export default async function WorkPage({ params, searchParams }: PageProps) {
  const { key } = await params;
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const w = c.works;
  const d = w.detail;

  const found = await load(key);
  if (!found) notFound();
  const { member, work } = found;
  const others = listWorks([member]).filter((item) => item.key !== work.key);
  // The progress record (2026-11-02): confirmed entries only. It is the page's
  // second half, not its subject — if it cannot be read the work still shows.
  const hash = work.key.slice(-6);
  const timeline = publicTimeline(
    (
      await listProgress({ confirmedOnly: true, memberIds: [member.id] }).catch((error) => {
        console.error("[works] could not read the progress record", error);
        return [];
      })
    ).filter((entry) => entry.work_hash === hash),
  );
  const p = d.progress;

  const base = siteUrl();
  const pageUrl = `${base}/works/${work.key}`;
  const maker = { "@type": "Person", name: work.maker, url: `${base}/members/${work.slug}` };
  const thing = work.url
    ? {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: work.title,
        ...(work.tagline ? { description: work.tagline } : {}),
        url: work.url,
        applicationCategory: "BusinessApplication",
        ...(work.fields.length > 0 ? { keywords: work.fields.join(", ") } : {}),
        creator: maker,
        mainEntityOfPage: pageUrl,
      }
    : {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: work.title,
        ...(work.tagline ? { description: work.tagline } : {}),
        ...(work.fields.length > 0 ? { keywords: work.fields.join(", ") } : {}),
        creator: maker,
        url: pageUrl,
      };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: d.home, item: `${base}/` },
      { "@type": "ListItem", position: 2, name: d.works, item: `${base}/works` },
      { "@type": "ListItem", position: 3, name: work.title, item: pageUrl },
    ],
  };

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={[thing, breadcrumb]} />
      <SiteHeader lang={lang} copy={c} path={`/works/${work.key}`} />

      <main id="main">
        <section className="section">
          <div className="shell stack-6" style={{ maxWidth: "720px" }}>
            <p style={{ margin: 0 }}>
              <Link href={`/works${langSuffix(lang)}`}>{d.back}</Link>
            </p>

            <div className="work-hero">
              <WorkIcon title={work.title} url={work.url} size={64} />
              <div className="stack-2">
                <h1 style={{ margin: 0 }}>{work.title}</h1>
                {work.tagline && <p className="body-lg" style={{ margin: 0 }}>{work.tagline}</p>}
              </div>
            </div>

            {work.url ? (
              <a className="btn btn--primary" href={work.url} target="_blank" rel="ugc nofollow noopener noreferrer" style={{ alignSelf: "flex-start" }}>
                {d.visit} ↗
              </a>
            ) : (
              <p className="body" style={{ color: "var(--fg3)", margin: 0 }}>{d.noUrl}</p>
            )}

            <dl className="work-facts">
              <div>
                <dt>{d.maker}</dt>
                <dd><Link href={`/members/${work.slug}${langSuffix(lang)}`}>{work.maker}</Link></dd>
              </div>
              {work.stage && (
                <div>
                  <dt>{d.stage}</dt>
                  <dd>{c.members.stages[work.stage]}</dd>
                </div>
              )}
              {work.fields.length > 0 && (
                <div>
                  <dt>{d.fields}</dt>
                  <dd className="work-facts__chips">
                    {work.fields.map((field) => (
                      <Link className="chip chip--link" key={field} href={`/works?field=${encodeURIComponent(field)}${langSuffix(lang, true)}`}>{field}</Link>
                    ))}
                  </dd>
                </div>
              )}
              {work.url && (
                <div>
                  <dt>{d.link}</dt>
                  <dd><a href={work.url} target="_blank" rel="ugc nofollow noopener noreferrer">{work.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd>
                </div>
              )}
            </dl>

            {timeline.length > 0 && (
              <section className="stack-3" aria-labelledby="work-progress">
                <h2 className="h3" id="work-progress" style={{ margin: 0 }}>{p.heading}</h2>
                <p className="body-sm" style={{ color: "var(--fg3)", margin: 0 }}>{p.lede}</p>
                <ol className="progress-list">
                  {timeline.map((entry) => (
                    <li key={entry.id} className="progress-item">
                      <span className="progress-item__meta">
                        <time dateTime={entry.happened_on}>{entry.happened_on}</time>
                        <span className="chip">{p.kinds[entry.kind]}</span>
                      </span>
                      <span className="progress-item__title">{entry.title}</span>
                      {entry.detail && <span className="body-sm progress-item__detail">{entry.detail}</span>}
                      {entry.proof_url && (
                        // Whoever issued it vouches for it, not this site: nofollow.
                        <a className="body-sm" href={entry.proof_url} target="_blank" rel="nofollow noopener noreferrer">
                          {entry.kind === "credential" ? p.verify : p.proof} · {new URL(entry.proof_url).hostname} ↗
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {others.length > 0 && (
              <section className="stack-3" aria-labelledby="work-more">
                <h2 className="h3" id="work-more">{d.more.replace("{name}", work.maker)}</h2>
                <ul className="works works--grid">
                  {others.map((item) => (
                    <li className="work" key={item.key}>
                      <Link className="work__link" href={`/works/${item.key}${langSuffix(lang)}`}>
                        <WorkIcon title={item.title} url={item.url} />
                        <span className="work__text">
                          <span className="work__title">{item.title}</span>
                          {item.tagline && <span className="work__tagline">{item.tagline}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Link className="btn btn--secondary" href={`/members/${work.slug}${langSuffix(lang)}`} style={{ alignSelf: "flex-start" }}>
              {d.makerCta.replace("{name}", work.maker)}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}
