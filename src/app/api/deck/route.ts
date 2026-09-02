import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { closeStaleDecks, createDeck } from "@/lib/db";
import { requestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Opens a room.
 *
 * Admin-only, which is the whole access model: whoever opens the room is
 * handed a presenter key and becomes the one person who can turn the page.
 * Everyone else needs nothing but the four-digit code, because the audience
 * side of this is a page you look at, exactly like `/badge` and the member
 * wall — putting a login in front of it would defeat the point of a QR code
 * on a café table.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const key = form?.get("key");

  if (!isAdmin(typeof key === "string" ? key : undefined)) {
    return NextResponse.json({ error: "not_authorised" }, { status: 401 });
  }

  const rawTitle = form?.get("title");
  const title =
    typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim().slice(0, 120) : null;

  // Opening a room is the natural moment to clear out the last ones: it
  // happens a handful of times a week, always by hand, and never on a path a
  // visitor is waiting on. A cron job for this would be more moving parts than
  // the thing it maintains.
  await closeStaleDecks().catch((error) => {
    console.error("[deck] could not close stale decks", error);
  });

  const deck = await createDeck(title);

  // A redirect rather than JSON, so the control on /admin can be an ordinary
  // form and this whole path needs no client-side script — the same rule the
  // rest of the site follows. 303 so the browser follows it with GET.
  //
  // The presenter key lands in the URL of the page it redirects to, which is
  // where it is meant to live: that link is the thing you send to the phone you
  // will actually be presenting from.
  //
  // ⚠️ Built from `requestOrigin()`, NOT from `request.url`. In production this
  // process sits behind a proxy and `request.url` is the address the container
  // answers on — `https://localhost:8080/...`, which is a link nobody can open
  // and which is not obviously wrong until somebody tries. The same helper
  // builds the QR code on the page this lands on, so the two always agree.
  const target = new URL(`/present/${deck.code}`, await requestOrigin());
  target.searchParams.set("k", deck.presenterKey);

  return NextResponse.redirect(target, 303);
}
