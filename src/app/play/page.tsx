import type { Metadata } from "next";
import QRCode from "qrcode";
import { SydneyQuest } from "@/components/game/SydneyQuest";
import type { Community } from "@/components/game/engine";
import { resolveLang } from "@/lib/content";
import { listWallMembers, listWharfQuestions } from "@/lib/db";
import { GAME_COPY, type GameCopy } from "@/lib/game/copy";
import { canClaim, statusOf } from "@/lib/questions";
import { pageAlternates } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { deepTranslate } from "@/lib/traditional";
import { listWorks } from "@/lib/works";
import type { Lang } from "@/lib/lang";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

let traditional: GameCopy | undefined;

/** The game's words in one language; Traditional is Simplified, converted once. */
function gameCopy(lang: Lang): GameCopy {
  if (lang === "en") return GAME_COPY.en;
  if (lang === "zh") return GAME_COPY.zh;
  traditional ??= deepTranslate(GAME_COPY.zh);
  return traditional;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const c = gameCopy(lang).meta;

  return {
    alternates: pageAlternates("/play", lang),
    title: c.title,
    description: c.description,
    openGraph: {
      title: c.title,
      description: c.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.title }],
    },
  };
}

/**
 * What the game is allowed to know about the community.
 *
 * ★ The same two reads the public pages use, and nothing else:
 * `listWallMembers()` (published and not hidden, filtered in SQL — the wall's
 * own privacy gate) and `listWharfQuestions()` (the Wharf's board, which only
 * copies questions from published cards). Every field handed to the browser
 * below is one those pages already show to anyone. A game is a new place for
 * the data to appear, not a reason for more of it to leave the database.
 */
async function loadCommunity(): Promise<Community> {
  try {
    const [members, questions] = await Promise.all([listWallMembers(), listWharfQuestions()]);
    const now = new Date();

    return {
      members: members.slice(0, 40).map((member) => ({
        slug: member.slug,
        name: member.display_name,
        headline: member.headline,
        roles: member.roles,
        lookingFor: member.looking_for,
        canHelp: member.can_help,
        tags: member.tags.slice(0, 6),
        avatar: member.has_avatar ? `/api/avatar/${member.id}?v=${member.avatar_version}` : null,
        products: member.assets
          .filter((asset) => asset.kind === "product")
          .slice(0, 3)
          .map((asset) => ({ title: asset.title, tagline: asset.tagline, url: asset.url, stage: asset.stage })),
      })),
      works: listWorks(members)
        .slice(0, 13)
        .map((work, index) => ({ key: `${work.slug}-${index}`, ...work })),
      questions: questions
        .filter((question) => question.lane !== "chat")
        .filter((question) => {
          const status = statusOf(
            {
              closed_at: question.closed_at,
              created_at: question.created_at,
              claims: question.replies.filter((reply) => reply.kind === "coming").length,
              answers: question.replies.filter((reply) => reply.kind === "answer").length,
            },
            now,
          );
          return canClaim(status);
        })
        .slice(0, 12)
        .map((question) => ({ id: question.id, text: question.text, name: question.name, slug: question.slug })),
    };
  } catch {
    // No database — a local build, or the database is down. The game still
    // runs: the story's people are all there, only the community is missing.
    return { members: [], works: [], questions: [] };
  }
}

/**
 * /play — a pixel Sydney, built on the real street map.
 *
 * No site header: this page is a full-screen game on a phone, and a nav bar
 * across the top of it would be a row of links under the player's thumb. The
 * title screen carries its own way home.
 */
export default async function PlayPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const community = await loadCommunity();

  // The share poster's code points at the home page — where the meetup is
  // explained and where sign-up is — rather than back into the game.
  const site = siteUrl();
  const qr = await QRCode.toDataURL(site, { margin: 1, width: 460, color: { dark: "#0a0b0dff", light: "#ffffffff" } });

  return (
    <main id="main" lang={lang === "en" ? "en" : lang === "zh-Hant" ? "zh-Hant" : "zh-CN"}>
      <SydneyQuest copy={gameCopy(lang)} lang={lang} community={community} qr={qr} site={site.replace(/^https?:\/\//, "")} />
    </main>
  );
}
