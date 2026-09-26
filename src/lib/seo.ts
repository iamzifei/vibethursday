// Relative, not "@/": the tests load this through Node's type stripper, which
// does not read tsconfig's path aliases.
import { type Copy, LANG_PARAM, type Lang } from "./content.ts";
import { FIRST_SESSION_DATE, formatSession } from "./sessions.ts";
import { siteUrl } from "./site.ts";

/**
 * What search engines and language models are told about this site, beyond
 * the words on the page.
 *
 * Two jobs, both pure functions of the copy bundle so nothing here can drift
 * from what a visitor reads:
 *
 * 1. `pageAlternates` — every public page is one URL in three languages, told
 *    apart by `?lang=`. Without a canonical and hreflang set in the head, a
 *    crawler sees `/?lang=en` as a near-duplicate of `/` and picks one; with
 *    them it sees one page in three languages. The sitemap already says this;
 *    the head has to agree.
 *
 * 2. The JSON-LD builders — the meetup as machine-readable facts. Measured on
 *    2026-09-18: the pages that rank for "ai events sydney" (and that Google's
 *    AI Overview quotes for the Chinese query) all carry an explicit next
 *    date, time and street address. This site had those facts spread across
 *    three cards and a FAQ, in prose. Nothing below is new content; it is the
 *    same facts in the shape a machine can quote.
 *
 * ⚠️ Who this is for. The audience is answer engines — AI Overviews and chat
 * assistants asked "what AI meetups are there in Sydney" — not Google's
 * rich-result cards. Two things follow, both checked against Google's own
 * documentation on 2026-09-18:
 * - Google's Event rich result wants one `Event` per leaf page and says not
 *   to mark up a page that lists several. The home page's `EventSeries` with
 *   its sub-events is therefore not a rich-result path; the per-session
 *   `Event` on `/sessions/<date>` is. The series stays because a series with
 *   the next two dates is exactly what an assistant needs to answer "when is
 *   the next one", and schema.org's vocabulary for that is `EventSeries`.
 * - FAQ rich results stopped appearing in Google Search in May 2026. The
 *   `FAQPage` block is kept for the same reason as the series: the questions
 *   are the ones people ask an assistant, and this is their answers in a form
 *   it can quote. Do not expect a FAQ snippet on the results page from it.
 */

/**
 * The venue, as structured data.
 *
 * ⚠️ Must say the same thing as the venue card and the "具体在哪" FAQ answer in
 * `content.ts`; a test holds the two together. Kept here rather than derived
 * from the prose because a street address parsed out of a sentence is exactly
 * the kind of thing that silently breaks when the sentence is rewritten.
 */
export const VENUE = {
  name: "The Avenue",
  streetAddress: "465 Victoria Avenue",
  addressLocality: "Chatswood",
  addressRegion: "NSW",
  postalCode: "2067",
  addressCountry: "AU",
} as const;

/**
 * Session hours, Sydney time.
 *
 * The same hours are written out in the hero's time card and the run-of-show
 * in `content.ts`, and `sessions.ts` knows the end hour; a test holds the
 * first two to these constants, because the hours changed once already this
 * month and a schema that says 10:00 under a page that says 10:30 is worse
 * than no schema.
 */
export const SESSION_START = "10:30";
export const SESSION_END = "12:00";

/** The `?lang=` suffix for a language, empty for the default. */
function langQuery(lang: Lang): string {
  const param = LANG_PARAM[lang];
  return param ? `?lang=${param}` : "";
}

/**
 * Canonical and hreflang links for one page.
 *
 * `path` is the page without any language on it ("/", "/members"). The
 * canonical is this language's own URL — each language version is a real page
 * that should be indexed as itself, not folded into the Chinese one — and the
 * language set names all three plus `x-default`, which is Simplified Chinese
 * because that is what the bare URL serves. The keys match the sitemap's.
 */
