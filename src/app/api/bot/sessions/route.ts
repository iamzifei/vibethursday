import { NextResponse } from "next/server";
import { botAuthFailure, botSecret, chooseBotSession } from "@/lib/bot-signup";
import { capFor } from "@/lib/capacity";
import { sessionHeadcount } from "@/lib/db";
import { tooMany } from "@/lib/rate-limit";
import { bookableSessions, isOpenTrialSession, nextThursdays, upcomingBookableSpecialSessions } from "@/lib/sessions";
import { feeToPay } from "@/lib/tuesday-fee";

/** Reads per hour per address: the bot asks this whenever someone asks 「周二有没有」. */
const READS_PER_HOUR = 120;

export const dynamic = "force-dynamic";

/**
 * What the WeChat group bot can book right now (2026-11-18): the next
 * Thursday and every Build Tuesday still taking signups, with how many places
 * are left. Read-only; signed like `/api/bot/signup`, over an empty body.
 */
export async function GET(request: Request) {
  const secret = botSecret();
  if (!secret) return new Response("Not found", { status: 404 });

  const limited = tooMany(request, "bot-sessions", READS_PER_HOUR);
  if (limited) return limited;

  const denied = botAuthFailure(request, secret, "");
  if (denied) return denied;

  const specials = upcomingBookableSpecialSessions();
  const offer = { thursdays: nextThursdays(1), specials, bookable: bookableSessions(12) };
  const dates = [...offer.thursdays.slice(0, 1), ...specials.map((session) => session.date)];

  try {
    const sessions = [];
    for (const date of dates) {
      const choice = chooseBotSession(date, offer);
      if (!choice.ok) continue;
      const { kind, online, fee, membersOnly } = choice.session;
      const cap = capFor(date);
      const { count } = await sessionHeadcount(date, null, null);
      sessions.push({
        date,
        kind,
        online,
        fee,
        amount: fee === null ? null : feeToPay(fee),
        membersOnly,
        openTrial: isOpenTrialSession(date),
        cap,
        spotsLeft: Math.max(0, cap - count),
      });
    }
    return NextResponse.json(
      {
        ok: true,
        thursday: sessions.find((session) => session.kind === "thursday") ?? null,
        tuesdays: sessions.filter((session) => session.kind === "tuesday"),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[bot-sessions] failed", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
