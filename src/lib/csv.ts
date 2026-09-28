// Relative, not "@/": the tests load this through Node's type stripper.

/**
 * One CSV cell, for the organiser's exports.
 *
 * The leading apostrophe guard matters: a value starting with = + - or @ is
 * interpreted as a formula when the file is opened in Excel or Sheets, which
 * turns an attacker-supplied signup field into code running on your machine.
 * Arrays (sessions, waitlist) are joined with ";" so the cell reads
 * 2026-08-06;2026-08-13 rather than a raw Postgres literal.
 */
export function csvCell(value: unknown): string {
  const text = value == null ? "" : Array.isArray(value) ? value.map(String).join(";") : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** The drinks sheet as a file: one row per order, the same lines the bar gets. */
export const ORDER_COLUMNS = ["name", "label", "cents", "note", "wechat", "updated_at"] as const;

/** Who checked in, earliest first. */
export const CHECKIN_COLUMNS = ["name", "wechat", "source", "on_wall", "created_at"] as const;
