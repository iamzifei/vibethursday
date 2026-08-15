import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { langSuffix } from "@/components/MemberCard";
import { MemberEditor } from "@/components/MemberEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { copy as allCopy, resolveLang } from "@/lib/content";
import { getMemberById, listPublishedTags } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: allCopy[resolveLang((await searchParams).lang)].editor.meta.title,
    robots: { index: false },
  };
}

export default async function MePage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = allCopy[lang];

  const memberId = await currentMemberId();

  if (!memberId) redirect(`/claim${langSuffix(lang)}`);

  const member = await getMemberById(memberId);

  // The cookie outlives the row if the organiser deleted a signup. Sending them
  // back to /claim is the only useful thing to do, and claiming again rebuilds
  // the card from the signup if one still exists.
  if (!member) redirect(`/claim${langSuffix(lang)}`);

  const suggestedTags = await listPublishedTags();

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} switchHref={lang === "zh" ? "/me?lang=en" : "/me"} />

      <main id="main">
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "720px" }}>
            <div className="stack-4">
              <Link className="body-sm" href={`/members${langSuffix(lang)}`}>
                {c.editor.backToWall}
              </Link>
              <span className="eyebrow">{c.editor.eyebrow}</span>
              <h1>{c.editor.title}</h1>
              <p className="body-lg">{c.editor.lede}</p>
            </div>

            <MemberEditor
              member={member}
              copy={c.editor}
              labels={c.members}
              lang={lang}
              suggestedTags={suggestedTags}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
