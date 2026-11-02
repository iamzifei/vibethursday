import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy } from "@/lib/content";
import { parseInline, parseMiniMarkdown, type Inline } from "@/lib/mini-markdown";
import { PLAYBOOK_CHAPTER_1 as CHAPTER } from "@/lib/playbook";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: CHAPTER.title,
  description: CHAPTER.description,
  alternates: { canonical: "/guide/how-we-run" },
};

/** Inline runs as React text: bold where marked, never HTML. */
function Text({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((part, index) => (part.bold ? <strong key={index}>{part.text}</strong> : <Fragment key={index}>{part.text}</Fragment>))}
    </>
  );
}

/**
 * 「Vibe Thursday 是怎么办起来的」第一章 (2026-11-02): free, public, for anyone
 * who wants to run something similar in their own city. Chinese only, like
 * /class: it was written for the Chinese-speaking organisers it is meant for.
 */
export default function HowWeRunPage() {
  const c = getCopy("zh");
  const blocks = parseMiniMarkdown(CHAPTER.markdown);
  const [lede, ...rest] = blocks;
  const base = siteUrl();

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: CHAPTER.title,
    description: CHAPTER.description,
    inLanguage: "zh-Hans",
    datePublished: CHAPTER.published,
    author: { "@type": "Organization", name: "Vibe Thursday", url: base },
    mainEntityOfPage: `${base}/guide/how-we-run`,
  };

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={[article]} />
      <SiteHeader lang="zh" copy={c} path="/guide" />
      <main id="main">
        <article className="section">
          <div className="shell stack-6 playbook" style={{ maxWidth: "720px" }}>
            <p style={{ margin: 0 }}><Link href="/guide">← 社区攻略</Link></p>
            <h1 style={{ margin: 0 }}>{CHAPTER.title}</h1>
            {lede?.type === "p" && <p className="body-lg"><Text parts={lede.parts} /></p>}
            {rest.map((block, index) => {
              switch (block.type) {
                case "h2":
                  return <h2 key={index} className="h3 playbook__step">{block.text}</h2>;
                case "label":
                  return <p key={index} className="eyebrow playbook__label">{block.text}</p>;
                case "p":
                  return <p key={index}><Text parts={block.parts} /></p>;
                case "ul":
                  return <ul key={index} className="stack-2">{block.items.map((item, n) => <li key={n}><Text parts={item} /></li>)}</ul>;
                case "ol":
                  return <ol key={index} className="stack-2">{block.items.map((item, n) => <li key={n}><Text parts={item} /></li>)}</ol>;
                case "code":
                  return <pre key={index} className="playbook__template">{block.text}</pre>;
              }
            })}
            <div className="card card--accent stack-3">
              <p style={{ margin: 0 }}>{parseInline("想先来看看一场是什么样子：每周四上午，免费。").map((part) => part.text).join("")}</p>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Link className="btn btn--primary" href="/#signup">报名周四</Link>
                <Link className="btn btn--secondary" href="/guide">回社区攻略</Link>
              </div>
            </div>
          </div>
        </article>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
