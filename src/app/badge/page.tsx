import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Avatar } from "@/components/Avatar";
import { BadgeExport } from "@/components/BadgeExport";
import { KeepAwake } from "@/components/KeepAwake";
import { cardTopic, langSuffix } from "@/components/MemberCard";
import { getCopy, resolveLang } from "@/lib/content";
import { getMemberById } from "@/lib/db";
import { currentMemberId } from "@/lib/member-auth";
import { nextThursdays } from "@/lib/sessions";
import { requestOrigin } from "@/lib/request-origin";
import { badgeShowsCode } from "@/lib/members";

type PageProps = {
  /** `in=1`: arrived straight from checking in (AFTER_CHECKIN_PATH). */
  searchParams: Promise<{ lang?: string; in?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: getCopy(resolveLang((await searchParams).lang)).badge.meta.title,
    robots: { index: false },
  };
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
  const params = await searchParams;
  const lang = resolveLang(params.lang);
  const c = getCopy(lang);
  const b = c.badge;
  const justCheckedIn = params.in === "1";

  // No card on this phone yet: go and make one, carrying the "checked in" note.
  const claimHref = `/claim${justCheckedIn ? "?in=1" : ""}${langSuffix(lang, justCheckedIn)}`;

  const memberId = await currentMemberId();
  if (!memberId) redirect(claimHref);

  const member = await getMemberById(memberId);
  if (!member) redirect(claimHref);

  const cardUrl = `${await requestOrigin()}/members/${member.slug}`;
  // The strict reading, on purpose, and unlike the member wall: this is a
  // table tent, propped up in the room on the day. A sentence written for a
  // session three weeks ago would be sitting on the table claiming to be what
  // its owner wants to talk about right now.
  const current = cardTopic(member);
  const topic = current?.session === nextThursdays(1)[0] ? current.topic : null;

  // Dark modules on a white field, never inverted: plenty of scanners fail on a
  // light-on-dark code. Same reasoning as the WeChat QR plate on the home page.
  // No code at all for a card the wall would not show: it would scan to a 404
  // (see `badgeShowsCode`). Null here removes the code and the image export.
  const showCode = badgeShowsCode(member);
  const qr = showCode ? await QRCode.toString(cardUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  }) : null;

  return (
    <div className="badge" lang={c.htmlLang}>
      <KeepAwake />

      <Link className="badge__exit body-sm" href={`/me${langSuffix(lang)}`}>
        {b.exit}
      </Link>

      {justCheckedIn && (
        <p className="body-sm" style={{ color: "var(--accent)", textAlign: "center", margin: 0 }}>
          {b.checkedIn}
        </p>
      )}

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

        {qr && (
          <div className="badge__code">
            {/* Generated server-side by the qrcode library from a URL this app
                built itself, so there is no untrusted markup in here. */}
            <div className="badge__qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <span className="badge__scan mono">{b.scanHint}</span>
          </div>
        )}
      </div>

      {!showCode && (
        <div className="badge__warning">
          {/* Hidden is the organiser's call, not something publishing undoes,
              so it gets its own line and no "publish" button. */}
          <p>{member.hidden ? b.hiddenWarning : b.draftWarning}</p>
          {!member.hidden && (
            <Link className="btn btn--primary" href={`/me${langSuffix(lang)}`}>
              {b.publishCta}
            </Link>
          )}
        </div>
      )}

      {/* The same card as a 3:4 image, for the times the exchange happens in a
          chat rather than across a table. */}
      {qr && <BadgeExport
        copy={b}
        name={member.display_name}
        headline={member.headline}
        lookingFor={member.looking_for}
        topic={topic}
        avatarUrl={member.has_avatar ? `/api/avatar/${member.id}?v=${member.avatar_version}` : null}
        roles={member.roles.map((role) => c.members.roles[role])}
        cardUrl={cardUrl}
        qrSvg={qr}
      />}
    </div>
  );
}
