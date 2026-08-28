import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { BUDGET_SQL, spendFrom, type BudgetQuery } from "../src/lib/coach-budget.ts";

/**
 * The daily spending cap.
 *
 * Everything here is about one failure mode: this cap can stop being a cap
 * without anything looking wrong. No error, no log line, no visible change on
 * any page — the button keeps working, and the only signal is a DeepSeek
 * balance going down. So the tests below assert the two things that make it
 * hold (the SQL guard, and charging before the call) rather than only the happy
 * path, which would still pass with the cap removed.
 */

function source(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

/**
 * The executable body: imports and comments removed.
 *
 * ⚠️ Both order checks below were written without this and both were wrong —
 * one failed on the `import { spendCoachCall }` line, and the other PASSED for
 * the same reason, comparing an import position against a call position. An
 * order test that reads the import block is not testing order at all.
 */
function body(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*import\b/.test(line) && !/^\s*\/\//.test(line))
    .join("\n");
}

/** Records what it was asked, and answers with the row count it was given. */
function fakeQuery(rowCount: number | null) {
  const calls: { sql: string; params: unknown[] }[] = [];

  const query: BudgetQuery = async (sql, params) => {
    calls.push({ sql, params });
    return { rowCount };
  };

  return { query, calls };
}

test("a row back means the call is paid for", async () => {
  const { query, calls } = fakeQuery(1);

  assert.equal(await spendFrom(query, 300), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [300]);
});

test("no row back means the day is spent", async () => {
  const { query } = fakeQuery(0);
  assert.equal(await spendFrom(query, 300), false);
});

test("a null row count is not one, and must not read as paid", async () => {
  // `pg` types rowCount as nullable. `result.rowCount === 1` is deliberate;
  // a truthiness check here would turn null into "allowed".
  const { query } = fakeQuery(null);
  assert.equal(await spendFrom(query, 300), false);
});

test("a limit of zero switches the button off without touching the database", async () => {
  const { query, calls } = fakeQuery(1);

  assert.equal(await spendFrom(query, 0), false);
  assert.equal(calls.length, 0, "a disabled button must not reach the database");
});

test("a negative limit is refused", async () => {
  const { query } = fakeQuery(1);
  assert.equal(await spendFrom(query, -5), false);
});

test("★ a mistyped limit fails closed, not open", async () => {
  // COACH_DAILY_LIMIT=three hundred -> Number(...) -> NaN. Every comparison
  // against NaN is false, so `limit <= 0` alone would wave this through and
  // send NaN to Postgres. A typo in the environment must not remove the cap.
  const { query, calls } = fakeQuery(1);

  assert.equal(await spendFrom(query, Number("three hundred")), false);
  assert.equal(await spendFrom(query, Number.POSITIVE_INFINITY), false);
  assert.equal(calls.length, 0);
});

test("★ the SQL still carries the clause that makes it a cap", () => {
  // Without this WHERE the statement still runs, still counts, and still
  // returns a row every time — it just never refuses. Nothing else in the
  // system would notice.
  assert.match(BUDGET_SQL, /WHERE\s+coach_budget\.calls\s*<\s*\$1/);
  // And it must stay a single statement: read-then-write in two round trips
  // would let simultaneous requests both pass the check.
  assert.equal(BUDGET_SQL.split(";").length, 1, "one statement, or the check is not atomic");
});

test("★ the route charges before it calls out, not after", () => {
  // A counter that only counts successes is a counter an attacker empties for
  // free by making the calls fail. The charge has to happen first.
  const route = body("src/app/api/wharf/coach/route.ts");
  const charge = route.indexOf("spendCoachCall(");
  const call = route.indexOf("coachQuestion(");

  assert.ok(charge > 0, "the route must take the call out of the budget");
  assert.ok(call > 0, "the route must still ask the model something");
  assert.ok(charge < call, "the budget is charged before the upstream call, never after");
});

test("★ the coach route is gated on the member cookie", () => {
  // The cookie is cheap to get, but it is what keeps a passing crawler out.
  const route = body("src/app/api/wharf/coach/route.ts");

  assert.match(route, /currentMemberId\(\)/);
  assert.match(route, /not_signed_in/);
  assert.ok(
    route.indexOf("currentMemberId(") < route.indexOf("spendCoachCall("),
    "identity is checked before any money is spent",
  );
});

/**
 * The one claim the fake above cannot check: that Postgres really does refuse
 * the over-limit writes when they arrive together.
 *
 * `spendFrom` with a stub proves the decision logic; it says nothing about
 * whether the statement is atomic under concurrency, and "atomic" is the entire
 * reason it is one statement. So this runs the real SQL against a real server
 * when there is one, and skips when there is not.
 *
 *   DATABASE_URL=postgresql://... npm test
 */
test(
  "★ the cap holds when the requests arrive together",
  { skip: process.env.DATABASE_URL ? false : "no DATABASE_URL — skipping the live check" },
  async () => {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
      // ⚠️ Taken out of db.ts rather than written again here. A second copy of
      // the DDL would let this test pass against a table shape production does
      // not have — which is the one way an integration test can lie.
      const ddl = source("src/lib/db.ts").match(
        /CREATE TABLE IF NOT EXISTS coach_budget \([\s\S]*?\)\s*\n\s*`/,
      );
      assert.ok(ddl, "could not find the coach_budget DDL in db.ts");

      await pool.query(ddl[0].replace(/`$/, ""));
      await pool.query("DELETE FROM coach_budget WHERE day = current_date");

      const LIMIT = 4;
      const ATTEMPTS = 20;

      const results = await Promise.all(
        Array.from({ length: ATTEMPTS }, () =>
          spendFrom((sql, params) => pool.query(sql, params), LIMIT),
        ),
      );

      assert.equal(
        results.filter(Boolean).length,
        LIMIT,
        "exactly the limit may pass, however many arrive at once",
      );

      const { rows } = await pool.query("SELECT calls FROM coach_budget WHERE day = current_date");
      assert.equal(Number(rows[0].calls), LIMIT, "and the counter stops there");

      await pool.query("DELETE FROM coach_budget WHERE day = current_date");
    } finally {
      await pool.end();
    }
  },
);
