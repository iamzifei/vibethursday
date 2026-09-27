import type { OrderRecord } from "@/lib/db";
import { formatPrice } from "@/lib/menu";
import type { BarSheet } from "@/lib/order";

type Props = {
  /** The session the link and the sheet belong to. */
  session: string;
  /** Whether that session still takes orders. */
  isOpen: boolean;
  /** The order link, with the code. */
  url: string;
  /** The same link as an SVG QR, drawn on the server. */
  qrSvg: string;
  /** Every order for `session`, in the order they came in. */
  orders: OrderRecord[];
  /** The sheet for the bar, built from the same rows. */
  sheet: BarSheet;
};

/**
 * The organiser's side of drink pre-orders: the link to post in the group,
 * the sheet to hand to the café, and every line with a way to remove it.
 *
 * ★ The sheet is plain text in a <pre>, twice: grouped by drink for whoever
 * makes the coffee, and alphabetical by name for whoever takes the money —
 * which is also the list they read from when somebody has forgotten what they
 * ordered. Select, copy, paste into the chat with the café.
 */
export function OrderDesk({ session, isOpen, url, qrSvg, orders, sheet }: Props) {
  const text = [
    `Vibe Thursday — drinks for ${session}`,
    `${sheet.cups} drinks, ${formatPrice(sheet.cents)} at menu prices`,
    "",
    "BY DRINK",
    ...sheet.byDrink,
    "",
    "BY NAME (for taking payment)",
    ...sheet.byName,
  ].join("\n");

  return (
    <section className="stack-6" id="orders">
      <div className="group-head">
        <h2 className="h3">点单 · {session}</h2>
        <span className="body-sm" style={{ color: "var(--fg3)" }}>
          {sheet.cups} 杯 · 菜单价合计 {formatPrice(sheet.cents)}
          {isOpen ? "" : " · 这一场的点单已经关了"}
        </span>
      </div>

      <div className="card stack-4">
        <div className="deck-build__join" style={{ alignItems: "flex-start" }}>
          {/* Built by this app from a URL this app composed; nothing in it
              came from a request. */}
          <div className="checkin-qr" aria-label={`点单二维码 ${url}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="stack-2">
            <p className="body-sm">
              <strong>贴进群里，或者直接发 vibethursday.com/go。</strong> 只点饮料，价格照店里菜单，到了各自报名字付钱。
            </p>
            <p className="body-sm">
              <a className="mono hl" href={url}>
                {url}
              </a>
            </p>
            <p className="body-sm" style={{ color: "var(--fg3)" }}>
              场次前 7 天开，开到当天结束。同一台手机再点一次是改单，不会多一行。
            </p>
          </div>
        </div>
      </div>

      <div className="stack-2">
        <p className="body-sm">
          <strong>给吧台的单子</strong>（全选复制，发给店里）
        </p>
        <pre className="card body-sm" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {text}
        </pre>
      </div>

      {orders.length === 0 ? (
        <p className="body-sm" style={{ color: "var(--fg3)" }}>
          还没有人点。
        </p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>名字</th>
                <th>饮品</th>
                <th>价格</th>
                <th>备注</th>
                <th>微信</th>
                <th>时间</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.name}</td>
                  <td>{order.label}</td>
                  <td>{formatPrice(order.cents)}</td>
                  <td>{order.note ?? ""}</td>
                  <td className="mono">{order.wechat ?? ""}</td>
                  <td className="mono">{order.updated_at.slice(5)}</td>
                  <td>
                    <form method="post" action="/api/admin/order">
                      <input type="hidden" name="id" value={order.id} />
                      <button className="linkish" type="submit">
                        删除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
