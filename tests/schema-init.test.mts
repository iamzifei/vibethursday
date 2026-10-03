import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

/**
 * The schema is created by `ensureSchema()` in src/lib/db.ts, on the first
 * request after every start. Two things must always hold:
 *
 * 1. It works on an EMPTY database. An ALTER on `members` once ran before the
 *    CREATE TABLE for `members`. The live database already had the table, so
 *    nothing showed; a fresh database (a new environment, a restore into an
 *    empty one, a local run) failed on every request that needed the schema.
 * 2. It changes nothing when run again on a database that already has it —
 *    every start runs it against the live database.
 *
 * The first two tests read the statements out of db.ts and need no database.
 * The last one runs the real thing twice against a throwaway Postgres, and is
 * skipped unless SCHEMA_TEST_DATABASE_URL points at one (see that test).
 */

const source = readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf8");

/** Every SQL statement `ensureSchema` runs, in order. */
function schemaStatements(): string[] {
  const start = source.indexOf("export function ensureSchema");
  const end = source.indexOf("})().catch(", start);
  assert.ok(start > 0 && end > start, "found ensureSchema in db.ts");
  const body = source.slice(start, end);
  const statements = [...body.matchAll(/pool\.query\(\s*`([\s\S]*?)`/g)].map((m) => m[1].replace(/\s+/g, " ").trim());
  assert.ok(statements.length > 30, `found the statements (${statements.length})`);
  return statements;
}

/** The table a statement creates or changes, and every other table it depends on. */
function touches(sql: string): { creates?: string; uses: string[] } {
  const uses: string[] = [];
  const create = sql.match(/^CREATE TABLE IF NOT EXISTS (\w+)/i);
  const alter = sql.match(/^ALTER TABLE (\w+)/i);
  const index = sql.match(/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS \w+ ON (\w+)/i);
  const update = sql.match(/^UPDATE (\w+)/i);
  for (const m of [alter, index, update]) if (m) uses.push(m[1]);
  for (const ref of sql.matchAll(/REFERENCES (\w+)/gi)) uses.push(ref[1]);
  assert.ok(create || alter || index || update, `a statement this test understands: ${sql.slice(0, 80)}`);
  return { creates: create?.[1], uses };
}

test("★ every table is created before anything alters, indexes, updates or references it", () => {
  const created = new Set<string>();
  for (const sql of schemaStatements()) {
    const { creates, uses } = touches(sql);
    for (const table of uses) {
      // A table may reference itself in its own CREATE; nothing else may run early.
      if (table === creates) continue;
      assert.ok(created.has(table), `"${sql.slice(0, 90)}…" runs before CREATE TABLE ${table}`);
    }
    if (creates) created.add(creates);
  }
});

test("★ schema init is only idempotent DDL: nothing it runs can fail or change things on a second run", () => {
  const notIfNotExists: string[] = [];
  for (const sql of schemaStatements()) {
    assert.ok(!/\bDROP (TABLE|COLUMN|INDEX)\b/i.test(sql), `no drops at start-up: ${sql.slice(0, 80)}`);
    if (/^CREATE /i.test(sql)) assert.match(sql, /^CREATE (UNIQUE )?(TABLE|INDEX) IF NOT EXISTS /i);
    if (/ADD COLUMN/i.test(sql)) assert.match(sql, /ADD COLUMN IF NOT EXISTS/i);
    if (!/IF NOT EXISTS/i.test(sql)) notIfNotExists.push(sql.slice(0, 45));
  }
  // The only statements without IF NOT EXISTS, each a no-op once it has run:
  // dropping a NOT NULL that is already gone, and two repairs whose WHERE
  // matches no row once they have been applied.
  assert.deepEqual(notIfNotExists, [
    "ALTER TABLE signups ALTER COLUMN email DROP N",
    "UPDATE signups SET waitlist_since = waitlist_",
    "UPDATE signups SET sessions = ARRAY(SELECT d ",
  ]);
});

/**
 * Runs `ensureSchema()` twice against a real, empty Postgres.
 *
 * To run it, start a throwaway database and point SCHEMA_TEST_DATABASE_URL at
 * it, e.g.:
 *
 *   initdb -D /tmp/pg && pg_ctl -D /tmp/pg -o "-p 55432" start
 *   createdb -p 55432 vt_schema_test
 *   SCHEMA_TEST_DATABASE_URL=postgres://localhost:55432/vt_schema_test pnpm test
 *
 * It refuses anything that is not on this machine or that already has tables,
 * so a mistyped URL cannot touch a real database.
 */
const url = process.env.SCHEMA_TEST_DATABASE_URL;

test(
  "★ ensureSchema succeeds on an empty database, and a second run changes nothing",
  { skip: url ? false : "set SCHEMA_TEST_DATABASE_URL to a throwaway local Postgres to run this" },
  async () => {
    const { hostname } = new URL(url!);
    assert.ok(["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname), "only a database on this machine");

    process.env.DATABASE_URL = url;
    const { ensureSchema, getPool } = await import("../src/lib/db.ts");
    const pool = getPool();
    const cache = (globalThis as unknown as { __vibeThursdayDb: { schemaReady: Promise<void> | undefined } })
      .__vibeThursdayDb;

    const snapshot = async () => {
      const columns = await pool.query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema = 'public'
          ORDER BY table_name, column_name`,
      );
      const indexes = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
      );
      const constraints = await pool.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace ORDER BY conname`,
      );
      return JSON.stringify([columns.rows, indexes.rows, constraints.rows]);
    };

    try {
      const existing = await pool.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`);
      assert.equal(existing.rows[0].n, 0, "the database must start empty");

      await ensureSchema();
      const first = await snapshot();

      const tables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`);
      const expected = schemaStatements()
        .map((sql) => touches(sql).creates)
        .filter((t): t is string => Boolean(t))
        .sort();
      assert.deepEqual(
        tables.rows.map((r) => r.tablename),
        expected,
      );
      const hidden = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'hidden_by_admin'`,
      );
      assert.equal(hidden.rowCount, 1, "the column whose ALTER used to run too early is there");

      // A second start against a database that already has everything —
      // which is what every deploy does to the live one.
      cache.schemaReady = undefined;
      await ensureSchema();
      assert.equal(await snapshot(), first, "the second run changed nothing");
    } finally {
      await pool.end();
    }
  },
);
