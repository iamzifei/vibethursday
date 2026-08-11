import type { Metadata } from "next";
import Link from "next/link";
import { SydneySkyline } from "@/components/SydneySkyline";
import { SignupForm } from "@/components/SignupForm";
import { SiteHeader } from "@/components/SiteHeader";
import { copy as allCopy, resolveLang } from "@/lib/content";
import { formatSession, nextThursdays } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const lang = resolveLang((await searchParams).lang);
  const c = allCopy[lang];

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
  const c = allCopy[lang];

  // The time is appended here rather than inside formatSession, which is also
  // used on the member wall to list which sessions someone attended — "8月6日
  // （周四）上午 10:00 · 8月13日（周四）上午 10:00" would be noise there. In the
  // picker it is the point: a bare date lets someone who works weekday
  // mornings choose one without ever registering that it is a morning.
  const sessions = nextThursdays(6).map((value) => ({
    value,
    label: `${formatSession(value, lang)} · ${allCopy[lang].signup.fields.sessionTimeSuffix}`,
  }));

  const nextSession = sessions[0];

  // The document is declared zh-CN in the layout, so the English view
  // re-declares its own language here for screen-reader pronunciation.
  return (
    <div lang={c.htmlLang}>
      <SiteHeader lang={lang} copy={c} switchHref={c.langSwitchHref} />

      <main>
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
                          href={lang === "en" ? `${fact.href}?lang=en` : fact.href}
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
                  {lang === "zh" ? `下一场 ${nextSession.label}` : `Next · ${nextSession.label}`}
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
              <Link className="btn btn--primary" href={lang === "en" ? "/members?lang=en" : "/members"}>
                {c.membersTeaser.cta}
              </Link>
              <Link className="btn btn--secondary" href={lang === "en" ? "/claim?lang=en" : "/claim"}>
                {c.membersTeaser.ctaSecondary}
              </Link>
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

            {/* One folded album per session, newest first. Sorting here rather
                than relying on the order in content.ts means adding a session
                is a one-entry edit that cannot be put in the wrong place.
                <details> keeps this working with no client JS. */}
            <div className="albums">
              {[...c.gallery.sessions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((session, index) => (
                  <details className="album" key={session.date} open={index === 0}>
                    <summary className="album__summary">
                      <span className="album__title">
                        {session.title} · {session.date}
                      </span>
                      <span className="album__note">{session.note}</span>
                      <span className="album__count">
                        {c.gallery.photoCount(session.photos.length)}
                      </span>
                    </summary>

                    <div className="gallery">
                      {session.photos.map((photo) => (
                        <figure className="gallery__item" key={photo.src}>
                          {/* Plain img: these are static local assets and the page
                              is mostly text, so the optimiser buys little here. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.src}
                            alt={photo.alt}
                            loading="lazy"
                            decoding="async"
                            width={1200}
                            height={900}
                          />
                        </figure>
                      ))}
                    </div>
                  </details>
                ))}
            </div>
          </div>
        </section>

        {/* ── Run of show ──────────────────────────────────────────── */}
        <section className="section">
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
              <Link href={lang === "en" ? "/support?lang=en" : "/support"}>
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
                        <Link href={lang === "en" ? `${item.href}?lang=en` : item.href}>
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

      <footer className="section" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div className="shell stack-3">
          <span className="h3 hl">{c.footer.tagline}</span>
          <span className="body-sm mono" style={{ color: "var(--fg3)" }}>
            {c.footer.location}
          </span>
          <span className="body-sm">
            <Link href={lang === "en" ? "/support?lang=en" : "/support"}>
              {c.footer.supportLink}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
