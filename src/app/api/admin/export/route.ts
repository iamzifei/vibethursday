import { isAdmin } from "@/lib/admin-auth";
import { listSignups } from "@/lib/db";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "name",
  "email",
  "wechat",
  "demo_intent",
  "first_session",
  "building",
  "source",
  "lang",
  "bot_check",
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
  const text = value == null ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? undefined;

  if (!isAdmin(key)) {
    return new Response("Not authorised", { status: 401 });
  }

  const signups = await listSignups();

  const lines = [
    COLUMNS.join(","),
    ...signups.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(",")),
  ];

  // The BOM makes Excel open the file as UTF-8, without which Chinese names
  // and WeChat IDs arrive as mojibake.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vibethursday-signups.csv"',
      "Cache-Control": "no-store",
    },
  });
}
