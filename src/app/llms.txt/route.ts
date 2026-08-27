import { copy, type Copy } from "@/lib/content";
import { siteUrl } from "@/lib/site";

// The absolute URLs below are only known once the app is running.
export const dynamic = "force-dynamic";

/**
 * `/llms.txt` — the site in plain text, for language models.
 *
 * The convention (llmstxt.org) is a small Markdown file at the root: an H1, a
 * blockquote summary, then sections of links. It exists because a model asked
 * "when is the Sydney AI meetup and can I come without a product" should get
 * that from one short file rather than by inferring it from a page whose
 * content is spread across nine animated sections.
 *
 * Everything here is generated from `@/lib/content`, never typed out again, so
 * a copy change on the site cannot leave this file describing last month's
 * venue. Nothing in it is anything a visitor cannot already read on the page.
 */
function section(c: Copy, isZh: boolean): string {
  const lines: string[] = [];

  lines.push(c.hero.lede, "");

  for (const fact of c.hero.facts) {
    lines.push(`- **${fact.label}**: ${fact.value}`);
  }

  lines.push("", isZh ? "### 流程" : "### Run of show", "");

  for (const slot of c.schedule.slots) {
    lines.push(`- **${slot.time}** ${slot.title} — ${slot.note}`);
  }

  lines.push("", isZh ? "### 谁适合来" : "### Who it is for", "");
  lines.push(c.who.groups.map((group) => `- ${group}`).join("\n"));
  lines.push("", c.who.note);

  lines.push("", isZh ? "### 规矩" : "### House rules", "");

  c.rules.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });

  lines.push("", isZh ? "### 常见问题" : "### FAQ", "");

  for (const item of c.faq.items) {
    // The answer is stored split around an optional inline link, because on the
    // page the link sits mid-sentence. Flattened back into one sentence here.
    const answer = [item.a, item.linkLabel, item.aTail].filter(Boolean).join("");
    lines.push(`**${item.q}**`, answer, "");
  }

  return lines.join("\n");
}

export async function GET(): Promise<Response> {
  const base = siteUrl();
  const zh = copy.zh;
  const en = copy.en;

  const body = `# Vibe Thursday

> ${zh.meta.description}

> ${en.meta.description}

## 页面 · Pages

- [首页 / Home](${base}/): ${zh.hero.subtitle} — ${en.hero.subtitle}
- [成员墙 / Member wall](${base}/members): ${zh.members.lede}
- [码头 / The Wharf](${base}/wharf): ${zh.wharf.lede} — ${en.wharf.lede}
- [这个活动的开销 / What it costs](${base}/support): ${zh.support.title} ${en.support.title}
- [认领名片 / Claim your card](${base}/claim): ${zh.claim.lede}

Every page has three views on the same URL: Simplified Chinese (no parameter,
the default), Traditional Chinese with \`?lang=zh-Hant\`, and English with
\`?lang=en\`. The Traditional view is the Simplified copy converted character by
character, so it is not reproduced below.

## 中文

${section(zh, true)}

## English

${section(en, false)}

## 说明 · Notes

- 报名在首页底部（${base}/#signup），免费，不售票。
- Signing up is free and happens at the bottom of the home page (${base}/#signup); there are no tickets.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Short, because the content follows the site's copy and the venue is the
      // thing most likely to change.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
