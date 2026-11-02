/**
 * The team's permissions (2026-11-02).
 *
 * The failure this guards against is silent: a new /api/admin route that
 * checks "is this the admin?" its own way, or forgets to check at all, works
 * fine in every test that signs in as the admin. So instead of trusting each
 * route, every route has to ask the one table in permissions.ts, with a
 * permission named in the source, and this file reads them all.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { can, PERMISSIONS, type Permission } from "../src/lib/permissions.ts";
import { PERSON_ROLE_KINDS } from "../src/lib/person-roles.ts";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/** Every route.ts under a directory, however deep. */
function routes(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return routes(rel);
    return entry.name === "route.ts" ? [rel] : [];
  });
}

test("the assistant holds exactly what James decided on 2026-11-02", () => {
  const allowed: Permission[] = ["desk", "checkin", "feeMarkPaid", "wechatFull", "waitlist", "questions", "photos"];
  for (const permission of PERMISSIONS) {
    assert.equal(can("assistant", permission), allowed.includes(permission), `assistant / ${permission}`);
    assert.equal(can("admin", permission), true, `admin / ${permission}`);
    assert.equal(can(null, permission), false, `nobody / ${permission}`);
  }
});

// The one admin route that is not an action: it trades the link for the cookie.
const EXEMPT = new Set([path.join("src/app/api/admin/session/route.ts")]);

// Routes an assistant may use, and the permission each must ask for. Every
// other admin route must ask for "admin".
const EXPECTED: Record<string, Permission> = {
  "src/app/api/admin/checkin/route.ts": "checkin",
  "src/app/api/admin/tuesday-fee/route.ts": "feeMarkPaid",
  "src/app/api/admin/waitlist/route.ts": "waitlist",
  "src/app/api/admin/questions/route.ts": "questions",
  "src/app/api/admin/photos/route.ts": "photos",
};

test("every /api/admin route asks the permission table, with the right permission", () => {
  const found = routes("src/app/api/admin").filter((file) => !EXEMPT.has(file));
  assert.ok(found.length >= 20, `expected the admin routes, found ${found.length}`);

  for (const file of found) {
    const source = read(file);
    const asked = [...source.matchAll(/authorise\(\s*request\s*,\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);
    assert.ok(asked.length > 0, `${file} does not call authorise(request, "<permission>")`);
    for (const permission of asked) {
      assert.ok((PERMISSIONS as readonly string[]).includes(permission), `${file} asks for unknown permission "${permission}"`);
    }
    assert.equal(asked[0], EXPECTED[file] ?? "admin", `${file} asks for "${asked[0]}"`);

    // No second, private way in: the old helpers decide "admin or not" by
    // themselves and would bypass the table.
    for (const bypass of ["isAdminRequest(", "isHelperSession(", "isAdminSession("]) {
      assert.ok(!source.includes(bypass), `${file} still checks access with ${bypass}`);
    }
  }
});

test("assistant is a role the admin can hand out, kept off public cards", () => {
  assert.ok((PERSON_ROLE_KINDS as readonly string[]).includes("assistant"));
  const db = read("src/lib/db.ts");
  assert.match(db, /CHECK \(role IN \('builder', 'mentor', 'volunteer', 'assistant'\)\)/);
});

// Review 2026-11-02 (independent check): name + WeChat ID is all the site's
// ordinary sign-in asks for, and a WeChat ID is seen by a whole room. So staff
// access must never ride on currentAccount(): it needs its own proof, a
// personal link the admin sends, which sets a staff-only signed cookie.
test("★ staff access does not trust the ordinary sign-in", () => {
  const staff = read("src/lib/staff.ts");
  assert.doesNotMatch(staff, /currentAccount/);
  assert.match(staff, /STAFF_COOKIE/);
});

test("★ /staff is the assistant's door, opened once by a personal link", () => {
  const page = path.join(root, "src/app/staff/page.tsx");
  assert.ok(existsSync(page), "no /staff page");
  assert.doesNotMatch(readFileSync(page, "utf8"), /wechatLoginHref\(/);
  const route = read("src/app/api/staff/session/route.ts");
  assert.match(route, /readStaffToken\(/);
  assert.match(route, /staffInviteValid\(/);
  // The admin finds each assistant's link on the roles page.
  assert.match(read("src/app/admin/roles/page.tsx"), /staffInviteToken\(/);
});

test("★ an assistant can only turn an unpaid Tuesday fee into paid", () => {
  const fee = read("src/app/api/admin/tuesday-fee/route.ts");
  assert.match(fee, /role !== "admin" && \(status !== "paid" \|\| fee\.status !== "pending"\)/);
});

test("the admin token is never read from a URL by the gate", () => {
  assert.doesNotMatch(read("src/lib/staff.ts"), /searchParams/);
});
