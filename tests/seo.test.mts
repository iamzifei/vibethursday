/**
 * Structured data and language alternates.
 *
 * Measured 2026-09-18: the pages that rank for "ai events sydney", and the ones
 * Google's AI Overview quotes for the Chinese query, all state a next date, a
 * time and a street address in a form a machine can read. This site had the
 * same facts in prose. These tests pin the machine-readable form to the copy
 * so the two cannot drift apart.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { copy } from "../src/lib/content.ts";
import {
  eventJsonLd,
  eventSeriesJsonLd,
  faqJsonLd,
  pageAlternates,
  serializeJsonLd,
  SESSION_END,
  SESSION_START,
  sessionTimes,
  sydneyOffset,
  VENUE,
} from "../src/lib/seo.ts";

test("every page names its canonical and all three languages", () => {
  const zh = pageAlternates("/members", "zh");
  assert.equal(zh.canonical, "https://vibethursday.com/members");

  const en = pageAlternates("/members", "en");
  assert.equal(en.canonical, "https://vibethursday.com/members?lang=en");

  // The language set is the same whichever language is being viewed, and
  // matches the keys the sitemap uses.
  assert.deepEqual(en.languages, zh.languages);
  assert.deepEqual(Object.keys(zh.languages), ["zh-Hans", "zh-Hant", "en-AU", "x-default"]);
  assert.equal(zh.languages["x-default"], "https://vibethursday.com/members");
  assert.equal(zh.languages["en-AU"], "https://vibethursday.com/members?lang=en");
});

test("★ session times follow Sydney daylight saving", () => {
  // Sydney moves to AEDT on the first Sunday of October. A Thursday either
  // side of the change must carry that side's offset, or every summer session
  // would be published an hour early.
  assert.equal(sydneyOffset("2026-09-24"), "+10:00");
  assert.equal(sydneyOffset("2026-10-08"), "+11:00");

  assert.deepEqual(sessionTimes("2026-09-24"), {
    start: "2026-09-24T10:30:00+10:00",
    end: "2026-09-24T12:00:00+10:00",
  });
});

test("the venue in structured data is the venue on the page", () => {
  // The venue card links to a map of the same address...
  const venueFact = copy.zh.hero.facts.find((fact) => fact.href?.startsWith("https://maps.google.com"));
  assert.ok(venueFact, "the hero has a venue card with a map link");
  for (const part of [VENUE.streetAddress, VENUE.addressLocality, VENUE.postalCode]) {
    assert.ok(venueFact.href?.includes(part.replaceAll(" ", "+")), `map link carries "${part}"`);
  }
  assert.ok(venueFact.value.includes(VENUE.name));

  // ...and the FAQ answer spells it out in full, in both languages.
  const address = `${VENUE.streetAddress}, ${VENUE.addressLocality} ${VENUE.addressRegion} ${VENUE.postalCode}`;
  for (const lang of ["zh", "en"] as const) {
    const answer = copy[lang].faq.items.map((item) => item.a).join("\n");
    assert.ok(answer.includes(address), `${lang} FAQ states "${address}"`);
  }
});

test("the hours in structured data are the hours on the page", () => {
  for (const lang of ["zh", "en"] as const) {
    const c = copy[lang];
    const timeCard = c.hero.facts[0];
    assert.ok(timeCard.value.includes(SESSION_START), `${lang} time card says ${SESSION_START}`);

    // The run-of-show opens at the start time, and its last slot — lunch,
    // for whoever stays — is named by the end time: "12:00 之后" / "From
    // 12:00pm".
    const slots = c.schedule.slots;
    assert.ok(slots[0].time.startsWith(SESSION_START), `${lang} first slot starts at ${SESSION_START}`);
    assert.ok(slots[slots.length - 1].time.includes(SESSION_END), `${lang} last slot is named by ${SESSION_END}`);
  }
});

test("the series is weekly, free, offline, and lists the given sessions", () => {
  const series = eventSeriesJsonLd(["2026-09-24", "2026-10-01"], "en", copy.en);

  assert.equal(series["@type"], "EventSeries");
  assert.equal(series.eventSchedule.byDay, "https://schema.org/Thursday");
  assert.equal(series.eventSchedule.repeatFrequency, "P1W");
  assert.equal(series.isAccessibleForFree, true);
  assert.equal(series.offers.price, "0");
  assert.equal(series.location.address.postalCode, VENUE.postalCode);
  assert.equal(series.url, "https://vibethursday.com/?lang=en");

  assert.equal(series.subEvent.length, 2);
  assert.equal(series.subEvent[0].startDate, "2026-09-24T10:30:00+10:00");
  assert.equal(series.subEvent[1].startDate, "2026-10-01T10:30:00+10:00");
  // Sub-events inherit the context from the series rather than repeating it,
  // and each points at its own page — the one thing Google's Event result
  // insists on.
  assert.equal("@context" in series.subEvent[0], false);
  assert.equal(series.subEvent[0].url, "https://vibethursday.com/sessions/2026-09-24?lang=en");
});

test("a past session points at its own page and pictures", () => {
  const event = eventJsonLd("2026-09-17", "zh", copy.zh, {
    page: true,
    title: "第七场",
    description: "那天的说明",
    images: ["https://vibethursday.com/photos/session-07-1-1600.jpg"],
  });

  assert.equal(event.name, "Vibe Thursday · 第七场");
  assert.equal(event.description, "那天的说明");
  assert.equal(event.url, "https://vibethursday.com/sessions/2026-09-17");
  assert.deepEqual(event.image, ["https://vibethursday.com/photos/session-07-1-1600.jpg"]);
  assert.equal(event.inLanguage, "zh-Hans");

  // An upcoming one with its own page links there; without one, to the form.
  const upcoming = eventJsonLd("2026-09-24", "en", copy.en, { page: true });
  assert.equal(upcoming.url, "https://vibethursday.com/sessions/2026-09-24?lang=en");
  assert.equal(upcoming.inLanguage, "en-AU");
  assert.deepEqual(upcoming.image, ["https://vibethursday.com/og.jpg"]);
  assert.equal(eventJsonLd("2026-09-24", "en", copy.en).url, "https://vibethursday.com/?lang=en#signup");
});

test("the FAQ is the page's FAQ, with inline links folded back into sentences", () => {
  const faq = faqJsonLd(copy.zh);

  assert.equal(faq.mainEntity.length, copy.zh.faq.items.length);

  const cost = faq.mainEntity.find((entry) => entry.name === "要钱吗？");
  assert.ok(cost);
  // The answer on the page is split around a link; here it is one sentence
  // with the link text in its place, so the middle of it is not missing.
  assert.ok(cost.acceptedAnswer.text.includes("这儿有个入口；不搭把手照样来"));
});

test("serialised JSON-LD cannot close its own script tag", () => {
  const out = serializeJsonLd({ text: "</script><b>" });
  assert.equal(out.includes("</script>"), false);
  assert.equal(JSON.parse(out).text, "</script><b>");
});

test("an event names its organizer and when sign-up opened, on its own", () => {
  // Search Console, 2026-09-26: "Missing field 'name' / 'url' (in 'organizer')"
  // and "Missing field 'validFrom' (in 'offers')". A bare `{ "@id" }` organizer
  // only resolves on the home page, where the Organization block also sits; a
  // session page or /sbm carries the Event alone, so the organizer has to be
  // readable without it.
  for (const event of [
    eventJsonLd("2026-10-01", "en", copy.en, { page: true }),
    eventSeriesJsonLd(["2026-10-01"], "zh", copy.zh),
  ]) {
    assert.equal(event.organizer["@type"], "Organization");
    assert.equal(event.organizer["@id"], "https://vibethursday.com/#organization");
    assert.equal(event.organizer.name, "Vibe Thursday");
    assert.equal(event.organizer.url, "https://vibethursday.com");

    // Sign-up has been open since the first session; the offset is Sydney's
    // on that date, like every other timestamp here.
    assert.equal(event.offers.validFrom, "2026-08-06T00:00:00+10:00");
  }
});
