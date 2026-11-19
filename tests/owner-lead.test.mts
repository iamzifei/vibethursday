/**
 * Business owners (2026-11-19, owner-lead.ts): the /boss form, the feedback
 * tick, and the organiser's list with a ready WeChat remark.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isOwner, ownerList, parseOwnerLead, wechatKey, wechatRemark, type OwnerRow } from "../src/lib/owner-lead.ts";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const base: OwnerRow = {
  id: "1",
  name: "陈总",
  wechat: "chen_888",
  industry: "property",
  topic: null,
  purposes: "",
  biz_focus: [],
  owner_lead: null,
  source: null,
  sessions: ["2026-11-12"],
  checked_in: ["2026-11-12"],
  created_at: "2026-11-12 10:00",
};

test("★ name and WeChat ID are required", () => {
  assert.equal(parseOwnerLead(form({ name: "陈总" })), null);
  assert.equal(parseOwnerLead(form({ wechat: "x" })), null);
});

test("unknown industry and size are 'not answered', not errors", () => {
  const lead = parseOwnerLead(form({ name: "陈总", wechat: "chen", industry: "spaceships", size: "huge" }))!;
  assert.equal(lead.industry, null);
  assert.equal(lead.lead.size, null);
});

test("★ the follow-up consent is only an explicit tick", () => {
  assert.equal(parseOwnerLead(form({ name: "a", wechat: "b" }))!.lead.consent, false);
  assert.equal(parseOwnerLead(form({ name: "a", wechat: "b", consent: "on" }))!.lead.consent, false);
  assert.equal(parseOwnerLead(form({ name: "a", wechat: "b", consent: "1" }))!.lead.consent, true);
});

test("a full answer is kept", () => {
  const lead = parseOwnerLead(form({ name: "陈总", wechat: "chen", industry: "property", shop: "XX 建材", size: "s6_20", need: "报价太慢", consent: "1" }))!;
  assert.deepEqual(lead, { name: "陈总", wechat: "chen", industry: "property", lead: { shop: "XX 建材", size: "s6_20", need: "报价太慢", consent: true } });
});

test("who counts as an owner", () => {
  assert.equal(isOwner(base), false);
  assert.equal(isOwner({ ...base, purposes: "2026-11-12=biz" }), true);
  assert.equal(isOwner({ ...base, biz_focus: ["leads"] }), true);
  assert.equal(isOwner({ ...base, owner_lead: { shop: null, size: null, need: null, consent: false, at: "" } }), true);
});

test("★ the WeChat remark follows the community format", () => {
  assert.equal(wechatRemark(base), "陈总 / 地产建筑装修 / VT");
  const fromSite = { ...base, sessions: [], owner_lead: { shop: "XX", size: "s6_20" as const, need: null, consent: true, at: "" } };
  assert.equal(wechatRemark(fromSite), "陈总 / 地产建筑装修 / 6–20 人 / 网站");
  assert.equal(wechatRemark({ ...base, industry: null }), "陈总 / 行业? / VT");
});

test("★ owners who asked to be looked at come first, then those who agreed to a follow-up", () => {
  const rows: OwnerRow[] = [
    { ...base, id: "a", wechat: "a", purposes: "x=biz", created_at: "2026-11-15 10:00" },
    { ...base, id: "b", wechat: "B b", purposes: "x=biz", created_at: "2026-11-01 10:00" },
    { ...base, id: "c", wechat: "c", owner_lead: { shop: null, size: null, need: null, consent: true, at: "" }, created_at: "2026-11-10 10:00" },
    { ...base, id: "d", wechat: "d" },
  ];
  const list = ownerList(rows, new Set([wechatKey("bb")]));
  assert.deepEqual(list.map((row) => row.id), ["b", "c", "a"]);
  assert.equal(list[0].wantsCall, true);
});
