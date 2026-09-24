import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { adminSessionValue, isAdmin, isAdminRequest, isAdminSession } from "../src/lib/admin-auth.ts";

/**
 * The organiser's session (`src/lib/admin-auth.ts`).
 *
 * Until 2026-09-24 the admin token lived in the URL — `/admin?key=…` — and
 * every admin action redirected back to it, so it sat in browser history, in
 * logs and in every screenshot of the address bar. The link now gets traded
 * once for an HttpOnly cookie holding a value derived from the token.
 */

function withToken<T>(token: string | undefined, run: () => T): T {
  const saved = process.env.ADMIN_TOKEN;
  if (token === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = token;
  try {
    return run();
  } finally {
    if (saved === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = saved;
  }
}

test("the session value is derived from the token, and is not the token", () => {
  withToken("a-long-test-token", () => {
    const value = adminSessionValue();
    assert.ok(value);
    assert.notEqual(value, "a-long-test-token", "the cookie must never hold the token itself");
    assert.equal(value, adminSessionValue(), "the same token has to give the same session");
  });
});

test("rotating the token signs every existing session out", () => {
  const before = withToken("token-one", () => adminSessionValue());
  withToken("token-two", () => {
    assert.ok(!isAdminSession(before!), "a session from the old token still verified");
    assert.ok(isAdminSession(adminSessionValue()!));
  });
});

test("an unconfigured deployment lets nobody in", () => {
  withToken(undefined, () => {
    assert.equal(adminSessionValue(), null);
    assert.ok(!isAdminSession("anything"));
    assert.ok(!isAdminSession(""));
    assert.ok(!isAdmin("anything"));
  });
});

test("a session is the cookie OR the token, and nothing else", () => {
  withToken("a-long-test-token", () => {
    const session = adminSessionValue()!;

    assert.ok(isAdminRequest(session, null), "a valid cookie alone must be enough");
    assert.ok(isAdminRequest(undefined, "a-long-test-token"), "the token alone must still work (the link, and old tabs)");

    assert.ok(!isAdminRequest(undefined, null));
    assert.ok(!isAdminRequest("forged", null));
    assert.ok(!isAdminRequest(`${session}x`, null));
    assert.ok(!isAdminRequest(undefined, "wrong-token"));
    // The session value must not work where the token is expected, or a stolen
    // cookie could be pasted into the link.
    assert.ok(!isAdmin(session));
  });
});

test("★ no admin page or component puts the token back into the HTML or a URL", () => {
  // The regression this guards is the easy one: a new admin form copies an
  // old one and brings `<input type="hidden" name="key" …>` with it, or a new
  // link rebuilds `/admin?key=…`. Either quietly puts the token back where
  // this change took it out of, and nothing would fail.
  const roots = ["src/app/admin", "src/app/api/admin", "src/components"];
  const walk = (dir: string): string[] =>
    readdirSync(path.join(process.cwd(), dir)).flatMap((name) => {
      const p = path.join(dir, name);
      return statSync(path.join(process.cwd(), p)).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
  const files = roots.flatMap(walk);

  const offenders: string[] = [];

  for (const file of files) {
    // The one route allowed to see the token in a URL is the one that trades it.
    if (file.endsWith(path.join("admin", "session", "route.ts"))) continue;

    // The admin page's single forward to the session route is the one place
    // the key may appear in a URL; it is counted separately below, so it is
    // taken out here rather than whitelisted by file.
    const text = readFileSync(path.join(process.cwd(), file), "utf8").replace(
      /\/api\/admin\/session\?key=\$\{encodeURIComponent\(key\)\}/g,
      "",
    );

    // The deck presenter has its own per-room key; that is not the admin token.
    const adminKeyField = /name="key"\s+value=\{(key|adminKey)!?\}/;
    const adminKeyUrl = /\?key=\$\{encodeURIComponent\((key|adminKey)!?\)\}/;

    if (adminKeyField.test(text)) offenders.push(`${file}: hidden admin-key field`);
    if (adminKeyUrl.test(text)) offenders.push(`${file}: admin key rebuilt into a URL`);
  }

  // The admin page may forward ?key= to the session route exactly once.
  const adminPage = readFileSync(path.join(process.cwd(), "src/app/admin/page.tsx"), "utf8");
  const forwards = adminPage.match(/\/api\/admin\/session\?key=/g)?.length ?? 0;
  assert.equal(forwards, 1, "the admin page should forward the key to the session route once, and nowhere else");

  assert.deepEqual(offenders, []);
});
