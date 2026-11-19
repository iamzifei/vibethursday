import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { listFeedback, listSignups } from "@/lib/db";
import { OWNER_SIZE_LABEL, ownerList, wechatKey } from "@/lib/owner-lead";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "老板名单 · 后台", robots: { index: false, follow: false } };

/**
 * Business owners (2026-11-19, owner-lead.ts), for following up on WeChat and
 * filling the owners' morning for each trade. Those who ticked "have James
 * look at my business" on a feedback form come first, then those who agreed
 * to a follow-up on /boss, then every other owner. Each row carries the
 * WeChat remark in the community's format, ready to paste. Organiser-only: it
 * carries WeChat IDs.
 */
export default async function OwnersPage() {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }
  const [signups, feedback] = await Promise.all([listSignups(), listFeedback()]);
  const asked = new Set(feedback.filter((row) => row.wants_call && row.wechat).map((row) => wechatKey(row.wechat)));
  const owners = ownerList(signups, asked);
  // Feedback hands raised by someone with no signup row under that WeChat ID.
  const known = new Set(signups.map((row) => wechatKey(row.wechat)));
  const strangers = feedback.filter((row) => row.wants_call && row.wechat && !known.has(wechatKey(row.wechat)));

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>老板名单 · {owners.length}</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          举手要一对一的 {owners.filter((row) => row.wantsCall).length + strangers.length} · 同意回访的 {owners.filter((row) => row.consent).length}。
          备注那一栏照社群规则的格式写好了，加完微信直接贴。「要一对一」是按反馈表里填的微信号对上的，没核姓名，私信时先确认是本人。
        </p>
      </div>

      {strangers.length > 0 && (
        <section className="stack-3">
          <h2 className="h3" style={{ margin: 0 }}>反馈表举手、但没对上报名的</h2>
          <ul className="desk-list">
            {strangers.map((row) => (
              <li className="desk-row" key={row.id}>
                <div className="desk-row__who">
                  <strong className="desk-row__name">{row.name ?? "（没留名字）"}</strong>
                  <span className="mono desk-row__wechat">{row.wechat}</span>
                  <span className="body-sm desk-row__topic">{row.session} 的反馈</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="desk-list">
        {owners.map((row) => (
          <li className="desk-row" key={row.id}>
            <div className="desk-row__who">
              <strong className="desk-row__name">
                {row.name}
                {row.wantsCall && " · 🙋 要一对一"}
                {row.consent && " · 同意回访"}
                {row.owner_lead && !row.consent && " · 没勾回访，别主动加"}
              </strong>
              <span className="mono desk-row__wechat">{row.wechat ?? "（没有微信号）"}</span>
              <span className="body-sm desk-row__topic">备注：<span className="mono">{row.remark}</span></span>
              {row.owner_lead?.shop && <span className="body-sm desk-row__topic">店 / 公司：{row.owner_lead.shop}</span>}
              {row.owner_lead?.size && <span className="body-sm desk-row__topic">规模：{OWNER_SIZE_LABEL[row.owner_lead.size]}</span>}
              {(row.owner_lead?.need || row.topic) && <span className="body-sm desk-row__topic">想让 AI 做：{row.owner_lead?.need ?? row.topic}</span>}
              <span className="body-sm desk-row__topic" style={{ color: "var(--fg3)" }}>
                来过 {row.checked_in.length} 次 · 登记于 {row.created_at}{row.source === "boss" ? " · 从 /boss" : ""}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
