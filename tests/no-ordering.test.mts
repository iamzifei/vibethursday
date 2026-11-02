/**
 * No ordering on the site (James 2026-11-02): almost everyone orders and pays
 * at the counter when they arrive, so the drinks/food order page, the bar
 * sheet, the order desk on /admin and the "pick something to order" question
 * at signup are gone. The rule itself stays: everyone orders one thing at the
 * venue — it is said on the site, not taken on it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ the order page, its routes, the bar sheet and the order desk are gone", () => {
  for (const file of [
    "src/app/order/page.tsx",
    "src/app/api/order/route.ts",
    "src/app/api/admin/order/route.ts",
    "src/components/OrderDesk.tsx",
    "src/lib/order.ts",
  ]) {
    assert.equal(existsSync(path.join(root, file)), false, file);
  }
});

test("nothing links to ordering any more", () => {
  assert.doesNotMatch(read("src/app/go/page.tsx"), /\/order\?/);
  assert.doesNotMatch(read("src/app/admin/page.tsx"), /OrderDesk|barSheet|countVenuePledges/);
  assert.doesNotMatch(read("src/components/SignupForm.tsx"), /venuePledge/);
  assert.doesNotMatch(read("src/app/api/signup/route.ts"), /venuePledge|saveOrder/);
  assert.doesNotMatch(read("src/lib/go.ts"), /"myOrder"|"order"/);
});

test("the rule is still said: one thing each, ordered at the venue", async () => {
  const { copy } = await import("../src/lib/content.ts");
  assert.match(JSON.stringify(copy.zh), /点一份/);
});

test("an old /order link lands on /go", () => {
  assert.match(read("next.config.ts"), /source: "\/order", destination: "\/go"/);
});
