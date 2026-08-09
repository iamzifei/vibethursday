import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Avatar } from "@/components/Avatar";
import { BadgeExport } from "@/components/BadgeExport";
import { KeepAwake } from "@/components/KeepAwake";
import { langSuffix, weeklyTopic } from "@/components/MemberCard";
import { copy as allCopy, resolveLang } from "@/lib/content";
import { getMemberById } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";
import { nextThursdays } from "@/lib/sessions";

type PageProps = {
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: allCopy[resolveLang((await searchParams).lang)].badge.meta.title,
    robots: { index: false },
  };
}

/**
 * The absolute origin, for a URL that has to survive being scanned by a phone
 * that is not this one. NEXT_PUBLIC_SITE_URL is the answer in production; the
 * request host covers local development, where that variable is usually unset.
 */
async function origin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;

  const store = await headers();
  const raw = store.get("host") ?? "";

  // The Host header is client-supplied. Nothing downstream would be injectable
  // (the QR encoder turns its input into modules, not markup), but a crafted
  // host would still produce a code pointing somewhere else, so anything that
  // is not a plain hostname[:port] is discarded rather than trusted.
  const host = /^[A-Za-z0-9.-]+(:\d+)?$/.test(raw) ? raw : "localhost:3000";

  // Loopback is the only case that is not HTTPS. Matching on "localhost" alone
  // gave a 127.0.0.1 dev server an https:// QR that nothing could open.
  const proto = /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";

  return `${proto}://${host}`;
}

/**
 * A name badge for the table.
 *
 * The first session's retro recorded that people arriving late never wrote a
 * paper name tag, so nobody knew who was talking. A phone standing on the table
 * fixes that with no printing, no pens and nobody assigned to hand them out —
 * and the QR turns the same screen into the card exchange, because scanning it
 * lands on a page that already says what this person is looking for.
 */
export default async function BadgePage({ searchParams }: PageProps) {
  const lang = resolveLang((await searchParams).lang);
  const c = allCopy[lang];
  const b = c.badge;

  const memberId = await currentMemberId();
  if (!memberId) redirect(`/claim${langSuffix(lang)}`);

  const member = await getMemberById(memberId);
  if (!member) redirect(`/claim${langSuffix(lang)}`);

  const cardUrl = `${await origin()}/members/${member.slug}`;
  const topic = weeklyTopic(member, nextThursdays(1)[0]);

  // Dark modules on a white field, never inverted: plenty of scanners fail on a
  // light-on-dark code. Same reasoning as the WeChat QR plate on the home page.
  const qr = await QRCode.toString(cardUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  return (
    <div className="badge" lang={c.htmlLang}>
      <KeepAwake />

      <Link className="badge__exit body-sm" href={`/me${langSuffix(lang)}`}>
        {b.exit}
      </Link>

      <div className="badge__main">
        <div className="badge__who">
          {member.has_avatar && (
            <Avatar
              id={member.id}
              name={member.display_name}
              hasAvatar={member.has_avatar}
              version={member.avatar_version}
              size="lg"
            />
          )}

          <span className="badge__name">{member.display_name}</span>

          {member.headline && <p className="badge__headline">{member.headline}</p>}

          {/* Same two lines the card shows, in the same order, so the badge
              and the wall never disagree about what someone is after. */}
          {topic && (
            <p className="badge__looking">
              <span aria-hidden="true">📌</span> {topic}
            </p>
          )}

          {member.looking_for && (
            <p className="badge__looking">
              <span aria-hidden="true">🔎</span> {member.looking_for}
            </p>
          )}

          {member.roles.length > 0 && (
            <div className="badge__roles">
              {member.roles.map((role) => (
                <span className="chip" key={role}>
                  {c.members.roles[role]}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="badge__code">
          {/* Generated server-side by the qrcode library from a URL this app
              built itself, so there is no untrusted markup in here. */}
          <div className="badge__qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <span className="badge__scan mono">{b.scanHint}</span>
        </div>
      </div>

      {!member.published && <p className="badge__warning">{b.draftWarning}</p>}

      {/* The same card as a 3:4 image, for the times the exchange happens in a
          chat rather than across a table. */}
      <BadgeExport
        copy={b}
        name={member.display_name}
        headline={member.headline}
        lookingFor={member.looking_for}
        topic={topic}
        avatarUrl={member.has_avatar ? `/api/avatar/${member.id}?v=${member.avatar_version}` : null}
        roles={member.roles.map((role) => c.members.roles[role])}
        cardUrl={cardUrl}
        qrSvg={qr}
      />
    </div>
  );
}
