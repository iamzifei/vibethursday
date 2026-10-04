import { cookies } from "next/headers";
import { tooMany } from "@/lib/rate-limit";
import { ADMIN_COOKIE, isAdminRequest } from "@/lib/admin-auth";
import { listCheckins, listFeedback, listOrders, listSignups } from "@/lib/db";

import { CHECKIN_COLUMNS, csvCell, ORDER_COLUMNS } from "@/lib/csv";
import { isSessionDate } from "@/lib/checkin";
import { focusSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "name",
  "email",
  "wechat",
  "demo_intent",
  "first_session",
  "sessions",
  // Waitlisted, not booked: the session was full (`capacity.ts`). Never counted in `sessions`.
  "waitlist",
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
  // Appended last so recipes that read by column name are unaffected.
  // Values this person used to go by in the WeChat column (`correctWechat`).
  "wechat_former",
  // The row id, which /admin's correct and merge actions take.
  "id",
  // How familiar with AI, and which industry (signup-profile.ts). Appended
  // after everything else for the same reason as the two above.
  "ai_level",
  "industry",
  // The one-tap "what else would you come to" from the confirmation
  // (signup-interest.ts). Appended last, like the two above.
  "interest",
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
  "wechat",
  "lang",
  "created_at",
] as const;


export async function GET(request: Request) {
  const limited = tooMany(request, "admin-export", 60);
  if (limited) return limited;

  const key = new URL(request.url).searchParams.get("key") ?? undefined;

  if (!isAdminRequest((await cookies()).get(ADMIN_COOKIE)?.value, key)) {
    return new Response("Not authorised", { status: 401 });
  }

  const what = new URL(request.url).searchParams.get("what");

  // One session's drinks or check-ins (default: the session in focus).
  const sessionParam = new URL(request.url).searchParams.get("session");
  const session = sessionParam && isSessionDate(sessionParam) ? sessionParam : focusSession().date;

  const { name, lines } =
    what === "orders"
      ? {
          name: `orders-${session}`,
          lines: await listOrders(session).then((rows) => [
            ORDER_COLUMNS.join(","),
            ...rows.map((row) => ORDER_COLUMNS.map((column) => csvCell(row[column])).join(",")),
          ]),
        }
      : what === "checkins"
      ? {
          name: `checkins-${session}`,
          lines: await listCheckins(session).then((rows) => [
            CHECKIN_COLUMNS.join(","),
            ...rows.map((row) => CHECKIN_COLUMNS.map((column) => csvCell(row[column])).join(",")),
          ]),
        }
      : what === "feedback"
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
