import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { assetLabel, langSuffix, weeklyTopic } from "@/components/MemberCard";
import { SiteHeader } from "@/components/SiteHeader";
import { copy as allCopy, resolveLang } from "@/lib/content";
import { getMemberBySlug } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";
import { formatSession, nextThursdays } from "@/lib/sessions";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const member = await getMemberBySlug((await params).slug);

  if (!member) return { title: allCopy[lang].members.meta.title };

  // The headline is what the person chose to say about themselves, so it is a
  // better description than anything assembled from their fields.
  const description = member.headline ?? allCopy[lang].members.meta.description;

  return {
    title: `${member.display_name} · Vibe Thursday`,
    description,
    openGraph: {
      title: `${member.display_name} · Vibe Thursday`,
      description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: member.display_name }],
    },
  };
}

export default async function MemberPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const lang = resolveLang((await searchParams).lang);
  const c = allCopy[lang];
  const m = c.members;

  const member = await getMemberBySlug(slug);

  if (!member) notFound();

  const topic = weeklyTopic(member, nextThursdays(1)[0]);

  // Looking at your own card was a dead end: the only ways to edit it were the
  // wall and /me, neither of which you are on when you followed your own QR.
  const isMine = (await currentMemberId()) === member.id;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader
        lang={lang}
        copy={c}
        switchHref={lang === "zh" ? `/members/${slug}?lang=en` : `/members/${slug}`}
      />

      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <Link className="body-sm" href={`/members${langSuffix(lang)}`}>
              {m.back}
            </Link>

            <div className="mprofile">
              <Avatar
                id={member.id}
                name={member.display_name}
                hasAvatar={member.has_avatar}
                version={member.avatar_version}
                size="lg"
              />

              <div className="stack-3">
                <h1>{member.display_name}</h1>
                {member.headline && (
                  <p className="body-lg" style={{ color: "var(--fg1)", fontWeight: 500 }}>
                    {member.headline}
                  </p>
                )}

                <div className="mcard__meta">
                  {member.roles.map((role) => (
                    <span className="chip" key={role}>
                      {m.roles[role]}
                    </span>
                  ))}
                  {member.sessions.length > 0 && (
                    <span className="chip chip--quiet">
                      {m.attended.replace("{n}", String(member.sessions.length))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isMine && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                <a className="btn btn--secondary" href={`/me${langSuffix(lang)}`}>
                  {m.editCta}
                </a>
                <a className="btn btn--secondary" href={`/badge${langSuffix(lang)}`}>
                  {c.editor.badgeCta}
                </a>
              </div>
            )}

            {member.bio && (
              <p className="body-lg" style={{ maxWidth: "62ch", whiteSpace: "pre-wrap" }}>
                {member.bio}
              </p>
            )}

            {(topic || member.looking_for || member.can_help) && (
              <dl className="wants wants--lg">
                {topic && (
                  <div className="wants__row">
                    <dt>📌 {m.thisWeekTopic}</dt>
                    <dd>{topic}</dd>
                  </div>
                )}
                {member.looking_for && (
                  <div className="wants__row">
                    <dt>🔎 {m.lookingFor}</dt>
                    <dd>{member.looking_for}</dd>
                  </div>
                )}
                {member.can_help && (
                  <div className="wants__row">
                    <dt>🤝 {m.canHelp}</dt>
                    <dd>{member.can_help}</dd>
                  </div>
                )}
              </dl>
            )}

            {member.assets.length > 0 && (
              <div className="grid-auto">
                {member.assets.map((asset) => (
                  <div className="card stack-3" key={`${asset.kind}-${asset.title}`}>
                    <div className="mcard__meta">
                      <span className="chip">{assetLabel(asset, m)}</span>
                      {/* No link, no problem. A product that only runs on a
                          laptop is a normal thing to have on this wall. */}
                      {asset.stage && <span className="chip chip--stage">{m.stages[asset.stage]}</span>}
                    </div>

                    <h2 className="h3">{asset.title}</h2>
                    {asset.tagline && <p className="body-sm">{asset.tagline}</p>}

                    {asset.url && (
                      <a
                        className="body-sm mono"
                        href={asset.url}
                        target="_blank"
                        // noopener is what stops the opened page reaching back
                        // through window.opener; nofollow keeps the wall from
                        // becoming something worth spamming for backlinks.
                        rel="noopener noreferrer nofollow"
                      >
                        {m.visit} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {member.tags.length > 0 && (
              <div className="mcard__tags">
                {member.tags.map((tag) => (
                  <Link
                    className="tag"
                    href={`/members?tag=${encodeURIComponent(tag)}${langSuffix(lang, true)}`}
                    key={tag}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {member.sessions.length > 0 && (
              <p className="body-sm mono" style={{ color: "var(--fg3)" }}>
                {member.sessions.map((session) => formatSession(session, lang)).join(" · ")}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="section" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="shell stack-3">
          <span className="h3 hl">{c.footer.tagline}</span>
          <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
            {c.footer.location}
          </span>
        </div>
      </footer>
    </div>
  );
}
