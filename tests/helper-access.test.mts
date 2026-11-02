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
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("★ the helper key and session are their own: neither opens /admin, neither is the admin token", async () => {
  process.env.ADMIN_TOKEN = "test-admin-token-123";
  const { adminSessionValue, helperLinkKey, helperSessionValue, isAdmin, isAdminSession, isHelperKey, isHelperSession } = await import("../src/lib/admin-auth.ts");
  const key = helperLinkKey()!;
  assert.ok(key && key.length >= 20);
  assert.equal(isHelperKey(key), true);
  assert.equal(isAdmin(key), false, "the helper link is not the admin token");
  assert.equal(isAdminSession(helperSessionValue()!), false, "a helper session is not an admin session");
  assert.equal(isHelperSession(adminSessionValue()!), false);
  assert.equal(isHelperSession(helperSessionValue()!), true);
  assert.equal(isHelperKey("test-admin-token-123"), false);
  delete process.env.ADMIN_TOKEN;
  assert.equal(helperLinkKey(), null, "no admin token, no helper link");
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

test("★ a helper can tick people in and mark a fee paid, never waive one", () => {
  assert.match(read("src/app/api/admin/checkin/route.ts"), /isHelperSession/);
  const fee = read("src/app/api/admin/tuesday-fee/route.ts");
  assert.match(fee, /isHelperSession/);
  assert.match(fee, /helper && status === "waived"/);
});

test("a helper searches by name only, so a WeChat ID cannot be spelt out letter by letter", () => {
  assert.match(read("src/app/admin/desk/page.tsx"), /filterDesk\(desk, query, role === "helper"\)/);
});
