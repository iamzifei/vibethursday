/**
 * Build Tuesday goes online, and the 共创会员 becomes a 4-week cohort
 * (2026-11-05).
 *
 * From Tuesday 10 November the session is online, 10:30–12:00 Sydney time:
 * James builds a real product live with AI. There is no per-session ticket any
 * more. The 共创会员 is now A$599 + GST paid once (no subscription, no
 * renewal) for one cohort of four Tuesdays; the first cohort is 10, 17, 24
 * November and 1 December. Who may join an online Tuesday: a current
 * 共创会员 (old or new) or someone on the 导师团.
 *
 * People who bought before this change are not affected: the 10/25 class and
 * the yearly membership keep a year from payment, Tuesdays free and the
 * AI+IP class free. The new 4-week orders are told apart by their own course
 * id, so the old rule is never touched.
 *
 * Database checks run against a throwaway local Postgres:
 *   COURSE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55433/vt_x npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  COURSE,
  MEMBERSHIP,
  MEMBERSHIP_COHORTS,
  MEMBERSHIP_COURSES,
  YEARLY_MEMBERSHIP_COURSES,
  YEARLY_MEMBERSHIP_ID,
  cohortForPayment,
  cohortOnSale,
  cohortValidUntilSql,
  PAYMENT_GRACE_MS,
  includesIpClass,
  membershipValidUntil,
  newMemberRef,
} from "../src/lib/course.ts";
import { feeFor, isOnlineSession, SPECIAL_SESSIONS } from "../src/lib/sessions.ts";
import { TUESDAY_ONLINE } from "../src/lib/tuesday-venue.ts";
import { copy } from "../src/lib/content.ts";
import { CHECKOUT_MINUTES } from "../src/lib/stripe-pay.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/** A Sydney wall-clock time as an instant. November is AEDT, UTC+11. */
const sydney = (isoLocal: string) => new Date(`${isoLocal}+11:00`);

/* ── The cohort ──────────────────────────────────────────────────────────── */

test("the first cohort is the four Tuesdays from 10 November", () => {
  assert.deepEqual([...MEMBERSHIP_COHORTS[0].tuesdays], ["2026-11-10", "2026-11-17", "2026-11-24", "2026-12-01"]);
  for (const cohort of MEMBERSHIP_COHORTS) {
    assert.equal(cohort.tuesdays.length, 4, "four weeks each");
    for (const date of cohort.tuesdays) assert.equal(new Date(`${date}T00:00:00Z`).getUTCDay(), 2, `${date} is a Tuesday`);
  }
});

test("★ a new membership is its own course id, still A$599 + GST, and counts as a membership", () => {
  assert.notEqual(MEMBERSHIP.id, YEARLY_MEMBERSHIP_ID, "new orders are told apart by their id");
  assert.equal(MEMBERSHIP.price, 599);
  assert.equal(MEMBERSHIP.amount, 658.9);
  assert.ok((MEMBERSHIP_COURSES as readonly string[]).includes(MEMBERSHIP.id));
  assert.deepEqual([...YEARLY_MEMBERSHIP_COURSES], [COURSE.id, YEARLY_MEMBERSHIP_ID]);
});

test("★ bought any time before cohort 1 ends: valid to the end of 1 December (Sydney)", () => {
  const end = sydney("2026-12-02T00:00:00");
  assert.equal(membershipValidUntil(MEMBERSHIP.id, sydney("2026-11-05T15:00:00"))?.getTime(), end.getTime());
  assert.equal(membershipValidUntil(MEMBERSHIP.id, sydney("2026-11-20T09:00:00"))?.getTime(), end.getTime(), "joining mid-cohort");
  // Review 2026-11-05: sales close at the start of the last Tuesday, and a
  // Checkout opened just before still counts if paid within the hour.
  assert.equal(membershipValidUntil(MEMBERSHIP.id, sydney("2026-11-30T23:59:00"))?.getTime(), end.getTime(), "the night before the last Tuesday");
  assert.equal(membershipValidUntil(MEMBERSHIP.id, sydney("2026-12-01T00:45:00"))?.getTime(), end.getTime(), "a Checkout opened before the close, paid just after");
  assert.equal(cohortForPayment(sydney("2026-11-05T15:00:00"))?.tuesdays[0], "2026-11-10");
});

test("★ a new membership paid after the last cohort has no cohort and makes no member", () => {
  assert.equal(cohortForPayment(sydney("2026-12-03T10:00:00")), null);
  assert.equal(membershipValidUntil(MEMBERSHIP.id, sydney("2026-12-03T10:00:00")), null);
});

