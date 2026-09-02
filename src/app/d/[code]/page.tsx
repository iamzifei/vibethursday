import type { Metadata } from "next";
import { DeckViewer } from "@/components/DeckViewer";
import { getCopy, resolveLang } from "@/lib/content";
import { clampIndex, isDeckCode } from "@/lib/deck";
import { getDeck } from "@/lib/db";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    title: getCopy(resolveLang((await searchParams).lang)).deck.viewerMeta.title,
    // A room is a moment, not a page: it exists for one talk and is deleted a
    // week later. Indexing it would leave search results pointing at nothing.
    robots: { index: false, follow: false },
  };
}

/**
 * Following a deck from the audience.
 *
 * Reached by scanning the code on the table, so it is deliberately open: no
 * sign-in, no membership, nothing between a stranger at the next chair and the
 * slide being talked about. Same reasoning as `/badge` and the member wall.
 *
 * Rendered without the site's header or footer. This is a screen, not a page —
 * the nav bar would be taking room from the thing everyone is trying to read.
 */
export default async function DeckViewerPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const copy = getCopy(resolveLang((await searchParams).lang)).deck;

  const deck = isDeckCode(code) ? await getDeck(code) : null;

  if (!deck) {
    return (
      <main className="deck">
        <div className="deck__notice stack-4">
          <p className="deck__code-big">{code.slice(0, 8)}</p>
          <p>{copy.notFound}</p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <DeckViewer
        code={deck.code}
        copy={copy}
        // Server-rendered at the page the room is actually on, so a phone that
        // joins mid-talk shows the right slide before any script has run.
        initialIndex={clampIndex(deck.currentIndex, deck.slideCount)}
        initialSlideCount={deck.slideCount}
        initialRev={deck.rev}
      />
    </main>
  );
}
