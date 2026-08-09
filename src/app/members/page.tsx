import type { Metadata } from "next";
import Link from "next/link";
import { MemberCard, langSuffix } from "@/components/MemberCard";
import { SiteHeader } from "@/components/SiteHeader";
import { copy as allCopy, resolveLang, type Copy, type Lang } from "@/lib/content";
import { listWallMembers, type Member } from "@/lib/db";
import { ROLES, type Role } from "@/lib/members";
import { formatSession, nextThursdays } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string; role?: string; tag?: string }>;
};

// Reads from Postgres on every request. The wall changes whenever anyone edits
// their card, and there is no revalidation story worth building for a page this
// small.
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = allCopy[resolveLang((await searchParams).lang)].members;

  return {
    title: c.meta.title,
    description: c.meta.description,
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.meta.title }],
    },
  };
}

export default async function MembersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = allCopy[lang];
  const m = c.members;

  const role = (ROLES as readonly string[]).includes(params.role ?? "")
    ? (params.role as Role)
    : null;
  const tag = params.tag?.trim() || null;

  const everyone = await listWallMembers();

  // Filtered in JS rather than SQL: this is a weekly meetup, the whole wall is
  // one small query, and pushing the filters down would buy nothing.
  const filtered = everyone.filter((member) => {
    if (role && !member.roles.includes(role)) return false;
    if (tag && !member.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    return true;
  });

  // "This Thursday" is the reason someone opens this page on a Wednesday
  // night, so it goes first rather than being something to scroll for.
  const upcoming = nextThursdays(1)[0];
  const comingThisWeek = filtered.filter((member) => member.sessions.includes(upcoming));
  const rest = filtered.filter((member) => !member.sessions.includes(upcoming));

  const filterHref = (value: Role | null) => {
    const query = new URLSearchParams();
    if (value) query.set("role", value);
    if (tag) query.set("tag", tag);
    if (lang === "en") query.set("lang", "en");
    const search = query.toString();
    return search ? `/members?${search}` : "/members";
  };

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} switchHref={lang === "zh" ? "/members?lang=en" : "/members"} />

      <main>
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{m.eyebrow}</span>
              <h1>{m.title}</h1>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {m.lede}
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <Link className="btn btn--primary" href={`/me${langSuffix(lang)}`}>
                {m.claimCta}
              </Link>
              <Link className="btn btn--secondary" href={`/${langSuffix(lang)}#signup`}>
                {c.nav.cta}
              </Link>
            </div>

            {/* Role filter. Plain links, so it works with JavaScript off and
                every filtered view is a URL someone can paste into the group. */}
            <div className="filters">
              <Link className={`chip chip--link${role === null ? " chip--on" : ""}`} href={filterHref(null)}>
                {m.filterAll}
              </Link>
              {ROLES.map((value) => (
                <Link
                  className={`chip chip--link${role === value ? " chip--on" : ""}`}
                  href={filterHref(value)}
                  key={value}
                >
                  {m.roles[value]}
                </Link>
              ))}
              {tag && (
                <Link className="chip chip--link chip--on" href={`/members${langSuffix(lang)}`}>
                  #{tag} ✕
                </Link>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="alert">{everyone.length === 0 ? m.empty : m.emptyFiltered}</p>
            ) : (
              <>
                {comingThisWeek.length > 0 && (
                  <Group
                    title={`${m.thisWeek} · ${formatSession(upcoming, lang)}`}
                    count={m.countLabel.replace("{n}", String(comingThisWeek.length))}
                    members={comingThisWeek}
                    copy={m}
                    lang={lang}
                    highlight
                  />
                )}

                {rest.length > 0 && (
                  <Group
                    title={m.everyone}
                    count={m.countLabel.replace("{n}", String(rest.length))}
                    members={rest}
                    copy={m}
                    lang={lang}
                  />
                )}
              </>
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

function Group({
  title,
  count,
  members,
  copy,
  lang,
  highlight = false,
}: {
  title: string;
  count: string;
  members: Member[];
  copy: Copy["members"];
  lang: Lang;
  highlight?: boolean;
}) {
  return (
    <section className="stack-4">
      <div className="group-head">
        <h2 className="h3">
          {highlight && <span className="dot dot--pulse" aria-hidden="true" />}
          {title}
        </h2>
        <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
          {count}
        </span>
      </div>

      <div className="mwall">
        {members.map((member) => (
          <MemberCard member={member} copy={copy} lang={lang} key={member.slug} />
        ))}
      </div>
    </section>
  );
}
