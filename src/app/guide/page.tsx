import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang, type Lang } from "@/lib/content";
import { GUIDE_COPY, type GuideCopy, type GuideIcon } from "@/lib/guide-copy";
import { langHref } from "@/lib/nav";
import { pageAlternates } from "@/lib/seo";
import { deepTranslate } from "@/lib/traditional";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

/** The guide in one language; Traditional is converted from the Chinese. */
function guideFor(lang: Lang): GuideCopy {
  if (lang === "en") return GUIDE_COPY.en;
  if (lang === "zh") return GUIDE_COPY.zh;
  return deepTranslate(GUIDE_COPY.zh);
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const g = guideFor(lang);

  return { alternates: pageAlternates("/guide", lang), title: g.meta.title, description: g.meta.description };
}

/**
 * The community guide (2026-10-28): how a Thursday runs, the ways to take part,
 * and eight things we ask of each other.
 *
 * Written to be read on a phone in about a minute and quoted from the group
 * chat, which is where nearly everyone arrives from. Each principle has its own
 * anchor (`/guide#p3`) so a message can point at one line rather than the page.
 *
 * It describes only what anyone in the room can see on a Thursday, in the
 * same plain words the group chat uses.
 */
export default async function GuidePage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const g = guideFor(lang);

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/guide" />

      <main id="main">
        <section className="section guide__hero">
          <div className="shell stack-6">
            <span className="eyebrow">{g.eyebrow}</span>
            <h1 className="guide__title">
              {g.title.map((line, index) => (
                <span key={line} className={index === g.title.length - 1 ? "hl" : undefined}>
                  {line}
                </span>
              ))}
            </h1>
            <p className="body-lg guide__lede">{g.lede}</p>
          </div>
        </section>

        <section className="section">
          <div className="shell stack-6">
            <h2 className="guide__kicker">{g.dayTitle}</h2>
            <ol className="guide__day">
              {g.day.map((step, index) => (
                <li key={step.name}>
                  <span className="guide__step mono" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="stack-1">
                    <strong>{step.name}</strong>
                    <p className="body-sm">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="shell stack-6">
            <h2 className="guide__kicker">{g.waysTitle}</h2>
            <ul className="guide__ways">
              {g.ways.map((way) => (
                <li key={way.name} className="card">
                  <Pictogram icon={way.icon} />
                  <strong>{way.name}</strong>
                  <p className="body-sm">{way.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section">
          <div className="shell stack-6">
            <h2 className="guide__kicker">{g.principlesTitle}</h2>
            <ol className="guide__principles">
              {g.principles.map((item, index) => {
                const n = String(index + 1).padStart(2, "0");
                return (
                  <li key={item.id} id={item.id}>
                    {/* The number is the anchor, so tapping it puts this
                        line's own address in the bar, ready to paste. */}
                    <a className="guide__num mono" href={`#${item.id}`} aria-label={g.anchorLabel(String(index + 1))}>
                      {n}
                    </a>
                    <div className="stack-2">
                      <h3 className="guide__head">{item.head}</h3>
                      <p>{item.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="section">
          <div className="shell">
            <div className="card card--accent stack-4 guide__close">
              <h2 className="h3">{g.closeTitle}</h2>
              <p>{g.closeText}</p>
              <div className="guide__actions">
                <Link className="btn btn--primary" href={langHref("/#signup", lang)}>
                  {g.cta}
                </Link>
                <Link href={langHref("/tuesday", lang)}>{g.tuesdayLink} →</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

/**
 * One line drawing per way of taking part. Decorative: the name under it says
 * the same thing, so it is hidden from screen readers.
 */
function Pictogram({ icon }: { icon: GuideIcon }) {
  const paths: Record<GuideIcon, ReactNode> = {
    // A cup with steam: come, sit, listen.
    listen: (
      <>
        <path d="M10 20h22v10a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9V20Z" />
        <path d="M32 23h3a4 4 0 0 1 0 8h-3" />
        <path d="M16 9c0 3 3 3 3 6M23 9c0 3 3 3 3 6" />
      </>
    ),
    // A speech bubble with a question in it.
    ask: (
      <>
        <path d="M8 12h32v20H22l-8 7v-7H8V12Z" />
        <path d="M21 19a3 3 0 1 1 4 3c-1 .5-1 1.2-1 2.2" />
        <path d="M24 28h.01" />
      </>
    ),
    // An open laptop, the five-minute share.
    share: (
      <>
        <path d="M11 13h26v17H11V13Z" />
        <path d="M6 35h36l-3 4H9l-3-4Z" />
        <path d="M20 19l6 3-6 3v-6Z" />
      </>
    ),
    // A raised hand.
    help: (
      <>
        <path d="M17 26V12a2.5 2.5 0 0 1 5 0v11" />
        <path d="M22 11V9a2.5 2.5 0 0 1 5 0v14" />
        <path d="M27 12a2.5 2.5 0 0 1 5 0v12" />
        <path d="M32 17a2.5 2.5 0 0 1 5 0v10c0 7-5 12-11 12h-2c-4 0-7-2-9-5l-5-8a2.5 2.5 0 0 1 4-3l3 3" />
      </>
    ),
  };

  return (
    <svg
      className="guide__icon"
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[icon]}
    </svg>
  );
}
