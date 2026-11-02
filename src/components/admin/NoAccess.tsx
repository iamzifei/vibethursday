/**
 * What a team page shows to someone without the permission for it
 * (2026-11-02). Says what to do, not just "no".
 */
export function NoAccess() {
  return (
    <main className="shell section">
      <div className="card stack-3">
        <h1 className="h3" style={{ margin: 0 }}>这一页你还打不开</h1>
        <p className="body-sm" style={{ margin: 0 }}>
          助理：在微信里点开主办人私发的专属登录链接，以后打开 vibethursday.com/staff 就能进。
        </p>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>已经登录了还看到这句：这一页只有管理员能用。</p>
      </div>
    </main>
  );
}
