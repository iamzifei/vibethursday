// Relative, not "@/": the tests load this through Node's type stripper.

/**
 * The daily spending cap for the ask-box helper, split out so it can be tested.
 *
 * It lives apart from `db.ts` only because that file imports through the `@/`
 * alias, which the test runner cannot resolve. That is a thin reason on its own
 * — the strong one is that this is the piece worth testing: it is the only thing
 * standing between a stranger and this site's DeepSeek balance, and the ways it
 * silently stops being a cap are all small edits that still compile.
 */

/**
 * One statement, and the WHERE is the whole point.
 *
 * ★ **The `WHERE coach_budget.calls < $1` is what makes this a cap.** Delete it
 * and the statement still runs, still counts, still returns a row — and never
 * refuses anything. There is a test asserting this clause is present for exactly
 * that reason: the failure mode is invisible in every log and on every page.
 *
 * Doing it in one statement also means two requests arriving together cannot
 * both read the same count and both decide they are under the line.
 */
export const BUDGET_SQL = `INSERT INTO coach_budget (day, calls) VALUES (current_date, 1)
     ON CONFLICT (day) DO UPDATE SET calls = coach_budget.calls + 1
     WHERE coach_budget.calls < $1
     RETURNING calls`;

/** Just enough of `pg`'s shape to run the statement, so a test can stand in. */
export type BudgetQuery = (sql: string, params: unknown[]) => Promise<{ rowCount: number | null }>;

/**
 * Takes one call out of today's budget. False means the day is spent.
 *
 * ⚠️ **Fails closed on a limit that is not a positive number.** The limit
 * arrives as `Number(process.env.COACH_DAILY_LIMIT ?? 300)`, and a typo in the
 * deployment's environment makes that `NaN`. Every comparison against `NaN` is
 * false, so a bare `limit <= 0` check waves it through and sends `NaN` to
 * Postgres — a mistyped spending cap must not become no spending cap.
 */
export async function spendFrom(query: BudgetQuery, limit: number): Promise<boolean> {
  if (!Number.isFinite(limit) || limit <= 0) return false;

  const result = await query(BUDGET_SQL, [limit]);

  // The WHERE refused it when nothing comes back. `rowCount` is nullable in
  // `pg`'s types, and null is not one.
  return result.rowCount === 1;
}
