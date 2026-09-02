import type { Metadata } from "next";
import QRCode from "qrcode";
import { DeckPresenter } from "@/components/DeckPresenter";
import { getCopy, resolveLang } from "@/lib/content";
import { clampIndex, isDeckCode, keyMatches } from "@/lib/deck";
import { getDeck } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string; lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: getCopy(resolveLang((await searchParams).lang)).deck.meta.title,
    robots: { index: false, follow: false },
  };
}

/**
 * Building and running a deck.
 *
 * The presenter key is in the URL rather than a cookie on purpose: the useful
 * shape of this is "assemble the deck on a laptop, then open the same link on
 * the phone you will actually be holding", and a cookie would tie control to
 * one browser. What the room scans is a different URL — `/d/<code>` — which
 * carries no key at all.
 */
export default async function PresentPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const query = await searchParams;
  const copy = getCopy(resolveLang(query.lang)).deck;

  const deck = isDeckCode(code) ? await getDeck(code) : null;

  // One message for "no such room" and for "wrong key". Telling an unauthorised
  // visitor that the room exists tells them the code is worth guessing at.
  if (!deck || !keyMatches(query.k, deck.presenterKey)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">{copy.notFound}</h1>
        </div>
      </main>
    );
  }

  const joinUrl = `${await requestOrigin()}/d/${deck.code}`;

  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    margin: 1,
    width: 480,
    // Black on white regardless of the site's palette: this is scanned across a
    // table under café lighting, and contrast beats matching the page.
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  return (
    <main className="shell section stack-8">
      <div className="stack-3">
        <h1 className="h3">{copy.title}</h1>
        <p className="body-sm">{copy.lede}</p>
      </div>

      <DeckPresenter
        code={deck.code}
        presenterKey={query.k!}
        copy={copy}
        joinUrl={joinUrl}
        qrDataUrl={qrDataUrl}
        initialSlideCount={deck.slideCount}
        initialRev={deck.rev}
        initialIndex={clampIndex(deck.currentIndex, deck.slideCount)}
      />
    </main>
  );
}
