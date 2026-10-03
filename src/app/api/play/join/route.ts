import { NextResponse } from "next/server";
import { awardPoints, getMemberById, memberAttendedWeek, playLoginDays } from "@/lib/db";
import { currentWeek, invalidateBoard, refreshCrown } from "@/lib/game/ledger";
import { guestToken, readGuestToken } from "@/lib/game/player-id";
import { loginAwards, POINTS, streakFromDays, sydneyDate, type Award } from "@/lib/game/points";
import { join } from "@/lib/game/room";
import { installRushSpawner } from "@/lib/game/server-rush";
import { currentMemberId } from "@/lib/member-auth";
import { bodyTooLarge, boundedRequest, tooMany } from "@/lib/rate-limit";

/**
 * The most this route reads from a request body. Checked twice: up front
 * against the declared length, and again while the body is read, which is
 * what catches a chunked request that declares none (see `boundedRequest`).
 */
const MAX_BODY = 4 * 1024;

export const dynamic = "force-dynamic";

/**
 * Steps into the shared world of /play.
 *
 * A member who is signed in walks around under their wall name, and only if
 * their card is published and not hidden — the same gate the wall itself
 * uses, so the game can never show a name the wall would not. Everybody else
 * is a guest with a generated name. Nobody types a name here at all.
 *
 * Since 2026-09-28 a guest brings back the signed token this route gave them
 * last time (`player-id.ts`), so the same phone is the same animal all week —
 * which is what lets a guest climb the weekly board. Joining is also where the
 * day's first visit is paid for, and where a member who was in the room on
 * Thursday gets that week's attendance points.
 */
export async function POST(request: Request) {
  if (bodyTooLarge(request, MAX_BODY)) return new Response("Payload too large", { status: 413 });

  // Sized for a room of phones on one café's Wi-Fi, not for one person.
  const limited = tooMany(request, "play-join", 120);
  if (limited) return limited;

  installRushSpawner();

  const bounded = await boundedRequest(request, MAX_BODY);
  if (!bounded) return new Response("Payload too large", { status: 413 });
  request = bounded;
  const body = (await request.json().catch(() => null)) as { guest?: unknown } | null;

  let identity: { memberId: string | null; name: string | null; slug: string | null; guestId: string | null } = {
    memberId: null,
    name: null,
    slug: null,
    guestId: null,
  };

  try {
    const memberId = await currentMemberId();
    if (memberId) {
      const member = await getMemberById(memberId);
      if (member && member.published && !member.hidden) {
        identity = { memberId, name: member.display_name, slug: member.slug, guestId: null };
      }
    }
  } catch {
    // No database (a local build) or a bad cookie: play as a guest.
  }

  // A guest keeps the token they brought, if it is ours; otherwise gets a new one.
  let token: string | null = null;
  if (!identity.memberId) {
    try {
      const brought = typeof body?.guest === "string" ? body.guest : null;
      const guestId = readGuestToken(brought);
      token = guestId ? brought : guestToken();
      identity.guestId = readGuestToken(token);
    } catch {
      // No secret configured: an anonymous guest, as before.
    }
  }

  const seat = join(identity);
  if (!seat) return NextResponse.json({ error: "full" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  // Today's visit, the streak, and Thursday's attendance. Best-effort: the
  // board is a bonus, and a database hiccup must not keep anyone out of Sydney.
  const player = identity.memberId ? `m:${identity.memberId}` : identity.guestId ? `g:${identity.guestId}` : null;
  let welcome: { points: number; streak: number; attended: boolean } | null = null;

  if (player) {
    try {
      const today = sydneyDate(new Date());
      const week = currentWeek();
      const days = await playLoginDays(player);
      const firstToday = !days.includes(today);
      const streak = streakFromDays([today, ...days], today);

      const who = { player, name: identity.name, slug: identity.slug, guest: seat.guest, week };
      const login: Award[] = firstToday ? loginAwards(streak, today) : [];
      const loginNew = (await awardPoints(login.map((award) => ({ ...award, ...who })))) > 0;

      // Attendance is paid once a week; "new" only on the visit that paid it,
      // so the toast is shown once rather than on every visit that week.
      let attendedNew = false;
      if (identity.memberId) {
        const session = await memberAttendedWeek(identity.memberId, week);
        if (session) {
          attendedNew = (await awardPoints([{ reason: "attended", ref: session, points: POINTS.attended, ...who }])) > 0;
        }
      }

      if (loginNew || attendedNew) invalidateBoard();
      welcome = {
        points: (loginNew ? login.reduce((sum, award) => sum + award.points, 0) : 0) + (attendedNew ? POINTS.attended : 0),
        streak,
        attended: attendedNew,
      };
    } catch (error) {
      console.error("[play] could not pay today's visit", error);
    }
    void refreshCrown();
  }

  return NextResponse.json(
    { ...seat, name: identity.name, slug: identity.slug, guestToken: token, welcome },
    { headers: { "Cache-Control": "no-store" } },
  );
}
