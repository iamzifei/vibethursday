/**
 * Paying for a Build Tuesday straight from the signup (James 2026-11-02):
 * "线上报名直接支付，走 stripe，费用是 30+gst。报名付费过 599 的人可以豁免……
 * 如果有遗漏的，留一个联系我的入口".
 *
 * Read from source: the signup confirmation's main button opens Stripe in
 * one tap (a form post to /api/pay/checkout, which falls back to the payment
 * page on any failure), and every place that asks for the fee says where to
 * go when a payment the site does not know about was made.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ the signup confirmation pays by card in one tap when card payment is on", () => {
  const form = read("src/components/SignupForm.tsx");
  assert.match(form, /action="\/api\/pay\/checkout"/);
  assert.match(form, /name="ref" value=\{receipt\.fee\.ref\}/);
  // Still a link to the payment page when card payment is off (bank transfer).
  assert.match(form, /\/tuesday\/pay\?ref=\$\{receipt\.fee\.ref\}/);
});

test("★ a missed payment has a way to the organiser on every page that asks for the fee", async () => {
  const { copy } = await import("../src/lib/content.ts");
  for (const lang of ["zh", "en"] as const) {
    assert.ok(copy[lang].signup.payMissing.length > 0, lang);
  }
  assert.match(read("src/components/SignupForm.tsx"), /copy\.payMissing/);
  assert.match(read("src/app/tuesday/pay/page.tsx"), /PayMissing|payMissing/);
  // The contact section on the home page carries the WeChat code.
  assert.match(read("src/lib/content.ts"), /payMissingHref: "\/#contact"/);
});
