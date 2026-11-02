/**
 * The 共创会员 offer where Build Tuesday is sold (2026-11-02): the Tuesday
 * page, its payment page and the signup confirmation. Tuesday is where the
 * membership is offered; Thursday never shows it. A literal path: this also
 * renders in the signup form, a client component that cannot import course.ts.
 */
export function MemberUpsell({ copy }: { copy: { title: string; body: string; cta: string } }) {
  return (
    <aside className="card stack-2" aria-label={copy.title}>
      <strong>{copy.title}</strong>
      <p className="body" style={{ margin: 0 }}>{copy.body}</p>
      <a className="body" href="/join">{copy.cta} →</a>
    </aside>
  );
}
