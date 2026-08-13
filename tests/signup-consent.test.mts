/**
 * Guards on the one place the signup form asks to publish something.
 *
 * Signing up and appearing on the member wall used to be two separate acts —
 * claim the card at /claim, then publish it in the editor. Measured 2026-08-13:
 * 56 signups, 14 published cards. The checkbox collapses that funnel, which
 * means the signup form is now the only place anyone is told that "what are you
 * working on" can become public. These tests pin the parts of that promise that
 * could drift without anyone noticing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { copy } from "../src/lib/content.ts";

const LANGS = ["zh", "en"] as const;

test("both languages ask before publishing anything to the wall", () => {
  for (const lang of LANGS) {
    const { publishCard, publishCardHint } = copy[lang].signup.fields;

    assert.ok(
      typeof publishCard === "string" && publishCard.trim().length > 0,
      `${lang} has no label on the publish-to-wall checkbox`,
    );
    assert.ok(
      typeof publishCardHint === "string" && publishCardHint.trim().length > 0,
      `${lang} has no explanation of what publishing to the wall means`,
    );
  }
});

test("the publish hint repeats that contact details stay private", () => {
  // `contactPrivacy` promises email and WeChat ID are the organiser's only.
  // The publish checkbox sits a few lines below it and is about making things
  // public, so it is exactly where someone re-reads that promise as "wait,
  // does this apply to my WeChat ID too". Answering it in the same breath
  // costs one clause; not answering it costs the tick.
  const mentions: Record<(typeof LANGS)[number], RegExp> = {
    zh: /邮箱|微信/,
    en: /email|wechat/i,
  };

  for (const lang of LANGS) {
    assert.match(
      copy[lang].signup.fields.publishCardHint,
      mentions[lang],
      `${lang} publish hint never says what happens to email / WeChat ID`,
    );
  }
});

test("the publish hint says the wall entry can be undone", () => {
  // The card is editable and can be taken down from /me. Saying so is what
  // makes ticking a low-stakes decision rather than a permanent one, and a
  // hint that drops the clause quietly raises the cost of saying yes.
  const undoable: Record<(typeof LANGS)[number], RegExp> = {
    zh: /随时|撤下|改/,
    en: /whenever|any time|take it down|edit/i,
  };

  for (const lang of LANGS) {
    assert.match(
      copy[lang].signup.fields.publishCardHint,
      undoable[lang],
      `${lang} publish hint does not say this is reversible`,
    );
  }
});

test("nothing in the signup copy claims a card exists before one is asked for", () => {
  // The old `topicHint` said the topic "shows on your member card" — true only
  // for the quarter of signups who had claimed one. Now that the checkbox
  // exists the claim can be honoured, but the two strings have to stay in step:
  // if the checkbox copy is ever removed, this hint goes back to over-promising.
  for (const lang of LANGS) {
    const fields = copy[lang].signup.fields;
    const promisesACard = /成员卡片|member card/i.test(fields.topicHint);

    if (!promisesACard) continue;

    assert.ok(
      fields.publishCard.trim().length > 0,
      `${lang} topicHint promises a member card, but nothing on the form offers to create one`,
    );
  }
});
