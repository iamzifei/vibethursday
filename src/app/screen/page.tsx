import type { Metadata } from "next";
import QRCode from "qrcode";
import { KeepAwake } from "@/components/KeepAwake";
import { requestOrigin } from "@/lib/request-origin";
import { SCREEN_LINKS, screenFor } from "@/lib/screen";
import { isSpecialSession, sydneyToday } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vibe Thursday · 今天", robots: { index: false } };

/** Dark on white, never inverted: plenty of scanners fail on a light-on-dark code. */
function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0a0b0d", light: "#ffffff" } });
}

/**
 * The venue screen (2026-10-22), two slides that take turns on the TV
 * (CSS only, `.screen__slide`; on a phone they simply stack): this morning
 * with a code to check in (/go) beside the code to sign up, then the
 * membership with its poster and a code to /vip. No dates, so the same
 * screen serves every week (James 2026-10-23). The check-in code leads to /go,
 * not to the door tablet's own code: /go only offers checking in during the
 * session window (`checkinLinkOpen`), so showing it here opens nothing new.
 */
export default async function ScreenPage() {
  const origin = await requestOrigin();
  // A Build Tuesday gets its own day on the screen (2026-11-02).
  const tuesday = isSpecialSession(sydneyToday().toISOString().slice(0, 10));
  const day = screenFor(tuesday);
  const [checkinQr, signupQr, secondQr] = await Promise.all([
    qrSvg(`${origin}${SCREEN_LINKS.checkin}`),
    qrSvg(`${origin}${tuesday ? SCREEN_LINKS.tuesday : SCREEN_LINKS.signup}`),
    qrSvg(`${origin}${day.second.href}`),
  ]);

  return (
    <main className="screen">
      <KeepAwake />
      <div className="screen__slide screen__slide--a">
      <section className="screen__intro">
        <p className="eyebrow">{day.eyebrow}</p>
        <h1>{day.title}</h1>
        <p className="screen__lead">{day.lead}</p>
        <ol className="screen__schedule">
          {day.schedule.map((slot) => (
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
      <section className="screen__codes screen__codes--pair">
        {/* Built by this app from URLs this app composed; nothing from the request. */}
        <figure>
          <div className="door-qr screen__qr" aria-label="签到二维码" dangerouslySetInnerHTML={{ __html: checkinQr }} />
          <figcaption><strong>扫码签到</strong>到了先签到 · vibethursday.com/go</figcaption>
        </figure>
        <figure>
          <div className="door-qr screen__qr" aria-label="报名二维码" dangerouslySetInnerHTML={{ __html: signupQr }} />
          <figcaption><strong>扫码报名</strong>{day.signupCaption}</figcaption>
        </figure>
      </section>
      </div>
      <div className="screen__slide screen__slide--b">
        <section className="screen__intro">
          <p className="eyebrow">§ {day.second.eyebrow}</p>
          <h1>{day.second.title}</h1>
          <p className="screen__price">{day.second.price}</p>
          <ul className="screen__points">
            {day.second.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
        <figure className="screen__codes">
          <div className="door-qr screen__qr" aria-label="第二个二维码" dangerouslySetInnerHTML={{ __html: secondQr }} />
          <figcaption>{day.second.caption}</figcaption>
        </figure>
      </div>
    </main>
  );
}
