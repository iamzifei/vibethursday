import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { langSuffix } from "@/components/MemberCard";
import { MemberEditor } from "@/components/MemberEditor";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang } from "@/lib/content";
import { getMemberById, getMySignupForMember, listPublishedTags } from "@/lib/db";
import { myToken } from "@/lib/my-signup";
import { formatSession, sydneyToday } from "@/lib/sessions";
import { currentMemberId } from "@/lib/member-auth";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: getCopy(resolveLang((await searchParams).lang)).editor.meta.title,
    robots: { index: false },
  };
}

export default async function MePage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);

  const memberId = await currentMemberId();

  if (!memberId) redirect(`/claim${langSuffix(lang)}`);

  const member = await getMemberById(memberId);

  // The cookie outlives the row if the organiser deleted a signup. Sending them
  // back to /claim is the only useful thing to do, and claiming again rebuilds
  // the card from the signup if one still exists.
  if (!member) redirect(`/claim${langSuffix(lang)}`);

  const suggestedTags = await listPublishedTags();

  // "Did my signup go through?" was asked from this page (2026-09-28): it is
  // where people land after signing up and claiming, and it showed only the
  // card. The card is already signed in, so the link to change a Thursday
  // carries a /my token and needs nothing typed.
  const today = sydneyToday().toISOString().slice(0, 10);
  let upcoming: { session: string; waitlisted: boolean }[] = [];
  let myHref = `/my${langSuffix(lang)}`;
  try {
    const mine = await getMySignupForMember(memberId);
    if (mine) {
      upcoming = [
        ...mine.sessions.map((session) => ({ session, waitlisted: false })),
        ...mine.waitlist.map((entry) => ({ session: entry.session, waitlisted: true })),
      ]
        .filter((entry) => entry.session >= today)
        .sort((a, b) => (a.session < b.session ? -1 : 1));
      const params = new URLSearchParams({ t: myToken(mine.id) });
      if (LANG_PARAM[lang]) params.set("lang", LANG_PARAM[lang]!);
      myHref = `/my?${params.toString()}`;
    }
  } catch (error) {
    console.error("[me] could not load the signup", error);
  }

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/me" />

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

            <div className="card stack-3">
              <span className="eyebrow">{c.my.eyebrow}</span>
              {upcoming.length === 0 ? (
                <p style={{ margin: 0 }}>{c.my.none}</p>
              ) : (
                <ul className="stack-2" style={{ margin: 0, paddingLeft: "1.2em" }}>
                  {upcoming.map((entry) => (
                    <li key={entry.session}>
                      <strong>{formatSession(entry.session, lang)}</strong> ·{" "}
                      {entry.waitlisted ? c.signup.successTagWaitlist : c.signup.successTagBooked}
                    </li>
                  ))}
                </ul>
              )}
              <Link className="body-sm" href={myHref}>
                {c.my.meLink}
              </Link>
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
