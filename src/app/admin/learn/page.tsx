import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { ossConfigured, vodConfigured } from "@/lib/aliyun";
import { listInvites, listLearners, listLessonFiles, listLessons, listRecentComments } from "@/lib/learn-db";
import { formatDuration, INVITE_DAYS_DEFAULT, INVITE_USES_DEFAULT, inviteUsable, parseChapters } from "@/lib/learn";
import { requestOrigin } from "@/lib/request-origin";
import { mailConfigured } from "@/lib/mail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "录播课 · 后台", robots: { index: false } };

type PageProps = { searchParams: Promise<{ r?: string }> };

const RESULTS: Record<string, string> = {
  saved: "已保存。",
  deleted: "已删除。",
  uploaded: "已上传。",
  "err-lesson": "标识只能用小写字母、数字和连字符，标题不能为空。",
  "err-video": "视频 ID 应该是 32 位的字母数字（在点播控制台「媒资库」里复制）。",
  "err-video-missing": "点播里找不到这个视频 ID，检查一下是不是复制错了。",
  "err-confirm": "删除前要勾选确认。",
  "err-file": "没选文件，或课程不存在。",
  "err-file-type": "只支持 PDF、Word、PPT、Markdown、TXT、ZIP，单个不超过 50 MB。",
  "err-oss": "资料存储还没配置好。",
  "err-learner": "学员信息不对。",
  "err-comment": "留言内容不能为空。",
  "err-invite": "邀请链接的名称不能为空，天数和人数要是正整数。",
  "invite-created": "邀请链接已生成，在下面复制。",
  "invite-revoked": "这条邀请链接已作废，之前通过它加入的人不受影响。",
  "err-server": "出错了，看一下服务器日志。",
};

const STATUS_LABEL = { pending: "待通过", approved: "已通过", revoked: "已关闭" } as const;

