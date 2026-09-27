import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LANG_PARAM, resolveLang } from "@/lib/content";
import { saveOrder } from "@/lib/db";
import { VENUE_MENU } from "@/lib/menu";
import {
  canOrder,
  isSessionDate,
  orderCookieName,
  orderToken,
  priceOrder,
  readOrderToken,
  verifyOrderCode,
} from "@/lib/order";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/request-origin";
import { sydneyToday } from "@/lib/sessions";

// Writes to Postgres; never prerender or cache.
export const dynamic = "force-dynamic";

/** Same allowance as check-in and feedback: a room on one café Wi-Fi is one address. */
const ORDERS_PER_HOUR = 200;

/** How long this phone remembers its order: past the session, not for good. */
const COOKIE_DAYS = 14;

/** Trims, drops empties, caps length. */
function clean(value: FormDataEntryValue | null, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Takes one drink order.
 *
 * A plain form post with a 303 back to `/order`, like `/api/feedback`. The
 * checks run in the same order: the code is the door, the window is checked
 * against today rather than the date in the link, then the rate limit, then
 * the body. The price is looked up from the menu; nothing the browser sends
 * about money is read.
 *
 * On success the phone gets a signed cookie naming its order, so ordering
 * again changes that order instead of adding a second line to the sheet, and
 * the redirect carries the same signed id as `mine=` so the page it lands on
 * is a receipt that still works if the cookie is lost.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);

  const session = clean(form?.get("session") ?? null, 10) ?? "";
  const code = clean(form?.get("code") ?? null, 40) ?? "";
  const lang = resolveLang(clean(form?.get("lang") ?? null, 10) ?? undefined);
  const origin = await requestOrigin();

  const back = (extra: Record<string, string>) => {
    const url = new URL("/order", origin);
    url.searchParams.set("s", session);
    url.searchParams.set("k", code);
    const param = LANG_PARAM[lang];
    if (param) url.searchParams.set("lang", param);
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return NextResponse.redirect(url, 303);
  };

  if (!isSessionDate(session) || !verifyOrderCode(session, code)) {
    return back({ err: "code" });
  }

  if (!canOrder(session, sydneyToday().toISOString().slice(0, 10))) {
    return back({ err: "code" });
  }

  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(`order:${remoteIp}`, ORDERS_PER_HOUR).allowed) {
    return back({ err: "rate" });
  }

  const name = clean(form?.get("name") ?? null, 60);
  const itemId = clean(form?.get("item") ?? null, 60);
  const priced = priceOrder(VENUE_MENU, itemId, clean(form?.get("size") ?? null, 10));

  // Hand back what was typed, so a missed radio button does not cost the name.
  const typed: Record<string, string> = {};
  if (name) typed.n = name;
  if (itemId) typed.i = itemId;

  if (!name) return back({ err: "name", edit: "1", ...typed });
  if (!priced) return back({ err: "drink", edit: "1", ...typed });

  const store = await cookies();
  const cookieName = orderCookieName(session);

  try {
    const id = await saveOrder({
      id: readOrderToken(store.get(cookieName)?.value),
      session,
      name,
      wechat: clean(form?.get("wechat") ?? null, 100),
      itemId: priced.itemId,
      itemLabel: priced.label,
      size: priced.size,
      priceCents: priced.cents,
      note: clean(form?.get("note") ?? null, 80),
      lang,
    });

    const token = orderToken(id);
    const response = back({ mine: token });

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/",
      maxAge: COOKIE_DAYS * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("[order] failed", error);
    return back({ err: "failed", edit: "1", ...typed });
  }
}
