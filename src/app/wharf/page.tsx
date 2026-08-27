import type { Metadata } from "next";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang } from "@/lib/content";
import { listWallMembers } from "@/lib/db";
import { formatSession, nextThursdays } from "@/lib/sessions";
import { groupTopics, gullMood } from "@/lib/wharf";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

// Reads Postgres on every request. The contents change whenever anyone signs
// up, which is most evenings in the two days before a session.
export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = getCopy(resolveLang((await searchParams).lang)).wharf;

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

/**
 * The Wharf — everything people said they wanted to ask, in one place.
 *
 * This page adds no way to put anything into the site. Every sentence on it
 * comes from one field on the sign-up form, and it is here because that field
 * went from a 19% fill rate to 80% over four sessions while being almost
 * invisible: a member card only shows the sentence while its author is signed
 * up for the *next* Thursday, so for most of any given week the site displayed
 * none of them. The bottleneck was never the input.
 *
 * **Nobody appears here who did not ask to appear.** The only rows this page
 * can see are the ones `listWallMembers()` returns, and that query filters on
 * `published_at IS NOT NULL AND NOT hidden` in SQL — the same gate the member
 * wall uses. Someone who filled in a question but never ticked "put me on the
 * member wall" is not reachable from this code path at all, which is what the
 * form promised them. There is a test pinning that down; do not replace this
 * call with a wider query.
 */
export default async function WharfPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);
  const w = c.wharf;

  const upcoming = nextThursdays(1)[0];
  const { groups, total, olderSessions, olderEntries } = groupTopics(
    await listWallMembers(),
    upcoming,
  );

  const thisWeek = groups[0].entries.length;
  const mood = gullMood(thisWeek, total);

  const say =
    mood === "waiting"
      ? w.say.waiting.replace("{n}", String(thisWeek))
      : mood === "quiet"
        ? w.say.quiet
        : w.say.empty;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/wharf" />

      <main id="main">
        <header className="wharf-hero">
          <div className="shell stack-4">
            <span className="eyebrow">{w.eyebrow}</span>
            <h1>{w.title}</h1>
            <p className="body-lg" style={{ maxWidth: "56ch" }}>
              {w.lede}
            </p>
            <p className="body-sm" style={{ maxWidth: "56ch", color: "var(--fg3)" }}>
              {w.place}
            </p>
            {/* The bird and its line, side by side. The drawing is the
                character; the sentence is real text because it carries the
                count, and the count is the only thing on this page that
                changes hour to hour.

                Eager, not lazy: it is the first thing on the page and it is
                8 KB. */}
            <div className="wharf-mascot">
              <picture>
                <source
                  type="image/avif"
                  srcSet="/wharf/gull-240.avif 240w, /wharf/gull-480.avif 480w"
                  sizes="180px"
                />
                <img
                  src="/wharf/gull-480.jpg"
                  srcSet="/wharf/gull-240.jpg 240w, /wharf/gull-480.jpg 480w"
                  sizes="180px"
                  alt={w.gullAlt}
                  width={480}
                  height={383}
                  decoding="async"
                />
              </picture>
              <p className="wharf-say">
                {mood === "waiting" ? <Line text={say} /> : say}
              </p>
            </div>
          </div>
        </header>

        <section className="section" style={{ paddingTop: "var(--space-8)" }}>
          <div className="shell stack-8">
            {groups.map((group) => {
              const isNow = group.session === upcoming;

              return (
                <div className="stack-4" key={group.session ?? "none"}>
                  <div className="wharf-group">
                    <span
                      className={`wharf-group__label${isNow ? " wharf-group__label--now" : ""}`}
                    >
                      {group.session === null
                        ? w.noSession
                        : isNow
                          ? `${w.thisWeek} · ${formatSession(group.session, lang)}`
                          : formatSession(group.session, lang)}
                    </span>
                    <span className="wharf-group__rule" />
                  </div>

                  {group.entries.length === 0 ? (
                    <p className="wharf-empty">{w.emptyWeek}</p>
                  ) : (
                    group.entries.map((entry) => (
                      <Link
                        key={entry.slug}
                        href={`/members/${entry.slug}${langSuffix(lang)}`}
                        className={`wharf-item${isNow ? " wharf-item--now" : ""}`}
                      >
                        <span className="wharf-item__q">{entry.topic}</span>
                        <span className="wharf-item__who">
                          <span className="wharf-item__name">{entry.name}</span>
                          {isNow ? <span className="pill pill--live">{w.comingLabel}</span> : null}
                        </span>
                      </Link>
                    ))
                  )}
                </div>
              );
            })}

            {/* Said out loud rather than just stopping: a list that quietly
                ends at four headings reads as "that is all there has ever
                been", which would be false. */}
            {olderSessions > 0 ? (
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {w.older.replace("{n}", String(olderSessions)).replace("{m}", String(olderEntries))}
              </p>
            ) : null}

            {/* The four-panel strip, and it belongs here rather than at the
                top of the page for two reasons. It *is* the explanation —
                bored, wanders down to the wharf, finds chips — so it sits
                against the paragraph that explains the same thing in words.
                And down here it can be lazy: it is 117 KB, which is a lot to
                put in front of a reader who came to read a list. */}
            <figure className="wharf-strip">
              <picture>
                <source
                  type="image/avif"
                  srcSet="/wharf/strip-800.avif 800w, /wharf/strip-1200.avif 1200w, /wharf/strip-1600.avif 1600w"
                  sizes="(max-width: 48rem) 100vw, 1032px"
                />
                <img
                  src="/wharf/strip-1200.jpg"
                  srcSet="/wharf/strip-800.jpg 800w, /wharf/strip-1200.jpg 1200w"
                  sizes="(max-width: 48rem) 100vw, 1032px"
                  alt={w.stripAlt}
                  width={1532}
                  height={1019}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </figure>

            <div className="wharf-how">
              <ChipMark />
              <div className="stack-3">
                <h2 className="h3" style={{ margin: 0 }}>
                  {w.how.title}
                </h2>
                <p className="wharf-how__body">{w.how.body}</p>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Link className="btn btn--primary" href={`/${langSuffix(lang)}#signup`}>
                    {w.how.cta}
                  </Link>
                  <Link className="btn btn--secondary" href={`/members${langSuffix(lang)}`}>
                    {w.membersCta}
                  </Link>
                </div>
              </div>
            </div>

            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {w.langNote}
            </p>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} />
    </div>
  );
}

/** Splits "… {n} 个问题" so the number can carry the chip colour. */
function Line({ text }: { text: string }) {
  const match = text.match(/^(.*?)(\d+.*)$/);
  if (!match) return <>{text}</>;

  return (
    <>
      {match[1]}
      <b>{match[2]}</b>
    </>
  );
}

/**
 * A serve of hot chips: three of them and the box.
 *
 * Drawn rather than an emoji so the yellow is the page's own token and the
 * shape is the same on every platform. Worth knowing if you edit it: the
 * chips have to splay noticeably wider than the mouth of the box and stand
 * well clear of it. An earlier version had them short and rounded, and at
 * this size the whole mark read as a crown.
 */
function ChipMark() {
  return (
    <svg
      className="wharf-how__mark"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="5.4" y="1.2" width="2.6" height="13" rx="0.6" transform="rotate(-16 6.7 7.7)" />
        <rect x="10.7" y="0.4" width="2.6" height="13.8" rx="0.6" />
        <rect x="16" y="1.2" width="2.6" height="13" rx="0.6" transform="rotate(16 17.3 7.7)" />
      </g>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        d="M5 12h14l-1.7 10.4H6.7z"
      />
    </svg>
  );
}
