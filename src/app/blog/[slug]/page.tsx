import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_AUTHOR, blogPost, blogPosts, relatedPosts, splitFaq } from "@/lib/blog";
import { getCopy } from "@/lib/content";
import { parseMiniMarkdown, tableOfContents } from "@/lib/mini-markdown";
import { siteUrl } from "@/lib/site";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return blogPosts().map((post) => ({ slug: post.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = blogPost((await params).slug);
  if (!post) return {};
  const image = { url: `/blog/${post.slug}-og.jpg`, width: 1200, height: 630, alt: post.coverAlt };
  return {
    title: `${post.title} · Vibe Thursday`,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: BLOG_AUTHOR.name, url: BLOG_AUTHOR.url }],
    alternates: { canonical: `/blog/${post.slug}` },
    // The whole openGraph object replaces the layout's, so siteName and locale are repeated here.
    openGraph: { type: "article", url: `/blog/${post.slug}`, siteName: "Vibe Thursday", locale: "zh_CN", title: post.title, description: post.description, images: [image], publishedTime: post.date, modifiedTime: post.updated, authors: [BLOG_AUTHOR.url] },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [image], creator: "@JamesAI" },
  };
}

/**
 * One blog post (2026-11-02, blog.ts): cover, byline, body, the FAQ, and an
 * invitation to the meetup. BlogPosting and FAQPage structured data, so
 * search engines and AI assistants can quote it with its author and date.
 */
export default async function BlogPostPage({ params }: PageProps) {
  const post = blogPost((await params).slug);
  if (!post) notFound();
  const c = getCopy("zh");
  const base = siteUrl();
  const { body, faq } = splitFaq(post.body);
  const url = `${base}/blog/${post.slug}`;

  const article = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: `${base}/blog/${post.slug}.webp`,
    datePublished: post.date,
    dateModified: post.updated,
    inLanguage: "zh-Hans",
    keywords: post.tags.join(","),
    author: { "@type": "Person", name: BLOG_AUTHOR.name, url: BLOG_AUTHOR.url },
    publisher: { "@type": "Organization", name: "Vibe Thursday", url: base, logo: { "@type": "ImageObject", url: `${base}/apple-icon.png` } },
    mainEntityOfPage: url,
  };
  const faqPage = faq.length > 0 && {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "") } })),
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Vibe Thursday", item: base },
      { "@type": "ListItem", position: 2, name: "博客", item: `${base}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  };

  // The sidebar contents (2026-11-03): the `## ` headings, plus the FAQ.
  const toc = [...tableOfContents(body), ...(faq.length > 0 ? [{ id: "faq", text: "常见问题" }] : [])];
  const related = relatedPosts(post.slug, 3);

  // One list, drawn twice: folded under the cover on a phone, and as a
  // sticky sidebar on a wide screen. Plain links and a <details>, no script.
  const tocList = (
    <ol className="blog-toc__list">
      {toc.map((item) => (
        <li key={item.id}><a href={`#${item.id}`}>{item.text}</a></li>
      ))}
    </ol>
  );

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={faqPage ? [article, faqPage, crumbs] : [article, crumbs]} />
      <SiteHeader lang="zh" copy={c} path="/blog" />
      <main id="main">
        <div className="section">
          <div className="shell blog-layout">
          {toc.length > 1 && (
            <aside className="blog-toc blog-toc--side" aria-label="文章目录">
              <p className="blog-toc__title">目录</p>
              {tocList}
            </aside>
          )}
          <article className="stack-6 blog-post">
            <p style={{ margin: 0 }}><Link href="/blog">← 博客</Link></p>
            <h1 style={{ margin: 0 }}>{post.title}</h1>
            <p className="body-sm blog-post__byline" style={{ margin: 0 }}>
              <a href={BLOG_AUTHOR.url} target="_blank" rel="noopener noreferrer author">{BLOG_AUTHOR.name}</a>
              {" · "}
              <time dateTime={post.date}>{post.date}</time>
              {post.updated !== post.date && <>{" · 更新于 "}<time dateTime={post.updated}>{post.updated}</time></>}
              {" · "}
              {post.tags.join(" · ")}
            </p>
            <Image src={`/blog/${post.slug}.webp`} alt={post.coverAlt} width={1536} height={1024} className="blog-post__cover" priority sizes="(max-width: 760px) 100vw, 720px" />
            {toc.length > 1 && (
              <details className="blog-toc blog-toc--fold">
                <summary>目录 · {toc.length} 节</summary>
                <nav aria-label="文章目录（手机）">{tocList}</nav>
              </details>
            )}
            <MiniMarkdown blocks={parseMiniMarkdown(body)} source={body} />

            {faq.length > 0 && (
              <section className="stack-3" aria-labelledby="faq">
                <h2 className="h3" id="faq">常见问题</h2>
                {faq.map((item) => (
                  <details key={item.q} className="disclosure" open>
                    <summary>{item.q}</summary>
                    <div className="disclosure__body">
                      <MiniMarkdown blocks={parseMiniMarkdown(item.a)} />
                    </div>
                  </details>
                ))}
              </section>
            )}

            <div className="card card--accent stack-3">
              <p style={{ margin: 0 }}>想当面聊这些：每周四上午 10:30，悉尼 Chatswood，免费。手上有项目想推进，来周二。</p>
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Link className="btn btn--primary" href="/#signup">报名周四</Link>
                <Link className="btn btn--secondary" href="/tuesday">看看周二</Link>
              </div>
            </div>

            {related.length > 0 && (
              <nav className="stack-3" aria-labelledby="related">
                <h2 className="h3" id="related">相关文章</h2>
                <ul className="blog-related">
                  {related.map((other) => (
                    <li key={other.slug}>
                      <Link className="blog-related__card" href={`/blog/${other.slug}`}>
                        <Image src={`/blog/${other.slug}.webp`} alt="" width={1536} height={1024} sizes="(max-width: 760px) 30vw, 200px" loading="lazy" />
                        <span className="blog-related__text">
                          <span className="blog-related__title">{other.title}</span>
                          <span className="blog-related__desc">{other.description}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/blog">看全部文章 →</Link>
              </nav>
            )}
          </article>
          </div>
        </div>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
