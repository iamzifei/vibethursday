/**
 * Sending one email (2026-10-28): the sign-in code for recorded lessons.
 *
 * SendGrid's v3 API over plain fetch, no SDK. Click and open tracking are off:
 * a sign-in code is not marketing, and tracking rewrites links.
 *
 * - SENDGRID_API_KEY
 * - MAIL_FROM — an address on a domain authenticated in SendGrid
 */

export function mailConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailConfigured()) return false;
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.MAIL_FROM, name: "Vibe Thursday" },
        subject,
        content: [{ type: "text/plain", value: text }],
        tracking_settings: { click_tracking: { enable: false }, open_tracking: { enable: false } },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.error("[mail] SendGrid refused", response.status, await response.text().catch(() => ""));
    return response.ok;
  } catch (error) {
    console.error("[mail] send failed", error);
    return false;
  }
}
