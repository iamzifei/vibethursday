import { NextResponse } from "next/server";
import { getMemberById } from "@/lib/db";
import { join } from "@/lib/game/room";
import { currentMemberId } from "@/lib/member-auth";
import { tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Steps into the shared world of /play.
 *
 * A member who is signed in walks around under their wall name, and only if
 * their card is published and not hidden — the same gate the wall itself
 * uses, so the game can never show a name the wall would not. Everybody else
 * is a guest with a generated name. Nobody types a name here at all.
 */
export async function POST(request: Request) {
  // Sized for a room of phones on one café's Wi-Fi, not for one person.
  const limited = tooMany(request, "play-join", 120);
  if (limited) return limited;

  let identity: { memberId: string | null; name: string | null; slug: string | null } = {
    memberId: null,
    name: null,
    slug: null,
  };

  try {
    const memberId = await currentMemberId();
    if (memberId) {
      const member = await getMemberById(memberId);
      if (member && member.published && !member.hidden) {
        identity = { memberId, name: member.display_name, slug: member.slug };
      }
    }
  } catch {
    // No database (a local build) or a bad cookie: play as a guest.
  }

  const seat = join(identity);
  if (!seat) return NextResponse.json({ error: "full" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  return NextResponse.json(
    { ...seat, name: identity.name, slug: identity.slug },
    { headers: { "Cache-Control": "no-store" } },
  );
}
