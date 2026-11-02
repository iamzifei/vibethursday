import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { listPhotosForReview } from "@/lib/db";
import { can } from "@/lib/permissions";
import { staffRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "照片审核 · VT 后台", robots: { index: false, follow: false } };

/**
 * Uploaded session photos (2026-11-02, moved out of /admin so an assistant
 * can review them). Nothing is public until approved. Phone first: one photo
 * per card, big enough to see who is in it, with the actions under it.
 */
export default async function PhotosPage() {
  const role = await staffRole();
  if (!can(role, "photos")) return <NoAccess />;

  const photos = await listPhotosForReview();
  const pending = photos.filter((photo) => photo.status === "pending");
  const approved = photos.filter((photo) => photo.status === "approved");

  const Card = ({ photo }: { photo: (typeof photos)[number] }) => (
    <li className="card stack-3 photo-review">
      <a href={`/api/session-photo/${photo.id}`} target="_blank" rel="noopener">
        {/* eslint-disable-next-line @next/next/no-img-element -- served by our own route, private until approved */}
        <img src={`/api/session-photo/${photo.id}`} alt={`照片 #${photo.id}`} width={photo.width} height={photo.height} loading="lazy" />
      </a>
      <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
        #{photo.id} · <a href={`/sessions/${photo.session}#photos`}>{photo.session}</a> · {photo.status === "pending" ? "待审" : "已公开"}
      </p>
      <div className="photo-review__actions">
        {(photo.status === "pending" ? (["approve", "reject", "delete"] as const) : (["reject", "delete"] as const)).map((action) => (
          <form key={action} method="post" action="/api/admin/photos">
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="id" value={photo.id} />
            <button className={`btn btn--sm ${action === "approve" ? "btn--primary" : "btn--secondary"}`} type="submit">
              {action === "approve" ? "通过" : action === "reject" ? (photo.status === "approved" ? "撤下" : "拒绝") : "删除"}
            </button>
          </form>
        ))}
      </div>
    </li>
  );

  return (
    <main className="shell section stack-6">
      <div className="stack-2">
        <h1 className="h2" style={{ margin: 0 }}>照片审核</h1>
        <p className="body-sm" style={{ margin: 0, color: "var(--fg3)" }}>
          通过之前看一眼：照片里认得出来的人，是不是都同意上网。拒绝会删掉图片；删除连记录一起删。
        </p>
      </div>

      <section className="stack-3">
        <h2 className="h3" style={{ margin: 0 }}>待审 · {pending.length}</h2>
        {pending.length > 1 && (
          <form method="post" action="/api/admin/photos">
            <input type="hidden" name="action" value="reject-all-pending" />
            <button className="btn btn--secondary btn--sm" type="submit">全部待审一键拒绝（被刷屏时用）</button>
          </form>
        )}
        {pending.length === 0 ? (
          <p className="body-sm" style={{ color: "var(--fg3)" }}>没有待审的照片。</p>
        ) : (
          <ul className="photo-review-list">{pending.map((photo) => <Card key={photo.id} photo={photo} />)}</ul>
        )}
      </section>

      <details className="disclosure">
        <summary className="h3" style={{ fontSize: "var(--text-lg)" }}>已公开 · {approved.length}</summary>
        <ul className="photo-review-list faq-answer">{approved.map((photo) => <Card key={photo.id} photo={photo} />)}</ul>
      </details>
    </main>
  );
}
