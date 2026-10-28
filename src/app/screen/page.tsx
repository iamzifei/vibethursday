import type { Metadata } from "next";
import QRCode from "qrcode";
import { KeepAwake } from "@/components/KeepAwake";
import { requestOrigin } from "@/lib/request-origin";
import { SCREEN_LINKS, SCREEN_MEMBER, SCREEN_SCHEDULE } from "@/lib/screen";

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
  const [checkinQr, signupQr, memberQr] = await Promise.all([
    qrSvg(`${origin}${SCREEN_LINKS.checkin}`),
    qrSvg(`${origin}${SCREEN_LINKS.signup}`),
    qrSvg(`${origin}${SCREEN_LINKS.member}`),
  ]);

  return (
    <main className="screen">
      <KeepAwake />
      <div className="screen__slide screen__slide--a">
      <section className="screen__intro">
        <p className="eyebrow">§ Vibe Thursday · 疯狂星期四</p>
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
      <section className="screen__codes screen__codes--pair">
        {/* Built by this app from URLs this app composed; nothing from the request. */}
        <figure>
          <div className="door-qr screen__qr" aria-label="签到二维码" dangerouslySetInnerHTML={{ __html: checkinQr }} />
          <figcaption><strong>扫码签到</strong>到了先签到 · vibethursday.com/go</figcaption>
        </figure>
        <figure>
          <div className="door-qr screen__qr" aria-label="报名二维码" dangerouslySetInnerHTML={{ __html: signupQr }} />
          <figcaption><strong>扫码报名</strong>每周四免费 · 下周也能报</figcaption>
        </figure>
      </section>
      </div>
      <div className="screen__slide screen__slide--b">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="screen__poster" src="/class/poster-member.webp" width={1080} height={1619} alt="疯狂星期四共创会员海报" />
        <section className="screen__intro">
          <p className="eyebrow">§ 想系统学 AI 的</p>
          <h1>疯狂星期四<br />共创会员</h1>
          <p className="screen__price">{SCREEN_MEMBER.price}</p>
          <ul className="screen__points">
            {SCREEN_MEMBER.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        </section>
        <figure className="screen__codes">
          <div className="door-qr screen__qr" aria-label="会员介绍二维码" dangerouslySetInnerHTML={{ __html: memberQr }} />
          <figcaption><strong>扫码看会员详情</strong>vibethursday.com/vip</figcaption>
        </figure>
      </div>
    </main>
  );
}
