import type { FeedbackRecord } from "@/lib/db";
import type { FeedbackSummary } from "@/lib/feedback";

/** One row of the cross-session table: a summary plus that day's headcount. */
export type FeedbackRow = FeedbackSummary & {
  /** From `checkins`. Null for sessions that ran before check-in existed. */
  attended: number | null;
};

type Props = {
  /** The session the current code belongs to — the one just gone. */
  session: string;
  /** Whether that session's window is still open. */
  isOpen: boolean;
  /** The feedback link, with the code. */
  url: string;
  /** The same link as an SVG QR, drawn on the server. */
  qrSvg: string;
  /** Every session that has any feedback, newest first. */
  summary: FeedbackRow[];
  /** Which session the answers below belong to. */
  showing: string;
  /** The answers for `showing`, newest first. */
  answers: FeedbackRecord[];
};

/** "4.5" or "—". A missing average is not a zero. */
function show(value: number | null): string {
  return value === null ? "—" : String(value);
}

/**
 * The organiser's side of feedback: the code to hand out, what every session
 * scored, and what one session actually said.
 *
 * ★ The headcount sits next to the response count on purpose. "4.6 out of 5"
 * from three people in a room of fourteen is a different fact from the same
 * number out of twelve, and a table that shows only the score invites the
 * second reading of the first situation. Every figure here is printed with
 * what it is out of.
 */
export function FeedbackDesk({ session, isOpen, url, qrSvg, summary, showing, answers }: Props) {
  const total = summary.reduce((sum, row) => sum + row.count, 0);
  const here = summary.find((row) => row.session === showing);

  return (
    <section className="stack-6" id="feedback">
      <div className="group-head">
        <h2 className="h3">反馈 · {session}</h2>
        <span className="body-sm" style={{ color: "var(--fg3)" }}>
          共 {total} 份{isOpen ? "" : " · 这一场的窗口已经关了"}
        </span>
      </div>

      <div className="card stack-4">
        <div className="deck-build__join" style={{ alignItems: "flex-start" }}>
          {/* Built by this app from a URL this app composed; nothing in it
              came from a request. */}
          <div
            className="checkin-qr"
            aria-label={`反馈二维码 ${url}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="stack-2">
            <p className="body-sm">
              <strong>散场前投屏，或者把链接贴进群。</strong> 五格，都能跳过，匿名的。
            </p>
            <p className="body-sm">
              <a className="mono hl" href={url}>
                {url}
              </a>
            </p>
            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              码由日期算出来，每场自动换，不用生成。<strong>只收一周</strong>，到下一个周四为止
              —— 这样一份反馈永远只属于一场。
            </p>
          </div>
        </div>
      </div>

      {summary.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--fg3)" }}>
          还没有人交过。第一场收上来之后，这里会按场次排出来。
        </p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">到场</th>
                <th scope="col">反馈</th>
                <th scope="col">平均分</th>
                <th scope="col">会带朋友</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.session}>
                  <td className="mono" style={{ color: row.session === showing ? "var(--fg1)" : undefined }}>
                    {row.session}
                    {row.session === showing ? " ←" : ""}
                  </td>
                  <td className="mono">{row.attended ?? "—"}</td>
                  {/* Out of the room, not out of nothing: this is the number
                      that says whether the score below it means anything. */}
                  <td className="mono">
                    {row.count}
                    {row.attended ? ` / ${row.attended}` : ""}
                  </td>
                  <td className="mono">
                    {show(row.average)}
                    {row.rated > 0 && row.rated !== row.count ? ` (${row.rated})` : ""}
                  </td>
                  <td className="mono">
                    {row.asked > 0 ? `${row.yes} / ${row.asked}` : "—"}
                  </td>
                  <td>
                    <a className="mono" href={`/admin?fb=${row.session}#feedback`}>
                      看这一场 →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="stack-4">
        <div className="group-head">
          <h3 className="h4">{showing} 说了什么</h3>
          <span className="body-sm" style={{ color: "var(--fg3)" }}>
            {here ? `${here.count} 份 · 平均 ${show(here.average)}` : "这一场还没有"}
            {" · "}
            <a className="mono" href="/api/admin/export?what=feedback">
              CSV
            </a>
          </span>
        </div>

        {answers.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>
            这一场还没有人交。
          </p>
        ) : (
          <ul className="stack-3" style={{ listStyle: "none", padding: 0 }}>
            {answers.map((answer) => (
              <li key={answer.id} className="card stack-2">
                <p className="body-sm mono" style={{ color: "var(--fg3)" }}>
                  {answer.created_at}
                  {answer.rating !== null ? ` · ${answer.rating}/5` : ""}
                  {answer.recommend ? ` · 带朋友：${answer.recommend}` : ""}
                  {answer.name ? ` · ${answer.name}` : " · 匿名"}
                  {answer.wechat ? ` · 微信 ${answer.wechat}` : ""}
                </p>
                {answer.best && (
                  <p className="body-sm">
                    <strong>最有用：</strong>
                    {answer.best}
                  </p>
                )}
                {answer.better && (
                  <p className="body-sm">
                    <strong>可以更好：</strong>
                    {answer.better}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
