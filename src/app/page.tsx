import type { Metadata } from "next";
import Link from "next/link";
import { SydneySkyline } from "@/components/SydneySkyline";
import { SignupForm } from "@/components/SignupForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCopy, resolveLang } from "@/lib/content";
import { listWallMembers } from "@/lib/db";
import { langHref } from "@/lib/nav";
import { formatSession, nextThursdays } from "@/lib/sessions";
import { featuredTopics, groupTopics, type WharfEntry } from "@/lib/wharf";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);

  return {
    title: c.meta.title,
    description: c.meta.description,
    // `images` has to be repeated here. Next.js does not merge openGraph with
    // the parent layout — declaring the key at all replaces the whole object,
    // so omitting images silently drops the social card.
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: c.meta.title }],
    },
  };
}

export default async function Page({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = getCopy(lang);

  // The time is appended here rather than inside formatSession, which is also
  // used on the member wall to list which sessions someone attended — "8月6日
  // （周四）上午 10:00 · 8月13日（周四）上午 10:00" would be noise there. In the
  // picker it is the point: a bare date lets someone who works weekday
  // mornings choose one without ever registering that it is a morning.
  const sessions = nextThursdays(6).map((value) => ({
    value,
    label: `${formatSession(value, lang)} · ${c.signup.fields.sessionTimeSuffix}`,
  }));

  const nextSession = sessions[0];

  /**
   * The three questions in the Wharf block.
   *
   * This is the only database read on the home page, and it is wrapped because
   * of what this page is: the address people are given, the one a stranger
   * opens first, and until now the only page that still rendered completely
   * with Postgres down. A block of questions is worth having; it is not worth
   * the front door going with it, so a failure here costs the three rows and
   * nothing else — the heading, the explanation and the link all still render.
   *
   * `listWallMembers` is the same call the member wall makes, and it is the
   * privacy boundary: published, unhidden cards only.
   */
  let featured: WharfEntry[] = [];
  let thisWeekCount = 0;

  try {
    const { groups } = groupTopics(await listWallMembers(), nextSession.value);
    featured = featuredTopics(groups);
    thisWeekCount = groups[0].entries.length;
  } catch (error) {
    console.error("[home] the wharf block could not be loaded", error);
  }

  // The document is declared zh-CN in the layout, so the English view
  // re-declares its own language here for screen-reader pronunciation.
  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} path="/" />

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="hero">
          <SydneySkyline />
          {/* Decorative motion layers. Purely visual, so they are hidden from
              assistive technology and carry no content. */}
          <div className="hero__grid" aria-hidden="true" />
          <div className="hero__scan" aria-hidden="true" />

          <div className="shell stack-8">
            <div className="stack-4 rise rise-1">
              <span className="eyebrow cursor">{c.hero.eyebrow}</span>
              {/* data-text feeds the two glitch copies drawn by ::before and
                  ::after; it must stay identical to the visible text. */}
              <h1 className="display-1 glitch" data-text={c.hero.title}>
                {c.hero.title}
              </h1>
              <p className="body-lg" style={{ color: "var(--fg1)", fontWeight: 500 }}>
                {c.hero.subtitle}
              </p>
            </div>

            <p className="body-lg rise rise-2" style={{ maxWidth: "58ch" }}>
              {c.hero.lede}
            </p>

            <dl className="grid-auto rise rise-3" style={{ margin: 0 }}>
              {c.hero.facts.map((fact) => (
                <div className="card stack-2" key={fact.label}>
                  <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
                    {fact.label}
                  </dt>
                  <dd className="stack-1" style={{ margin: 0, color: "var(--fg1)", fontWeight: 500 }}>
                    <span>{fact.value}</span>
                    {/* Only the cost card carries one. It is already the card
                        answering this question, so the link rides along instead
                        of claiming a section of its own. */}
                    {/* Two of these cards carry a link: the venue points at a
                        map, the cost points at what running it costs. External
                        ones must not get ?lang= appended, which would send a
                        stray query string to Google. */}
                    {fact.href &&
                      (fact.href.startsWith("http") ? (
                        <a
                          href={fact.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "block",
                            fontWeight: 400,
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          {fact.linkLabel}
                        </a>
                      ) : (
                        <Link
                          href={langHref(fact.href, lang)}
                          style={{
                            display: "block",
                            fontWeight: 400,
                            fontSize: "var(--text-sm)",
                          }}
                        >
                          {fact.linkLabel}
                        </Link>
                      ))}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="stack-3 rise rise-4">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
                <a className="btn btn--primary" href="#signup">
                  {c.hero.cta}
                </a>
                <a className="btn btn--secondary" href="#what">
                  {c.hero.ctaSecondary}
                </a>
              </div>

              {nextSession && (
                <span className="pill pill--live" style={{ alignSelf: "flex-start" }}>
                  <span className="dot dot--pulse" aria-hidden="true" />
                  {`${c.hero.nextPrefix}${nextSession.label}`}
                </span>
              )}

              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {c.hero.note}
              </p>
            </div>
          </div>
        </section>

        {/* ── What ─────────────────────────────────────────────────── */}
        <section className="section" id="what">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.what.eyebrow}</span>
              <h2>{c.what.title}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {c.what.lede}
              </p>
            </div>

            <div className="grid-auto">
              {c.what.points.map((point) => (
                <div className="card stack-3" key={point.title}>
                  <h3 className="h3">{point.title}</h3>
                  <p className="body-sm">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Members ──────────────────────────────────────────────────
            Third on the page, straight after "what this is", because it is the
            only section that answers "who would I actually meet" — and that
            question is the whole decision for two different readers: someone
            deciding whether to come, and someone looking for a cofounder, a
            first customer or a partner. It used to sit sixth, behind the
            photos, which is a long way to scroll for the most persuasive thing
            here. Concrete people also answer "do I belong" better than the
            list of categories in "who it is for", which now follows it. */}
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.membersTeaser.eyebrow}</span>
              <h2>{c.membersTeaser.title}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {c.membersTeaser.lede}
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              <Link className="btn btn--primary" href={langHref("/members", lang)}>
                {c.membersTeaser.cta}
              </Link>
              <Link className="btn btn--secondary" href={langHref("/claim", lang)}>
                {c.membersTeaser.ctaSecondary}
              </Link>
            </div>
          </div>
        </section>

        {/* ── The Wharf ────────────────────────────────────────────
            Directly after the wall, because they are the same kind of thing:
            the two parts of this site that get thicker every week. The wall
            answers "who will be there", this answers "what will they want to
            talk about", and the second is the one that gets a stranger to
            walk over to a table.

            Real questions rather than a description of them. Three lines of
            somebody's actual problem make the case that no amount of copy
            about the feature can. */}
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.wharfTeaser.eyebrow}</span>
              <h2>{c.wharfTeaser.title}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {c.wharfTeaser.lede}
              </p>
            </div>

            {featured.length > 0 ? (
              <div className="wharf-rows">
                {featured.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={langHref(`/members/${entry.slug}`, lang)}
                    className="wharf-row"
                  >
                    <span className="wharf-row__q">{entry.topic}</span>
                    <span className="wharf-row__who">{entry.name}</span>
                  </Link>
                ))}
              </div>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
              <Link className="btn btn--secondary" href={langHref("/wharf", lang)}>
                {c.wharfTeaser.cta}
              </Link>
              <span className="body-sm" style={{ color: "var(--fg3)" }}>
                {thisWeekCount > 0
                  ? c.wharfTeaser.count.replace("{n}", String(thisWeekCount))
                  : c.wharfTeaser.empty}
              </span>
            </div>
          </div>
        </section>

        {/* ── Who ──────────────────────────────────────────────────── */}
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.who.eyebrow}</span>
              <h2>{c.who.title}</h2>
            </div>

            <ul
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-2)",
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {c.who.groups.map((group) => (
                <li className="pill" key={group} style={{ textTransform: "none", letterSpacing: 0 }}>
                  {group}
                </li>
              ))}
            </ul>

            <p className="body-sm" style={{ maxWidth: "62ch", color: "var(--fg3)" }}>
              {c.who.note}
            </p>
          </div>
        </section>

        {/* ── Gallery ──────────────────────────────────────────────── */}
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.gallery.eyebrow}</span>
              <h2>{c.gallery.title}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {c.gallery.lede}
              </p>
            </div>

            {/* The albums stay here — they are the most persuasive thing on
                this page — but the full record of a session lives on its own
                page now, and this is the only link to it. */}
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <Link className="btn btn--secondary" href={langHref("/sessions", lang)}>
                {c.gallery.archiveCta}
              </Link>
            </div>

            {/* One album per session, newest first, each closed and shown as a
                stack of prints. Sorting here rather than relying on the order in
                content.ts means adding a session is a one-entry edit that cannot
                be put in the wrong place. <details> keeps the whole thing working
                with no client JS: the stack is the summary, the grid is what it
                opens into. */}
            <div className="albums">
              {[...c.gallery.sessions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((session) => (
                  <details className="album" key={session.date}>
                    <summary className="album__summary">
                      {/* Back to front, so the cover on top is the session's
                          first photo. Reversed here rather than in CSS because
                          z-index would have to fight the DOM order anyway.

                          400w: these are covers a couple of hundred pixels wide
                          and every visitor downloads them, which makes them the
                          only images on the page worth being small. Not lazy for
                          the same reason — they are the section's content, not
                          something below it. */}
                      <div className="album__stack" aria-hidden="true">
                        {session.photos
                          .slice(0, 3)
                          .reverse()
                          .map((photo) => (
                            /* <picture>, not srcSet, because this is a format
                               choice and srcset does not make one: it picks by
                               width and assumes every candidate is decodable,
                               so an AVIF listed there reaches browsers that
                               cannot read it. Only <source type> negotiates. */
                            <picture key={photo.src}>
                              <source type="image/avif" srcSet={`${photo.src}-400.avif`} />
                              <img src={`${photo.src}-400.jpg`} alt="" decoding="async" />
                            </picture>
                          ))}
                      </div>

                      <div className="album__meta">
                        <span className="album__title">
                          {session.title} · {session.date}
                        </span>
                        <span className="album__note">{session.note}</span>
                        <span className="album__count">
                          {c.gallery.photoCount(session.photos.length)}
                        </span>
                      </div>
                    </summary>

                    <div className="gallery">
                      {session.photos.map((photo) => (
                        <figure className="gallery__item" key={photo.src}>
                          {/* Still no next/image: these are static local assets
                              and `scripts/build-photos.mts` has already done the
                              resizing and re-encoding at author time, so an
                              optimiser at request time would repeat the work on
                              every deploy for nothing.

                              `sizes` describes the CSS width, not the file: the
                              gallery is one column on a phone and columns of at
                              least 20rem inside an 880px shell above that, so
                              440px is the widest a photo is ever drawn on a
                              desktop. A phone at 2x therefore wants the 800, and
                              only a retina desktop showing one photo full width
                              reaches for the 1600.

                              Real width/height per photo, not a hard-coded 4:3:
                              two of these are portrait, and declaring the wrong
                              ratio makes the page jump when they load. */}
                          <picture>
                            <source
                              type="image/avif"
                              srcSet={`${photo.src}-800.avif 800w, ${photo.src}-1600.avif 1600w`}
                              sizes="(max-width: 48rem) 100vw, 440px"
                            />
                            <img
                              src={`${photo.src}-1600.jpg`}
                              srcSet={`${photo.src}-800.jpg 800w, ${photo.src}-1600.jpg 1600w`}
                              sizes="(max-width: 48rem) 100vw, 440px"
                              alt={photo.alt}
                              loading="lazy"
                              decoding="async"
                              width={photo.width}
                              height={photo.height}
                            />
                          </picture>
                        </figure>
                      ))}
                    </div>
                  </details>
                ))}
            </div>
          </div>
        </section>

        {/* ── Run of show ──────────────────────────────────────────── */}
        <section className="section" id="schedule">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.schedule.eyebrow}</span>
              <h2>{c.schedule.title}</h2>
            </div>

            <div>
              {c.schedule.slots.map((slot) => (
                <div className="slot" key={slot.time}>
                  <span className="slot__time">{slot.time}</span>
                  <div className="stack-2">
                    <span className="slot__title">{slot.title}</span>
                    <span className="slot__note">{slot.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── House rules ──────────────────────────────────────────── */}
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.rules.eyebrow}</span>
              <h2>{c.rules.title}</h2>
            </div>

            <ol className="stack-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {c.rules.items.map((item, index) => (
                <li className="rule" key={item}>
                  <span className="rule__num">{String(index + 1).padStart(2, "0")}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Signup ───────────────────────────────────────────────── */}
        <section className="section" id="signup">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.signup.eyebrow}</span>
              <h2>{c.signup.title}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {c.signup.lede}
              </p>
            </div>

            <SignupForm
              lang={lang}
              copy={c.signup}
              sessions={sessions}
              turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
            />

            {/* Deliberately outside the form. Someone deciding whether to come
                should see what a session costs before committing — but the
                moment it sits among the fields it reads as a step, and an
                optional thing that looks like a step is no longer optional. */}
            <p className="body-sm" style={{ color: "var(--fg3)", maxWidth: "62ch" }}>
              {c.signup.supportNote}
              <Link href={langHref("/support", lang)}>
                {c.signup.supportNoteCta}
              </Link>
              {c.signup.supportNoteTail}
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className="section">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.faq.eyebrow}</span>
              <h2>{c.faq.title}</h2>
            </div>

            <div className="stack-6">
              {c.faq.items.map((item) => (
                <div className="stack-2" key={item.q}>
                  <h3 className="h3" style={{ fontSize: "var(--text-lg)" }}>
                    {item.q}
                  </h3>
                  {/* The link sits inside the sentence rather than trailing it.
                      An answer that says "pick «mornings do not work»" should
                      make those words the thing you click.

                      Note what is NOT here: `className="body-sm"` on the anchor.
                      `.body-sm` sets a colour and a class outranks the bare `a`
                      rule in globals.css, so styling the anchor that way paints
                      links in body grey and they stop looking like links. The
                      size comes from the paragraph; the anchor only inherits. */}
                  <p className="body-sm" style={{ maxWidth: "62ch" }}>
                    {item.a}
                    {item.href &&
                      (item.href.startsWith("#") ? (
                        // Same-page anchor: routing here would reload the whole
                        // page to scroll a few hundred pixels.
                        <a href={item.href}>{item.linkLabel}</a>
                      ) : (
                        <Link href={langHref(item.href, lang)}>
                          {item.linkLabel}
                        </Link>
                      ))}
                    {item.aTail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────────── */}
        <section className="section" id="contact">
          <div className="shell stack-8">
            <div className="stack-4">
              <span className="eyebrow">{c.contact.eyebrow}</span>
              <h2>{c.contact.title}</h2>
              <p className="body-lg" style={{ maxWidth: "62ch" }}>
                {c.contact.lede}
              </p>
            </div>

            <figure className="qr-card" style={{ margin: 0 }}>
              {/* Intrinsic size is given so the plate does not reflow once the
                  image loads. Not lazy-loaded: someone scrolling here is about
                  to scan it, and a late-arriving QR is a broken QR. */}
              {/* Plain img, not next/image: this is an 8 KB code that has to
                  stay pixel-exact. Anything that resamples or re-encodes it
                  risks a QR that some scanners cannot read, and there is no
                  bandwidth to win here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wechat-qr.png"
                alt={c.contact.alt}
                width={712}
                height={712}
                decoding="async"
              />
              <figcaption>{c.contact.caption}</figcaption>
            </figure>
          </div>
        </section>
      </main>

      <SiteFooter lang={lang} copy={c} support />
    </div>
  );
}
