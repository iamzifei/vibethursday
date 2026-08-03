import { NextResponse } from "next/server";
import { saveSignup } from "@/lib/db";
import { nextThursdays } from "@/lib/sessions";

// This route writes to Postgres, so it must never be prerendered or cached.
export const dynamic = "force-dynamic";

const DEMO_INTENTS = new Set(["yes", "maybe", "listen"]);

/** Trims, drops empties, and caps length so one paste cannot fill a column. */
function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Deliberately loose email check. The only job here is to catch typos like a
 * missing @ before the address reaches the database; anything stricter starts
 * rejecting addresses that are actually valid.
 */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  // Honeypot: a field hidden from humans that bots fill in anyway. Answer 200
  // so the bot records a success and does not retry with a different shape.
  if (clean(body.company, 100)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name, 100);
  const email = clean(body.email, 200);

  if (!name || !email) {
    return NextResponse.json({ error: "missing_required" }, { status: 400 });
  }

  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const demoIntentRaw = clean(body.demoIntent, 20);
  const demoIntent = demoIntentRaw && DEMO_INTENTS.has(demoIntentRaw) ? demoIntentRaw : null;

  // Only accept a session date the form actually offered. Without this the
  // column would happily take any string a crafted request sent.
  const sessionRaw = clean(body.firstSession, 10);
  const firstSession = sessionRaw && nextThursdays(12).includes(sessionRaw) ? sessionRaw : null;

  try {
    await saveSignup({
      name,
      email,
      wechat: clean(body.wechat, 100),
      building: clean(body.building, 1000),
      demoIntent,
      firstSession,
      source: clean(body.source, 200),
      lang: clean(body.lang, 5) ?? "zh",
    });
  } catch (error) {
    console.error("[signup] failed to save", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
