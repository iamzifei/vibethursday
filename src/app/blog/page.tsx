import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BLOG_AUTHOR, blogPosts } from "@/lib/blog";
import { getCopy } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "博客 · 悉尼华人 AI 聚会的经验与问答 · Vibe Thursday",
  description: "悉尼每周四 AI 聚会 Vibe Thursday 的博客：往期场次的要点，和大家最常问的 AI 问题——普通人怎么开始用 AI、不会写代码怎么做产品、澳洲做自媒体、小生意怎么让 ChatGPT 推荐你。",
  alternates: { canonical: "/blog" },
};

/**
 * /blog (2026-11-02, blog.ts): every post, newest first. Chinese only, like
 * the posts themselves.
 */
export default function BlogIndexPage() {
  const c = getCopy("zh");
  const posts = blogPosts();
  const base = siteUrl();
  const list = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Vibe Thursday 博客",
    url: `${base}/blog`,
    inLanguage: "zh-Hans",
    author: { "@type": "Person", name: BLOG_AUTHOR.name, url: BLOG_AUTHOR.url },
    blogPost: posts.map((post) => ({ "@type": "BlogPosting", headline: post.title, url: `${base}/blog/${post.slug}`, datePublished: post.date })),
  };

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={[list]} />
      <SiteHeader lang="zh" copy={c} path="/blog" />
      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-3" style={{ maxWidth: "720px" }}>
              <span className="eyebrow">§ 博客</span>
              <h1 style={{ margin: 0 }}>聚会上聊过的，写成文章。</h1>
              <p className="body-lg" style={{ margin: 0 }}>
                往期场次的要点，和大家最常问的 AI 问题。想当面聊，<Link href="/#signup">每周四上午来 Chatswood</Link>。
              </p>
            </div>
            <ul className="blog-list">
              {posts.map((post) => (
                <li key={post.slug} className="blog-card">
                  <Link href={`/blog/${post.slug}`} className="blog-card__link">
                    <Image src={`/blog/${post.slug}.webp`} alt={post.coverAlt} width={800} height={533} className="blog-card__img" sizes="(max-width: 720px) 100vw, 400px" />
                    <span className="blog-card__meta">{post.date} · {post.tags.slice(0, 2).join(" · ")}</span>
                    <strong className="blog-card__title">{post.title}</strong>
                    <span className="blog-card__desc">{post.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter lang="zh" copy={c} />
    </div>
  );
}
