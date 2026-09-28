import assert from "node:assert/strict";
import { test } from "node:test";
import { capacityAlert } from "../src/lib/capacity.ts";
import { CHECKIN_COLUMNS, csvCell, ORDER_COLUMNS } from "../src/lib/csv.ts";
import { copy } from "../src/lib/content.ts";

/** The 2026-09-28 admin round: the capacity alert, the new exports, and /sbm. */

test("★ the capacity alert fires on a long waitlist or a burst of unverified signups", () => {
  assert.equal(capacityAlert({ waitlist: 0, unverifiedLastDay: 0 }), null);
  assert.equal(capacityAlert({ waitlist: 4, unverifiedLastDay: 9 }), null);
  assert.deepEqual(capacityAlert({ waitlist: 5, unverifiedLastDay: 0 }), { waitlist: 5, unverifiedLastDay: 0 });
  assert.deepEqual(capacityAlert({ waitlist: 0, unverifiedLastDay: 10 }), { waitlist: 0, unverifiedLastDay: 10 });
});

test("the new exports have their columns and keep the formula guard", () => {
  assert.deepEqual(ORDER_COLUMNS, ["name", "label", "cents", "note", "wechat", "updated_at"]);
  assert.deepEqual(CHECKIN_COLUMNS, ["name", "wechat", "source", "on_wall", "created_at"]);
  // A cell that would run as a formula in Excel or Sheets is defused.
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell(["2026-10-01", "2026-10-08"]), `"2026-10-01;2026-10-08"`);
  assert.equal(csvCell(null), `""`);
});

test("★ the /sbm page never names the legal entity", () => {
  // James 2026-09-28: the government listing carries it; the landing page does not.
  for (const lang of ["zh", "en"] as const) {
    assert.ok(!/Orris/i.test(JSON.stringify(copy[lang].sbm)), `${lang} sbm copy still names Orris`);
  }
});
