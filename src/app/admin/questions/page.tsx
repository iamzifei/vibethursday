import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { getSessionQuestions } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatQuestionList } from "@/lib/session-questions";
import { deskSession, formatSession } from "@/lib/sessions";
import { staffRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "本周问答 · VT 后台", robots: { index: false, follow: false } };

/**
 * The week's questions (2026-11-02, moved out of /admin so an assistant can
 * keep them up to date). The shortlist the group voted on, pasted here; /go
 * shows the candidates before the morning and the chosen two on the day.
 */
export default async function QuestionsPage() {
  const role = await staffRole();
  if (!can(role, "questions")) return <NoAccess />;

  const session = deskSession();
  const questions = await getSessionQuestions(session);

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>本周问答</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          {formatSession(session, "zh")} · 场前在 /go 显示候选，当天显示今天聊的
        </p>
      </div>

      <form method="post" action="/api/admin/questions" className="stack-3">
        <input type="hidden" name="session" value={session} />
        <textarea className="field" name="questions" rows={8} defaultValue={formatQuestionList(questions)} placeholder={"一行一个问题；票最多的两个在行首加 *"} />
        <p className="field-hint">一行一个问题，行首加 * 表示当天要聊的。序号会自动去掉，最多 8 个。清空后保存就是删除。</p>
        <div>
          <button className="btn btn--primary" type="submit">保存</button>
        </div>
      </form>
    </main>
  );
}
