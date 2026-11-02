import type { Metadata } from "next";
import Link from "next/link";
import { MemberCard, langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, LANG_PARAM, resolveLang, type Copy, type Lang } from "@/lib/content";
import { pageAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { IDENTITIES, identityOf, paginate, sortByIdentity, tagKey, topTags, type Identity } from "@/lib/directory";
import { siteUrl } from "@/lib/site";
import { listWallMembers, type Member } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";
import { ROLES, type Role } from "@/lib/members";
import { focusSession, formatSession } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string; role?: string; tag?: string; q?: string; works?: string; page?: string; who?: string }>;
};

// Reads from Postgres on every request. The wall changes whenever anyone edits
// their card, and there is no revalidation story worth building for a page this
// small.
export const dynamic = "force-dynamic";

/** Cards per page (2026-11-02): a phone scrolls a page, not the whole wall. */
const PAGE_SIZE = 24;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang).members;
  // Filtered, searched and later pages are cuts of the same wall: followed,
  // not indexed, so /members itself carries the weight.
  const narrowed = Boolean(params.role || params.tag || params.q || params.works || (params.page && params.page !== "1"));

  return {
    alternates: pageAlternates("/members", lang),
    title: c.meta.title,
    description: c.meta.description,
    robots: { index: !narrowed, follow: true },
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
  const worksOnly = params.works === "1";
  // By identity (2026-11-02): 导师团 / 共建者 / 共创会员 / everyone else.
  const who = (IDENTITIES as readonly string[]).includes(params.who ?? "") ? (params.who as Identity) : null;

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
    if (tag && !member.tags.some((t) => tagKey(t) === tagKey(tag))) return false;
    if (worksOnly && member.assets.length === 0) return false;
    if (who && identityOf(member) !== who) return false;

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
  // Sorted by identity so who is who shows at a glance; within each identity
  // the wall's own order (most recently seen first) is kept.
  const everyoneElse = sortByIdentity(filtered.filter((member) => !member.sessions.includes(upcoming)));
  const { items: rest, page, pages } = paginate(
    everyoneElse,
    Number(params.page ?? 1),
    PAGE_SIZE,
  );
  // This week's group sits above the pages, on the first one only.
  const thisWeekCount = filtered.length - everyoneElse.length;
  const comingThisWeek = page === 1 ? sortByIdentity(filtered.filter((member) => member.sessions.includes(upcoming))) : [];
  const popularTags = topTags(everyone, 12);

  /** The current view's address with some of its parts changed; any change resets to page 1. */
  const viewHref = (next: { role?: Role | null; tag?: string | null; works?: boolean; page?: number; who?: Identity | null }) => {
    const value = { role, tag, works: worksOnly, q: query, page: 1, who, ...next };
    const search = new URLSearchParams();
    if (value.who) search.set("who", value.who);
    if (value.role) search.set("role", value.role);
    if (value.tag) search.set("tag", value.tag);
    if (value.works) search.set("works", "1");
    if (value.q) search.set("q", value.q);
    if (value.page > 1) search.set("page", String(value.page));
    if (LANG_PARAM[lang]) search.set("lang", LANG_PARAM[lang]!);
    const text = search.toString();
    return text ? `/members?${text}` : "/members";
  };

  const base = siteUrl();
  const shown = [...comingThisWeek, ...rest];
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: m.meta.title,
    numberOfItems: filtered.length,
    itemListElement: shown.map((member, index) => ({
      "@type": "ListItem",
      // Page 1 also carries this week's group, so later pages start after it.
      position: (page === 1 ? 0 : thisWeekCount + (page - 1) * PAGE_SIZE) + index + 1,
      url: `${base}/members/${member.slug}`,
      name: member.display_name,
    })),
  };

  // Picking a role keeps the search, tag and works filter, and goes back to page 1.
  const filterHref = (value: Role | null) => viewHref({ role: value });

  /** The same view with the search cleared and every other filter kept. */
  const clearSearchHref = (() => {
    const search = new URLSearchParams();
    if (role) search.set("role", role);
    if (tag) search.set("tag", tag);
    if (worksOnly) search.set("works", "1");
    if (who) search.set("who", who);
    if (LANG_PARAM[lang]) search.set("lang", LANG_PARAM[lang]!);
    const text = search.toString();
    return text ? `/members?${text}` : "/members";
  })();
  const identityCounts = new Map(IDENTITIES.map((identity) => [identity, everyone.filter((member) => identityOf(member) === identity).length]));

  return (
    <div lang={c.htmlLang}>
      <JsonLd data={[itemList]} />
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

              {/* The same cards, viewed by what is hanging off them. It lives
                  here rather than in the nav because it is a second view of
                  this page's data, not a fifth part of the site. */}
              <Link className="btn btn--secondary" href={`/works${langSuffix(lang)}`}>
                {c.works.eyebrow.replace("§ ", "")}
              </Link>
            </div>

            {/* A plain GET form, like the role filter below it: no client JS,
                and the result is a URL that can be pasted into the group. The
                other filters ride along as hidden fields so searching does not
                silently drop the role someone had picked. */}
            <form className="wall-search" method="get" action="/members" role="search">
              {role && <input type="hidden" name="role" value={role} />}
              {tag && <input type="hidden" name="tag" value={tag} />}
              {worksOnly && <input type="hidden" name="works" value="1" />}
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
                <Link className="chip chip--link chip--on" href={viewHref({ tag: null })}>
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

            {/* By identity (2026-11-02): who is who, at a glance. */}
            <div className="filters" aria-label={m.identityLabel}>
              {IDENTITIES.filter((identity) => (identityCounts.get(identity) ?? 0) > 0).map((identity) => (
                <Link className={`chip chip--link${who === identity ? " chip--on" : ""}`} key={identity} href={viewHref({ who: who === identity ? null : identity })}>
                  {m.identity[identity]} · {identityCounts.get(identity)}
                </Link>
              ))}
            </div>

            {/* The most common tags, as filters (2026-11-02), and "has works". */}
            <div className="filters" aria-label={m.tagsLabel}>
              <Link className={`chip chip--link${worksOnly ? " chip--on" : ""}`} href={viewHref({ works: !worksOnly })}>
                {m.worksOnly}
              </Link>
              {popularTags.map((item) => {
                const on = tag ? tagKey(tag) === tagKey(item.label) : false;
                return (
                  <Link className={`chip chip--link${on ? " chip--on" : ""}`} key={item.label} href={viewHref({ tag: on ? null : item.label })}>
                    #{item.label} · {item.count}
                  </Link>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <div className="stack-2">
                <p className="alert">
                  {everyone.length === 0
                    ? m.empty
                    : query
                      ? m.searchEmpty.replace("{q}", query)
                      : m.emptyFiltered}
                </p>
                {/* Signed up but not here (2026-11-02): only claimed, public cards are on the wall. */}
                {query && (
                  <p className="body-sm" style={{ margin: 0 }}>
                    {m.claimHint} <Link href={`/claim${langSuffix(lang)}`}>{m.claimPublishCta} →</Link>
                  </p>
                )}
              </div>
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
                    count={m.countLabel.replace("{n}", String(everyoneElse.length))}
                    members={rest}
                    copy={m}
                    lang={lang}
                    upcoming={upcoming}
                  />
                )}
                {pages > 1 && (
                  <nav className="pager" aria-label={m.pageLabel.replace("{p}", String(page)).replace("{n}", String(pages))}>
                    {page > 1 ? <Link rel="prev" className="btn btn--secondary" href={viewHref({ page: page - 1 })}>{m.prev}</Link> : <span />}
                    <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
                      {m.pageLabel.replace("{p}", String(page)).replace("{n}", String(pages))}
                    </span>
                    {page < pages ? <Link rel="next" className="btn btn--secondary" href={viewHref({ page: page + 1 })}>{m.next}</Link> : <span />}
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} consult={false} />
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
