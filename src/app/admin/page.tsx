import type { Metadata } from "next";
import { isAdmin } from "@/lib/admin-auth";
import { listSignups } from "@/lib/db";
import { isTurnstileConfigured } from "@/lib/turnstile";

// Always read live data, and keep this page out of any search index.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Signups · Vibe Thursday",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ key?: string }>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const key = (await searchParams).key;

  if (!isAdmin(key)) {
    return (
      <main className="shell section">
        <div className="card stack-3">
          <h1 className="h3">Not authorised</h1>
          <p className="body-sm">
            Open this page as <code>/admin?key=YOUR_ADMIN_TOKEN</code>.
          </p>
        </div>
      </main>
    );
  }

  const signups = await listSignups();

  const wantsToDemo = signups.filter((row) => row.demo_intent === "yes").length;
  const withWechat = signups.filter((row) => row.wechat).length;

  const stats = [
    { label: "Total", value: signups.length },
    { label: "Want to demo", value: wantsToDemo },
    { label: "With WeChat", value: withWechat },
  ];

  return (
    <main className="shell section stack-8">
      <div className="stack-4">
        <span className="eyebrow">Vibe Thursday · admin</span>
        <h1>Signups</h1>
      </div>

      <dl className="grid-auto" style={{ margin: 0 }}>
        {stats.map((stat) => (
          <div className="card stack-2" key={stat.label}>
            <dt className="eyebrow" style={{ color: "var(--fg3)" }}>
              {stat.label}
            </dt>
            <dd className="h3 hl" style={{ margin: 0 }}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* The signup route fails closed without Turnstile keys, so a dropped
          environment variable takes the form down. Surfacing the state here
          means that is something you can see rather than have to guess at. */}
      {isTurnstileConfigured() ? (
        <p className="alert">Bot protection: Turnstile active.</p>
      ) : (
        <p className="alert alert--error" role="alert">
          Bot protection: <strong>NOT configured</strong>. The signup form is currently rejecting
          every submission with a 503. Set NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.
        </p>
      )}

      <div>
        <a className="btn btn--secondary" href={`/api/admin/export?key=${encodeURIComponent(key!)}`}>
          Download CSV
        </a>
      </div>

      {signups.length === 0 ? (
        <p className="alert">No signups yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">WeChat</th>
                <th scope="col">Demo</th>
                <th scope="col">Session</th>
                <th scope="col">Building</th>
                <th scope="col">Source</th>
                <th scope="col">Lang</th>
                <th scope="col">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {signups.map((row) => (
                <tr key={row.id}>
                  <td style={{ color: "var(--fg1)" }}>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.wechat ?? "—"}</td>
                  <td>{row.demo_intent ?? "—"}</td>
                  <td className="mono">{row.first_session ?? "—"}</td>
                  {/* The only free-text column, so it is the only one allowed
                      to wrap rather than widen the table indefinitely. */}
                  <td style={{ whiteSpace: "normal", minWidth: "280px" }}>{row.building ?? "—"}</td>
                  <td>{row.source ?? "—"}</td>
                  <td>{row.lang ?? "—"}</td>
                  <td className="mono">{row.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
