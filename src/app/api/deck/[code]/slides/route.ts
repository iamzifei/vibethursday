import { NextResponse } from "next/server";
import { keyMatches, MAX_SLIDE_BYTES, MAX_SLIDES, publish } from "@/lib/deck";
import { addDeckSlide, clearDeckSlides, getDeck } from "@/lib/db";
import { sniffImage } from "@/lib/image-sniff";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Adds one page.
 *
 * One request per page rather than one request carrying the whole deck: on the
 * venue's mobile data a single twelve-megabyte upload that fails at 90% has to
 * start over, whereas twelve small ones fail one at a time and retry cheaply.
 * It also lets the presenter watch a progress count instead of a spinner.
 */
export async function POST(request: Request, { params }: Context) {
  const { code } = await params;

  const form = await request.formData().catch(() => null);
  const providedKey = form?.get("key");
  const file = form?.get("slide");

  const deck = await getDeck(code);
  if (!deck) return NextResponse.json({ error: "no_such_deck" }, { status: 404 });

  if (!keyMatches(typeof providedKey === "string" ? providedKey : undefined, deck.presenterKey)) {
    return NextResponse.json({ error: "not_presenter" }, { status: 403 });
  }

  if (deck.slideCount >= MAX_SLIDES) {
    return NextResponse.json({ error: "too_many_slides" }, { status: 409 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (file.size > MAX_SLIDE_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(bytes);

  if (!mime || !ALLOWED.has(mime)) {
    return NextResponse.json({ error: "bad_type" }, { status: 415 });
  }

  try {
    const idx = await addDeckSlide(code, { bytes, mime });

    // Tell the room the deck grew. Someone who scanned the QR while the
    // presenter was still uploading otherwise sits on "no slides yet" until
    // the first page turn.
    publish(code, { index: deck.currentIndex, slideCount: idx + 1, rev: deck.rev });

    return NextResponse.json({ idx, slideCount: idx + 1 });
  } catch (error) {
    console.error("[deck] failed to store a slide", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

/** Throws the deck away so it can be re-uploaded. The room code and any QR
 *  already printed or projected keep working. */
export async function DELETE(request: Request, { params }: Context) {
  const { code } = await params;

  const body = await request.json().catch(() => null);
  const providedKey = typeof body?.key === "string" ? body.key : undefined;

  const deck = await getDeck(code);
  if (!deck) return NextResponse.json({ error: "no_such_deck" }, { status: 404 });

  if (!keyMatches(providedKey, deck.presenterKey)) {
    return NextResponse.json({ error: "not_presenter" }, { status: 403 });
  }

  const rev = await clearDeckSlides(code);
  publish(code, { index: 0, slideCount: 0, rev });

  return NextResponse.json({ ok: true, rev });
}
