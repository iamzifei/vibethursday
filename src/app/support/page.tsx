import type { Metadata } from "next";
import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import { SiteHeader } from "@/components/SiteHeader";
import { copy as allCopy, resolveLang } from "@/lib/content";
import { CONTRIBUTORS, SUPPORT_URL } from "@/lib/support";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const c = allCopy[resolveLang((await searchParams).lang)].support;

  return { title: c.meta.title, description: c.meta.description };
}

/**
 * What the meetup costs, and where to chip in if you want to.
 *
 * The order of this page is the argument. "It is free" comes first, the bill
 * second, and the way to chip in only after both — reversed, the same facts
 * read as the opening move of charging for entry, which is the one impression
 * this page has to avoid.
 *
 * There is no ledger here by decision. An earlier version published what came
 * in and went out each session; see `@/lib/support` for what that gave up and
 * why nothing on the page implies otherwise.
 */
export default async function SupportPage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = allCopy[lang];
  const s = c.support;

  return (
    <div lang={c.htmlLang}>
      <SiteHeader
        lang={lang}
        copy={c}
        switchHref={lang === "zh" ? "/support?lang=en" : "/support"}
      />

      <main>
        <section className="section">
          <div className="shell stack-8" style={{ maxWidth: "680px" }}>
            <div className="stack-4">
              <span className="eyebrow">{s.eyebrow}</span>
              <h1>{s.title}</h1>
              <p className="body-lg">{s.lede}</p>
            </div>

            {/* ── The bill ─────────────────────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.costTitle}</h2>

              <dl className="stack-3" style={{ margin: 0 }}>
                {s.costItems.map((item) => (
                  <div className="card stack-2" key={item.label}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: "var(--space-3)",
                      }}
                    >
                      <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
                        {item.label}
                      </dt>
                      <dd
                        className="mono"
                        style={{ margin: 0, color: "var(--fg1)", fontWeight: 600 }}
                      >
                        {item.value}
                      </dd>
                    </div>
                    <dd className="body-sm" style={{ margin: 0 }}>
                      {item.note}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {s.costNote}
              </p>
            </div>

            {/* ── The ask ──────────────────────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.askTitle}</h2>
              <p className="body-sm">{s.askBody}</p>
              {/* An amount, without an amount being owed. Left out entirely,
                  people guess — and the guesses land wildly on both sides,
                  which is its own kind of awkward. */}
              <p className="body-sm">{s.askScaleNote}</p>
              {/* Lives here rather than only next to the list, because the list
                  is hidden while empty and this is how it stops being empty. */}
              <p className="body-sm">{s.askOptIn}</p>

              <a
                className="btn btn--primary"
                href={SUPPORT_URL}
                style={{ alignSelf: "flex-start" }}
                rel="noopener noreferrer"
                target="_blank"
              >
                {s.linkCta}
              </a>
            </div>

            {/* ── Contributors ─────────────────────────────────────── */}
            {/* Hidden entirely until someone is on it. A wall with two names
                looks worse than no wall — the same reason the member wall
                ships prefilled drafts rather than an empty grid. */}
            {CONTRIBUTORS.length > 0 && (
              <div className="stack-4">
                <h2 className="h3">{s.thanksTitle}</h2>
                <p className="body-sm">{s.thanksLede}</p>

                <ul
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--space-3)",
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {CONTRIBUTORS.map((person) => (
                    <li className="card stack-2" key={person.name}>
                      <span style={{ color: "var(--fg1)", fontWeight: 600 }}>
                        {person.slug ? (
                          <Link href={`/members/${person.slug}${langSuffix(lang)}`}>
                            {person.name}
                          </Link>
                        ) : (
                          person.name
                        )}
                      </span>
                      <span className="body-sm" style={{ color: "var(--fg3)" }}>
                        {person.kinds.map((kind) => s.thanksKinds[kind]).join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="body-sm" style={{ color: "var(--fg3)" }}>
                  {s.thanksNote}
                </p>
              </div>
            )}

            {/* ── The promises ─────────────────────────────────────── */}
            <div className="stack-4">
              <h2 className="h3">{s.rulesTitle}</h2>
              <ol className="stack-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {s.rules.map((rule, index) => (
                  <li className="rule" key={rule}>
                    <span className="rule__num">{String(index + 1).padStart(2, "0")}</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="body-sm">
              <Link href={`/${langSuffix(lang)}`}>{s.back}</Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
