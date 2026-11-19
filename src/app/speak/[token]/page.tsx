import type { Metadata } from "next";
import QRCode from "qrcode";
import { DeckPresenter } from "@/components/DeckPresenter";
import { SpeakerBrief } from "@/components/SpeakerBrief";
import { getCopy, resolveLang } from "@/lib/content";
import { clampIndex } from "@/lib/deck";
import { ensureSpeakerDeck, getDeck, getSpeakerShare } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";
import { formatSession } from "@/lib/sessions";
import { BRIEF_FIELDS, SPEAKER_REVIEW_LIMIT, type Brief } from "@/lib/speak";
import { verifySpeakerToken } from "@/lib/speak-token";
import { reviewAvailable } from "@/lib/speak-review";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: getCopy(resolveLang((await searchParams).lang)).speak.meta.title,
    robots: { index: false, follow: false },
  };
}

const EMPTY_BRIEF = Object.fromEntries(BRIEF_FIELDS.map((field) => [field, ""])) as Brief;

/**
 * A picked speaker's hand-in page (2026-11-19, speak.ts).
 *
 * The link is the only key: it names one person and one morning and stops
 * working at the end of that day. The phone-follow room for their slides is
 * opened here on the first visit, so the room code and presenter link exist
 * before Thursday and nobody has to open one at the table.
 */
export default async function SpeakPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const lang = resolveLang((await searchParams).lang);
  const all = getCopy(lang);
  const copy = all.speak;

  // The token is only URL-safe characters, so it arrives exactly as issued.
  const who = verifySpeakerToken(token);
  const share = who ? await getSpeakerShare(who.session, who.signupId).catch(() => null) : null;

  // One message for a bad link, an expired one and an undone pick: none of
  // them should tell a stranger whether the other parts were right.
  if (!who || !share) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <p className="body">{copy.invalid}</p>
        </div>
      </main>
    );
  }

  const date = formatSession(who.session, lang);
  const room = await ensureSpeakerDeck(who.session, who.signupId, `${date} · ${share.name}`).catch((error) => {
    console.error("[speak] could not open the speaker's room", error);
    return null;
  });
  const deck = room ? await getDeck(room.code) : null;

  const origin = await requestOrigin();
  const joinUrl = room ? `${origin}/d/${room.code}` : "";
  const presenterUrl = room ? `${origin}/present/${room.code}?k=${room.key}` : "";
  const qrDataUrl = room
    ? await QRCode.toDataURL(joinUrl, { margin: 1, width: 480, color: { dark: "#0a0b0d", light: "#ffffff" } })
    : "";

  const stale = Boolean(share.review && share.briefAt && share.reviewedAt && share.briefAt > share.reviewedAt);

  return (
    <main className="shell section stack-12">
      <header className="stack-4">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="h2" style={{ margin: 0 }}>{copy.title.replace("{date}", date)}</h1>

        <div className="card card--accent stack-2">
          <p className="label" style={{ margin: 0 }}>{copy.themeLabel}</p>
          <p className="body" style={{ margin: 0 }}>{share.theme ?? copy.themeNone}</p>
        </div>

        <p className="body">{copy.greeting.replace("{name}", share.name)}</p>
        <ol className="stack-2 body-sm" style={{ margin: 0, paddingLeft: "1.25em" }}>
          {copy.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </header>

      <SpeakerBrief
        token={token}
        copy={copy}
        initialBrief={share.brief ?? EMPTY_BRIEF}
        initialReview={share.review}
        initialStale={stale}
        reviewsLeft={Math.max(0, SPEAKER_REVIEW_LIMIT - share.reviewCount)}
        reviewOn={reviewAvailable()}
        slides={
          <section className="stack-4">
            <h2 className="h3" style={{ margin: 0 }}>{copy.slidesTitle}</h2>
            <p className="body-sm">{copy.slidesLede}</p>
            <p className="field-hint">{copy.slidesTextNote}</p>
            {room && deck ? (
              <>
                <p className="body-sm">
                  {copy.presenterLink} <a className="mono hl" href={presenterUrl} style={{ wordBreak: "break-all" }}>{presenterUrl}</a>
                </p>
                <DeckPresenter
                  code={room.code}
                  presenterKey={room.key}
                  copy={all.deck}
                  joinUrl={joinUrl}
                  qrDataUrl={qrDataUrl}
                  initialSlideCount={deck.slideCount}
                  initialRev={deck.rev}
                  initialIndex={clampIndex(deck.currentIndex, deck.slideCount)}
                />
              </>
            ) : (
              <p className="body-sm hl">{copy.slidesUnavailable}</p>
            )}
          </section>
        }
      />
    </main>
  );
}
