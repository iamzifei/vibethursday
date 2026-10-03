import { NextResponse } from "next/server";
import { awardDailyTask } from "@/lib/db";
import { currentWeek, invalidateBoard } from "@/lib/game/ledger";
import { DAILY_TASK_MAX, POINTS, sydneyDate } from "@/lib/game/points";
import { playerOf } from "@/lib/game/room";
import { DAILY_KINDS, dailyTasks, type DailyKind } from "@/lib/game/state";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 1024;

export const dynamic = "force-dynamic";

/**
 * One of today's three tasks, finished. The one score the server cannot see
 * for itself — only the browser knows a critter was befriended — so it is
 * taken on trust and capped hard: today's tasks only, each once, three a day
 * (`awardDailyTask`). The most a liar gains is nine points a day.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response(null, { status: 413 });
  const limited = tooMany(request, "play-daily", 120);
  if (limited) return limited;

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response(null, { status: 413 });
  request = bounded;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const key = typeof body?.key === "string" ? body.key : "";
  const kind = body?.kind as DailyKind;

  const player = playerOf(id, key);
  if (!player || player.playerKey.startsWith("s:")) return NextResponse.json({ ok: false }, { status: 403 });

  const today = sydneyDate(new Date());
  // Today's set, the same for everyone (state.ts). The member task is only
  // swapped out when there are no members at all, which is never true now.
  const todays = dailyTasks(today, { members: 99, stalls: 99, questions: 99 }).map((task) => task.kind);
  if (!DAILY_KINDS.includes(kind) || !todays.includes(kind)) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const paid = await awardDailyTask(
      { week: currentWeek(), player: player.playerKey, name: player.name, slug: player.slug, guest: player.guest, reason: "daily", ref: `${today}:${kind}`, points: POINTS.dailyTask },
      today,
      DAILY_TASK_MAX,
    );
    if (paid) invalidateBoard();
    return NextResponse.json({ ok: true, paid });
  } catch (error) {
    console.error("[play] could not pay a daily task", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
