import { NextResponse } from "next/server";
import { saveSignup } from "@/lib/db";
import { nextThursdays } from "@/lib/sessions";
import { verifyTurnstile } from "@/lib/turnstile";

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

  // Bot check runs before any validation, so a failed challenge never reveals
  // which fields the endpoint cares about or whether an email is already known.
  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() ?? null;

  const botCheck = await verifyTurnstile(clean(body.turnstileToken, 2048), remoteIp);

  if (!botCheck.ok) {
    // 403 for a genuine failed challenge, 503 when our own verification path
    // is broken — the visitor should be told to retry, not that they look
    // like a robot.
    const isOurFault = botCheck.reason === "not_configured" || botCheck.reason === "unreachable";
    return NextResponse.json(
      { error: isOurFault ? "server_error" : "failed_bot_check" },
      { status: isOurFault ? 503 : 403 },
    );
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