export function pageAlternates(path: string, lang: Lang) {
  const base = siteUrl();

  return {
    canonical: `${base}${path}${langQuery(lang)}`,
    languages: {
      "zh-Hans": `${base}${path}`,
      "zh-Hant": `${base}${path}?lang=zh-Hant`,
      "en-AU": `${base}${path}?lang=en`,
      "x-default": `${base}${path}`,
    },
  };
}

/**
 * Sydney's UTC offset on a given calendar date, e.g. "+10:00" or "+11:00".
 *
 * Read from Intl rather than hard-coded because Sydney observes daylight
 * saving: sessions in October carry a different offset from sessions in
 * September, and a fixed "+10:00" would put every summer session an hour
 * early. Taken at midday UTC of that date, which is 10pm–11pm local the same
 * day — well clear of the 2am changeover, so the offset is the one in force
 * during the session.
 */
export function sydneyOffset(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${isoDate}T12:00:00Z`));

  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+10:00";

  // "GMT+10:00" → "+10:00". A bare "GMT" (never the case for Sydney) would be
  // UTC, which is written "Z" in ISO 8601.
  return name === "GMT" ? "Z" : name.replace("GMT", "");
}

/** Start and end of the session on `isoDate` as full ISO 8601 timestamps. */
export function sessionTimes(isoDate: string): { start: string; end: string } {
  const offset = sydneyOffset(isoDate);
  return {
    start: `${isoDate}T${SESSION_START}:00${offset}`,
    end: `${isoDate}T${SESSION_END}:00${offset}`,
  };
}

/** The language tag schema.org consumers expect for a page in `lang`. */
function inLanguage(lang: Lang): string {
  return lang === "en" ? "en-AU" : lang === "zh-Hant" ? "zh-Hant" : "zh-Hans";
}

function place() {
  return {
    "@type": "Place",
    name: VENUE.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: VENUE.streetAddress,
      addressLocality: VENUE.addressLocality,
      addressRegion: VENUE.addressRegion,
      postalCode: VENUE.postalCode,
      addressCountry: VENUE.addressCountry,
    },
  };
}

/**
 * Free, and said in the vocabulary a crawler checks for.
 *
 * `validFrom` is when sign-up opened: the first session, because the form has
 * been open ever since. Search Console flags an Event offer without one.
 */
function freeOffer(url: string) {
  return {
    "@type": "Offer",
    price: "0",
    priceCurrency: "AUD",
    availability: "https://schema.org/InStock",
    validFrom: `${FIRST_SESSION_DATE}T00:00:00${sydneyOffset(FIRST_SESSION_DATE)}`,
    url,
  };
}

/**
 * Who runs the events, readable on its own.
 *
 * The `@id` ties it to the full Organization block on the home page, but a
 * session page or /sbm carries the Event without that block, so a bare `@id`
 * leaves the organizer nameless there — Search Console reports it as missing
 * `name` and `url`. The two fields repeat what `organizationJsonLd` says.
 */
function organizer() {
  const base = siteUrl();

  return { "@type": "Organization", "@id": `${base}/#organization`, name: "Vibe Thursday", url: base };
}

/**
 * The meetup as an organisation: the thing the events belong to.
 *
 * `sameAs` names the other places on the web that are unambiguously this
 * meetup and not a namesake: the source repository, and the recurring listings
 * on Humanitix and Eventbrite — where people search for events, and which
 * point back here. Both listings are scheduled in batches; the URLs stay the
 * same when more Thursdays are added.
 */
export function organizationJsonLd(c: Copy) {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: "Vibe Thursday",
    alternateName: c.hero.subtitle,
    url: base,
    logo: `${base}/icon.png`,
    sameAs: [
      "https://github.com/iamzifei/vibethursday",
      "https://events.humanitix.com/vibe-thursday-sydney-ai-meetup-chatswood-every-thursday",
      "https://www.eventbrite.com/e/vibe-thursday-sydney-ai-meetup-chatswood-every-thursday-tickets-2002332666908",
    ],
  };
}

