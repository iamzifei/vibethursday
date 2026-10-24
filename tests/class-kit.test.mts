import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  cardText,
  CARD_FIELDS,
  packMarkdown,
  parseKitSubmission,
  PROFILE_FIELDS,
  profileMarkdown,
  SPEC_FIELDS,
} from "../src/lib/class-kit.ts";

const APP = path.join(import.meta.dirname, "..", "src", "app");

test("the profile has the 13 boxes shown in class, in order", () => {
  assert.equal(PROFILE_FIELDS.length, 13);
  PROFILE_FIELDS.forEach((field, index) => assert.ok(field.label.startsWith(`${index + 1} `), field.label));
});

test("the profile file keeps the sample's shape and leaves out empty boxes", () => {
  const md = profileMarkdown({ p1: "Eastwood 装修", p3: "卫生间 1.6–2.6 万\n厨房 2.2–3.8 万", p13: "报价、折扣" }, "2026-10-25");
  assert.equal(
    md,
    "【业务档案】（更新日期：2026-10-25）\n\n1 一句话生意：Eastwood 装修\n3 主要服务与价格：卫生间 1.6–2.6 万\n   厨房 2.2–3.8 万\n13 不让 AI 碰的事：报价、折扣\n",
  );
  assert.ok(!md.includes("2 地址"), "an empty box is not written out");
});

test("the industry pack numbers only the experience that was filled in, and dates the rule", () => {
  const md = packMarkdown({ industry: "装修", e1: "9–11 月旺季", e3: "客人同时问三家", rule: "定金不超过 10%", ruleDate: "2026-10-24" }, "2026-10-25");
  assert.match(md, /^【行业知识包：装修】/);
  assert.match(md, /1\. 9–11 月旺季\n2\. 客人同时问三家\n/);
  assert.match(md, /- 规定：定金不超过 10%\n- 日期：2026-10-24\n$/);
  assert.ok(!md.includes("出处"), "no source line when no source was given");
});

test("the card reads as plain lines to paste as a first question", () => {
  assert.equal(cardText({ biz: "贷款", pain: "回消息到十点", area: "客服" }), "我的生意：贷款\n最头疼的一件事：回消息到十点\n属于：客服");
  assert.equal(cardText({ biz: "贷款" }), "我的生意：贷款");
});

test("only the card and the spec are ever accepted by the server", () => {
  assert.equal(parseKitSubmission("profile", { p1: "x", p13: "y" }), null);
  assert.equal(parseKitSubmission("pack", { industry: "x", e1: "y" }), null);
  assert.equal(parseKitSubmission("nope", { biz: "x" }), null);
  assert.equal(parseKitSubmission("card", "biz=x"), null);
  assert.equal(parseKitSubmission("card", ["x"]), null);
});

test("a handed-in form keeps known fields only, trimmed and capped, and needs its required boxes", () => {
  const card = parseKitSubmission("card", { biz: "  贷款  ", pain: "回消息", area: "客服", extra: "dropped", wechat: "smuggled" });
  assert.deepEqual(card, { kind: "card", payload: { biz: "贷款", pain: "回消息", area: "客服" }, name: null, wechat: null });

  assert.equal(parseKitSubmission("card", { biz: "贷款" }), null, "pain is required");
  assert.equal(parseKitSubmission("card", { biz: "贷款", pain: "   " }), null, "whitespace is empty");

  const badChoice = parseKitSubmission("card", { biz: "a", pain: "b", area: "<script>" });
  assert.deepEqual(badChoice?.payload, { biz: "a", pain: "b" }, "a choice outside the options is skipped");

  const long = "字".repeat(30000);
  const spec = parseKitSubmission("spec", { thing: "盯期限", spec: long, name: "Grace", wechat: "g123", biz: 5 });
  const specMax = SPEC_FIELDS.find((field) => field.name === "spec")!.max;
  assert.equal(spec?.payload.spec.length, specMax);
  assert.equal(spec?.name, "Grace");
  assert.equal(spec?.wechat, "g123");
  assert.equal(CARD_FIELDS.find((field) => field.name === "biz")!.max, 200);
});

test("every workbook page is kept out of search, and /class itself is not blocked", () => {
  for (const page of ["kit", "card", "profile", "pack", "spec"]) {
    const source = readFileSync(path.join(APP, "class", page, "page.tsx"), "utf8");
    assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/, `/class/${page} sets noindex`);
  }

  const robots = readFileSync(path.join(APP, "robots.ts"), "utf8");
  const disallow = robots.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";
  const rules = [...disallow.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  // Prefix matching, as in robots-prefix.test.mts.
  const blocks = (url: string) => rules.some((rule) => (rule.endsWith("$") ? url === rule.slice(0, -1) : url.startsWith(rule)));
  assert.ok(blocks("/class/kit") && blocks("/class/spec"), "the workbook is disallowed");
  assert.ok(!blocks("/class") && !blocks("/class?ref=AIABCDE"), "the class signup page stays reachable");

  const sitemap = readFileSync(path.join(APP, "sitemap.ts"), "utf8");
  assert.ok(!sitemap.includes("/class/"), "no workbook page in the sitemap");
});
