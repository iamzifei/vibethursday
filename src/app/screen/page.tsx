import type { Metadata } from "next";
import QRCode from "qrcode";
import { KeepAwake } from "@/components/KeepAwake";
import { requestOrigin } from "@/lib/request-origin";
import { SCREEN_LINKS, SCREEN_SCHEDULE } from "@/lib/screen";
import { deskSession, formatSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vibe Thursday · 今天", robots: { index: false } };

/** Dark on white, never inverted: plenty of scanners fail on a light-on-dark code. */
function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0b0d", light: "#ffffff" } });
}

/**
 * The venue screen (2026-10-22): what this morning is, how it runs, and two
 * codes — sign up, and add the dinner. Public, unlike /admin/door: nothing
 * here is not already on the home page, and the check-in code stays on the
 * door tablet, where only the people in the room can scan it.
 */
export default async function ScreenPage() {
  const origin = await requestOrigin();
  const [signupQr, dinnerQr] = await Promise.all([qrSvg(`${origin}${SCREEN_LINKS.signup}`), qrSvg(`${origin}${SCREEN_LINKS.dinner}`)]);
  const today = formatSession(deskSession(), "zh");

  return (
    <main className="screen">
      <KeepAwake />
      <section className="screen__intro">
        <p className="eyebrow">§ Vibe Thursday · 疯狂星期四 · {today}</p>
        <h1>一群用 AI 做事的人，<br />每周四聚一次。</h1>
        <p className="screen__lead">这不是课，没有系统教学。手上有东西就打开给大家看，做了一半也行；卡住了，现场问。</p>
        <ol className="screen__schedule">
          {SCREEN_SCHEDULE.map((slot) => (
            <li key={slot.time}>
              <span className="mono">{slot.time}</span>
              <div>
                <strong>{slot.title}</strong>
                <p>{slot.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="screen__codes">
        <figure>
          {/* Built by this app from a URL this app composed; nothing from the request. */}
          <div className="door-qr screen__qr" aria-label="报名二维码" dangerouslySetInnerHTML={{ __html: signupQr }} />
          <figcaption><strong>扫码报名</strong>每周四免费 · 下周也能报</figcaption>
        </figure>
        <figure>
          <div className="door-qr screen__qr" aria-label="加订聚餐二维码" dangerouslySetInnerHTML={{ __html: dinnerQr }} />
          <figcaption><strong>加订散场聚餐</strong>40 澳元含 GST · 一道主菜 + 一杯咖啡 · 限 12 席</figcaption>
        </figure>
      </section>
    </main>
  );
}