/**
 * One session as an Event.
 *
 * `page` says the session has its own page at `/sessions/<date>` — every
 * session that has happened does, and so do the next few Thursdays, which is
 * what Google's Event result needs ("each event must have a unique URL").
 * Past ones carry that morning's poster and photographs; an upcoming one
 * carries the site's own picture and links to the same page, where the
 * sign-up is one click away.
 */
export function eventJsonLd(
  isoDate: string,
  lang: Lang,
  c: Copy,
  options: {
    page?: boolean;
    title?: string;
    description?: string;
    images?: readonly string[];
    /**
     * Where this event lives, when that is neither the home page nor the
     * session's own page — /sbm, which is the address the NSW Small Business
     * Month listing sends people to. Without it the markup would send a
     * crawler to a home page that does not mention the program.
     */
    url?: string;
  } = {},
) {
  const base = siteUrl();
  const { start, end } = sessionTimes(isoDate);
  const dateLabel = options.title ?? formatSession(isoDate, lang);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `Vibe Thursday · ${dateLabel}`,
    description: options.description ?? c.hero.lede,
    startDate: start,
    endDate: end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: place(),
    organizer: organizer(),
    isAccessibleForFree: true,
    offers: freeOffer(options.url ?? `${base}/${langQuery(lang)}#signup`),
    inLanguage: inLanguage(lang),
    image: options.images?.length ? [...options.images] : [`${base}/og.jpg`],
    url:
      options.url ??
      (options.page ? `${base}/sessions/${isoDate}${langQuery(lang)}` : `${base}/${langQuery(lang)}#signup`),
  };
}

/**
 * The weekly series, with the next few sessions as concrete sub-events.
 *
 * The schedule says "every Thursday, 10:30 to 12:00, Sydney time" in the
 * vocabulary for recurring events; the sub-events give a crawler actual dates
 * to quote, which is what an answer to "when is the next one" needs.
 */
export function eventSeriesJsonLd(upcoming: readonly string[], lang: Lang, c: Copy) {
  const base = siteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "EventSeries",
    "@id": `${base}/#series`,
    name: `Vibe Thursday · ${c.hero.subtitle}`,
    description: c.hero.lede,
    url: `${base}/${langQuery(lang)}`,
    startDate: FIRST_SESSION_DATE,
    eventSchedule: {
      "@type": "Schedule",
      byDay: "https://schema.org/Thursday",
      startTime: SESSION_START,
      endTime: SESSION_END,
      repeatFrequency: "P1W",
      scheduleTimezone: "Australia/Sydney",
      startDate: FIRST_SESSION_DATE,
    },
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: place(),
    organizer: organizer(),
    isAccessibleForFree: true,
    offers: freeOffer(`${base}/${langQuery(lang)}#signup`),
    inLanguage: inLanguage(lang),
    image: [`${base}/og.jpg`],
    subEvent: upcoming.map((date) => {
      // Sub-events inherit the context from the series.
      const event: Record<string, unknown> = { ...eventJsonLd(date, lang, c, { page: true }) };
      delete event["@context"];
      return event;
    }),
  };
}

/**
 * The FAQ section as an FAQPage.
 *
 * Each answer is stored split around an optional inline link, because on the
 * page the link sits mid-sentence. Flattened back into one sentence here, the
 * same way `llms.txt` does it.
 */
export function faqJsonLd(c: Copy) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: [item.a, item.linkLabel, item.aTail].filter(Boolean).join(""),
      },
    })),
  };
}

/**
 * Serialises structured data for a `<script type="application/ld+json">`.
 *
 * `<` is escaped so that a string in the copy can never close the script tag
 * early — the same precaution the Next.js docs show. JSON stays valid because
 * `<` is a legal JSON escape for the same character.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
