import Link from "next/link";
import { langSuffix } from "@/components/MemberCard";
import type { ArchiveRow } from "@/lib/archive";
import type { Copy, Lang } from "@/lib/content";
import { formatSession } from "@/lib/sessions";

type Props = {
  row: ArchiveRow;
  lang: Lang;
  copy: Copy["archive"];
  /** Only the first row on a page loads its poster eagerly. */
  eager: boolean;
  /** Where the title links. Omitted on the session's own page. */
  href?: string;
};

/**
 * One session in the archive.
 *
 * Its own file because two pages draw it: the list of every session, and one
 * session's own page, which is this row followed by who checked in. The two
 * must not drift — a row that says one thing in the list and another on its
 * page is the kind of disagreement nobody notices until somebody does.
 */
export function SessionRow({ row, lang, copy: a, eager, href }: Props) {
  const title = row.title ?? a.sessionN.replace("{n}", String(row.index));

  return (
    <li className="archive__row">
      <div className="archive__head">
        <h2 className="archive__title">
          {href ? <Link href={href}>{title}</Link> : title}
        </h2>
        <span className="archive__date mono">
          {formatSession(row.date, lang)}
        </span>
      </div>

      {/* The painted poster for that morning. Above the note
        rather than below it: it is what makes a row of dates
        into a row of mornings, and on a phone it is the thing
        that tells you which session you have scrolled to.

        Only the newest one is eager — it is the first image on
        the page below the totals. Every older poster is below
        the fold on any screen there is. */}
      {row.poster && (
        <picture className="archive__poster">
          <source
            type="image/avif"
            srcSet={`${row.poster}-800.avif 800w, ${row.poster}-1200.avif 1200w`}
            sizes="(max-width: 48rem) 100vw, 832px"
          />
          <img
            src={`${row.poster}-1200.jpg`}
            srcSet={`${row.poster}-800.jpg 800w, ${row.poster}-1200.jpg 1200w`}
            sizes="(max-width: 48rem) 100vw, 832px"
            alt={a.posterAlt.replace("{title}", title)}
            width={1536}
            height={1024}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            decoding="async"
          />
        </picture>
      )}

      {/* The one real headcount on this site, from the day's
        check-ins. Older sessions have no such record and show
        nothing here rather than a zero that would read as
        "nobody came". */}
      {row.attended !== null && (
        <p className="archive__attended mono">
          {a.attended.replace("{n}", String(row.attended))}
        </p>
      )}

      {row.note && <p className="archive__note">{row.note}</p>}

      {row.photos.length > 0 && (
        <div className="stack-2">
          <div className="archive__photos">
            {row.photos.slice(0, 3).map((photo) => (
              <Photo key={photo.src} photo={photo} />
            ))}
          </div>

          {/* The rest fold, and folding them is not only tidiness:
            a closed <details> is never fetched. Four sessions of
            photographs all loaded at once was most of this
            page's weight on a phone, and the poster above is
            what the row is actually for. */}
          {row.photos.length > 3 && (
            <details className="fold">
              <summary>
                {a.morePhotos.replace("{n}", String(row.photos.length - 3))}
              </summary>
              <div className="archive__photos">
                {row.photos.slice(3).map((photo) => (
                  <Photo key={photo.src} photo={photo} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {row.questions.length > 0 && (
        <div className="stack-3">
          <span className="archive__label">{a.questionsLabel}</span>

          {/* One line each, not the Wharf's cards. A session can
            carry a dozen questions and four sessions of cards
            made a page nobody scrolls to the bottom of. The
            first three are open; the rest fold, natively, with
            no script. */}
          <div className="wharf-rows">
            {row.questions.slice(0, 3).map((question) => (
              <Link
                key={question.slug}
                href={`/members/${question.slug}${langSuffix(lang)}`}
                className="wharf-row"
              >
                <span className="wharf-row__q">{question.topic}</span>
                <span className="wharf-row__who">{question.name}</span>
              </Link>
            ))}
          </div>

          {row.questions.length > 3 && (
            <details className="fold">
              <summary>
                {a.moreQuestions.replace(
                  "{n}",
                  String(row.questions.length - 3),
                )}
              </summary>
              <div className="wharf-rows">
                {row.questions.slice(3).map((question) => (
                  <Link
                    key={question.slug}
                    href={`/members/${question.slug}${langSuffix(lang)}`}
                    className="wharf-row"
                  >
                    <span className="wharf-row__q">{question.topic}</span>
                    <span className="wharf-row__who">{question.name}</span>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Who signed up, of the people with a card — the best this site could
        say before check-in existed. A session with a check-in record has the
        real list on its own page, and this stand-in would only contradict it. */}
      {row.attended === null && (
        <div className="stack-2">
          <span className="archive__label">{a.peopleLabel}</span>
          {row.people.length > 0 ? (
            <>
              <p className="archive__people">
                {row.people.map((person, index) => (
                  <span key={person.slug}>
                    {index > 0 && <span aria-hidden="true"> · </span>}
                    <Link href={`/members/${person.slug}${langSuffix(lang)}`}>
                      {person.name}
                    </Link>
                  </span>
                ))}
              </p>
              <p className="body-sm" style={{ color: "var(--fg3)" }}>
                {a.peopleNote}
              </p>
            </>
          ) : (
            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              {a.empty}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** One thumbnail. Extracted only because the archive now draws two sets. */
function Photo({
  photo,
}: {
  photo: { src: string; alt: string; width: number; height: number };
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={`${photo.src}-400.avif`} />
      <img
        src={`${photo.src}-400.jpg`}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
