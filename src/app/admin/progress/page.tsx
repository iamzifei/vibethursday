import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { getCopy } from "@/lib/content";
import { listProgress, listWallMembers } from "@/lib/db";
import { MAX_DETAIL, MAX_TITLE, PROGRESS_KINDS, progressByWork, type ProgressEntry } from "@/lib/progress";
import { sydneyToday } from "@/lib/sessions";
import { listWorks } from "@/lib/works";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "作品进展 · 后台", robots: { index: false } };

type PageProps = { searchParams: Promise<{ err?: string; ok?: string }> };

const ERRORS: Record<string, string> = {
  member: "找不到这个作品的做的人，刷新再试。",
  hash: "作品标识不对，刷新再试。",
  date: "日期不对。",
  kind: "类型不对。",
  title: `「发生了什么」要填，最多 ${MAX_TITLE} 字。`,
  detail: `「补充」最多 ${MAX_DETAIL} 字。`,
  proof: "证明链接要以 https:// 开头；证书类必须附发证方的核验链接。",
};

/**
 * The organiser's view of every work's progress record (2026-11-02,
 * progress.ts): add an entry (it starts as a draft), confirm it once the
 * maker has said yes, or delete it. Entries whose work was renamed no longer
 * match any work and are listed apart, so they can be cleared.
 */
export default async function ProgressAdminPage({ searchParams }: PageProps) {
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

  const params = await searchParams;
  const labels = getCopy("zh").works.detail.progress.kinds;
  const [members, entries] = await Promise.all([listWallMembers(), listProgress()]);
  const idBySlug = new Map(members.map((member) => [member.slug, member.id]));
  const works = listWorks(members);
  const byWork = progressByWork(entries);
  const matched = new Set<string>();
  // Sydney's date, not UTC: on a Tuesday morning UTC is still Monday.
  const today = sydneyToday().toISOString().slice(0, 10);

  const Entry = ({ entry, anchor }: { entry: ProgressEntry; anchor: string }) => (
    <li className="stack-1">
      <span>
        <strong>{entry.happened_on}</strong> · {labels[entry.kind]} · {entry.title}
        {entry.confirmed ? " ✓ 已公开" : " · 草稿（不公开）"}
      </span>
      {entry.detail && <span className="body-sm tagger-muted">{entry.detail}</span>}
      {entry.proof_url && <span className="body-sm tagger-muted">{entry.proof_url}</span>}
      <span style={{ display: "flex", gap: "0.5rem" }}>
        <form method="post" action="/api/admin/progress">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="anchor" value={anchor} />
          <input type="hidden" name="action" value={entry.confirmed ? "unconfirm" : "confirm"} />
          <button className="btn btn--secondary" type="submit">{entry.confirmed ? "撤回成草稿" : "确认公开"}</button>
        </form>
        <form method="post" action="/api/admin/progress">
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="anchor" value={anchor} />
          <input type="hidden" name="action" value="delete" />
          <button className="btn btn--secondary" type="submit">删除</button>
        </form>
      </span>
    </li>
  );

  return (
    <main className="shell section stack-6 tagger">
      <div className="stack-3">
        <div className="tagger-top">
          <span className="eyebrow">后台 · 作品进展</span>
          <span className="tagger-top__links">
            <Link href="/admin">回后台</Link>
          </span>
        </div>
        <h1 className="h2">作品进展 · {works.length} 个作品</h1>
        <p className="body">
          新增的每一条都是<strong>草稿</strong>，网站上看不到。<strong>点「确认公开」= 做的人已经同意公开这一条</strong>，
          先在微信上问过再点。证书类请附发证方的官方验证链接（比如 Credly），不要附截图。
        </p>
        {params.err && ERRORS[params.err] && <p className="alert" role="alert">{ERRORS[params.err]}</p>}
        {params.ok === "added" && <p className="body-sm">已存为草稿。</p>}
      </div>

      {works.map((work) => {
        const memberId = idBySlug.get(work.slug);
        if (!memberId) return null;
        const hash = work.key.slice(-6);
        const pair = `${memberId}:${hash}`;
        matched.add(pair);
        const mine = byWork.get(pair) ?? [];
        const anchor = `w-${memberId}-${hash}`;
        return (
          <section className="card stack-3" id={anchor} key={work.key}>
            <h2 className="h3" style={{ margin: 0 }}>
              <Link href={`/works/${work.key}`}>{work.title}</Link>
              <span className="tagger-muted"> · {work.maker}</span>
            </h2>
            {mine.length > 0 && (
              <ul className="stack-2" style={{ margin: 0 }}>
                {mine.map((entry) => <Entry key={entry.id} entry={entry} anchor={anchor} />)}
              </ul>
            )}
            <details>
              <summary>加一条</summary>
              <form method="post" action="/api/admin/progress" className="stack-2" style={{ marginTop: "0.75rem" }}>
                <input type="hidden" name="action" value="add" />
                <input type="hidden" name="member" value={memberId} />
                <input type="hidden" name="hash" value={hash} />
                <label className="label">
                  日期 <input className="field" type="date" name="date" defaultValue={today} max={today} required />
                </label>
                <label className="label">
                  类型{" "}
                  <select className="field" name="kind" defaultValue="tuesday">
                    {PROGRESS_KINDS.map((kind) => <option key={kind} value={kind}>{labels[kind]}</option>)}
                  </select>
                </label>
                <label className="label">
                  发生了什么 <input className="field" name="title" maxLength={MAX_TITLE} required placeholder="比如：在周二 demo 了第一版，三个人当场试用" />
                </label>
                <label className="label">
                  补充（卡在哪、下一步，可空） <textarea className="field" name="detail" maxLength={MAX_DETAIL} rows={2} />
                </label>
                <label className="label">
                  证明链接（可空，https） <input className="field" name="proof" type="url" placeholder="https://" />
                </label>
                <button className="btn btn--primary" type="submit">存为草稿</button>
              </form>
            </details>
          </section>
        );
      })}

      {(() => {
        const orphans = entries.filter((entry) => !matched.has(`${entry.member_id}:${entry.work_hash}`));
        if (orphans.length === 0) return null;
        return (
          <section className="card stack-3">
            <h2 className="h3" style={{ margin: 0 }}>对不上的记录 · {orphans.length}</h2>
            <p className="body-sm tagger-muted">作品改了名、被删了，或者名片被隐藏了。网站上都不显示，需要的话重新录到新名字下面再删掉这里的。</p>
            <ul className="stack-2" style={{ margin: 0 }}>
              {orphans.map((entry) => <Entry key={entry.id} entry={entry} anchor="" />)}
            </ul>
          </section>
        );
      })()}
    </main>
  );
}
