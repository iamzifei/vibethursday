import { isAdmin } from "@/lib/admin-auth";
import { listFeedback, listSignups } from "@/lib/db";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "name",
  "email",
  "wechat",
  "demo_intent",
  "first_session",
  "sessions",
  // Which of those they were actually there for, from check-ins. Empty for
  // everyone before check-in existed, and for anyone who did not tap.
  "checked_in",
  // Why they came, per session: "2026-09-24=biz 2026-10-01=learn".
  "purposes",
  "availability",
  "ai_models",
  "ai_spend",
  "building",
  "topic",
  "source",
  "lang",
  "bot_check",
  "created_at",
] as const;

/**
 * The feedback export, which is a different sheet rather than more columns on
 * this one: a signup is a person and a feedback row is a morning, and joining
 * them would also be the one thing the form promises not to do — the rows are
 * anonymous, and a spreadsheet lining them up next to names would quietly
 * un-promise it.
 */
const FEEDBACK_COLUMNS = [
  "session",
  "rating",
  "recommend",
  "best",
  "better",
  "name",
  "lang",
  "created_at",
] as const;

/**
 * Escapes one CSV cell.
 *
 * The leading apostrophe guard matters: a value starting with = + - or @ is
 * interpreted as a formula when the file is opened in Excel or Sheets, which
 * turns an attacker-supplied signup field into code running on your machine.
 */
function csvCell(value: unknown): string {
  // `sessions` arrives as a JS array; join it so the cell reads 2026-08-06;
  // 2026-08-13 rather than the raw Postgres literal.
  const text =
    value == null ? "" : Array.isArray(value) ? value.map(String).join(";") : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? undefined;

  if (!isAdmin(key)) {
    return new Response("Not authorised", { status: 401 });
  }

  const what = new URL(request.url).searchParams.get("what");

  const { name, lines } =
    what === "feedback"
      ? {
          name: "feedback",
          lines: await listFeedback().then((rows) => [
            FEEDBACK_COLUMNS.join(","),
            ...rows.map((row) => FEEDBACK_COLUMNS.map((column) => csvCell(row[column])).join(",")),
          ]),
        }
      : {
          name: "signups",
          lines: await listSignups().then((rows) => [
            COLUMNS.join(","),
            ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(",")),
          ]),
        };

  // The BOM makes Excel open the file as UTF-8, without which Chinese names
  // and WeChat IDs arrive as mojibake.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vibethursday-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
