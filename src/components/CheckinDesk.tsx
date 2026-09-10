import type { RosterEntry } from "@/lib/checkin";
import type { CheckinRow } from "@/lib/db";

type Props = {
  adminKey: string;
  /** The session the desk is set up for. */
  session: string;
  /** Whether that session is today in Sydney — the only day the code works. */
  isToday: boolean;
  /** The check-in link, with the code. */
  url: string;
  /** The same link as an SVG QR, drawn on the server. */
  qrSvg: string;
  roster: RosterEntry[];
  checkins: CheckinRow[];
};

/**
 * The organiser's side of check-in: the code for the table, the live count,
 * who has tapped, and a tick for anyone who did not.
 *
 * Contact details are shown here and nowhere else on the feature: two people
 * with the same name are told apart by WeChat ID on this screen, and by a
 * few words about their work on the room's.
 */
export function CheckinDesk({ adminKey, session, isToday, url, qrSvg, roster, checkins }: Props) {
  const pending = roster.filter((entry) => !entry.checkedIn);

  return (
    <section className="stack-6" id="checkin">
      <div className="group-head">
        <h2 className="h3">签到 · {session}</h2>
        <span className="body-sm" style={{ color: "var(--fg3)" }}>
          已到 {checkins.length} · 报名 {roster.length}
          {isToday ? "" : " · 这个码只在当天生效"}
        </span>
      </div>

      <div className="card stack-4">
        <div className="deck-build__join" style={{ alignItems: "flex-start" }}>
          {/* The SVG is built by this app from a URL this app composed;
              nothing in it came from a request. */}
          <div
            className="checkin-qr"
            aria-label={`签到二维码 ${url}`}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="stack-2">
            <p className="body-sm">
              <strong>投屏或放桌上让大家扫。</strong> 打开是今天的名单，点自己名字就签到了；没报名的填三格。
            </p>
            <p className="body-sm">
              <a className="mono hl" href={url}>
                {url}
              </a>
            </p>
            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              码由日期算出来，每周四自动换；不用生成、不用记。到场页在{" "}
              <a className="mono" href={`/sessions/${session}`}>
                /sessions/{session}
              </a>
              。
            </p>
          </div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Name</th>
              <th scope="col">WeChat</th>
              <th scope="col">On wall</th>
              <th scope="col">Via</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {checkins.length === 0 && (
              <tr>
                <td colSpan={6} className="body-sm" style={{ color: "var(--fg3)" }}>
                  还没有人签到。
                </td>
              </tr>
            )}
            {checkins.map((row) => (
              <tr key={row.signup_id}>
                <td className="mono">{row.created_at}</td>
                <td>{row.name}</td>
                <td className="mono">{row.wechat ?? "—"}</td>
                <td className="mono">{row.on_wall ? "yes" : "no"}</td>
                <td className="mono">{row.source}</td>
                <td>
                  <form method="post" action="/api/admin/checkin">
                    <input type="hidden" name="key" value={adminKey} />
                    <input type="hidden" name="session" value={session} />
                    <input type="hidden" name="signupId" value={row.signup_id} />
                    <input type="hidden" name="action" value="undo" />
                    <button className="linkish" type="submit">
                      撤销
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending.length > 0 && (
        <details className="fold">
          <summary>报了名还没签到的 {pending.length} 人 — 手动签到</summary>
          <div className="table-scroll">
            <table className="table">
              <tbody>
                {pending.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {entry.name}
                      {entry.hint && (
                        <span className="body-sm" style={{ color: "var(--fg3)" }}>
                          {" "}
                          · {entry.hint}
                        </span>
                      )}
                    </td>
                    <td>
                      {/* Ticks the headcount only. "On wall" stays no: that
                          answer belongs to the person, and they can still
                          scan the code and give it themselves. */}
                      <form method="post" action="/api/admin/checkin">
                        <input type="hidden" name="key" value={adminKey} />
                        <input type="hidden" name="session" value={session} />
                        <input type="hidden" name="signupId" value={entry.id} />
                        <input type="hidden" name="action" value="checkin" />
                        <button className="linkish" type="submit">
                          签到（不上墙）
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
