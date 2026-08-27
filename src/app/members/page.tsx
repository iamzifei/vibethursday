import type { Metadata } from "next";
import Link from "next/link";
import { MemberCard, langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang, type Copy, type Lang } from "@/lib/content";
import { listWallMembers, type Member } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";
import { ROLES, type Role } from "@/lib/members";
import { focusSession, formatSession } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string; role?: string; tag?: string; q?: string }>;
};

// Reads from Postgres on every request. The wall changes whenever anyone edits
// their card, and there is no revalidation story worth building for a page this
// small.
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).members;

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
  const c = getCopy(lang);
  const m = c.members;

  const role = (ROLES as readonly string[]).includes(params.role ?? "")
    ? (params.role as Role)
    : null;
  const tag = params.tag?.trim() || null;

  // Capped, because it is echoed back into the input and into the empty-state
  // message. A paragraph pasted in here should not become the page.
  const query = params.q?.trim().slice(0, 80) || null;

  /**
   * Everything about a member that someone might remember them by.
   *
   * Names are the *last* thing that survives a conversation — "the one doing
   * SEO" is what is left an hour later, and the role chips cannot express it:
   * there are six of them and they are categories, not descriptions. So the
   * free-text columns are what this searches, and the name comes along only
   * because leaving it out would be strange.
   */
  const haystack = (member: Member) =>
    [
      member.display_name,
      member.headline,
      member.bio,
      member.looking_for,
      member.can_help,
      member.topic,
      ...member.tags,
      ...member.assets.flatMap((asset) => [asset.title, asset.tagline]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

  // Every word has to appear somewhere, so "seo 悉尼" narrows rather than
  // widens. Splitting on whitespace also does the right thing for Chinese,
  // which arrives as a single token and is matched as a substring.
  const terms = query ? query.toLowerCase().split(/\s+/).filter(Boolean) : [];

  const everyone = await listWallMembers();
  const signedIn = (await currentMemberId()) !== null;

  // Filtered in JS rather than SQL: this is a weekly meetup, the whole wall is
  // one small query, and pushing the filters down would buy nothing.
  const filtered = everyone.filter((member) => {
    if (role && !member.roles.includes(role)) return false;
    if (tag && !member.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;

    if (terms.length > 0) {
      const text = haystack(member);
      if (!terms.every((term) => text.includes(term))) return false;
    }

    return true;
  });

  // "This Thursday" is the reason someone opens this page on a Wednesday
  // night, so it goes first rather than being something to scroll for.
  //
  // A partition, deliberately: every member lands in exactly one group, so a
  // regular who has been to six sessions is listed once, not six times, and
  // someone who has never picked a session still appears — in the second group,
  // just without an attendance count.
  //
  // `focusSession` rather than the next Thursday: after noon on a Thursday the
  // next-Thursday answer jumps a week, which used to empty this group out the
  // moment a session finished. See sessions.ts for the measurement.
  const { date: upcoming, past: lookingBack } = focusSession();
  const comingThisWeek = filtered.filter((member) => member.sessions.includes(upcoming));
  const rest = filtered.filter((member) => !member.sessions.includes(upcoming));

  const filterHref = (value: Role | null) => {
    const params = new URLSearchParams();
    if (value) params.set("role", value);
    if (tag) params.set("tag", tag);
    // Carried through, so picking a role narrows a search rather than losing it.
    if (query) params.set("q", query);
    if (LANG_PARAM[lang]) params.set("lang", LANG_PARAM[lang]!);
    const search = params.toString();
    return search ? `/members?${search}` : "/members";
  };

  /** The same view with the search cleared and every other filter kept. */
  const clearSearchHref = (() => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (tag) params.set("tag", tag);
    if (LANG_PARAM[lang]) params.set("lang", LANG_PARAM[lang]!);
    const search = params.toString();
    return search ? `/members?${search}` : "/members";
  })();

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/members" />

      <main id="main">
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{m.eyebrow}</span>
              <h1>{m.title}</h1>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {m.lede}
              </p>
            </div>

            {/* Someone who has already claimed was being told to claim. They
                get their own two doors instead — and the badge needs a way in
                that is not "open the editor and scroll". */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              {signedIn ? (
                <>
                  <Link className="btn btn--primary" href={`/badge${langSuffix(lang)}`}>
                    {c.editor.badgeCta}
                  </Link>
                  <Link className="btn btn--secondary" href={`/me${langSuffix(lang)}`}>
                    {m.editCta}
                  </Link>
                </>
              ) : (
                /* One door, not two. There used to be a "报名" button beside
                   this one, which the site nav now carries on every page — the
                   same word twice in one viewport, both going to the same
                   anchor. Someone who has never signed up is not stranded by
                   its removal: /me sends them to /claim, which ends in "还没
                   报过名？" pointing at the form. */
                <Link className="btn btn--primary" href={`/me${langSuffix(lang)}`}>
                  {m.claimCta}
                </Link>
              )}
            </div>

            {/* A plain GET form, like the role filter below it: no client JS,
                and the result is a URL that can be pasted into the group. The
                other filters ride along as hidden fields so searching does not
                silently drop the role someone had picked. */}
            <form className="wall-search" method="get" action="/members" role="search">
              {role && <input type="hidden" name="role" value={role} />}
              {tag && <input type="hidden" name="tag" value={tag} />}
              {LANG_PARAM[lang] && <input type="hidden" name="lang" value={LANG_PARAM[lang]!} />}

              <label className="visually-hidden" htmlFor="wall-q">
                {m.searchLabel}
              </label>
              <input
                className="field"
                id="wall-q"
                name="q"
                type="search"
                defaultValue={query ?? ""}
                placeholder={m.searchPlaceholder}
                maxLength={80}
              />
              <button className="btn btn--secondary" type="submit">
                {m.searchSubmit}
              </button>
            </form>

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
              {query && (
                <Link className="chip chip--link chip--on" href={clearSearchHref}>
                  {`"${query}" ✕`}
                  <span className="visually-hidden"> — {m.searchClear}</span>
                </Link>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="alert">
                {everyone.length === 0
                  ? m.empty
                  : query
                    ? m.searchEmpty.replace("{q}", query)
                    : m.emptyFiltered}
              </p>
            ) : (
              <>
                {comingThisWeek.length > 0 && (
                  <Group
                    title={`${lookingBack ? m.lastSession : m.thisWeek} · ${formatSession(upcoming, lang)}`}
                    count={m.countLabel.replace("{n}", String(comingThisWeek.length))}
                    members={comingThisWeek}
                    copy={m}
                    lang={lang}
                    upcoming={upcoming}
                    highlight
                  />
                )}

                {rest.length > 0 && (
                  <Group
                    // Only "everyone" when there is no group above it holding
                    // some of them back.
                    title={comingThisWeek.length > 0 ? m.others : m.everyone}
                    count={m.countLabel.replace("{n}", String(rest.length))}
                    members={rest}
                    copy={m}
                    lang={lang}
                    upcoming={upcoming}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

function Group({
  title,
  count,
  members,
  copy,
  lang,
  upcoming,
  highlight = false,
}: {
  title: string;
  count: string;
  members: Member[];
  copy: Copy["members"];
  lang: Lang;
  upcoming: string;
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
          <MemberCard member={member} copy={copy} lang={lang} upcoming={upcoming} key={member.slug} />
        ))}
      </div>
    </section>
  );
}
