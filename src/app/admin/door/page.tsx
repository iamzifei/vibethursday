import type { Metadata } from "next";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { KeepAwake } from "@/components/KeepAwake";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { checkinCode, isSessionDate } from "@/lib/checkin";
import { requestOrigin } from "@/lib/request-origin";
import { deskSession, formatSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "签到 · Vibe Thursday", robots: { index: false } };

/**
 * The check-in code, full screen, for a tablet propped up at the door.
 *
 * The same code /admin shows, without the rest of /admin around it: on
 * 1 October most of the room never checked in, because nobody was holding a
 * code at the door, and /admin itself cannot be left on a table —
 * it carries the whole signup list (James 2026-10-01). Organiser-only, like
 * /admin, so the code is not one more public link.
 */
type PageProps = { searchParams: Promise<{ s?: string }> };

export default async function DoorPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">Not authorised</h1>
          <p className="body-sm">
            Open <code>/admin?key=YOUR_ADMIN_TOKEN</code> once on this device, then come back here.
          </p>
        </div>
      </main>
    );
  }

  // The Tuesday on a Build Tuesday, otherwise the Thursday in focus — or any
  // date given as ?s=, so a code can be printed ahead and taped to the door
  // (suggested by a helper, 2026-11-02). It still only works on that day.
  const requested = (await searchParams).s;
  const session = requested && isSessionDate(requested) ? requested : deskSession();
  const url = `${await requestOrigin()}/checkin?s=${session}&k=${checkinCode(session)}`;
  // Dark on white, never inverted: plenty of scanners fail on a light-on-dark code.
  const qr = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0b0d", light: "#ffffff" },
  });

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-6)",
        padding: "var(--space-6)",
        textAlign: "center",
      }}
    >
      {/* Screen stays on while this page is open. */}
      <KeepAwake />
      <h1 style={{ margin: 0 }}>扫码签到 · Scan to check in</h1>
      {/* Built by this app from a URL this app composed; nothing from the request. */}
      <div
        aria-label="签到二维码"
        className="door-qr"
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <p className="body-lg" style={{ margin: 0 }}>
        找不到自己的名字，直接写名字签到 · {formatSession(session, "zh")}
      </p>
      <p className="body-sm door-print-hint" style={{ margin: 0, color: "var(--fg3)" }}>
        要打印贴门口：用浏览器的「打印」。这个码只在 {formatSession(session, "zh")} 当天有效；别的日子在地址后面加 ?s=日期，比如 ?s=2026-11-10。
      </p>
    </main>
  );
}
