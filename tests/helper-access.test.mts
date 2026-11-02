/**
 * A helper's way into the check-in desk (2026-11-02): someone at the door on
 * the organiser's behalf sees the desk, the door code and a person's payment
 * code, can tick people in and mark a fee paid — and nothing else of /admin:
 * no signup list, no exports, no waiving fees, WeChat IDs shortened.
 *
 * The helper link is derived from ADMIN_TOKEN, so it needs no new setting and
 * changes whenever the admin token does.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

// Spec change 2026-11-02 (James): the shared helper link is retired now that
// every assistant has a personal link (admin-auth.ts STAFF_COOKIE). It is
// removed in code rather than by rotating ADMIN_TOKEN, so nothing else signs out.
test("★ the old shared helper link no longer exists and no longer opens anything", () => {
  assert.ok(!existsSync(path.join(root, "src/app/api/helper/session/route.ts")), "the route that issued it is gone");
  const auth = read("src/lib/admin-auth.ts");
  for (const name of ["HELPER_COOKIE", "helperLinkKey", "isHelperKey", "helperSessionValue", "isHelperSession"]) {
    assert.ok(!auth.includes(name), `admin-auth.ts still has ${name}`);
  }
  assert.doesNotMatch(read("src/lib/staff.ts"), /vt_helper|HELPER/);
});

test("WeChat IDs are shortened for a helper", async () => {
  const { maskWechat } = await import("../src/lib/desk.ts");
  assert.equal(maskWechat("zhangxm_88"), "zha***");
  assert.equal(maskWechat("ab"), "ab***");
  assert.equal(maskWechat(null), null);
});

test("★ the desk, its payment code and the door let a helper in; nothing else does", () => {
  for (const file of ["src/app/admin/desk/page.tsx", "src/app/admin/desk/pay/page.tsx", "src/app/admin/door/page.tsx"]) {
    assert.match(read(file), /staffRole\(/, file);
  }
  for (const file of ["src/app/admin/page.tsx", "src/app/admin/members/page.tsx", "src/app/admin/roles/page.tsx", "src/app/api/admin/export/route.ts"]) {
    assert.doesNotMatch(read(file), /staffRole|isHelperSession/, file);
  }
});

// Spec change 2026-11-02: the helper is now the assistant role, checked through
// authorise() and the permission table (permissions.ts, tests/permissions.test.mts).
test("★ an assistant can tick people in and mark a fee paid, never waive one", () => {
  assert.match(read("src/app/api/admin/checkin/route.ts"), /authorise\(request, "checkin"/);
  const fee = read("src/app/api/admin/tuesday-fee/route.ts");
  assert.match(fee, /authorise\(request, "feeMarkPaid"/);
  assert.match(fee, /status === "waived" && !can\(role, "admin"\)/);
});

// Spec change 2026-11-02 (James): the assistant sees WeChat IDs in full, so the
// name-only search now applies only to whoever lacks `wechatFull`.
test("whoever cannot see full WeChat IDs searches by name only", () => {
  const page = read("src/app/admin/desk/page.tsx");
  assert.match(page, /const fullWechat = can\(role, "wechatFull"\)/);
  assert.match(page, /filterDesk\(desk, query, !fullWechat\)/);
});
