import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession, staffInviteToken } from "@/lib/admin-auth";
import { siteUrl } from "@/lib/site";
import { listPersonRoles, searchSignups, type PersonRoleRow } from "@/lib/db";
import { PERSON_ROLE_KINDS, ROLE_LABEL, type PersonRoleKind } from "@/lib/person-roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "身份与助理 · 后台", robots: { index: false, follow: false } };

type PageProps = { searchParams: Promise<{ q?: string; err?: string }> };

const ABOUT: Record<PersonRoleKind, string> = {
  mentor: "主办人定向邀请、有专业能力或行业认知的人。可以参加周二线上（不用办会员），名片上显示「导师团」。",
  volunteer: "帮忙办活动的人（签到台、门口）。只在后台可见，名片上不显示。",
  builder: "来周二、确定一起做某个项目的人，交付方或需求方都算。名片上显示「共建者」；备注写做哪个项目。",
  assistant: "团队成员。加上以后把下面的「专属登录链接」私发给 TA，点一次就登录；以后打开 vibethursday.com/staff 直接进后台。能做：签到台、门口签到码、帮人签到、标周二已付、候补、问答、照片审核，能看完整微信号。看不到收款金额，不能免收、不能动会员和付款链接。名片上不显示。",
};

/**
 * The two organiser-given roles (2026-11-02, person-roles.ts): who is on the
 * 导师团 and who is a 共建者, a search to add someone, and a button to remove.
 * 共创会员 is bought, not given, and lives on /admin/members.
 */
export default async function RolesPage({ searchParams }: PageProps) {
  if (!isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) {
    return (
      <main className="shell section">
        <p className="body">没有权限。先打开一次后台链接。</p>
      </main>
    );
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 40);
  const [roles, found] = await Promise.all([listPersonRoles(), query ? searchSignups(query) : Promise.resolve([])]);
  const holders = (role: PersonRoleKind) => roles.filter((row) => row.role === role);

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>身份与助理</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          共创会员是付费的，在 <a href="/admin/members">共创会员</a> 那一页。下面这些身份由你给，随时可以加、可以去掉。「助理」是团队成员，加上以后把 TA 那一行的专属登录链接私发过去。
        </p>
      </div>
      {params.err && <p className="alert" role="alert">没存上：这个人的报名记录可能已经被合并或删除，刷新再试。</p>}

      <section className="card stack-3">
        <h2 className="h3" style={{ margin: 0 }}>添加</h2>
        <p className="body-sm" style={{ margin: 0 }}>
          ① 在下面搜这个人的名字或微信号（要在网站上报过名）；② 在搜出来的那一行点「加为助理」「加为导师团」等按钮。要去掉，在下面的名单里点「移除」。
        </p>
        <form className="wall-search" action="/admin/roles">
          <input className="field" type="search" name="q" defaultValue={query} placeholder="搜报过名的人：名字或微信号" autoFocus={!query} />
          <button className="btn btn--secondary" type="submit">搜</button>
        </form>
        {query && found.length === 0 && <p className="body-sm" style={{ color: "var(--fg3)" }}>没找到。要先在网站上报过一次名才能加。</p>}
        {found.length > 0 && (
          <ul className="desk-list">
            {found.map((person) => (
              <li className="desk-row" key={person.id}>
                <div className="desk-row__who">
                  <strong className="desk-row__name">{person.name}</strong>
                  <span className="mono desk-row__wechat">{person.wechat ?? "没填微信号"}</span>
                  {person.building && <span className="body-sm desk-row__topic">{person.building}</span>}
                </div>
                <div className="desk-row__actions">
                  {PERSON_ROLE_KINDS.map((role) => (
                    <form method="post" action="/api/admin/roles" key={role} className="stack-1">
                      <input type="hidden" name="signupId" value={person.id} />
                      <input type="hidden" name="role" value={role} />
                      {role === "builder" && <input className="field" name="note" placeholder="做哪个项目" maxLength={200} />}
                      <button className="btn btn--secondary btn--sm" type="submit">加为{ROLE_LABEL[role]}</button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(["assistant", "mentor", "volunteer", "builder"] as const).map((role) => (
        <section className="stack-3" id={role} key={role}>
          <h2 className="h3" style={{ margin: 0 }}>{ROLE_LABEL[role]} · {holders(role).length} 人</h2>
          <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>{ABOUT[role]}</p>
          {holders(role).length === 0 ? (
            <p className="body-sm" style={{ color: "var(--fg3)" }}>还没有人。</p>
          ) : (
            <RoleList rows={holders(role)} />
          )}
        </section>
      ))}
    </main>
  );
}

function RoleList({ rows }: { rows: PersonRoleRow[] }) {
  return (
    <ul className="desk-list">
      {rows.map((row) => (
        <li className="desk-row" key={`${row.signup_id}-${row.role}`}>
          <div className="desk-row__who">
            <strong className="desk-row__name">{row.name}</strong>
            <span className="mono desk-row__wechat">{row.wechat ?? "没填微信号"} · {row.added_on} 加入</span>
            {row.note && <span className="body-sm desk-row__topic">{row.note}</span>}
            {row.role === "assistant" && <AssistantLink row={row} />}
          </div>
          <div className="desk-row__actions">
            <form method="post" action="/api/admin/roles">
              <input type="hidden" name="signupId" value={row.signup_id} />
              <input type="hidden" name="role" value={row.role} />
              <input type="hidden" name="action" value="remove" />
              <button className="btn btn--secondary btn--sm" type="submit">移除</button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * An assistant's personal link (2026-11-02): send it to them in WeChat; one
 * tap signs that phone in. To replace a lost or leaked link, remove the role
 * and add it again — the old link and every phone signed in with it stop at once.
 */
function AssistantLink({ row }: { row: PersonRoleRow }) {
  const token = staffInviteToken(row.signup_id, row.stamp);
  if (!token) return null;
  return (
    <details className="body-sm">
      <summary>专属登录链接（私发给 TA，点一次即可）</summary>
      <p className="mono" style={{ overflowWrap: "anywhere", margin: "var(--space-1) 0" }}>
        {`${siteUrl()}/api/staff/session?invite=${token}`}
      </p>
      <p style={{ margin: 0, color: "var(--fg3)" }}>链接丢了或发错人：点「移除」再重新加为助理，旧链接和已登录的手机立刻失效。</p>
    </details>
  );
}
