// Relative imports only: the tests load this through Node's type stripper.
import { BLOG_SOURCES } from "./blog-posts.ts";

/**
 * The blog (2026-11-02). Articles written from the public Thursday sessions
 * and the questions people bring to the meetup — never from the paid,
 * closed-door Tuesdays — for search engines and AI answers, each one ending in
 * an invitation to come along.
 *
 * Each post is markdown with a small frontmatter, kept in `blog-posts.ts`
 * (written by `scripts/blog-import.mjs` from the drafts). The body uses the
 * site's mini-markdown; a final `## 常见问题` section of `### ` questions
 * becomes the FAQ, rendered as a list and as FAQPage structured data.
 */

/** The byline on every post (James 2026-11-02). */
export const BLOG_AUTHOR = { name: "澳洲AI教父", url: "https://x.com/JamesAI" } as const;

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  /** When the post was last edited (2026-11-03); the publish date if never. */
  updated: string;
  tags: string[];
  coverAlt: string;
  /** The markdown after the frontmatter, FAQ included. */
  body: string;
};

/** Parses one post: `---` frontmatter of `key: value` lines, then the body. */
export function parsePost(source: string): BlogPost {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source.replace(/\r\n/g, "\n"));
  if (!match) throw new Error("blog post without frontmatter");
  const fields = new Map<string, string>();
  for (const line of match[1].split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) fields.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  const field = (key: string) => {
    const value = fields.get(key);
    if (!value) throw new Error(`blog post missing "${key}"`);
    return value;
  };
  return {
    slug: field("slug"),
    title: field("title"),
    description: field("description"),
    date: field("date"),
    updated: fields.get("updated") || field("date"),
    tags: field("tags").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    coverAlt: field("cover_alt"),
    body: match[2].trim(),
  };
}

const FAQ_HEADING = "## 常见问题";

/** Splits the trailing `## 常见问题` section off the body, as question/answer pairs. */
export function splitFaq(body: string): { body: string; faq: { q: string; a: string }[] } {
  const at = body.lastIndexOf(`\n${FAQ_HEADING}`);
  const start = body.startsWith(FAQ_HEADING) ? 0 : at;
  if (start < 0) return { body, faq: [] };
  const faqText = body.slice(start).replace(FAQ_HEADING, "");
  const faq = faqText
    .split(/\n### /)
    .slice(1)
    .map((chunk) => {
      const [q, ...rest] = chunk.split("\n");
      return { q: q.trim(), a: rest.join("").trim() };
    })
    .filter((item) => item.q && item.a);
  return { body: body.slice(0, start).trim(), faq };
}

/** Every post, newest first (by date, then title). */
export function blogPosts(): BlogPost[] {
  return BLOG_SOURCES.map(parsePost).sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? 1 : -1));
}

export function blogPost(slug: string): BlogPost | null {
  return blogPosts().find((post) => post.slug === slug) ?? null;
}

/**
 * Posts to read next (2026-11-03): the most shared tags first, then the newest.
 * Shown at the end of every post as 「相关文章」, so every article links to
 * others and none is left without internal links.
 */
export function relatedPosts(slug: string, count = 3): BlogPost[] {
  const posts = blogPosts();
  const post = posts.find((item) => item.slug === slug);
  if (!post) return [];
  const shared = (other: BlogPost) => other.tags.filter((tag) => post.tags.includes(tag)).length;
  return posts
    .filter((other) => other.slug !== slug)
    .map((other, order) => ({ other, score: shared(other), order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, count)
    .map((item) => item.other);
}