/** The organiser's side of /learn: lessons, handouts, who may watch, and comments. */
export default async function AdminLearnPage({ searchParams }: PageProps) {
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

  const { r } = await searchParams;
  const result = r?.startsWith("added-")
    ? `已放行 ${r.slice(6)} 个邮箱。`
    : r?.startsWith("kicked-")
      ? `已关闭 ${r.slice(7)} 位通过这条链接加入的学员。`
      : r
        ? RESULTS[r]
        : null;

  const [lessons, learners, comments, invites] = await Promise.all([
    listLessons(true),
    listLearners(),
    listRecentComments(100),
    listInvites(),
  ]);
  const origin = await requestOrigin();
  const inviteLabel = new Map(invites.map((i) => [i.id, i.label]));
  const joinedBy = (inviteId: string) => learners.filter((l) => l.inviteId === inviteId).length;
  const files = new Map(await Promise.all(lessons.map(async (l) => [l.id, await listLessonFiles(l.id)] as const)));
  const pending = learners.filter((l) => l.status === "pending");

  const setup = [
    !vodConfigured() && "视频点播",
    !ossConfigured() && "资料存储",
    !mailConfigured() && "邮箱验证码",
  ].filter(Boolean);

  return (
    <main className="shell section stack-8">
      <div className="stack-3">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <span className="eyebrow">后台 · 录播课</span>
          <span>
            <Link href="/learn">看学员页 →</Link> · <Link href="/admin">回后台</Link>
          </span>
        </div>
        <h1 className="h2">录播课</h1>
        {result && <p className={r?.startsWith("err") ? "alert alert--error" : "alert alert--success"}>{result}</p>}
        {setup.length > 0 && <p className="alert alert--error">还没配置：{setup.join("、")}（看部署环境变量）。</p>}
        {pending.length > 0 && (
          <p className="alert alert--error">
            <a href="#learners">{pending.length} 个人在等你通过 →</a>
          </p>
        )}
      </div>

      {/* ── Lessons ── */}
      <section className="stack-4" aria-labelledby="lessons">
        <h2 className="h3" id="lessons">
          课程（{lessons.length}）
        </h2>
        <p className="body-sm">
          视频先在阿里云视频点播控制台上传，转码完成后在「媒资库」复制视频 ID 填到这里。勾选「发布」后学员才看得到。
        </p>

        {[...lessons, null].map((lesson) => (
          <div key={lesson?.id ?? "new"} className="card stack-3" id={lesson ? `lesson-${lesson.id}` : "lesson-new"}>
            <h3 className="h3">
              {lesson ? (
                <>
                  {lesson.published ? "" : "【草稿】"}
                  {lesson.title}
                  {formatDuration(lesson.durationS) && <span className="body-sm"> · {formatDuration(lesson.durationS)}</span>}
                  {lesson.published && (
                    <>
                      {" "}
                      <Link className="body-sm" href={`/learn/${lesson.slug}`}>
                        打开 →
                      </Link>
                    </>
                  )}
                </>
              ) : (
                "新建一节课"
              )}
            </h3>

            <form className="stack-2" method="post" action="/api/admin/learn">
              <input type="hidden" name="action" value="save-lesson" />
              {lesson && <input type="hidden" name="id" value={lesson.id} />}
              <label className="label">
                标题
                <input className="field" name="title" required maxLength={120} defaultValue={lesson?.title ?? ""} />
              </label>
              <label className="label">
                网址标识（小写字母、数字、连字符，如 lesson-01）
                <input className="field" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} defaultValue={lesson?.slug ?? ""} />
              </label>
              <label className="label">
                视频 ID
                <input className="field" name="videoId" pattern="[a-f0-9]{32}" defaultValue={lesson?.videoId ?? ""} />
              </label>
              <label className="label">
                简介（选填）
                <textarea className="field" name="summary" maxLength={2000} defaultValue={lesson?.summary ?? ""} />
              </label>
              <label className="label">
                章节（选填，一行一个：时间 标题，如「4:46 申请 API Key」或「1:02:05 收尾」）
                <textarea
                  className="field"
                  name="chapters"
                  rows={6}
                  maxLength={8000}
                  placeholder={"0:00 开场\n4:46 申请 API Key\n18:41 配置微信服务号"}
                  defaultValue={lesson?.chapters ?? ""}
                />
                {lesson?.chapters && (
                  <span className="field-hint">已识别 {parseChapters(lesson.chapters, lesson.durationS).length} 个章节；没有时间或标题的行、超出视频长度的时间会被跳过</span>
                )}
              </label>
              <label className="label">
                排序（数字小的在前）
                <input className="field" name="position" type="number" defaultValue={lesson?.position ?? lessons.length + 1} />
              </label>
              <label className="choice">
                <input type="checkbox" name="published" defaultChecked={lesson?.published ?? false} /> 发布
              </label>
              <button className="btn btn--primary" type="submit" style={{ alignSelf: "flex-start" }}>
                {lesson ? "保存" : "新建"}
              </button>
            </form>

            {lesson && (
              <>
                <div className="stack-2">
                  <strong className="body-sm">教案和资料</strong>
                  {(files.get(lesson.id) ?? []).map((file) => (
                    <form key={file.id} method="post" action="/api/admin/learn" className="body-sm" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <input type="hidden" name="action" value="delete-file" />
                      <input type="hidden" name="id" value={file.id} />
                      <span>
                        {file.title}.{file.ext}
                      </span>
                      <button className="btn btn--secondary" type="submit">
                        删除
                      </button>
                    </form>
                  ))}
                  <form method="post" action="/api/admin/learn" encType="multipart/form-data" className="stack-2">
                    <input type="hidden" name="action" value="upload-file" />
                    <input type="hidden" name="lessonId" value={lesson.id} />
                    <input className="field" name="title" placeholder="显示名称（不填就用文件名）" maxLength={120} />
                    <input name="file" type="file" required accept=".pdf,.docx,.pptx,.md,.txt,.zip" />
                    <button className="btn btn--secondary" type="submit" style={{ alignSelf: "flex-start" }}>
                      上传
                    </button>
                  </form>
                </div>

                <form method="post" action="/api/admin/learn" className="body-sm" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="hidden" name="action" value="delete-lesson" />
                  <input type="hidden" name="id" value={lesson.id} />
                  <label className="choice">
                    <input type="checkbox" name="confirm" /> 确认删除这节课（留言和资料一起删）
                  </label>
                  <button className="btn btn--secondary" type="submit">
                    删除课程
                  </button>
                </form>
              </>
            )}
          </div>
        ))}
      </section>

      {/* ── Invite links ── */}
      <section className="stack-4" id="invites" aria-labelledby="invites-title">
        <h2 className="h3" id="invites-title">
          邀请链接（发到学员群里，点开登录、填名字就能直接看，不用你审批）
        </h2>

        <form className="card stack-2" method="post" action="/api/admin/learn">
          <input type="hidden" name="action" value="invite-create" />
          <label className="label">
            名称（只有你看得到，比如「10 月 AI 第一课 学员群」）
            <input className="field" name="label" required maxLength={60} />
          </label>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <label className="label">
              有效天数（留空 = 不过期）
              <input className="field" name="days" type="number" min={1} max={365} defaultValue={INVITE_DAYS_DEFAULT} />
            </label>
            <label className="label">
              最多几人（留空 = 不限，建议设成群人数加一点）
              <input className="field" name="maxUses" type="number" min={1} max={10000} defaultValue={INVITE_USES_DEFAULT} />
            </label>
          </div>
          <button className="btn btn--primary" type="submit" style={{ alignSelf: "flex-start" }}>
            生成邀请链接
          </button>
        </form>

        {invites.map((invite) => {
          const live = inviteUsable(invite);
          const count = joinedBy(invite.id);
          return (
            <div key={invite.id} className="card stack-2">
              <p className="body-sm">
                <strong>{invite.label}</strong> · {live ? "可用" : invite.revokedAt ? "已作废" : "已失效"} · 已加入 {invite.uses}
                {invite.maxUses !== null ? ` / ${invite.maxUses}` : ""} 人
                {invite.expiresAt ? ` · ${new Date(invite.expiresAt).toLocaleString("zh-CN", { timeZone: "Australia/Sydney" })}（悉尼时间）到期` : " · 不过期"}
              </p>
              {live && (
                <input className="field" readOnly value={`${origin}/learn/join/${invite.token}`} aria-label="邀请链接，全选复制" />
              )}
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                {!invite.revokedAt && (
                  <form method="post" action="/api/admin/learn">
                    <input type="hidden" name="action" value="invite-revoke" />
                    <input type="hidden" name="id" value={invite.id} />
                    <button className="btn btn--secondary" type="submit">
                      作废链接
                    </button>
                  </form>
                )}
                {count > 0 && (
                  <form method="post" action="/api/admin/learn" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <input type="hidden" name="action" value="invite-kick" />
                    <input type="hidden" name="id" value={invite.id} />
                    <label className="choice">
                      <input type="checkbox" name="confirm" /> 确认
                    </label>
                    <button className="btn btn--secondary" type="submit">
                      关闭通过这条链接加入的 {count} 人
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Learners ── */}
      <section className="stack-4" id="learners" aria-labelledby="learners-title">
        <h2 className="h3" id="learners-title">
          学员（{learners.length}，待通过 {pending.length}）
        </h2>

        <form className="card stack-2" method="post" action="/api/admin/learn">
          <input type="hidden" name="action" value="preapprove" />
          <label className="label" htmlFor="preapprove">
            按邮箱提前放行（一行一个，邮箱后面可以跟名字）
          </label>
          <textarea className="field" id="preapprove" name="list" placeholder={"someone@example.com 张三\nother@example.com"} />
          <button className="btn btn--secondary" type="submit" style={{ alignSelf: "flex-start" }}>
            放行
          </button>
        </form>

        <div style={{ overflowX: "auto" }}>
          <table className="body-sm" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>名字 / 备注</th>
                <th>登录方式</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr key={learner.id} style={{ borderTop: "1px solid var(--border-default)", verticalAlign: "top" }}>
                  <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>
                    <form method="post" action="/api/admin/learn" style={{ display: "flex", gap: "0.25rem" }}>
                      <input type="hidden" name="action" value="learner-name" />
                      <input type="hidden" name="id" value={learner.id} />
                      <input className="field" name="name" defaultValue={learner.name ?? ""} placeholder="（没留名字）" maxLength={40} style={{ minHeight: 36 }} />
                      <button className="btn btn--secondary" type="submit">
                        改名
                      </button>
                    </form>
                    {learner.note && <div>{learner.note}</div>}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {learner.email ?? (learner.openid ? "微信" : "—")}
                    {learner.inviteId && <div>链接：{inviteLabel.get(learner.inviteId) ?? "—"}</div>}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{STATUS_LABEL[learner.status]}</td>
                  <td style={{ padding: "0.5rem 0" }}>
                    {(["approved", "revoked", "pending"] as const)
                      .filter((s) => s !== learner.status)
                      .map((status) => (
                        <form key={status} method="post" action="/api/admin/learn" style={{ display: "inline" }}>
                          <input type="hidden" name="action" value="learner-status" />
                          <input type="hidden" name="id" value={learner.id} />
                          <input type="hidden" name="status" value={status} />
                          <button className={status === "approved" ? "btn btn--primary" : "btn btn--secondary"} type="submit">
                            {status === "approved" ? "通过" : status === "revoked" ? "关闭" : "改回待通过"}
                          </button>{" "}
                        </form>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Comments ── */}
      <section className="stack-4" id="comments" aria-labelledby="comments-title">
        <h2 className="h3" id="comments-title">
          最近留言
        </h2>
        {comments.length === 0 && <p className="body-sm">还没有留言。</p>}
        {comments.map((comment) => (
          <div key={comment.id} className="card stack-2" style={comment.hidden ? { opacity: 0.5 } : undefined}>
            <p className="body-sm">
              <strong>{comment.byAdmin ? "主理人" : comment.name || "（没留名字）"}</strong> · {comment.lessonTitle} ·{" "}
              {new Date(comment.createdAt).toLocaleString("zh-CN", { timeZone: "Australia/Sydney" })}
              {comment.hidden && " · 已隐藏"}
            </p>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{comment.body}</p>
            <form method="post" action="/api/admin/learn" style={{ display: "inline" }}>
              <input type="hidden" name="action" value={comment.hidden ? "comment-show" : "comment-hide"} />
              <input type="hidden" name="id" value={comment.id} />
              <button className="btn btn--secondary" type="submit">
                {comment.hidden ? "取消隐藏" : "隐藏"}
              </button>
            </form>
            {!comment.parentId && !comment.byAdmin && (
              <form method="post" action="/api/admin/learn" className="stack-2">
                <input type="hidden" name="action" value="reply" />
                <input type="hidden" name="lessonId" value={lessons.find((l) => l.slug === comment.lessonSlug)?.id ?? ""} />
                <input type="hidden" name="parent" value={comment.id} />
                <textarea className="field" name="body" placeholder="以主理人身份回复" maxLength={2000} required />
                <button className="btn btn--secondary" type="submit" style={{ alignSelf: "flex-start" }}>
                  回复
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
