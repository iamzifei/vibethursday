import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { MiniMarkdown } from "@/components/MiniMarkdown";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_AUTHOR, blogPost, blogPosts, splitFaq } from "@/lib/blog";
import { getCopy } from "@/lib/content";
import { parseMiniMarkdown } from "@/lib/mini-markdown";
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
    openGraph: { type: "article", url: `/blog/${post.slug}`, siteName: "Vibe Thursday", locale: "zh_CN", title: post.title, description: post.description, images: [image], publishedTime: post.date, authors: [BLOG_AUTHOR.url] },
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
    dateModified: post.date,
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

  const others = blogPosts().filter((other) => other.slug !== post.slug).slice(0, 3);

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={faqPage ? [article, faqPage, crumbs] : [article, crumbs]} />
      <SiteHeader lang="zh" copy={c} path="/blog" />
      <main id="main">
        <article className="section">
          <div className="shell stack-6 blog-post" style={{ maxWidth: "720px" }}>
            <p style={{ margin: 0 }}><Link href="/blog">← 博客</Link></p>
            <h1 style={{ margin: 0 }}>{post.title}</h1>
            <p className="body-sm blog-post__byline" style={{ margin: 0 }}>
              <a href={BLOG_AUTHOR.url} target="_blank" rel="noopener noreferrer author">{BLOG_AUTHOR.name}</a>
              {" · "}
              <time dateTime={post.date}>{post.date}</time>
              {" · "}
              {post.tags.join(" · ")}
            </p>
            <Image src={`/blog/${post.slug}.webp`} alt={post.coverAlt} width={1536} height={1024} className="blog-post__cover" priority sizes="(max-width: 760px) 100vw, 720px" />
            <MiniMarkdown blocks={parseMiniMarkdown(body)} />

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

            {others.length > 0 && (
              <nav className="stack-2" aria-label="更多文章">
                <h2 className="h4" style={{ margin: 0 }}>接着读</h2>
                <ul className="stack-2">
                  {others.map((other) => <li key={other.slug}><Link href={`/blog/${other.slug}`}>{other.title}</Link></li>)}
                </ul>
              </nav>
            )}
          </div>
        </article>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
