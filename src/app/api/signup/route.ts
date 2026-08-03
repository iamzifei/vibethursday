import { NextResponse } from "next/server";
import { saveSignup } from "@/lib/db";
import { nextThursdays } from "@/lib/sessions";
import { checkRateLimit } from "@/lib/rate-limit";
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

  const forwardedFor = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim() ?? null;

  // Rate limit first — it is the defence that still works when the challenge
  // does not, and it costs nothing to evaluate.
  const rate = checkRateLimit(remoteIp ?? "unknown");

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  // Advisory: only a token that is present AND invalid blocks the submission.
  // A missing token means the challenge never completed in that browser, which
  // must not cost someone their signup.
  const { verdict } = await verifyTurnstile(clean(body.turnstileToken, 2048), remoteIp);

  if (verdict === "rejected") {
    return NextResponse.json({ error: "failed_bot_check" }, { status: 403 });
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
      botCheck: verdict,
    });
  } catch (error) {
    console.error("[signup] failed to save", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
