/**
 * Where and when the Thursday meetup happens, defined once.
 *
 * The home page's venue and time cards (`content.ts` hero.facts), the
 * structured data (`seo.ts`), /go, the admin poster and the WeChat group
 * bot's replies (`bot-signup.ts`) all read these, so a venue or time change
 * is one edit here and they cannot disagree.
 *
 * A leaf module with no imports: the browser bundle and the tests (Node's type
 * stripper) can both load it without pulling in the copy.
 */
export const VENUE = {
  name: "The Avenue",
  streetAddress: "465 Victoria Avenue",
  addressLocality: "Chatswood",
  addressRegion: "NSW",
  postalCode: "2067",
  addressCountry: "AU",
} as const;

/** The map link on the home page's venue card. */
export const VENUE_MAPS_URL = "https://maps.google.com/?q=The+Avenue+465+Victoria+Avenue+Chatswood+NSW+2067";

/** "465 Victoria Avenue, Chatswood": the short address the venue card links with. */
export const VENUE_SHORT_ADDRESS = `${VENUE.streetAddress}, ${VENUE.addressLocality}`;

/** Thursday hours, Sydney time: doors, the session proper, and the end. */
export const THURSDAY_HOURS = { doors: "10:30", start: "10:45", end: "12:00" } as const;

/** "10:30 开门 · 10:45 开始": the home page's time card, without the weekday. */
export const THURSDAY_TIME_ZH = `${THURSDAY_HOURS.doors} 开门 · ${THURSDAY_HOURS.start} 开始`;