test("★ old orders are unchanged: a year and a week from payment", () => {
  const paid = new Date("2026-10-25T02:00:00Z");
  const expected = new Date("2027-11-01T02:00:00Z"); // + 1 year 7 days
  assert.equal(membershipValidUntil(COURSE.id, paid)?.getTime(), expected.getTime(), "the 10/25 class");
  assert.equal(membershipValidUntil(YEARLY_MEMBERSHIP_ID, paid)?.getTime(), expected.getTime(), "the yearly membership");
  assert.equal(membershipValidUntil("2026-11-15-ai-ip", paid), null, "the AI+IP class is never a membership");
});

test("★ only the old memberships include the free AI+IP class", () => {
  assert.equal(includesIpClass(COURSE.id), true);
  assert.equal(includesIpClass(YEARLY_MEMBERSHIP_ID), true);
  assert.equal(includesIpClass(MEMBERSHIP.id), false);
});

test("★ cohort 1 is on sale until the start of 1 December; after that the next cohort is not set (review 2026-11-05)", () => {
  // Before: on sale until 12:00 on the last Tuesday, so a Checkout opened at
  // 11:50 and paid at 12:10 took the full price for a cohort already over.
  assert.equal(cohortOnSale(sydney("2026-11-05T15:00:00"))?.tuesdays[0], "2026-11-10");
  assert.equal(cohortOnSale(sydney("2026-11-30T23:59:00"))?.tuesdays[0], "2026-11-10");
  assert.equal(cohortOnSale(sydney("2026-12-01T00:00:00")), null);
  assert.equal(cohortOnSale(sydney("2026-12-01T11:50:00")), null);
});

test("★ a payment counts for the cohort that was on sale when its Checkout opened (review 2026-11-05)", () => {
  // Before: a payment counted for any cohort not yet over, so once a second
  // cohort is listed, someone sold cohort 2 on the morning of cohort 1's last
  // Tuesday would have been recorded as cohort 1 and lost access at midnight.
  // The rule: the first cohort whose sale had not closed an hour before the
  // payment, the hour covering a Checkout page's whole life.
  assert.ok(PAYMENT_GRACE_MS > (CHECKOUT_MINUTES * 60 + 90) * 1000, "the grace outlasts any Checkout page");
  assert.equal(cohortForPayment(sydney("2026-12-01T00:30:00"))?.tuesdays[0], "2026-11-10");
  assert.equal(cohortForPayment(sydney("2026-12-01T10:00:00")), null, "nothing was on sale then");
  for (const at of ["2026-11-05T15:00:00", "2026-11-30T23:59:00"]) {
    assert.equal(cohortForPayment(sydney(at)), cohortOnSale(sydney(at)), `sold and recorded as the same cohort at ${at}`);
  }
});

test("the SQL cohort end is built from the same list, from constants only", () => {
  const sql = cohortValidUntilSql("o.paid_at");
  assert.match(sql, /^CASE /);
  assert.match(sql, /'2026-12-02 00:00 Australia\/Sydney'::timestamptz/);
  assert.doesNotMatch(sql, /\$\d/, "no parameters: nothing from input");
});

/* ── Tuesday itself ──────────────────────────────────────────────────────── */

test("★ no fee from 10 November; past Tuesdays keep their fee", () => {
  assert.equal(feeFor("2026-10-20"), 30);
  assert.equal(feeFor("2026-10-27"), 30);
  assert.equal(feeFor("2026-11-03"), 30);
  for (const session of SPECIAL_SESSIONS.filter((s) => s.date >= "2026-11-10")) {
    assert.equal(feeFor(session.date), null, `${session.date} has no fee`);
    assert.equal(isOnlineSession(session.date), true, `${session.date} is online`);
    assert.equal(session.endHour, 12, "over by 12:00");
  }
  assert.equal(isOnlineSession("2026-11-03"), false);
  assert.equal(isOnlineSession("2026-11-12"), false, "a Thursday");
  assert.ok(SPECIAL_SESSIONS.some((s) => s.date === "2026-11-10"));
});

test("online Tuesday runs 10:30–12:00", () => {
  assert.equal(TUESDAY_ONLINE.start, "10:30");
  assert.equal(TUESDAY_ONLINE.end, "12:00");
});

/* ── How people get in: a WeChat group, no link on the site ──────────────── */

