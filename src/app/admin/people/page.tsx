import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminSession } from "@/lib/admin-auth";
import { getCopy } from "@/lib/content";
import { countUntaggedAttendees, listProfiledPeople } from "@/lib/db";
import {
  PERSON_LEVELS,
  PERSON_LEVEL_LABEL,
  PERSON_ROLES,
  PERSON_ROLE_LABEL,
  countValues,
  matchesFilter,
  type PeopleFilter,
} from "@/lib/person-profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "所有人 · 后台", robots: { index: false } };

type PageProps = { searchParams: Promise<PeopleFilter> };

const FILTER_KEYS = ["role", "level", "industry", "tag", "resource", "q"] as const;

/**
 * Everyone tagged so far, filterable by any one of the tagged dimensions
 * (2026-10-13). Every filter is a link, so a filtered view can be bookmarked,
 * and the count beside each value is over everyone, not the current filter.
 */
export default async function PeoplePage({ searchParams }: PageProps) {
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

  const params = await searchParams;
  const filter: PeopleFilter = Object.fromEntries(
    FILTER_KEYS.map((key) => [key, typeof params[key] === "string" ? params[key]!.slice(0, 60) : undefined]),
  );
  const [everyone, backlog] = await Promise.all([listProfiledPeople(), countUntaggedAttendees()]);
  const people = everyone.filter((person) => matchesFilter(person, filter));

  const industries = getCopy("zh").signup.fields.industryOptions;
  const industryLabel = (value: string | null) => industries.find((option) => option.value === value)?.label ?? value ?? "";

  /** A link that sets (or, when already set, clears) one filter and keeps the rest. */
  const href = (key: (typeof FILTER_KEYS)[number], value: string) => {
    const query = new URLSearchParams();
    for (const k of FILTER_KEYS) if (filter[k] && k !== key) query.set(k, filter[k]!);
    if (filter[key] !== value) query.set(key, value);
    const text = query.toString();
    return text ? `/admin/people?${text}` : "/admin/people";
  };
  const exportQuery = new URLSearchParams({ format: "csv" });
  for (const k of FILTER_KEYS) if (filter[k]) exportQuery.set(k, filter[k]!);

  const roleCounts = countValues(everyone.map((person) => person.roles));
  const levelCounts = countValues(everyone.map((person) => (person.level ? [String(person.level)] : [])));
  const industryCounts = countValues(everyone.map((person) => (person.industry ? [person.industry] : [])));
  const tagCounts = countValues(everyone.map((person) => person.tags));
  const resourceCounts = countValues(everyone.map((person) => person.resources));
  const count = (list: { value: string; count: number }[], value: string) =>
    list.find((item) => item.value.toLowerCase() === value.toLowerCase())?.count ?? 0;

  const filtering = FILTER_KEYS.some((key) => filter[key]);

  const Chip = ({ k, value, label, n }: { k: (typeof FILTER_KEYS)[number]; value: string; label: string; n: number }) => (
    <Link className={filter[k] === value ? "chip chip--link chip--on" : "chip chip--link"} href={href(k, value)}>
      {label}
      <span className="tagger-muted"> {n}</span>
    </Link>
  );

  return (
    <main className="shell section stack-6 tagger">
      <div className="stack-3">
        <div className="tagger-top">
          <span className="eyebrow">后台 · 所有人</span>
          <span className="tagger-top__links">
            <Link href="/admin/tag">去标注 →</Link>
            <Link href="/admin">回后台</Link>
          </span>
        </div>
        <h1 className="h2">
          标过的 {everyone.length} 人{filtering ? ` · 筛出 ${people.length} 人` : ""}
        </h1>
        {backlog > 0 && (
          <p className="body-sm tagger-muted">
            另有 {backlog} 个签到过的人还没标，<Link href="/admin/tag">去标注</Link>。
          </p>
        )}
      </div>

      <form className="wall-search" action="/admin/people">
        {FILTER_KEYS.filter((key) => key !== "q" && filter[key]).map((key) => (
          <input key={key} type="hidden" name={key} value={filter[key]} />
        ))}
        <input className="field" type="search" name="q" defaultValue={filter.q ?? ""} placeholder="搜名字、微信、标签、备注" />
        <button className="btn btn--secondary" type="submit">
          搜
        </button>
      </form>

      <div className="tagger-facets">
        <Facet label="角色">
          {PERSON_ROLES.map((role) => (
            <Chip key={role} k="role" value={role} label={PERSON_ROLE_LABEL[role]} n={count(roleCounts, role)} />
          ))}
        </Facet>
        <Facet label="水平">
          {PERSON_LEVELS.map((level) => (
            <Chip key={level} k="level" value={String(level)} label={`${level} ${PERSON_LEVEL_LABEL[level]}`} n={count(levelCounts, String(level))} />
          ))}
        </Facet>
        <Facet label="行业">
          {industryCounts.map((item) => (
            <Chip key={item.value} k="industry" value={item.value} label={industryLabel(item.value)} n={item.count} />
          ))}
        </Facet>
        {tagCounts.length > 0 && (
          <Facet label="专业 / 能力">
            {tagCounts.map((item) => (
              <Chip key={item.value} k="tag" value={item.value} label={item.value} n={item.count} />
            ))}
          </Facet>
        )}
        {resourceCounts.length > 0 && (
          <Facet label="资源">
            {resourceCounts.map((item) => (
              <Chip key={item.value} k="resource" value={item.value} label={item.value} n={item.count} />
            ))}
          </Facet>
        )}
      </div>

      <div className="tagger-top">
        {filtering ? <Link href="/admin/people">清除筛选</Link> : <span />}
        <a href={`/api/admin/profile?${exportQuery.toString()}`}>导出 CSV{filtering ? "（当前筛选）" : ""}</a>
      </div>

      {people.length === 0 ? (
        <p className="body-sm tagger-muted">{everyone.length === 0 ? "还没有标过任何人。" : "没有人符合这些筛选。"}</p>
      ) : (
        <div className="table-scroll">
          <table className="table tagger-table">
            <thead>
              <tr>
                <th scope="col">名字</th>
                <th scope="col">角色</th>
                <th scope="col">水平</th>
                <th scope="col">行业</th>
                <th scope="col">专业 / 能力</th>
                <th scope="col">资源</th>
                <th scope="col">来过</th>
                <th scope="col">备注</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const last = person.attended.at(-1);
                return (
                  <tr key={person.id}>
                    <td>
                      <div>{person.name}</div>
                      {person.wechat && <div className="mono tagger-muted">{person.wechat}</div>}
                    </td>
                    <td>{person.roles.map((role) => PERSON_ROLE_LABEL[role]).join("、")}</td>
                    <td>{person.level ? `${person.level} ${PERSON_LEVEL_LABEL[person.level]}` : ""}</td>
                    <td>{industryLabel(person.industry)}</td>
                    <td>{person.tags.join("、")}</td>
                    <td>{person.resources.join("、")}</td>
                    <td>
                      {person.attended.length} 次
                      {last && (
                        <div>
                          <Link className="tagger-muted" href={`/admin/tag?s=${last}#p-${person.id}`}>
                            最近 {last.slice(5)}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="tagger-table__note">
                      {person.session_notes.map((item) => (
                        <div key={item.session}>
                          <span className="tagger-muted">{item.session.slice(5)}</span> {item.note}
                        </div>
                      ))}
                      {person.note && <div>{person.note}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="tagger-facet">
      <div className="tagger-field__label">{label}</div>
      <div className="filters">{children}</div>
    </div>
  );
}