// Spec change 2026-11-05 (owner, same day): there is no meeting link on the
// website at all. Before each Tuesday James adds the people who may join to a
// WeChat group for that session and posts the Zoom link there.
test("★ the site carries no meeting link and reads no link variable", () => {
  for (const file of ["src/lib/tuesday-venue.ts", "src/components/TuesdayVenue.tsx", "src/lib/content.ts", "src/app/api/signup/route.ts", "src/app/my/page.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /TUESDAY_ONLINE_URL/, file);
    assert.doesNotMatch(source, /zoom\.us|meeting\.tencent|meet\.google|teams\.microsoft/i, file);
  }
});

test("★ where the address used to show, an online Tuesday says how to get in", () => {
  assert.equal(TUESDAY_ONLINE.zh.howToJoin, "每周二开始前，我会拉一个临时微信群，Zoom 链接发在群里。");
  assert.equal(TUESDAY_ONLINE.en.howToJoin, "Before each Tuesday starts, James adds you to a WeChat group for that session and posts the Zoom link there.");
  const venue = read("src/components/TuesdayVenue.tsx");
  assert.match(venue, /isOnlineSession\(/);
  assert.match(venue, /howToJoin/);
});

test("the signup and /my show it only through the entitlement check", () => {
  assert.match(read("src/app/api/signup/route.ts"), /canJoinOnlineTuesday\(/);
  assert.match(read("src/app/my/page.tsx"), /canJoinOnlineTuesday\(/);
});

/* ── /join is a one-off payment ──────────────────────────────────────────── */

test("★ the membership Checkout is a one-off payment, not a subscription", async () => {
  assert.doesNotMatch(read("src/lib/card-pay.ts"), /recurring:\s*"year"/);
  const { createCheckout } = await import("../src/lib/stripe-pay.ts");
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  process.env.STRIPE_SECRET_KEY = "sk_test_x";
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    sent.push(String(init?.body ?? ""));
    return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout", status: "open", payment_status: "unpaid", metadata: {} }), { status: 200 });
  }) as typeof fetch;
  try {
    await createCheckout({
      kind: "member", ref: "CMABCDE", signupId: "", session: MEMBERSHIP.id, amount: MEMBERSHIP.amount,
      title: "x", successUrl: "https://s", cancelUrl: "https://c", idempotencyKey: "k",
    });
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.STRIPE_SECRET_KEY;
  }
  const form = new URLSearchParams(sent[0]);
  assert.equal(form.get("mode"), "payment");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "65890");
  assert.equal([...form.keys()].some((key) => key.includes("recurring")), false);
});

/* ── Copy ────────────────────────────────────────────────────────────────── */

const TUESDAY_COPY = (lang: "zh" | "en") => {
  const c = copy[lang];
  return JSON.stringify([
    c.tuesday,
    c.signup.compare.tuesday,
    c.signup.memberUpsell,
    c.paths.items.find((p: { key: string }) => p.key === "tuesday"),
  ]);
};

test("★ Tuesday copy names no ticket price, in either language", () => {
  assert.doesNotMatch(TUESDAY_COPY("zh"), /30 澳元/);
  assert.doesNotMatch(TUESDAY_COPY("en"), /A\$30\b/);
});

test("★ Tuesday copy says online and 10:30–12:00", () => {
  for (const lang of ["zh", "en"] as const) {
    const text = TUESDAY_COPY(lang);
    assert.match(text, lang === "zh" ? /线上/ : /online/i, `${lang} says online`);
    assert.match(text, /10:30–12:00/, `${lang} time`);
    assert.doesNotMatch(text, /12:30/, `${lang} old end time`);
  }
});

test("★ new-membership copy has no auto-renewal and no year", () => {
  const sources = [
    JSON.stringify(copy.zh.tuesday.memberUpsell),
    JSON.stringify(copy.zh.signup.memberUpsell),
    read("src/app/join/page.tsx").split("export default")[0],
  ];
  for (const source of sources) {
    assert.doesNotMatch(source, /自动续费/);
    assert.doesNotMatch(source, /一年/);
  }
  assert.doesNotMatch(JSON.stringify(copy.en.tuesday.memberUpsell), /renew|a year/i);
  assert.doesNotMatch(JSON.stringify(copy.en.signup.memberUpsell), /renew|a year/i);
});

test("/join says 4 weeks, names the cohort dates, and offers no payment when no cohort is set", () => {
  const page = read("src/app/join/page.tsx");
  assert.match(page, /cohortOnSale\(/);
  assert.match(page, /下一期日期待定/);
  assert.match(page, /4 周/);
});

/* ── Against a database ──────────────────────────────────────────────────── */

const db = process.env.COURSE_TEST_DATABASE_URL;

test(
  "★ SQL and code agree on validity; old orders keep their year; new ones last to the cohort's end",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { ensureSchema, getPool, isMember, hasYearMembership, canJoinOnlineTuesday, setPersonRole } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();

    // The SQL cohort end matches the code's, for times either side of each boundary.
    for (const at of ["2026-11-05T15:00:00", "2026-12-01T00:59:00", "2026-12-01T01:01:00", "2026-12-01T23:59:00", "2027-03-01T10:00:00"]) {
      const instant = sydney(at);
      const row = (await pool.query<{ until: Date | null }>(`SELECT ${cohortValidUntilSql("$1::timestamptz")} AS until`, [instant])).rows[0];
      assert.equal(row.until?.getTime() ?? null, membershipValidUntil(MEMBERSHIP.id, instant)?.getTime() ?? null, at);
    }

    const stamp = Date.now();
    const made: string[] = [];
    const refs: string[] = [];
    const signup = async (name: string) => {
      const id = (await pool.query<{ id: string }>(`INSERT INTO signups (name, wechat) VALUES ($1, $2) RETURNING id::text AS id`, [name, `${name}-${stamp}`])).rows[0].id;
      made.push(id);
      return id;
    };
    const order = async (course: string, name: string, paidAt: string) => {
      const ref = newMemberRef();
      refs.push(ref);
      await pool.query(
        `INSERT INTO course_orders (course, name, wechat, ref, status, paid_at) VALUES ($1, $2, $3, $4, 'paid', ${paidAt})`,
        [course, name, `${name}-${stamp}`, ref],
      );
    };

    try {
      const old = await signup("olda");
      await order(YEARLY_MEMBERSHIP_ID, "olda", "now() - interval '300 days'");
      assert.equal(await isMember(old), true, "an old yearly order 300 days on still counts");
      assert.equal(await hasYearMembership(old), true, "and still includes the AI+IP class");
      assert.equal(await canJoinOnlineTuesday(old), true);

      const lapsed = await signup("oldb");
      await order(COURSE.id, "oldb", "now() - interval '1 year 8 days'");
      assert.equal(await isMember(lapsed), false, "past a year and a week, as before");

      const fresh = await signup("newa");
      await order(MEMBERSHIP.id, "newa", "now()");
      assert.equal(await isMember(fresh), true, "a 4-week order inside cohort 1");
      assert.equal(await hasYearMembership(fresh), false, "no free AI+IP class");
      assert.equal(await canJoinOnlineTuesday(fresh), true);

      const late = await signup("newb");
      await order(MEMBERSHIP.id, "newb", "'2026-12-03 10:00 Australia/Sydney'::timestamptz");
      assert.equal(await isMember(late), false, "paid after the last cohort: no cohort, no membership");

      const mentor = await signup("menta");
      await setPersonRole(mentor, "mentor", null);
      assert.equal(await canJoinOnlineTuesday(mentor), true, "the 导师团 may join");
      assert.equal(await isMember(mentor), false);

      const builder = await signup("builda");
      await setPersonRole(builder, "builder", null);
      assert.equal(await canJoinOnlineTuesday(builder), false, "共建者 are no longer free");

      const nobody = await signup("nobod");
      assert.equal(await canJoinOnlineTuesday(nobody), false);
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE ref = ANY($1::text[])`, [refs]).catch(() => {});
      await pool.query(`DELETE FROM person_roles WHERE signup_id = ANY($1::bigint[])`, [made]).catch(() => {});
      await pool.query(`DELETE FROM signups WHERE id = ANY($1::bigint[])`, [made]).catch(() => {});
      // The pool is shared with the manual-entry test below, which closes it.
    }
  },
);

test(
  "★ a manual entry is recorded under the deal on sale the day it was paid",
  { skip: db ? false : "set COURSE_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(db!).hostname), "only a database on this machine");
    process.env.DATABASE_URL = db;
    const { addManualMembership, ensureSchema, getPool, listMemberships } = await import("../src/lib/db.ts");
    await ensureSchema();
    const pool = getPool();
    const stamp = Date.now();
    const before = `manold-${stamp}`;
    const after = `mannew-${stamp}`;
    try {
      assert.equal(await addManualMembership({ name: "Old", wechat: before, paidOn: "2026-11-04", note: "转账" }), "added");
      assert.equal(await addManualMembership({ name: "New", wechat: after, paidOn: "2026-11-05", note: "转账" }), "added");
      const rows = await listMemberships();
      const old = rows.find((row) => row.wechat === before);
      const fresh = rows.find((row) => row.wechat === after);
      assert.equal(old?.course, YEARLY_MEMBERSHIP_ID, "paid before the switch: a year");
      assert.equal(old?.expires_on, "2027-11-04");
      assert.equal(fresh?.course, MEMBERSHIP.id, "paid from the switch on: 4 weeks");
      assert.equal(fresh?.expires_on, "2026-12-01", "the cohort's last Tuesday");
      assert.equal(fresh?.active, true);
    } finally {
      await pool.query(`DELETE FROM course_orders WHERE wechat = ANY($1::text[])`, [[before, after]]).catch(() => {});
      await pool.end();
    }
  },
);
